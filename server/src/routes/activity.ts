import { Router, Response } from 'express';
import { and, count, desc, eq, gte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { adminActivity } from '../db/schema.js';
import { asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { paginated, paginationSchema } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

/** GET /api/admin/activity — the audit trail (append-only; no write endpoints). */
router.get(
  '/',
  requirePermission('activity:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = paginationSchema
      .extend({
        action: z.string().trim().max(60).optional(),
        entityType: z.string().trim().max(40).optional(),
        days: z.coerce.number().int().min(1).max(365).optional(),
      })
      .parse(req.query);

    const conditions = [
      query.search
        ? or(
            sql`${adminActivity.summary} ilike ${`%${query.search}%`}`,
            sql`${adminActivity.actorEmail} ilike ${`%${query.search}%`}`,
            sql`${adminActivity.entityType} ilike ${`%${query.search}%`}`
          )
        : undefined,
      query.action ? eq(adminActivity.action, query.action) : undefined,
      query.entityType ? eq(adminActivity.entityType, query.entityType) : undefined,
      query.days ? gte(adminActivity.createdAt, new Date(Date.now() - query.days * 86_400_000)) : undefined,
    ].filter(Boolean);

    const where = conditions.length ? and(...(conditions as never[])) : undefined;

    const [items, totals, actions, entities] = await Promise.all([
      db
        .select()
        .from(adminActivity)
        .where(where)
        .orderBy(desc(adminActivity.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db.select({ value: count() }).from(adminActivity).where(where),
      db
        .select({ action: adminActivity.action, value: count() })
        .from(adminActivity)
        .groupBy(adminActivity.action)
        .orderBy(desc(count()))
        .limit(40),
      db.select({ entityType: adminActivity.entityType }).from(adminActivity).groupBy(adminActivity.entityType),
    ]);

    res.json({
      ...paginated(items, totals[0]?.value ?? 0, query.page, query.limit),
      filters: {
        actions: actions.map((row) => ({ action: row.action, count: Number(row.value) })),
        entityTypes: entities.map((row) => row.entityType).sort(),
      },
    });
  })
);

/** GET /api/admin/activity/stats — 14-day activity sparkline + top actors. */
router.get(
  '/stats',
  requirePermission('activity:read'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const [daily, actors, actionTotals] = await Promise.all([
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${adminActivity.createdAt}), 'YYYY-MM-DD')`,
          value: count(),
        })
        .from(adminActivity)
        .where(gte(adminActivity.createdAt, sql`now() - interval '14 days'`))
        .groupBy(sql`date_trunc('day', ${adminActivity.createdAt})`)
        .orderBy(sql`date_trunc('day', ${adminActivity.createdAt})`),
      db
        .select({ actorEmail: adminActivity.actorEmail, value: count() })
        .from(adminActivity)
        .where(gte(adminActivity.createdAt, sql`now() - interval '30 days'`))
        .groupBy(adminActivity.actorEmail)
        .orderBy(desc(count()))
        .limit(6),
      db
        .select({ action: adminActivity.action, value: count() })
        .from(adminActivity)
        .where(gte(adminActivity.createdAt, sql`now() - interval '30 days'`))
        .groupBy(adminActivity.action)
        .orderBy(desc(count()))
        .limit(12),
    ]);

    res.json({
      daily: daily.map((row) => ({ day: row.day, count: Number(row.value) })),
      topActors: actors.map((row) => ({ email: row.actorEmail ?? 'system', count: Number(row.value) })),
      topActions: actionTotals.map((row) => ({ action: row.action, count: Number(row.value) })),
    });
  })
);

export default router;
