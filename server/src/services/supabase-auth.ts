import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Supabase Auth (GoTrue) client for the admin password-reset flow.
 *
 * WHY SUPABASE SENDS THE EMAIL
 * The studio has a Supabase project but no SMTP account, so the previous
 * SMTP-only reset flow could never deliver a link. Supabase Auth ships its own
 * mailer (the built-in service, or whatever custom SMTP is configured in the
 * Supabase dashboard), so the API hands the *email* to Supabase and keeps the
 * *credential* here: the console password still lives in
 * `admin_users.password_hash`, and `POST /api/auth/reset-password` only
 * rotates it after verifying that the caller holds a Supabase session that was
 * created by opening the emailed link.
 *
 * WHY PLAIN `fetch`
 * `@supabase/supabase-js` would add a few hundred KB to the Vercel function for
 * four REST calls. The API already limits its Supabase footprint to
 * `@supabase/storage-js` for the same reason, so this module talks to GoTrue's
 * REST endpoints directly with the global `fetch` (Node ≥ 18).
 *
 * Endpoints used (all documented GoTrue routes):
 *   POST /auth/v1/admin/users           create the auth user (service role)
 *   POST /auth/v1/admin/generate_link   dev only: mint the link without email
 *   POST /auth/v1/recover               send the recovery email
 *   GET  /auth/v1/user                  validate a user access token
 *   POST /auth/v1/logout                revoke the recovery session afterwards
 */

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * `amr` methods that prove the bearer opened a link Supabase emailed to the
 * address. A password or OAuth session is deliberately *not* accepted: anyone
 * who can sign up an account with the admin's email in Supabase must not be
 * able to rotate the console password without receiving the email.
 */
const EMAIL_PROOF_METHODS = new Set(['recovery', 'magiclink']);

export type SupabaseAuthReadiness =
  | { ready: true }
  | { ready: false; reason: 'not_configured' | 'disabled_by_config' };

/** Is Supabase Auth configured *and* selected as the reset-email channel? */
export function supabaseAuthReady(): SupabaseAuthReadiness {
  if (config.passwordReset.channel === 'smtp') return { ready: false, reason: 'disabled_by_config' };
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return { ready: false, reason: 'not_configured' };
  return { ready: true };
}

/** Absolute URL the recovery email sends the admin back to. */
export function supabaseRecoveryRedirectUrl(): string {
  return `${config.mail.appBaseUrl}${config.passwordReset.supabaseRedirectPath}`;
}

/* ----------------------------- low-level client ---------------------------- */

interface GoTrueResult<T> {
  status: number;
  ok: boolean;
  body: T | null;
  errorCode?: string;
  message?: string;
}

function authBaseUrl(): string {
  return `${config.supabaseUrl.replace(/\/$/, '')}/auth/v1`;
}

/**
 * One GoTrue request. `apikey` identifies the project to the gateway; the
 * bearer is either the same key (admin / public endpoints) or a user's access
 * token (`/user`, `/logout`).
 */
async function gotrue<T = unknown>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PUT'; bearer?: string; apikey?: string; body?: unknown } = {}
): Promise<GoTrueResult<T>> {
  const apikey = init.apikey ?? config.supabaseServiceRoleKey;
  const bearer = init.bearer ?? apikey;

  const response = await fetch(`${authBaseUrl()}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Client-Info': 'brainchild-studio-api',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  const record = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value) return value;
    }
    return undefined;
  };

  return {
    status: response.status,
    ok: response.ok,
    body: response.ok ? (parsed as T) : null,
    // GoTrue error bodies: { code, error_code, msg } (new) or { error, error_description } (old)
    errorCode: pick('error_code', 'error'),
    message: pick('msg', 'message', 'error_description'),
  };
}

function describeFailure(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'timeout';
    return error.message;
  }
  return String(error);
}

/* ------------------------------- operations -------------------------------- */

export interface EnsureUserResult {
  ok: boolean;
  created: boolean;
  reason?: string;
}

/**
 * Make sure `email` exists in Supabase `auth.users` so a recovery email can be
 * sent to it. The account is created *without* a password: it can only ever be
 * entered through a link Supabase emails to the address, which is exactly the
 * proof this flow needs. Existing accounts are left untouched.
 */
export async function ensureSupabaseAuthUser(email: string, displayName?: string | null): Promise<EnsureUserResult> {
  try {
    const result = await gotrue<{ id: string }>('/admin/users', {
      method: 'POST',
      body: {
        email,
        email_confirm: true,
        user_metadata: displayName ? { display_name: displayName } : {},
      },
    });

    if (result.ok) return { ok: true, created: true };

    const alreadyExists =
      result.status === 422 &&
      (result.errorCode === 'email_exists' || /already|exists|registered/i.test(result.message ?? ''));
    if (alreadyExists) return { ok: true, created: false };

    logger.error('Supabase Auth: could not create auth user for password reset', {
      status: result.status,
      errorCode: result.errorCode,
      message: result.message,
    });
    return { ok: false, created: false, reason: result.errorCode ?? `http_${result.status}` };
  } catch (error) {
    logger.error('Supabase Auth: createUser request failed', { error: describeFailure(error) });
    return { ok: false, created: false, reason: 'network_error' };
  }
}

export interface RecoveryEmailResult {
  delivered: boolean;
  /** Stable machine-readable reason when not delivered. */
  reason?: 'rate_limited' | 'provider_error' | 'rejected' | 'network_error';
  status?: number;
  detail?: string;
}

/**
 * Ask Supabase to email its "Reset Password" template to `email`. The link in
 * that email verifies the token at Supabase and then redirects the browser to
 * `redirectTo` with a recovery session in the URL fragment.
 *
 * `redirectTo` must be allow-listed in the Supabase dashboard
 * (Authentication → URL Configuration → Redirect URLs), otherwise Supabase
 * silently falls back to the project's Site URL.
 */
export async function sendSupabaseRecoveryEmail(email: string, redirectTo: string): Promise<RecoveryEmailResult> {
  const apikey = config.supabaseAnonKey || config.supabaseServiceRoleKey;
  try {
    const result = await gotrue(`/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      apikey,
      body: { email, gotrue_meta_security: {} },
    });

    if (result.ok) return { delivered: true, status: result.status };

    const failure: RecoveryEmailResult = {
      delivered: false,
      status: result.status,
      detail: [result.errorCode, result.message].filter(Boolean).join(': ') || undefined,
      reason:
        result.status === 429
          ? 'rate_limited'
          : result.status >= 500
            ? 'provider_error'
            : 'rejected',
    };
    logger.error('Supabase Auth: recovery email was not accepted', {
      status: failure.status,
      reason: failure.reason,
      detail: failure.detail,
    });
    return failure;
  } catch (error) {
    logger.error('Supabase Auth: recover request failed', { error: describeFailure(error) });
    return { delivered: false, reason: 'network_error', detail: describeFailure(error) };
  }
}

/**
 * Development helper: mint the same link Supabase would email, without sending
 * anything. Lets the reset flow be exercised locally against a real project
 * while staying under Supabase's 2-emails-per-hour built-in mailer cap.
 *
 * Never call this together with `sendSupabaseRecoveryEmail` for the same user —
 * each call rotates the recovery token, invalidating the previous link.
 */
export async function generateSupabaseRecoveryLink(
  email: string,
  redirectTo: string
): Promise<{ link: string | null; reason?: string }> {
  try {
    const result = await gotrue<{ action_link?: string }>('/admin/generate_link', {
      method: 'POST',
      body: { type: 'recovery', email, redirect_to: redirectTo },
    });
    if (result.ok && result.body?.action_link) return { link: result.body.action_link };
    logger.warn('Supabase Auth: generate_link did not return a link', {
      status: result.status,
      errorCode: result.errorCode,
      message: result.message,
    });
    return { link: null, reason: result.errorCode ?? `http_${result.status}` };
  } catch (error) {
    logger.warn('Supabase Auth: generate_link request failed', { error: describeFailure(error) });
    return { link: null, reason: 'network_error' };
  }
}

export type RecoverySessionCheck =
  | { ok: true; userId: string; email: string; method: string; authenticatedAt: Date; sessionId?: string }
  | { ok: false; reason: 'invalid_token' | 'no_email' | 'not_recovery_session' | 'recovery_expired' | 'network_error' };

interface AmrEntry {
  method: string;
  timestamp?: number;
}

/**
 * Reads the claims of a JWT *without* verifying it. Only ever called with a
 * token string that Supabase has just validated via `GET /auth/v1/user`, so
 * the claims are those of a signed, unexpired token.
 */
function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  try {
    const json = Buffer.from(segments[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const claims = JSON.parse(json) as unknown;
    return claims && typeof claims === 'object' ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function normaliseAmr(raw: unknown): AmrEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): AmrEntry | null => {
      if (typeof entry === 'string') return { method: entry };
      if (entry && typeof entry === 'object' && typeof (entry as AmrEntry).method === 'string') {
        const timestamp = (entry as AmrEntry).timestamp;
        return { method: (entry as AmrEntry).method, timestamp: typeof timestamp === 'number' ? timestamp : undefined };
      }
      return null;
    })
    .filter((entry): entry is AmrEntry => entry !== null);
}

/**
 * Verify that `accessToken` is a live Supabase session that was created by
 * opening an emailed recovery/magic link recently enough to still count.
 *
 * 1. Supabase itself validates signature + expiry (`GET /auth/v1/user`).
 * 2. The `amr` claim must contain an email-proof method (`recovery`,
 *    `magiclink`) whose timestamp is within `recoverySessionMaxAgeMinutes`.
 * 3. The email comes from Supabase's response, never from the client.
 */
export async function verifySupabaseRecoverySession(accessToken: string): Promise<RecoverySessionCheck> {
  let user: { id?: string; email?: string } | null;
  try {
    const result = await gotrue<{ id?: string; email?: string }>('/user', { bearer: accessToken });
    if (!result.ok || !result.body) return { ok: false, reason: 'invalid_token' };
    user = result.body;
  } catch (error) {
    logger.error('Supabase Auth: could not validate recovery session', { error: describeFailure(error) });
    return { ok: false, reason: 'network_error' };
  }

  const email = user.email?.trim().toLowerCase();
  if (!user.id || !email) return { ok: false, reason: 'no_email' };

  const claims = decodeJwtClaims(accessToken) ?? {};
  const proof = normaliseAmr(claims.amr).filter((entry) => EMAIL_PROOF_METHODS.has(entry.method));
  if (proof.length === 0) return { ok: false, reason: 'not_recovery_session' };

  // Newest email-proof event wins; entries without a timestamp fall back to `iat`.
  const iat = typeof claims.iat === 'number' ? claims.iat : Math.floor(Date.now() / 1000);
  const newest = proof.reduce((best, entry) => ((entry.timestamp ?? iat) > (best.timestamp ?? iat) ? entry : best));
  const authenticatedAtSeconds = newest.timestamp ?? iat;
  const ageMinutes = (Date.now() / 1000 - authenticatedAtSeconds) / 60;
  if (ageMinutes > config.passwordReset.recoverySessionMaxAgeMinutes) {
    return { ok: false, reason: 'recovery_expired' };
  }

  return {
    ok: true,
    userId: user.id,
    email,
    method: newest.method,
    authenticatedAt: new Date(authenticatedAtSeconds * 1000),
    sessionId: typeof claims.session_id === 'string' ? claims.session_id : undefined,
  };
}

/**
 * Best-effort: end the recovery session everywhere once the password has been
 * rotated, so the link's session cannot be reused from the same browser.
 */
export async function revokeSupabaseSession(accessToken: string): Promise<boolean> {
  try {
    const result = await gotrue('/logout?scope=global', { method: 'POST', bearer: accessToken });
    return result.ok || result.status === 204;
  } catch (error) {
    logger.warn('Supabase Auth: could not revoke recovery session', { error: describeFailure(error) });
    return false;
  }
}
