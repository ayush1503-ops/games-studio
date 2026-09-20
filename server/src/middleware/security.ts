import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit, { Options } from 'express-rate-limit';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/** Attaches a request id used in logs and error responses. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get('x-request-id');
  const id = incoming && /^[a-zA-Z0-9-_]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  (req as Request & { id: string }).id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

/**
 * Security headers.
 *
 * CSP notes:
 *  - `script-src 'self'` only — no inline scripts, no eval, no CDNs.
 *  - `style-src` needs 'unsafe-inline' because the SPA sets inline style
 *    attributes (React `style={}`); this is the one documented relaxation.
 *  - frames are denied outright (clickjacking).
 */
export function securityHeaders() {
  const dev = !config.isProduction;

  const csp: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': dev ? ['*'] : ["'none'"],
    'form-action': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'media-src': ["'self'", 'blob:'],
    // The browser SPA talks to Supabase (REST + realtime) in addition to the
    // same-origin API, so the storage CDN host must be an allowed connect target.
    'connect-src': dev
      ? ["'self'", 'ws:', 'wss:', 'http://localhost:*', 'https://*.supabase.co', 'wss://*.supabase.co']
      : ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  };
  if (config.isProduction) csp['upgrade-insecure-requests'] = [];

  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: Object.fromEntries(
        Object.entries(csp).map(([key, value]) => [key, value.length ? value : []])
      ),
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    crossOriginOpenerPolicy: dev ? false : { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: config.isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    frameguard: dev ? false : { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  });
}

export function permissionsPolicy(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );
  next();
}

/** Adds hardening headers to user-supplied media so files can never execute. */
export function uploadHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

/** Rejects plaintext HTTP when the deployment terminates TLS upstream. */
export function requireHttps(req: Request, res: Response, next: NextFunction): void {
  if (!config.forceHttps) return next();
  const proto = req.get('x-forwarded-proto')?.split(',')[0].trim() || req.protocol;
  if (proto === 'https') return next();

  if (req.method === 'GET' || req.method === 'HEAD') {
    res.redirect(308, `https://${req.get('host')}${req.originalUrl}`);
    return;
  }
  res.status(400).json({ error: 'HTTPS is required.', code: 'https_required' });
}

/** Only the configured front-end origins may talk to the API from a browser. */
export function enforceOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('origin');
  if (!origin) return next();

  const allowed = config.frontendOrigins.includes(origin.replace(/\/$/, ''));
  if (allowed) return next();

  // Same-origin requests from the API's own served bundle.
  try {
    const host = req.get('host');
    if (host && new URL(origin).host === host) return next();
  } catch {
    /* fallthrough */
  }

  logger.warn('Blocked cross-origin request', { origin, path: req.originalUrl });
  res.status(403).json({ error: 'Origin not allowed.', code: 'origin_not_allowed' });
}

const baseOptions: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  // Never let a proxy header spoof the client identity.
  validate: { xForwardedForHeader: false, trustProxy: false },
};

function makeLimiter(windowMs: number, max: number, message: string, extra: Partial<Options> = {}) {
  return rateLimit({
    ...baseOptions,
    ...extra,
    windowMs,
    max,
    message: { error: message, code: 'rate_limited' },
  });
}

export const globalLimiter = makeLimiter(
  Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  Number(process.env.RATE_LIMIT_MAX_REQUESTS || 900),
  'Too many requests. Please slow down.'
);

export const adminLimiter = makeLimiter(
  15 * 60 * 1000,
  1500,
  'Unusually high admin activity. Please wait a moment.'
);

/** Login is limited per IP *and* per submitted email to blunt credential stuffing. */
export const loginLimiter = makeLimiter(
  15 * 60 * 1000,
  10,
  'Too many sign-in attempts. Please try again in 15 minutes.',
  {
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().slice(0, 120) : 'anonymous';
      return `${req.ip}|${crypto.createHash('sha256').update(email).digest('hex').slice(0, 16)}`;
    },
    skipSuccessfulRequests: true,
  }
);

// Password reset is intentionally tight (it sends email and mints tokens) but
// still leaves room for a person who mistypes their address a few times.
export const passwordResetLimiter = makeLimiter(
  60 * 60 * 1000,
  Number(process.env.RATE_LIMIT_RESET_MAX || 10),
  'Too many password reset requests. Please try again later.'
);

export const publicWriteLimiter = makeLimiter(
  10 * 60 * 1000,
  Number(process.env.RATE_LIMIT_PUBLIC_WRITE_MAX || 12),
  'You have sent a lot of messages — please try again in a few minutes.'
);

export const uploadLimiter = makeLimiter(15 * 60 * 1000, 60, 'Upload limit reached for now.');
export const exportLimiter = makeLimiter(60 * 60 * 1000, 20, 'Export limit reached. Try again later.');
