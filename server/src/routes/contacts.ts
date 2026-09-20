import { Router, Response } from 'express';
import { and, count, desc, eq, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { contactMessages } from '../db/schema.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { idSchema, paginated, paginationSchema } from '../middleware/validate.js';
import { audit } from '../services/activity.js';
import { cleanText } from '../utils/sanitize.js';

const router = Router();
router.use(authenticate);

const STATUSES = ['UNREAD', 'REVIEWED', 'REPLIED', 'ARCHIVED', 'SPAM'] as const;

/** GET /api/admin/contacts */
router.get(
  '/',
  requirePermission('contacts:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = paginationSchema
      .extend({ status: z.enum([...STATUSES, 'ALL']).default('ALL') })
      .parse(req.query);

    const conditions = [
      query.search
        ? or(
            sql`${contactMessages.name} ilike ${`%${query.search}%`}`,
            sql`${contactMessages.email} ilike ${`%${query.search}%`}`,
            sql`${contactMessages.subject} ilike ${`%${query.search}%`}`,
            sql`${contactMessages.company} ilike ${`%${query.search}%`}`
          )
        : undefined,
      query.status === 'ALL' ? undefined : eq(contactMessages.status, query.status),
    ].filter(Boolean);

    const where = conditions.length ? and(...(conditions as never[])) : undefined;

    const [items, totals, unread, byStatus] = await Promise.all([
      db
        .select()
        .from(contactMessages)
        .where(where)
        .orderBy(desc(contactMessages.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db.select({ value: count() }).from(contactMessages).where(where),
      db.select({ value: count() }).from(contactMessages).where(eq(contactMessages.status, 'UNREAD')),
      db
        .select({ status: contactMessages.status, value: count() })
        .from(contactMessages)
        .groupBy(contactMessages.status),
    ]);

    res.json({
      ...paginated(items, totals[0]?.value ?? 0, query.page, query.limit),
      counts: {
        unread: unread[0]?.value ?? 0,
        byStatus: Object.fromEntries(byStatus.map((row) => [row.status, Number(row.value)])),
      },
    });
  })
);

/** GET /api/admin/contacts/:id */
router.get(
  '/:id',
  requirePermission('contacts:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const [message] = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1);
    if (!message) throw new AppError(404, 'That message no longer exists.', 'not_found');
    res.json({ message });
  })
);

/** PATCH /api/admin/contacts/:id — status and internal notes only. */
router.patch(
  '/:id',
  requirePermission('contacts:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const data = z
      .object({
        status: z.enum(STATUSES).optional(),
        notes: z.string().trim().max(2000).optional().nullable(),
      })
      .strict()
      .parse(req.body);

    const [existing] = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'That message no longer exists.', 'not_found');

    const [updated] = await db
      .update(contactMessages)
      .set({
        ...(data.status !== undefined
          ? {
              status: data.status,
              handledAt:
                data.status === 'UNREAD' ? null : existing.handledAt ?? new Date(),
              handledById: data.status === 'UNREAD' ? null : req.admin!.id,
            }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes ? cleanText(data.notes, 2000) : null } : {}),
      })
      .where(eq(contactMessages.id, id))
      .returning();

    audit(req)('CONTACT_UPDATED', 'contact', {
      entityId: id,
      summary: `Marked message from ${updated.name} as ${updated.status}`,
      metadata: { fields: Object.keys(data) },
    });

    res.json({ message: updated });
  })
);

/** DELETE /api/admin/contacts/:id */
router.delete(
  '/:id',
  requirePermission('contacts:delete'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const [message] = await db
      .select({ id: contactMessages.id, name: contactMessages.name, subject: contactMessages.subject })
      .from(contactMessages)
      .where(eq(contactMessages.id, id))
      .limit(1);
    if (!message) throw new AppError(404, 'That message no longer exists.', 'not_found');

    await db.delete(contactMessages).where(eq(contactMessages.id, id));

    audit(req)('CONTACT_DELETED', 'contact', {
      entityId: id,
      summary: `Deleted message “${message.subject}”`,
    });

    res.json({ ok: true });
  })
);

export default router;
