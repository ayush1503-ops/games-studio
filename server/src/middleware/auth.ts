import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { adminSessions, adminUsers } from '../db/schema.js';
import { config } from '../config/env.js';
import { ACCESS_COOKIE } from '../utils/cookies.js';
import { AppError } from './errors.js';
import { permissionsForRole, Role } from '../services/permissions.js';

export interface SessionAdmin {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  sessionId: string;
  permissions: string[];
}

export interface AuthRequest extends Request {
  admin?: SessionAdmin;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  sid: string;
  typ: 'access';
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'typ'>): string {
  return jwt.sign({ ...payload, typ: 'access' }, config.jwtSecret, {
    expiresIn: `${config.accessTokenTtlMinutes}m`,
    issuer: 'brainchild-studio',
    audience: 'brainchild-admin',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      issuer: 'brainchild-studio',
      audience: 'brainchild-admin',
    }) as AccessTokenPayload;
    return decoded.typ === 'access' ? decoded : null;
  } catch {
    return null;
  }
}

async function loadAdmin(adminId: string, sessionId: string): Promise<SessionAdmin | null> {
  const [admin] = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, adminId))
    .limit(1);

  if (!admin || !admin.isActive) return null;

  if (sessionId) {
    // A session row must exist, still be live, and not have been revoked:
    // signing out elsewhere or a password change kills access immediately.
    const [session] = await db
      .select({ id: adminSessions.id })
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.id, sessionId),
          isNull(adminSessions.revokedAt),
          gt(adminSessions.expiresAt, new Date())
        )
      )
      .limit(1);
    if (!session) return null;
  }

  const role = admin.role as Role;
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role,
    sessionId,
    permissions: permissionsForRole(role),
  };
}

/**
 * `Authorization: Bearer <access token>` — the header transport.
 *
 * The console normally authenticates with the HttpOnly `bc_at` cookie. That
 * cannot work when the site is embedded in a cross-site iframe (an embedded
 * preview panel, for example): `SameSite=Lax` cookies are not attached to
 * cross-site requests and third-party cookies are blocked by several browsers,
 * so every request would arrive unauthenticated. The client detects that case
 * and switches to sending the same signed token in this header instead.
 *
 * Security is unchanged: the token is the same short-lived JWT, still checked
 * against a live, unrevoked session row, and a header can only be attached by
 * script running on our own origin — which is also why the CSRF double-submit
 * check is unnecessary in this mode (see middleware/csrf.ts).
 */
export function bearerAccessToken(req: Request): string | null {
  const header = req.get('authorization');
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme.toLowerCase() !== 'bearer') return null;
  const token = value.trim();
  return token.length > 0 ? token : null;
}

/** Cookie first (unchanged default), header as the fallback transport. */
function accessTokenFrom(req: Request): string | null {
  const cookie = req.cookies?.[ACCESS_COOKIE];
  if (typeof cookie === 'string' && cookie.length > 0) return cookie;
  return bearerAccessToken(req);
}

/** Reads the access cookie, validates the session, and loads the live admin row. */
export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = accessTokenFrom(req);
    if (!token || typeof token !== 'string') {
      throw new AppError(401, 'Please sign in to continue.', 'unauthenticated');
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      throw new AppError(401, 'Your session has expired. Please sign in again.', 'session_expired');
    }

    const admin = await loadAdmin(payload.sub, payload.sid);
    if (!admin) {
      throw new AppError(401, 'Your session has ended. Please sign in again.', 'session_revoked');
    }

    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
}

/** Same as authenticate but never blocks the request. */
export async function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const token = accessTokenFrom(req);
  if (!token || typeof token !== 'string') return next();

  const payload = verifyAccessToken(token);
  if (!payload) return next();

  const admin = await loadAdmin(payload.sub, payload.sid);
  if (admin) req.admin = admin;
  next();
}
