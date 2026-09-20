import { NextFunction, Request, Response } from 'express';
import { CSRF_COOKIE, setCsrfCookie } from '../utils/cookies.js';
import { randomToken, safeEqual } from '../utils/crypto.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { bearerAccessToken } from './auth.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Paths a header-transport client may call without the cookie-backed
 * double-submit token: the sign-in/refresh/recovery endpoints under
 * `/api/auth`, which are reached before (or without) any Bearer token.
 */
const HEADER_TRANSPORT_BOOTSTRAP_PATHS = ['/api/auth/'];

/** Makes sure a CSRF token exists for the browser session. */
export function ensureCsrfToken(req: Request, res: Response, next: NextFunction): void {
  const existing = req.cookies?.[CSRF_COOKIE];
  if (!existing || typeof existing !== 'string' || existing.length < 20) {
    setCsrfCookie(res, randomToken(24));
  }
  next();
}

/**
 * Double-submit CSRF protection for every state-changing admin request.
 *
 * 1. The token must match the `bc_csrf` cookie exactly (timing-safe compare).
 * 2. If the browser sent an `Origin`, it must be an allowed studio origin
 *    (cross-site form posts always carry an Origin; same-site ones match).
 * 3. `Sec-Fetch-Site: cross-site` is rejected outright when present.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite === 'cross-site') {
    logger.warn('CSRF: cross-site request rejected', { path: req.originalUrl, fetchSite });
    res.status(403).json({ error: 'Cross-site request blocked.', code: 'csrf_failed' });
    return;
  }

  /* --------------------------- header transport --------------------------- */

  // A cross-site attacker cannot attach an `Authorization` header (it is not a
  // CORS-safelisted header, so a browser would preflight it and our CORS policy
  // refuses unknown origins), and it cannot set one from a plain form post. So a
  // request that carries a Bearer token is not forgeable and needs no cookie
  // double-submit. An invalid or *expired* token is deliberately still let
  // through here: the auth middleware answers 401, which is what tells the
  // console to refresh its session — reporting it as a CSRF error would strand
  // the user with an error they cannot act on. Every admin route is
  // authenticated, so nothing runs without a valid session.
  if (bearerAccessToken(req)) {
    next();
    return;
  }

  // The console's own header-transport calls: it cannot hold the CSRF cookie at
  // all (that is why it is in header mode), and the endpoints under /api/auth
  // either require a session token or a one-time emailed proof. The guards
  // above — cross-site rejection and the origin allow-list — still apply to
  // every one of them, and the response to a sign-in is unreadable from another
  // origin, so a foreign page cannot obtain the tokens it returns.
  const path = (req.originalUrl.split('?')[0] || '').replace(/\/$/, '');
  const headerTransport = req.get('x-auth-transport')?.trim().toLowerCase() === 'header';
  if (headerTransport && HEADER_TRANSPORT_BOOTSTRAP_PATHS.some((prefix) => path.startsWith(prefix))) {
    next();
    return;
  }

  /* ---------------------------- cookie transport -------------------------- */

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');

  if (!cookieToken || !headerToken || typeof cookieToken !== 'string') {
    res.status(403).json({
      error: 'Security token missing or expired. Please refresh the page and try again.',
      code: 'csrf_missing',
    });
    return;
  }

  if (!safeEqual(cookieToken, headerToken)) {
    logger.warn('CSRF: token mismatch', { path: req.originalUrl });
    res.status(403).json({ error: 'Security token invalid.', code: 'csrf_failed' });
    return;
  }

  const origin = req.get('origin');
  if (origin) {
    const normalised = origin.replace(/\/$/, '');
    const host = req.get('host');
    let sameOrigin = false;
    try {
      sameOrigin = !!host && new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
    if (!config.frontendOrigins.includes(normalised) && !sameOrigin) {
      logger.warn('CSRF: untrusted origin', { origin, path: req.originalUrl });
      res.status(403).json({ error: 'Origin not allowed.', code: 'origin_not_allowed' });
      return;
    }
  }

  next();
}
