import crypto from 'crypto';
import dotenv from 'dotenv';

// Loaded here (not only in the entrypoint) so every process — API, scripts and
// tests — reads the same environment before any config value is evaluated.
dotenv.config();

/**
 * Central, validated environment configuration.
 *
 * Security rules enforced here:
 *  - Production refuses to boot with missing/weak secrets (no silent fallbacks).
 *  - Development gets generated ephemeral secrets so the project runs out of the box.
 *  - Secrets are never logged; only a presence report is printed at startup.
 */

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string, value: string | undefined, minLength = 1): string {
  if (!value || value.trim().length < minLength) {
    throw new Error(
      `[config] Missing or too short environment variable "${name}" (min ${minLength} chars). ` +
        `Copy server/.env.example to server/.env and set a strong value.`
    );
  }
  return value.trim();
}

function optional(value: string | undefined, fallback: string): string {
  return value && value.trim() !== '' ? value.trim() : fallback;
}

function devFallback(name: string, fallback: string): string {
  const provided = process.env[name]?.trim();
  if (provided) return provided;

  if (isProduction) {
    throw new Error(
      `[config] ${name} must be set in production. Generate one with: openssl rand -hex 32`
    );
  }
  // Ephemeral per-boot secret: fine for local development, never used in production.
  // eslint-disable-next-line no-console
  console.warn(`[config] ${name} is not set — using an ephemeral development secret.`);
  return crypto.randomBytes(32).toString('hex') || fallback;
}

const DEV_DATABASE_URL =
  'postgresql://brainchild:brainchild@127.0.0.1:55432/brainchild_games?schema=public';

/**
 * Public origin the password-reset link points back to.
 *
 * Resolution order (first non-empty wins):
 *   1. APP_BASE_URL                      – explicit, always preferred
 *   2. FRONTEND_ORIGIN (first entry)     – already the deployed site in production
 *   3. VERCEL_PROJECT_PRODUCTION_URL     – injected by Vercel (production domain)
 *   4. VERCEL_URL                        – injected by Vercel (deployment URL)
 *   5. http://localhost:3000             – local development
 *
 * Only environment values are used, never the incoming Host/Origin header: a
 * reset link built from request headers is the classic host-header-injection
 * password-reset vulnerability.
 */
function resolveAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const firstOrigin = process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim();
  if (firstOrigin && !(isProduction && /localhost|127\.0\.0\.1/.test(firstOrigin))) {
    return firstOrigin.replace(/\/$/, '');
  }

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercelHost) return `https://${vercelHost.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;

  return 'http://localhost:3000';
}

export const config = {
  env: isProduction ? 'production' : optional(process.env.NODE_ENV, 'development'),
  isProduction,
  isTest: process.env.NODE_ENV === 'test',

  port: Number(optional(process.env.PORT, '3001')),
  host: optional(process.env.HOST, '0.0.0.0'),

  databaseUrl: isProduction
    ? required('DATABASE_URL', process.env.DATABASE_URL, 12)
    : optional(process.env.DATABASE_URL, DEV_DATABASE_URL),

  // --- crypto -------------------------------------------------------------
  jwtSecret: isProduction
    ? required('JWT_SECRET', process.env.JWT_SECRET, 32)
    : devFallback('JWT_SECRET', 'dev-jwt-secret'),
  jwtRefreshSecret: isProduction
    ? required('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET, 32)
    : devFallback('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
  accessTokenTtlMinutes: Number(optional(process.env.ACCESS_TOKEN_TTL_MINUTES, '30')),
  refreshTokenTtlDays: Number(optional(process.env.REFRESH_TOKEN_TTL_DAYS, '14')),
  resetTokenTtlMinutes: Number(optional(process.env.RESET_TOKEN_TTL_MINUTES, '30')),
  bcryptRounds: Number(optional(process.env.BCRYPT_ROUNDS, '12')),

  // --- network / cookies --------------------------------------------------
  frontendOrigins: optional(process.env.FRONTEND_ORIGIN, 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  trustProxy: optional(process.env.TRUST_PROXY, '1'),
  forceHttps: optional(process.env.FORCE_HTTPS, isProduction ? 'true' : 'false') === 'true',
  cookieSecure: optional(process.env.COOKIE_SECURE, isProduction ? 'true' : 'false') === 'true',
  cookieDomain: process.env.COOKIE_DOMAIN?.trim() || undefined,

  // --- uploads ------------------------------------------------------------
  uploadDir: optional(process.env.UPLOAD_DIR, './uploads'),
  // 4 MB keeps single-image uploads under the 4.5 MB serverless request-body
  // limit on Vercel (and is plenty for CMS hero/cover images).
  maxUploadBytes: Number(optional(process.env.MAX_UPLOAD_BYTES, String(4 * 1024 * 1024))),

  /**
   * Media storage backend:
   *  - `local`    (default when no Supabase service-role key is present):
   *               files live on the API server's disk and are served from
   *               `/uploads`. Fine for development and single-server deploys.
   *  - `supabase`: files go to a Supabase Storage bucket via the service-role
   *               key and are served from the public storage CDN. This is the
   *               correct mode for serverless hosts (Vercel) where the local
   *               filesystem is ephemeral.
   *
   * Set STORAGE_DRIVER explicitly to override auto-detection.
   */
  storageDriver: optional(
    process.env.STORAGE_DRIVER,
    process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL ? 'supabase' : 'local'
  ),
  supabaseUrl: process.env.SUPABASE_URL?.trim() || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '',
  /**
   * Publishable/anon key. Optional on the server: it is only used as the
   * `apikey` for the public `/auth/v1/recover` call so that request looks
   * exactly like one made from the browser. Falls back to the service-role key.
   */
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY?.trim() || '',
  storageBucket: optional(process.env.STORAGE_BUCKET, 'media'),

  // --- mail ---------------------------------------------------------------
  mail: {
    transport: optional(process.env.MAIL_TRANSPORT, isProduction ? 'smtp' : 'console'),
    from: optional(process.env.MAIL_FROM, 'Brainchild Studio <no-reply@brainchild.games>'),
    smtpHost: process.env.SMTP_HOST?.trim(),
    smtpPort: Number(optional(process.env.SMTP_PORT, '587')),
    smtpUser: process.env.SMTP_USER?.trim(),
    smtpPassword: process.env.SMTP_PASSWORD,
    appBaseUrl: resolveAppBaseUrl(),
  },

  // --- admin password reset -----------------------------------------------
  passwordReset: {
    /**
     * Who delivers the "reset your password" email:
     *  - `auto` (default): Supabase Auth when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
     *                      are set, otherwise the SMTP/console mailer above.
     *  - `supabase`:       always Supabase Auth (the form reports delivery as
     *                      unavailable if it is not configured).
     *  - `smtp`:           never Supabase — always the SMTP/console mailer.
     *
     * The credential itself always stays in `admin_users.password_hash`;
     * Supabase only carries the email and proves the recipient opened it.
     */
    channel: optional(process.env.PASSWORD_RESET_CHANNEL, 'auto').toLowerCase(),
    /** SPA route the Supabase recovery link redirects back to. */
    supabaseRedirectPath: '/admin/reset-password',
    /**
     * A Supabase recovery session older than this cannot be used to set a new
     * console password — mirrors Supabase's own 1 h link validity so a session
     * left behind in a browser does not stay usable indefinitely.
     */
    recoverySessionMaxAgeMinutes: Number(optional(process.env.RECOVERY_SESSION_MAX_AGE_MINUTES, '60')),
  },

  // --- developer conveniences (never enabled in production) ----------------
  exposeResetLink: !isProduction && optional(process.env.DEV_EXPOSE_RESET_LINK, 'true') === 'true',
  logLevel: optional(process.env.LOG_LEVEL, isProduction ? 'info' : 'debug'),

  // --- serving ------------------------------------------------------------
  serveFrontend: optional(process.env.SERVE_FRONTEND, isProduction ? 'true' : 'false') === 'true',
  frontendDistDir: optional(process.env.FRONTEND_DIST_DIR, '../dist'),

  seed: {
    adminEmail: optional(process.env.ADMIN_EMAIL, 'brainchildgamesin@gmail.com'),
    adminPassword: process.env.ADMIN_PASSWORD,
    adminName: optional(process.env.ADMIN_NAME, 'Studio Admin'),
    // Always ensure this studio owner account exists as SUPER_ADMIN
    primaryAdminEmail: 'brainchildgamesin@gmail.com',
    primaryAdminName: 'Brainchild Games',
  },
};

export type AppConfig = typeof config;

/* Validate the storage driver up front so misconfiguration fails loudly. */
if (!['local', 'supabase'].includes(config.storageDriver)) {
  throw new Error(
    `[config] STORAGE_DRIVER must be "local" or "supabase", got "${config.storageDriver}".`
  );
}
if (isProduction && config.storageDriver === 'supabase' && (!config.supabaseUrl || !config.supabaseServiceRoleKey)) {
  throw new Error(
    '[config] STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in production.'
  );
}
if (!['auto', 'supabase', 'smtp'].includes(config.passwordReset.channel)) {
  throw new Error(
    `[config] PASSWORD_RESET_CHANNEL must be "auto", "supabase" or "smtp", got "${config.passwordReset.channel}".`
  );
}
if (config.passwordReset.channel === 'supabase' && (!config.supabaseUrl || !config.supabaseServiceRoleKey)) {
  // Not fatal (the reset form reports delivery as unavailable), but loud.
  // eslint-disable-next-line no-console
  console.warn(
    '[config] PASSWORD_RESET_CHANNEL=supabase but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — ' +
      'password reset emails cannot be sent.'
  );
}
if (isProduction && config.storageDriver === 'local') {
  // Not an error (VM/container deploys may legitimately use disk storage), but
  // on serverless hosts this means uploads silently land on ephemeral disk.
  // eslint-disable-next-line no-console
  console.warn(
    '[config] WARNING: production uses STORAGE_DRIVER=local. On serverless ' +
      'hosts (Vercel) the filesystem is ephemeral and uploaded images will be ' +
      'lost. Set STORAGE_DRIVER=supabase with SUPABASE_URL + ' +
      'SUPABASE_SERVICE_ROLE_KEY for serverless deployments.'
  );
}

/** Startup checklist printed once so operators can spot insecure setups fast. */
export function configReport(): string[] {
  return [
    `environment: ${config.env}`,
    `database: ${config.databaseUrl.replace(/:\/\/[^@]*@/, '://***:***@')}`,
    `cookies secure: ${config.cookieSecure}`,
    `force https: ${config.forceHttps}`,
    `allowed origins: ${config.frontendOrigins.join(', ')}`,
    `mail transport: ${config.mail.transport}`,
    `password reset channel: ${config.passwordReset.channel}` +
      (config.supabaseUrl && config.supabaseServiceRoleKey ? ' (supabase auth configured)' : ' (supabase auth not configured)'),
    `reset links point to: ${config.mail.appBaseUrl}`,
    `reset link exposure: ${config.exposeResetLink ? 'DEV ONLY (enabled)' : 'disabled'}`,
  ];
}
