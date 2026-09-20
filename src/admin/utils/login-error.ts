import { ApiError } from './api';

/**
 * Turns anything the login request can throw into a message that is actually
 * true.
 *
 * Why this exists: the console's API client always rejects with `ApiError`
 * (see `client.interceptors.response` in `utils/api.ts`), which carries the
 * server's message on `.message` and has no `.response`. Reading
 * `error.response?.data?.error` therefore always came back `undefined` and the
 * page showed "Invalid email or password" for *every* failure — a rate limit,
 * an account lockout, a missing CSRF cookie and an unreachable API all looked
 * like a wrong password.
 */
export interface LoginErrorInfo {
  message: string;
  hint?: string;
}

const FALLBACK = 'Sign-in failed. Please try again.';

function isAxiosShaped(error: unknown): error is { response?: { status?: number; data?: { error?: string; message?: string; code?: string } } } {
  return typeof error === 'object' && error !== null && 'response' in error;
}

export function describeLoginError(error: unknown): LoginErrorInfo {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'network_error':
      case 'timeout':
        return {
          message: error.message || 'Cannot reach the studio server. Check your connection.',
          hint: 'The console could not reach the API. Locally, start it with `npm run dev:server`; on a deployment, check the API is up.',
        };
      case 'rate_limited':
        return {
          message: error.message,
          hint: 'Too many failed attempts in a row. Wait 15 minutes — restarting the API clears the counter in local development.',
        };
      case 'account_locked':
        return {
          message: error.message,
          hint: 'Another studio admin can unlock the account from Team → Unlock.',
        };
      case 'account_inactive':
        return { message: error.message, hint: 'Ask a studio owner to reactivate the account.' };
      case 'csrf_missing':
      case 'csrf_failed':
        return {
          message: error.message,
          hint: 'Cookies are blocked for this page (common inside an embedded preview). Reload the page — the console switches to header-based sign-in automatically.',
        };
      case 'invalid_credentials':
        return {
          message: error.message,
          hint: 'The password is case-sensitive — use “Forgot password?” if you no longer remember it.',
        };
      default:
        return { message: error.message || FALLBACK };
    }
  }

  // Defensive: a raw axios/fetch-style error slipping through (older client
  // build, or an error thrown outside the interceptor).
  if (isAxiosShaped(error)) {
    const status = error.response?.status;
    const body = error.response?.data;
    if (body?.message || body?.error) return { message: body.message || body.error! };
    if (status === 429) return { message: 'Too many sign-in attempts. Please try again in 15 minutes.' };
    if (status === 423) return { message: 'Too many failed attempts. This account is locked for a few minutes.' };
    if (status === 401) return { message: 'Email or password is incorrect.' };
    if (!error.response) {
      return {
        message: 'Cannot reach the studio server. Check your connection.',
        hint: 'The console could not reach the API.',
      };
    }
  }

  if (error instanceof Error && error.message) return { message: error.message };
  return { message: FALLBACK };
}
