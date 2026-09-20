import { Router, Response } from 'express';
import { and, count, desc, eq, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { subscribers } from '../db/schema.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { emailSchema, idSchema, paginated, paginationSchema } from '../middleware/validate.js';
import { exportLimiter } from '../middleware/security.js';
import { audit } from '../services/activity.js';
import { cleanText } from '../utils/sanitize.js';

const router = Router();
router.use(authenticate);

const subscribePayload = z
  .object({
    email: emailSchema,
    name: z.string().trim().max(80).optional().nullable(),
    interests: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
    status: z.enum(['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED']).default('ACTIVE'),
    source: z.string().trim().max(40).default('admin'),
  })
  .strict();

/**
 * CSV export hardening:
 *  - prefix a UTF-8 BOM so Excel opens accented names correctly
 *  - neutralise formula injection (=, +, -, @) so a subscriber name can never
 *    become a formula when the file is opened in a spreadsheet app
 */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header])).join(','));
  return `\uFEFF${lines.join('\r\n')}`;
}

function buildFilters(query: { search?: string; status?: string }) {
  const conditions = [
    query.search
      ? or(
          sql`${subscribers.email} ilike ${`%${query.search}%`}`,
          sql`${subscribers.name} ilike ${`%${query.search}%`}`,
          sql`array_to_string(${subscribers.interests}, ' ') ilike ${`%${query.search}%`}`
        )
      : undefined,
    query.status && query.status !== 'ALL' ? eq(subscribers.status, query.status) : undefined,
  ].filter(Boolean);
  return conditions.length ? and(...(conditions as never[])) : undefined;
}

/** GET /api/admin/subscribers */
router.get(
  '/',
  requirePermission('subscribers:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = paginationSchema
      .extend({ status: z.enum(['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'ALL']).default('ALL') })
      .parse(req.query);

    const where = buildFilters(query);

    const [items, totals, active, unsubscribed, recent] = await Promise.all([
      db
        .select()
        .from(subscribers)
        .where(where)
        .orderBy(desc(subscribers.subscribedAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db.select({ value: count() }).from(subscribers).where(where),
      db.select({ value: count() }).from(subscribers).where(eq(subscribers.status, 'ACTIVE')),
      db.select({ value: count() }).from(subscribers).where(eq(subscribers.status, 'UNSUBSCRIBED')),
      db
        .select({ value: count() })
        .from(subscribers)
        .where(sql`${subscribers.subscribedAt} > now() - interval '30 days'`),
    ]);

    res.json({
      ...paginated(items, totals[0]?.value ?? 0, query.page, query.limit),
      counts: {
        active: active[0]?.value ?? 0,
        unsubscribed: unsubscribed[0]?.value ?? 0,
        last30Days: recent[0]?.value ?? 0,
      },
    });
  })
);

/** POST /api/admin/subscribers — manual add (e.g. a sign-up collected at an event). */
router.post(
  '/',
  requirePermission('subscribers:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = subscribePayload.parse(req.body);

    const [existing] = await db
      .select({ id: subscribers.id })
      .from(subscribers)
      .where(sql`lower(${subscribers.email}) = ${data.email}`)
      .limit(1);
    if (existing) throw new AppError(409, 'That email is already on the list.', 'duplicate');

    const [created] = await db
      .insert(subscribers)
      .values({
        email: data.email,
        name: data.name ? cleanText(data.name, 80) : null,
        interests: data.interests.map((interest) => cleanText(interest, 60)),
        status: data.status,
        source: cleanText(data.source, 40),
      })
      .returning();

    audit(req)('SUBSCRIBER_ADDED', 'subscriber', {
      entityId: created.id,
      summary: `Added ${created.email} to the drop list`,
    });

    res.status(201).json({ subscriber: created });
  })
);

/** PATCH /api/admin/subscribers/:id */
router.patch(
  '/:id',
  requirePermission('subscribers:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const data = z
      .object({
        name: z.string().trim().max(80).optional().nullable(),
        interests: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
        status: z.enum(['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED']).optional(),
      })
      .strict()
      .parse(req.body);

    const [existing] = await db.select().from(subscribers).where(eq(subscribers.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'That subscriber no longer exists.', 'not_found');

    const [updated] = await db
      .update(subscribers)
      .set({
        ...(data.name !== undefined ? { name: data.name ? cleanText(data.name, 80) : null } : {}),
        ...(data.interests !== undefined ? { interests: data.interests.map((interest) => cleanText(interest, 60)) } : {}),
        ...(data.status !== undefined
          ? { status: data.status, unsubscribedAt: data.status === 'ACTIVE' ? null : existing.unsubscribedAt ?? new Date() }
          : {}),
      })
      .where(eq(subscribers.id, id))
      .returning();

    audit(req)('SUBSCRIBER_UPDATED', 'subscriber', {
      entityId: id,
      summary: `Updated subscriber ${updated.email}`,
      metadata: { fields: Object.keys(data) },
    });

    res.json({ subscriber: updated });
  })
);

/** DELETE /api/admin/subscribers/:id */
router.delete(
  '/:id',
  requirePermission('subscribers:delete'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const [existing] = await db.select().from(subscribers).where(eq(subscribers.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'That subscriber no longer exists.', 'not_found');

    await db.delete(subscribers).where(eq(subscribers.id, id));

    audit(req)('SUBSCRIBER_DELETED', 'subscriber', {
      entityId: id,
      summary: `Removed subscriber ${existing.email}`,
    });

    res.json({ ok: true });
  })
);

/** GET /api/admin/subscribers/export.csv */
router.get(
  '/export.csv',
  requirePermission('subscribers:export'),
  exportLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = paginationSchema
      .extend({ status: z.enum(['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'ALL']).default('ALL') })
      .parse(req.query);

    const rows = await db
      .select()
      .from(subscribers)
      .where(buildFilters(query))
      .orderBy(desc(subscribers.subscribedAt))
      .limit(50_000);

    const headers = ['email', 'name', 'status', 'interests', 'source', 'subscribedAt'];
    const csv = toCsv(
      rows.map((row) => ({
        email: row.email,
        name: row.name ?? '',
        status: row.status,
        interests: row.interests.join(' | '),
        source: row.source ?? '',
        subscribedAt: row.subscribedAt.toISOString(),
      })),
      headers
    );

    audit(req)('SUBSCRIBERS_EXPORTED', 'subscriber', {
      summary: `Exported ${rows.length} subscribers (CSV)`,
      metadata: { format: 'csv', rows: rows.length, filter: query.status },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="brainchild-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  })
);

/** GET /api/admin/subscribers/export.json */
router.get(
  '/export.json',
  requirePermission('subscribers:export'),
  exportLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = paginationSchema
      .extend({ status: z.enum(['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'ALL']).default('ALL') })
      .parse(req.query);

    const rows = await db
      .select()
      .from(subscribers)
      .where(buildFilters(query))
      .orderBy(desc(subscribers.subscribedAt))
      .limit(50_000);

    audit(req)('SUBSCRIBERS_EXPORTED', 'subscriber', {
      summary: `Exported ${rows.length} subscribers (JSON)`,
      metadata: { format: 'json', rows: rows.length, filter: query.status },
    });

    res.setHeader('Content-Disposition', `attachment; filename="brainchild-subscribers-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({ exportedAt: new Date().toISOString(), count: rows.length, subscribers: rows });
  })
);

export default router;
