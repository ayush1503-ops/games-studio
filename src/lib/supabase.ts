import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client (browser-side, publishable/anon key only).
 *
 * Configuration is read from Vite environment variables:
 *   VITE_SUPABASE_URL      – the project URL, e.g. https://kxirdoacrphluervussu.supabase.co
 *                            (always https://<project-ref>.supabase.co — the ref is the
 *                            20-character id in the dashboard URL, *not* a piece of the key)
 *   VITE_SUPABASE_ANON_KEY – the publishable/anon key (safe to expose)
 *
 * Both are validated at import time so misconfiguration is loud, not silent.
 */

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

if (!url) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL is not set. Supabase features (auth, player data, wishlist) will be disabled.'
  );
}
if (!anonKey) {
  // eslint-disable-next-line no-console
  console.warn('[supabase] VITE_SUPABASE_ANON_KEY is not set. Supabase features will be disabled.');
}

/**
 * Parameters Supabase Auth appends to the URL when it redirects back to the
 * site after an emailed link is opened, e.g.
 *   /admin/reset-password#access_token=…&refresh_token=…&type=recovery
 *   /admin/reset-password#error=access_denied&error_code=otp_expired&error_description=…
 *
 * The SDK consumes and *removes* these from the URL while it initialises, so
 * they are captured once here — before `createClient` runs — and exposed as a
 * plain object that pages can read at any time.
 */
export interface AuthCallbackParams {
  /** `recovery`, `signup`, `magiclink`, `invite`, `email_change` … */
  type: string | null;
  /** True when the URL carried a session (implicit flow) or a PKCE code. */
  hasCredentials: boolean;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}

function readAuthCallbackParams(): AuthCallbackParams {
  const empty: AuthCallbackParams = {
    type: null,
    hasCredentials: false,
    error: null,
    errorCode: null,
    errorDescription: null,
  };
  if (typeof window === 'undefined') return empty;

  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#/, '');
  if (hash) {
    for (const [key, value] of new URLSearchParams(hash)) {
      if (!params.has(key)) params.set(key, value);
    }
  }

  return {
    type: params.get('type'),
    hasCredentials: params.has('access_token') || params.has('code'),
    error: params.get('error'),
    errorCode: params.get('error_code'),
    errorDescription: params.get('error_description'),
  };
}

export const authCallbackParams: AuthCallbackParams = readAuthCallbackParams();

/** True when this page load is the landing of a password-recovery email link. */
export const isPasswordRecoveryCallback = (): boolean =>
  authCallbackParams.type === 'recovery' && authCallbackParams.hasCredentials;

/**
 * True when Supabase redirected back with an error instead of a session
 * (expired/used link, etc.). Error redirects carry no `type`, so callers
 * cannot tell which kind of link failed — in this app the only emailed auth
 * links are password-recovery ones.
 */
export const hasAuthCallbackError = (): boolean =>
  Boolean(authCallbackParams.errorCode || authCallbackParams.error);

/** Human-readable text for an auth-callback error, or null when there is none. */
export function describeAuthCallbackError(): string | null {
  if (!hasAuthCallbackError()) return null;
  const code = authCallbackParams.errorCode ?? authCallbackParams.error ?? '';
  if (code === 'otp_expired') return 'This reset link has expired or was already used. Please request a new one.';
  if (code === 'access_denied') return 'This reset link could not be verified. Please request a new one.';
  return (
    authCallbackParams.errorDescription?.replace(/\+/g, ' ') ??
    'This reset link could not be verified. Please request a new one.'
  );
}

/**
 * Singleton client. When credentials are missing we export `null` so UI code
 * can gracefully fall back rather than crashing the bundle.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Use local storage by default for SPA sessions.
          storageKey: 'brainchild-supabase-auth-token',
        },
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      })
    : null;

/** Type guard: returns true if Supabase is configured and safe to call. */
export const isSupabaseConfigured = (): boolean => supabase !== null;

export default supabase;
