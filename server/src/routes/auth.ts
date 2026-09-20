import { Router, Response } from 'express';
import { and, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { adminActivity, adminSessions, adminUsers, passwordResetTokens } from '../db/schema.js';
import { config } from '../config/env.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { AuthRequest, authenticate, signAccessToken, verifyAccessToken } from '../middleware/auth.js';
import {
  clearCsrfCookie,
  clearSessionCookies,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  setCsrfCookie,
  setSessionCookies,
} from '../utils/cookies.js';
import {
  burnPasswordTime,
  checkPasswordPolicy,
  hashPassword,
  randomToken,
  safeEqual,
  sha256,
  verifyPassword,
} from '../utils/crypto.js';
import {
  temporaryAdminPassword,
  temporaryPasswordTrackingEnabled,
} from '../config/temporary-password.js';
import { audit } from '../services/activity.js';
import { loginLimiter, passwordResetLimiter } from '../middleware/security.js';
import { emailSchema } from '../middleware/validate.js';
import { mailTransportReady, passwordResetEmail, sendMail } from '../services/mailer.js';
import {
  ensureSupabaseAuthUser,
  generateSupabaseRecoveryLink,
  revokeSupabaseSession,
  sendSupabaseRecoveryEmail,
  supabaseAuthReady,
  supabaseRecoveryRedirectUrl,
  verifySupabaseRecoverySession,
} from '../services/supabase-auth.js';
import { logger } from '../utils/logger.js';
import { permissionsForRole } from '../services/permissions.js';

const router = Router();

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Enter your password').max(200),
  })
  .strict();

const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(200, 'Password is too long');

const findByEmail = (email: string) =>
  sql`lower(${adminUsers.email}) = ${email}`;

/**
 * The console authenticates with HttpOnly cookies by default. When it is
 * embedded in a cross-site iframe (an embedded preview panel) those cookies
 * cannot be sent, so a client that declares `X-Auth-Transport: header` receives
 * the same tokens in the response body and returns them as
 * `Authorization: Bearer`. See middleware/auth.ts for the header side.
 */
function wantsHeaderTransport(req: AuthRequest): boolean {
  return req.get('x-auth-transport')?.trim().toLowerCase() === 'header';
}

async function issueSession(
  res: Response,
  admin: { id: string; email: string; role: string },
  meta: { ip?: string; userAgent?: string }
): Promise<{ accessToken: string; refreshToken: string }> {
  const refreshToken = randomToken(48);

  const [session] = await db
    .insert(adminSessions)
    .values({
      adminUserId: admin.id,
      tokenHash: sha256(refreshToken),
      ipAddress: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 400) ?? null,
      expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
    })
    .returning({ id: adminSessions.id });

  const accessToken = signAccessToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role as never,
    sid: session.id,
  });

  setSessionCookies(res, { accessToken, refreshToken });
  // The double-submit token is deliberately NOT rotated here: a client that
  // already fetched /api/auth/csrf must keep working after signing in.
  return { accessToken, refreshToken };
}

/** POST /api/auth/login */
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, password } = loginSchema.parse(req.body);

    const [admin] = await db.select().from(adminUsers).where(findByEmail(email)).limit(1);

    // Uniform failure for unknown users, wrong passwords and lockouts.
    const genericFailure = () =>
      new AppError(401, 'Email or password is incorrect.', 'invalid_credentials');

    if (!admin) {
      await burnPasswordTime(password);
      throw genericFailure();
    }

    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      const minutes = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppError(
        423,
        `Too many failed attempts. This account is locked for ${minutes} more minute(s).`,
        'account_locked'
      );
    }

    if (!admin.isActive) {
      await burnPasswordTime(password);
      throw new AppError(403, 'This account has been deactivated. Contact a studio owner.', 'account_inactive');
    }

    const valid = await verifyPassword(password, admin.passwordHash);

    if (!valid) {
      const failedCount = admin.failedLoginCount + 1;
      const shouldLock = failedCount >= MAX_FAILED_LOGINS;

      await db
        .update(adminUsers)
        .set({
          failedLoginCount: shouldLock ? 0 : failedCount,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
        })
        .where(eq(adminUsers.id, admin.id));

      await db.insert(adminActivity).values({
        adminUserId: admin.id,
        actorEmail: admin.email,
        action: shouldLock ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
        entityType: 'auth',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')?.slice(0, 400),
        requestId: (req as AuthRequest & { id?: string }).id,
      });

      if (shouldLock) {
        throw new AppError(
          423,
          `Too many failed attempts. This account is locked for ${LOCKOUT_MINUTES} minutes.`,
          'account_locked'
        );
      }
      throw genericFailure();
    }

    // Is this still the shared TEMPORARY password? The console shows a banner
    // until it is replaced, so a temporary credential cannot silently linger.
    const usingTemporaryPassword =
      temporaryPasswordTrackingEnabled() && safeEqual(password, temporaryAdminPassword());

    await db
      .update(adminUsers)
      .set({
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: req.ip ?? null,
      })
      .where(eq(adminUsers.id, admin.id));

    const issued = await issueSession(res, admin, { ip: req.ip, userAgent: req.get('user-agent') });

    audit(req)('LOGIN', 'auth', {
      adminUserId: admin.id,
      actorEmail: admin.email,
      summary: `${admin.name ?? admin.email} signed in`,
      ...(usingTemporaryPassword ? { metadata: { temporaryPassword: true } } : {}),
    });

    if (usingTemporaryPassword) {
      logger.warn('Signed in with the TEMPORARY admin password — change it in Settings', {
        adminId: admin.id,
        email: admin.email,
      });
    }

    res.json({
      csrfToken: typeof req.cookies?.[CSRF_COOKIE] === 'string' ? req.cookies[CSRF_COOKIE] : undefined,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: permissionsForRole(admin.role as never),
        lastLoginAt: admin.lastLoginAt,
        temporaryPasswordInUse: usingTemporaryPassword,
      },
      // Header transport (embedded/iframe consoles) gets the tokens in the body
      // because it cannot rely on the Set-Cookie above being stored or sent.
      ...(wantsHeaderTransport(req)
        ? {
            accessToken: issued.accessToken,
            refreshToken: issued.refreshToken,
            expiresInMinutes: config.accessTokenTtlMinutes,
          }
        : {}),
    });
  })
);

/** GET /api/auth/csrf — issues a CSRF token before the first mutation. */
router.get('/csrf', (req, res) => {
  const existing = req.cookies?.[CSRF_COOKIE];
  const token = typeof existing === 'string' && existing.length >= 20 ? existing : randomToken(24);
  setCsrfCookie(res, token);
  res.json({ csrfToken: token });
});

/**
 * POST /api/auth/refresh — rotates the refresh token (replay is blocked).
 *
 * The refresh token comes from the `bc_sid` cookie, or from the request body
 * for the header transport (a cross-site iframe cannot send that cookie).
 * Rotation is identical either way: the presented token is invalidated
 * immediately, so a replayed one fails.
 */
router.post(
  '/refresh',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const bodyRefresh = z
      .object({ refreshToken: z.string().min(20).max(400).optional() })
      .parse(req.body ?? {});

    const raw = typeof req.cookies?.[REFRESH_COOKIE] === 'string'
      ? req.cookies[REFRESH_COOKIE]
      : bodyRefresh.refreshToken;
    if (!raw || typeof raw !== 'string') throw new AppError(401, 'Session expired.', 'session_expired');

    const session = await db.query.adminSessions.findFirst({
      where: eq(adminSessions.tokenHash, sha256(raw)),
      with: {
        adminUser: { columns: { id: true, email: true, role: true, isActive: true } },
      },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      clearSessionCookies(res);
      throw new AppError(401, 'Session expired. Please sign in again.', 'session_expired');
    }

    if (!session.adminUser?.isActive) {
      clearSessionCookies(res);
      throw new AppError(403, 'This account is no longer active.', 'account_inactive');
    }

    // Rotate: the presented token becomes invalid immediately.
    const nextToken = randomToken(48);
    await db
      .update(adminSessions)
      .set({
        tokenHash: sha256(nextToken),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
      })
      .where(eq(adminSessions.id, session.id));

    const accessToken = signAccessToken({
      sub: session.adminUser.id,
      email: session.adminUser.email,
      role: session.adminUser.role as never,
      sid: session.id,
    });

    setSessionCookies(res, { accessToken, refreshToken: nextToken });
    res.json({
      ok: true,
      expiresInMinutes: config.accessTokenTtlMinutes,
      ...(wantsHeaderTransport(req) ? { accessToken, refreshToken: nextToken } : {}),
    });
  })
);

/** GET /api/auth/me */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const [admin] = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        name: adminUsers.name,
        role: adminUsers.role,
        lastLoginAt: adminUsers.lastLoginAt,
        passwordChangedAt: adminUsers.passwordChangedAt,
        createdAt: adminUsers.createdAt,
        passwordHash: adminUsers.passwordHash,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, req.admin!.id))
      .limit(1);

    if (!admin) throw new AppError(404, 'Account not found.', 'not_found');

    // Verified against the stored hash (never trusted from the client), so the
    // banner clears the moment a private password is set.
    const { passwordHash, ...profile } = admin;
    const temporaryPasswordInUse = temporaryPasswordTrackingEnabled()
      ? await verifyPassword(temporaryAdminPassword(), passwordHash)
      : false;

    res.json({
      admin: { ...profile, permissions: req.admin!.permissions, temporaryPasswordInUse },
    });
  })
);

/** POST /api/auth/logout */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.admin?.sessionId) {
      await db
        .update(adminSessions)
        .set({ revokedAt: new Date(), revokedReason: 'logout' })
        .where(eq(adminSessions.id, req.admin.sessionId));
    }
    audit(req)('LOGOUT', 'auth', { summary: 'Signed out' });
    clearSessionCookies(res);
    clearCsrfCookie(res);
    res.json({ ok: true });
  })
);

/** POST /api/auth/logout-all */
router.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ended = await db
      .update(adminSessions)
      .set({ revokedAt: new Date(), revokedReason: 'logout_all' })
      .where(and(eq(adminSessions.adminUserId, req.admin!.id), isNull(adminSessions.revokedAt)))
      .returning({ id: adminSessions.id });

    audit(req)('LOGOUT_ALL', 'auth', { summary: `Ended ${ended.length} session(s)` });
    clearSessionCookies(res);
    clearCsrfCookie(res);
    res.json({ ok: true, ended: ended.length });
  })
);

/** GET /api/auth/sessions — active devices for the signed-in admin. */
router.get(
  '/sessions',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const sessions = await db
      .select({
        id: adminSessions.id,
        ipAddress: adminSessions.ipAddress,
        userAgent: adminSessions.userAgent,
        createdAt: adminSessions.createdAt,
        lastUsedAt: adminSessions.lastUsedAt,
        expiresAt: adminSessions.expiresAt,
      })
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.adminUserId, req.admin!.id),
          isNull(adminSessions.revokedAt),
          gt(adminSessions.expiresAt, new Date())
        )
      )
      .orderBy(sql`${adminSessions.lastUsedAt} desc`);

    res.json({
      sessions: sessions.map((session) => ({
        ...session,
        current: session.id === req.admin!.sessionId,
        device: describeUserAgent(session.userAgent),
      })),
    });
  })
);

/** DELETE /api/auth/sessions/:id — ownership is enforced server-side. */
router.delete(
  '/sessions/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = z.string().uuid().parse(req.params.id);

    const [session] = await db
      .select({ id: adminSessions.id, adminUserId: adminSessions.adminUserId })
      .from(adminSessions)
      .where(eq(adminSessions.id, id))
      .limit(1);

    // A missing session and somebody else's session are indistinguishable,
    // which prevents probing for valid session ids.
    if (!session || session.adminUserId !== req.admin!.id) {
      throw new AppError(404, 'Session not found.', 'not_found');
    }

    await db
      .update(adminSessions)
      .set({ revokedAt: new Date(), revokedReason: 'revoked_by_user' })
      .where(eq(adminSessions.id, id));

    audit(req)('SESSION_REVOKED', 'auth', { entityId: id, summary: 'Ended a device session' });
    res.json({ ok: true });
  })
);

/** POST /api/auth/change-password */
router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const schema = z
      .object({
        currentPassword: z.string().min(1).max(200),
        newPassword: passwordSchema,
      })
      .strict();
    const { currentPassword, newPassword } = schema.parse(req.body);

    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, req.admin!.id)).limit(1);
    if (!admin) throw new AppError(404, 'Account not found.', 'not_found');

    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      throw new AppError(400, 'Your current password is incorrect.', 'invalid_password');
    }

    const policy = checkPasswordPolicy(newPassword, [admin.email, admin.name ?? '']);
    if (!policy.ok) throw new AppError(400, policy.problems.join(' '), 'weak_password', policy.problems);
    if (await verifyPassword(newPassword, admin.passwordHash)) {
      throw new AppError(400, 'Choose a password you have not used here before.', 'reused_password');
    }

    await db
      .update(adminUsers)
      .set({ passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() })
      .where(eq(adminUsers.id, admin.id));

    // Keep the current device signed in, drop every other one.
    await db
      .update(adminSessions)
      .set({ revokedAt: new Date(), revokedReason: 'password_changed' })
      .where(
        and(eq(adminSessions.adminUserId, admin.id), ne(adminSessions.id, req.admin!.sessionId))
      );

    audit(req)('PASSWORD_CHANGED', 'auth', { summary: 'Changed account password' });
    res.json({ ok: true });
  })
);

/**
 * Which service will carry the reset email for this deployment. Computed from
 * configuration only (never from the address), so it is safe to return to an
 * anonymous caller.
 */
function resetDeliveryPlan(): {
  channel: 'supabase' | 'smtp' | 'console' | 'none';
  ready: boolean;
  reason?: string;
} {
  const supabase = supabaseAuthReady();
  const mailer = mailTransportReady();

  if (supabase.ready) return { channel: 'supabase', ready: true };
  if (mailer.ready) return { channel: mailer.transport === 'console' ? 'console' : 'smtp', ready: true };

  const reason =
    config.passwordReset.channel === 'supabase'
      ? 'supabase_auth_not_configured'
      : mailer.reason ?? (supabase.ready ? undefined : supabase.reason) ?? 'unknown';
  return { channel: 'none', ready: false, reason };
}

/** POST /api/auth/forgot-password */
router.post(
  '/forgot-password',
  passwordResetLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email } = z.object({ email: emailSchema }).strict().parse(req.body);

    // Delivery readiness is a property of the deployment, not of the address,
    // so it is computed before the lookup and included on *every* response
    // path — including the unknown-address one. If the key only appeared for
    // existing accounts, its presence would itself identify which emails have
    // a studio account, defeating the anti-enumeration design of this endpoint.
    const plan = resetDeliveryPlan();
    const genericResponse = {
      message: 'If that email belongs to a studio account, a reset link is on its way.',
      emailDeliveryEnabled: plan.ready,
      emailDeliveryChannel: plan.channel,
      ...(plan.ready ? {} : { emailDeliveryReason: plan.reason ?? 'unknown' }),
    };

    const [admin] = await db.select().from(adminUsers).where(findByEmail(email)).limit(1);
    if (!admin || !admin.isActive) {
      await burnPasswordTime(email);
      res.json(genericResponse);
      return;
    }

    /* ----------------------- channel 1: Supabase Auth ---------------------- */
    if (plan.channel === 'supabase') {
      // Outstanding SMTP-style tokens are retired so only the newest link works.
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.adminUserId, admin.id), isNull(passwordResetTokens.usedAt)));

      const redirectTo = supabaseRecoveryRedirectUrl();
      const ensured = await ensureSupabaseAuthUser(admin.email, admin.name);

      let delivered = false;
      let failureReason: string | undefined = ensured.ok ? undefined : `create_user_failed:${ensured.reason}`;
      let devResetUrl: string | undefined;

      if (ensured.ok) {
        if (config.exposeResetLink) {
          // Dev: mint the link instead of emailing it — keeps local testing
          // under Supabase's built-in mailer cap (2 emails/hour).
          const minted = await generateSupabaseRecoveryLink(admin.email, redirectTo);
          if (minted.link) {
            devResetUrl = minted.link;
            delivered = true;
            logger.info('Password reset link (dev, Supabase generate_link)', { to: admin.email, link: minted.link });
          } else {
            failureReason = `generate_link_failed:${minted.reason}`;
          }
        } else {
          const sent = await sendSupabaseRecoveryEmail(admin.email, redirectTo);
          delivered = sent.delivered;
          if (!sent.delivered) failureReason = [sent.reason, sent.detail].filter(Boolean).join(': ');
        }
      }

      audit(req)('PASSWORD_RESET_REQUESTED', 'auth', {
        adminUserId: admin.id,
        actorEmail: admin.email,
        summary: `Reset link ${delivered ? 'sent' : 'NOT sent'} to ${admin.email} via Supabase Auth`,
        metadata: { channel: 'supabase', delivered, ...(failureReason ? { reason: failureReason } : {}) },
      });
      logger.info('Password reset requested', { adminId: admin.id, channel: 'supabase', delivered });

      // The body can never reveal whether this address has an account, so a
      // failed send is never surfaced as an error for it — it is logged (and
      // audited) instead. Development builds do get the detail back.
      if (!delivered) {
        logger.error('Password reset email was not delivered', {
          adminId: admin.id,
          channel: 'supabase',
          reason: failureReason,
          redirectTo,
        });
      }

      res.json({
        ...genericResponse,
        ...(config.exposeResetLink
          ? { ...(devResetUrl ? { devResetUrl } : {}), ...(failureReason ? { devDeliveryError: failureReason } : {}) }
          : {}),
      });
      return;
    }

    /* ---------------------- channel 2: SMTP / console ---------------------- */

    // Invalidate outstanding tokens before issuing a new one.
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.adminUserId, admin.id), isNull(passwordResetTokens.usedAt)));

    const rawToken = randomToken(48);
    await db.insert(passwordResetTokens).values({
      adminUserId: admin.id,
      tokenHash: sha256(rawToken),
      expiresAt: new Date(Date.now() + config.resetTokenTtlMinutes * 60 * 1000),
      requestedIp: req.ip ?? null,
    });

    const resetUrl = `${config.mail.appBaseUrl}/admin/reset-password?token=${rawToken}`;
    const delivery = await sendMail({ to: admin.email, ...passwordResetEmail(resetUrl, config.resetTokenTtlMinutes) });

    audit(req)('PASSWORD_RESET_REQUESTED', 'auth', {
      adminUserId: admin.id,
      actorEmail: admin.email,
      summary: `Reset link generated for ${admin.email}`,
      metadata: { channel: plan.channel, delivered: delivery.delivered },
    });

    logger.info('Password reset requested', { adminId: admin.id, channel: plan.channel, delivered: delivery.delivered });

    // The body can never reveal whether this address has an account, so a
    // failed send is never surfaced as an error for it — it is logged instead.
    if (!delivery.delivered) {
      logger.error('Password reset email was not delivered', {
        adminId: admin.id,
        reason: delivery.reason,
        mailerReason: plan.reason,
        transport: plan.channel,
      });
    }

    res.json({
      ...genericResponse,
      // Development-only convenience; hard-disabled in production.
      ...(config.exposeResetLink ? { devResetUrl: resetUrl } : {}),
    });
  })
);

/**
 * Rotates an admin's console password and ends everything that depended on
 * the old one. Shared by both reset proofs (SMTP token / Supabase session).
 */
async function completePasswordReset(
  req: AuthRequest,
  target: { id: string; email: string | null; name: string | null },
  newPassword: string,
  proof: { kind: 'token' } | { kind: 'supabase'; method: string; supabaseUserId: string }
): Promise<void> {
  const policy = checkPasswordPolicy(newPassword, [target.email ?? '', target.name ?? '']);
  if (!policy.ok) throw new AppError(400, policy.problems.join(' '), 'weak_password', policy.problems);

  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    await tx
      .update(adminUsers)
      .set({ passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null })
      .where(eq(adminUsers.id, target.id));

    // Whichever proof was used, no outstanding reset token survives it.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.adminUserId, target.id), isNull(passwordResetTokens.usedAt)));

    // Every existing session dies with the old password.
    await tx
      .update(adminSessions)
      .set({ revokedAt: new Date(), revokedReason: 'password_reset' })
      .where(and(eq(adminSessions.adminUserId, target.id), isNull(adminSessions.revokedAt)));

    await tx.insert(adminActivity).values({
      adminUserId: target.id,
      actorEmail: target.email,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'auth',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 400),
      metadata:
        proof.kind === 'supabase'
          ? { channel: 'supabase', method: proof.method, supabaseUserId: proof.supabaseUserId }
          : { channel: 'token' },
    });
  });
}

/** POST /api/auth/reset-password */
router.post(
  '/reset-password',
  passwordResetLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Exactly one proof of identity is accepted per request:
    //  - `token`               the one-time token from an SMTP/console reset email
    //  - `supabaseAccessToken` the session Supabase created when the emailed
    //                          recovery link was opened
    const schema = z
      .object({
        token: z.string().min(20).max(200).optional(),
        supabaseAccessToken: z.string().min(20).max(4096).optional(),
        newPassword: passwordSchema,
      })
      .strict()
      .refine((body) => Boolean(body.token) !== Boolean(body.supabaseAccessToken), {
        message: 'Provide either a reset token or a Supabase recovery session.',
        path: ['token'],
      });
    const { token, supabaseAccessToken, newPassword } = schema.parse(req.body);

    const invalidLink = () => new AppError(400, 'That reset link is invalid or has expired.', 'invalid_reset_token');

    /* --------------------- proof A: Supabase recovery session --------------------- */
    if (supabaseAccessToken) {
      if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
        throw new AppError(503, 'Password reset via Supabase is not configured on this server.', 'reset_channel_unavailable');
      }

      const session = await verifySupabaseRecoverySession(supabaseAccessToken);
      if (!session.ok) {
        if (session.reason === 'network_error') {
          throw new AppError(503, 'Could not verify the reset link right now. Please try again.', 'reset_verify_unavailable');
        }
        if (session.reason === 'not_recovery_session') {
          throw new AppError(
            400,
            'This session was not opened from a reset email. Please use the link we sent you.',
            'invalid_reset_token'
          );
        }
        throw invalidLink();
      }

      const [admin] = await db.select().from(adminUsers).where(findByEmail(session.email)).limit(1);
      // An unknown or deactivated admin is indistinguishable from a bad link.
      if (!admin || !admin.isActive) throw invalidLink();

      await completePasswordReset(req, admin, newPassword, {
        kind: 'supabase',
        method: session.method,
        supabaseUserId: session.userId,
      });

      // The recovery session has done its job; do not leave it usable.
      void revokeSupabaseSession(supabaseAccessToken);

      clearSessionCookies(res);
      res.json({ ok: true, message: 'Password updated. You can sign in now.' });
      return;
    }

    /* -------------------------- proof B: one-time token -------------------------- */
    const record = await db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.tokenHash, sha256(token!)),
      with: { adminUser: { columns: { id: true, email: true, name: true, isActive: true } } },
    });

    if (!record || record.usedAt || record.expiresAt < new Date() || !record.adminUser?.isActive) {
      throw invalidLink();
    }

    await completePasswordReset(
      req,
      { id: record.adminUserId, email: record.adminUser?.email ?? null, name: record.adminUser?.name ?? null },
      newPassword,
      { kind: 'token' }
    );

    clearSessionCookies(res);
    res.json({ ok: true, message: 'Password updated. You can sign in now.' });
  })
);

/** POST /api/auth/verify-session — lets the SPA check a token without side effects. */
router.post(
  '/verify-session',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const token = req.cookies?.bc_at;
    const payload = typeof token === 'string' ? verifyAccessToken(token) : null;
    res.json({ valid: Boolean(payload) });
  })
);

function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent.toLowerCase();
  const platform =
    ua.includes('iphone') || ua.includes('android')
      ? 'Mobile'
      : ua.includes('mac os')
        ? 'macOS'
        : ua.includes('windows')
          ? 'Windows'
          : ua.includes('linux')
            ? 'Linux'
            : 'Device';
  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('chrome')
      ? 'Chrome'
      : ua.includes('safari') && !ua.includes('chrome')
        ? 'Safari'
        : ua.includes('firefox')
          ? 'Firefox'
          : 'Browser';
  return `${browser} · ${platform}`;
}

export default router;
