import { Router, Response } from 'express';
import { and, count, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { players, games } from '../db/schema.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { idSchema, paginated, paginationSchema } from '../middleware/validate.js';
import { audit } from '../services/activity.js';
import { cleanText } from '../utils/sanitize.js';

const router = Router();
router.use(authenticate);

/**
 * Column allow-list. `passwordHash` is deliberately absent: account passwords
 * are never selected, serialised or logged by the admin API.
 */
const playerColumns = {
  id: players.id,
  email: players.email,
  displayName: players.displayName,
  country: players.country,
  role: players.role,
  status: players.status,
  emailVerified: players.emailVerified,
  wishlist: players.wishlist,
  lastSeenAt: players.lastSeenAt,
  createdAt: players.createdAt,
  updatedAt: players.updatedAt,
};

const updateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(60).optional(),
    country: z.string().trim().max(80).optional().nullable(),
    role: z.enum(['PLAYER', 'PRESS', 'MODERATOR']).optional(),
    status: z.enum(['ACTIVE', 'DISABLED', 'BANNED']).optional(),
    emailVerified: z.boolean().optional(),
  })
  .strict();

/** GET /api/admin/players */
router.get(
  '/',
  requirePermission('players:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = paginationSchema
      .extend({
        status: z.enum(['ACTIVE', 'DISABLED', 'BANNED', 'ALL']).default('ALL'),
        role: z.enum(['PLAYER', 'PRESS', 'MODERATOR', 'ALL']).default('ALL'),
      })
      .parse(req.query);

    const conditions = [
      query.search
        ? or(
            sql`${players.email} ilike ${`%${query.search}%`}`,
            sql`${players.displayName} ilike ${`%${query.search}%`}`,
            sql`${players.country} ilike ${`%${query.search}%`}`
          )
        : undefined,
      query.status === 'ALL' ? undefined : eq(players.status, query.status),
      query.role === 'ALL' ? undefined : eq(players.role, query.role),
    ].filter(Boolean);

    const where = conditions.length ? and(...(conditions as never[])) : undefined;

    const [items, totals, active, verified] = await Promise.all([
      db
        .select(playerColumns)
        .from(players)
        .where(where)
        .orderBy(desc(players.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db.select({ value: count() }).from(players).where(where),
      db.select({ value: count() }).from(players).where(eq(players.status, 'ACTIVE')),
      db.select({ value: count() }).from(players).where(eq(players.emailVerified, true)),
    ]);

    res.json({
      ...paginated(items, totals[0]?.value ?? 0, query.page, query.limit),
      counts: { active: active[0]?.value ?? 0, verified: verified[0]?.value ?? 0 },
    });
  })
);

/** GET /api/admin/players/:id */
router.get(
  '/:id',
  requirePermission('players:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const [player] = await db.select(playerColumns).from(players).where(eq(players.id, id)).limit(1);
    if (!player) throw new AppError(404, 'That player account no longer exists.', 'not_found');

    const wishlist = player.wishlist.length
      ? await db
          .select({ id: games.id, title: games.title, slug: games.slug })
          .from(games)
          .where(inArray(games.id, player.wishlist))
      : [];

    res.json({ player: { ...player, wishlistGames: wishlist } });
  })
);

/** PATCH /api/admin/players/:id */
router.patch(
  '/:id',
  requirePermission('players:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const data = updateSchema.parse(req.body);

    const [existing] = await db.select({ id: players.id, displayName: players.displayName }).from(players).where(eq(players.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'That player account no longer exists.', 'not_found');

    await db
      .update(players)
      .set({
        ...(data.displayName !== undefined ? { displayName: cleanText(data.displayName, 60) } : {}),
        ...(data.country !== undefined ? { country: data.country ? cleanText(data.country, 80) : null } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.emailVerified !== undefined ? { emailVerified: data.emailVerified } : {}),
      })
      .where(eq(players.id, id));

    const [player] = await db.select(playerColumns).from(players).where(eq(players.id, id)).limit(1);

    audit(req)(data.status ? 'PLAYER_STATUS_CHANGED' : 'PLAYER_UPDATED', 'player', {
      entityId: id,
      summary: `Updated player ${player!.displayName}${data.status ? ` (${data.status})` : ''}`,
      metadata: { fields: Object.keys(data) },
    });

    res.json({ player });
  })
);

/** DELETE /api/admin/players/:id — requires typing the email to confirm. */
router.delete(
  '/:id',
  requirePermission('players:delete'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const { confirm } = z.object({ confirm: z.string().min(1).max(200) }).strict().parse(req.body);

    const [player] = await db
      .select({ id: players.id, email: players.email, displayName: players.displayName })
      .from(players)
      .where(eq(players.id, id))
      .limit(1);
    if (!player) throw new AppError(404, 'That player account no longer exists.', 'not_found');

    if (confirm.trim().toLowerCase() !== player.email.toLowerCase()) {
      throw new AppError(400, 'To confirm, type the player email exactly.', 'confirmation_required');
    }

    await db.delete(players).where(eq(players.id, id));

    audit(req)('PLAYER_DELETED', 'player', {
      entityId: id,
      summary: `Deleted player ${player.displayName}`,
      metadata: { email: player.email },
    });

    res.json({ ok: true });
  })
);

export default router;
