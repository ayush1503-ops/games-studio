import { Router, Response } from 'express';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { adminSessions, adminUsers } from '../db/schema.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { emailSchema, idSchema } from '../middleware/validate.js';
import { audit } from '../services/activity.js';
import { permissionsForRole, ROLE_MATRIX, Role } from '../services/permissions.js';
import { hashPassword, temporaryPassword, verifyPassword } from '../utils/crypto.js';
import { cleanText } from '../utils/sanitize.js';
import { logger } from '../utils/logger.js';

const router = Router();
router.use(authenticate);

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'EDITOR'] as const;

/** Safe projection: password hashes and reset material never leave the database. */
const teamColumns = {
  id: adminUsers.id,
  email: adminUsers.email,
  name: adminUsers.name,
  role: adminUsers.role,
  isActive: adminUsers.isActive,
  lastLoginAt: adminUsers.lastLoginAt,
  lastLoginIp: adminUsers.lastLoginIp,
  passwordChangedAt: adminUsers.passwordChangedAt,
  failedLoginCount: adminUsers.failedLoginCount,
  lockedUntil: adminUsers.lockedUntil,
  createdAt: adminUsers.createdAt,
};

async function countSuperAdmins(excludeId?: string): Promise<number> {
  const conditions = [eq(adminUsers.role, 'SUPER_ADMIN'), eq(adminUsers.isActive, true)];
  if (excludeId) conditions.push(ne(adminUsers.id, excludeId));
  const [row] = await db.select({ value: count() }).from(adminUsers).where(and(...conditions));
  return Number(row?.value ?? 0);
}

/** GET /api/admin/team */
router.get(
  '/',
  requirePermission('team:read'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const members = await db.select(teamColumns).from(adminUsers).orderBy(asc(adminUsers.createdAt));

    const activeSessions = await db
      .select({ adminUserId: adminSessions.adminUserId, value: count() })
      .from(adminSessions)
      .where(sql`${adminSessions.revokedAt} is null and ${adminSessions.expiresAt} > now()`)
      .groupBy(adminSessions.adminUserId);

    const sessionCounts = new Map(activeSessions.map((row) => [row.adminUserId, Number(row.value)]));

    res.json({
      team: members.map((member) => ({
        ...member,
        permissions: permissionsForRole(member.role as Role),
        activeSessions: sessionCounts.get(member.id) ?? 0,
      })),
      roles: ROLE_MATRIX,
    });
  })
);

/** POST /api/admin/team — creates an account and returns a one-time password. */
router.post(
  '/',
  requirePermission('team:create'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = z
      .object({
        email: emailSchema,
        name: z.string().trim().min(2).max(120),
        role: z.enum(ROLES),
      })
      .strict()
      .parse(req.body);

    // Only a studio owner may mint another owner.
    if (data.role === 'SUPER_ADMIN' && req.admin!.role !== 'SUPER_ADMIN') {
      throw new AppError(403, 'Only a studio owner can add another owner.', 'forbidden_role');
    }

    const [existing] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(sql`lower(${adminUsers.email}) = ${data.email}`)
      .limit(1);
    if (existing) throw new AppError(409, 'That email already has a studio account.', 'duplicate');

    const oneTimePassword = temporaryPassword();

    const [created] = await db
      .insert(adminUsers)
      .values({
        email: data.email,
        name: cleanText(data.name, 120),
        role: data.role,
        passwordHash: await hashPassword(oneTimePassword),
        passwordChangedAt: new Date(),
      })
      .returning(teamColumns);

    audit(req)('TEAM_MEMBER_CREATED', 'admin_user', {
      entityId: created.id,
      summary: `Added ${created.email} as ${created.role}`,
      metadata: { role: created.role },
    });

    // Returned exactly once so the owner can hand it over out-of-band; it is
    // never stored in plain text or written to logs.
    res.status(201).json({ member: { ...created, permissions: permissionsForRole(created.role as Role) }, temporaryPassword: oneTimePassword });
  })
);

/** PATCH /api/admin/team/:id — name, role, active flag. */
router.patch(
  '/:id',
  requirePermission('team:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const data = z
      .object({
        name: z.string().trim().min(2).max(120).optional(),
        role: z.enum(ROLES).optional(),
        isActive: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);

    const [target] = await db.select(teamColumns).from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
    if (!target) throw new AppError(404, 'That team member no longer exists.', 'not_found');

    if (target.role === 'SUPER_ADMIN' && req.admin!.role !== 'SUPER_ADMIN') {
      throw new AppError(403, 'Only a studio owner can change an owner account.', 'forbidden_role');
    }

    // Lockout guards: never demote or deactivate the last active owner, and
    // never let someone deactivate their own account.
    const losingOwner =
      target.role === 'SUPER_ADMIN' &&
      ((data.role && data.role !== 'SUPER_ADMIN') || data.isActive === false);
    if (losingOwner) {
      if ((await countSuperAdmins(target.id)) === 0) {
        throw new AppError(409, 'At least one active studio owner must remain.', 'last_owner');
      }
      if (req.admin!.id === target.id) {
        throw new AppError(409, 'You cannot remove your own owner access.', 'self_lockout');
      }
    }
    if (data.isActive === false && req.admin!.id === target.id) {
      throw new AppError(409, 'You cannot deactivate your own account.', 'self_lockout');
    }

    const [updated] = await db
      .update(adminUsers)
      .set({
        ...(data.name !== undefined ? { name: cleanText(data.name, 120) } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      })
      .where(eq(adminUsers.id, id))
      .returning(teamColumns);

    // Deactivating an account or changing its role ends its live sessions.
    if (data.isActive === false || (data.role && data.role !== target.role)) {
      await db
        .update(adminSessions)
        .set({ revokedAt: new Date(), revokedReason: 'role_or_status_changed' })
        .where(and(eq(adminSessions.adminUserId, id), sql`${adminSessions.revokedAt} is null`));
    }

    audit(req)('TEAM_MEMBER_UPDATED', 'admin_user', {
      entityId: id,
      summary: `Updated ${updated.email}`,
      metadata: { fields: Object.keys(data), role: updated.role },
    });

    res.json({ member: { ...updated, permissions: permissionsForRole(updated.role as Role) } });
  })
);

/** POST /api/admin/team/:id/reset-password — owner-issued one-time password. */
router.post(
  '/:id/reset-password',
  requirePermission('team:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);

    const [target] = await db.select(teamColumns).from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
    if (!target) throw new AppError(404, 'That team member no longer exists.', 'not_found');
    if (target.role === 'SUPER_ADMIN' && req.admin!.role !== 'SUPER_ADMIN') {
      throw new AppError(403, 'Only a studio owner can reset an owner password.', 'forbidden_role');
    }
    if (req.admin!.id === target.id) {
      throw new AppError(400, 'Use “Change password” to update your own password.', 'use_change_password');
    }

    const oneTimePassword = temporaryPassword();

    await db
      .update(adminUsers)
      .set({
        passwordHash: await hashPassword(oneTimePassword),
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      })
      .where(eq(adminUsers.id, id));

    await db
      .update(adminSessions)
      .set({ revokedAt: new Date(), revokedReason: 'admin_password_reset' })
      .where(and(eq(adminSessions.adminUserId, id), sql`${adminSessions.revokedAt} is null`));

    audit(req)('TEAM_PASSWORD_RESET', 'admin_user', {
      entityId: id,
      summary: `Issued a one-time password for ${target.email}`,
    });

    res.json({ ok: true, temporaryPassword: oneTimePassword });
  })
);

/** POST /api/admin/team/:id/unlock — clears a brute-force lockout. */
router.post(
  '/:id/unlock',
  requirePermission('team:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const [updated] = await db
      .update(adminUsers)
      .set({ failedLoginCount: 0, lockedUntil: null })
      .where(eq(adminUsers.id, id))
      .returning(teamColumns);

    if (!updated) throw new AppError(404, 'That team member no longer exists.', 'not_found');

    audit(req)('TEAM_MEMBER_UNLOCKED', 'admin_user', {
      entityId: id,
      summary: `Unlocked ${updated.email}`,
    });

    res.json({ member: updated });
  })
);

/** DELETE /api/admin/team/:id — owner-only, with self and last-owner guards. */
router.delete(
  '/:id',
  requirePermission('team:delete'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const { confirm } = z.object({ confirm: z.string().min(1).max(200) }).strict().parse(req.body);

    const [target] = await db.select(teamColumns).from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
    if (!target) throw new AppError(404, 'That team member no longer exists.', 'not_found');

    if (req.admin!.id === target.id) {
      throw new AppError(409, 'You cannot delete your own account.', 'self_lockout');
    }
    if (target.role === 'SUPER_ADMIN' && (await countSuperAdmins(target.id)) === 0) {
      throw new AppError(409, 'At least one active studio owner must remain.', 'last_owner');
    }
    if (confirm.trim().toLowerCase() !== target.email.toLowerCase()) {
      throw new AppError(400, 'To confirm, type the team member email exactly.', 'confirmation_required');
    }

    await db.delete(adminUsers).where(eq(adminUsers.id, id));

    audit(req)('TEAM_MEMBER_DELETED', 'admin_user', {
      entityId: id,
      summary: `Removed ${target.email} from the studio team`,
      metadata: { role: target.role },
    });

    res.json({ ok: true });
  })
);

export default router;
