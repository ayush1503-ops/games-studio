import { CookieOptions, Response } from 'express';
import { config } from '../config/env.js';

export const ACCESS_COOKIE = 'bc_at';
export const REFRESH_COOKIE = 'bc_sid';
export const CSRF_COOKIE = 'bc_csrf';

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'lax',
  path: '/',
  ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
};

export function setSessionCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string }
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions,
    maxAge: config.accessTokenTtlMinutes * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions,
    maxAge: config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookies(res: Response): void {
  const clear: CookieOptions = { ...baseOptions, maxAge: undefined };
  res.clearCookie(ACCESS_COOKIE, clear);
  res.clearCookie(REFRESH_COOKIE, clear);
}

/** CSRF cookie is intentionally readable by JS: it is the "double submit" half. */
export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  });
}

export function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE, { path: '/', secure: config.cookieSecure, sameSite: 'lax' });
}
