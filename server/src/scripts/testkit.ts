/**
 * Tiny zero-dependency HTTP test kit for the API.
 *
 * It keeps its own cookie jar (so HttpOnly session cookies behave exactly like
 * a browser), sends the double-submit CSRF header, and reports a readable
 * pass/fail summary with a non-zero exit code for CI.
 */

import { temporaryAdminPassword } from '../config/temporary-password.js';

const BASE_URL = process.env.TEST_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3001}`;

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  text: string;
  headers: Headers;
}

export class Actor {
  readonly cookies = new Map<string, string>();
  csrfToken: string | null = null;

  constructor(readonly name: string, private readonly baseUrl = BASE_URL) {}

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
  }

  private storeCookies(headers: Headers): void {
    const list = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
    for (const raw of list) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      if (index === -1) continue;
      const key = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (!value || value === 'deleted') this.cookies.delete(key);
      else this.cookies.set(key, value);
    }
  }

  async request<T = any>(
    method: string,
    path: string,
    options: { body?: unknown; headers?: Record<string, string>; origin?: string; csrf?: boolean; raw?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
    const cookie = this.cookieHeader();
    if (cookie) headers.Cookie = cookie;
    if (options.origin) headers.Origin = options.origin;

    let payload: string | FormData | undefined;
    if (options.body !== undefined) {
      if (options.body instanceof FormData) {
        payload = options.body;
      } else {
        headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
        payload = JSON.stringify(options.body);
      }
    }

    const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && options.csrf !== false;
    if (needsCsrf && this.csrfToken && !headers['X-CSRF-Token']) headers['X-CSRF-Token'] = this.csrfToken;

    const response = await fetch(`${this.baseUrl}${path}`, { method, headers, body: payload, redirect: 'manual' });
    this.storeCookies(response.headers);

    // Decoded with ignoreBOM so byte-level checks (e.g. CSV BOM) stay observable.
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await response.arrayBuffer());
    let body: any = text;
    if (!options.raw) {
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
    }
    return { status: response.status, body: body as T, text, headers: response.headers };
  }

  get = <T = any>(path: string, options?: Parameters<Actor['request']>[2]) => this.request<T>('GET', path, options);
  post = <T = any>(path: string, body?: unknown, options?: Parameters<Actor['request']>[2]) =>
    this.request<T>('POST', path, { ...options, body });
  patch = <T = any>(path: string, body?: unknown, options?: Parameters<Actor['request']>[2]) =>
    this.request<T>('PATCH', path, { ...options, body });
  put = <T = any>(path: string, body?: unknown, options?: Parameters<Actor['request']>[2]) =>
    this.request<T>('PUT', path, { ...options, body });
  del = <T = any>(path: string, body?: unknown, options?: Parameters<Actor['request']>[2]) =>
    this.request<T>('DELETE', path, { ...options, body });

  /** Fetches and remembers the double-submit CSRF token. */
  async primeCsrf(): Promise<string> {
    const response = await this.request('GET', '/api/auth/csrf');
    this.csrfToken = response.body?.csrfToken ?? this.cookies.get('bc_csrf') ?? null;
    return this.csrfToken ?? '';
  }

  async login(email: string, password: string): Promise<ApiResponse> {
    await this.primeCsrf();
    return this.post('/api/auth/login', { email, password });
  }

  async loginOrFail(email: string, password: string): Promise<ApiResponse> {
    const response = await this.login(email, password);
    if (response.status !== 200) {
      throw new Error(`${this.name}: sign-in failed (${response.status} ${JSON.stringify(response.body)})`);
    }
    return response;
  }
}

/* --------------------------------- reporting -------------------------------- */

let passed = 0;
const failures: string[] = [];
let currentSection = '';

export function section(name: string): void {
  currentSection = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

export function check(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failures.push(`${currentSection} → ${label}`);
    console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail !== undefined ? `  (${format(detail)})` : ''}`);
  }
}

export function expectStatus(response: ApiResponse, expected: number | number[], label: string): void {
  const wanted = Array.isArray(expected) ? expected : [expected];
  check(
    `${label} → ${wanted.join('/')}`,
    wanted.includes(response.status),
    `got ${response.status} ${format(response.body).slice(0, 160)}`
  );
}

export function format(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function summarize(title: string): number {
  const failed = failures.length;
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`\x1b[1m${title}\x1b[0m: \x1b[32m${passed} passed\x1b[0m, ${failed ? `\x1b[31m${failed} failed\x1b[0m` : '0 failed'}`);
  if (failed) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  • ${failure}`);
  }
  console.log(`${'─'.repeat(72)}\n`);
  return failed;
}

export const BASE = BASE_URL;
export const DEMO = {
  owner: { email: process.env.ADMIN_EMAIL || 'brainchildgamesin@gmail.com', password: process.env.ADMIN_PASSWORD || temporaryAdminPassword() },
  primary: { email: 'brainchildgamesin@gmail.com', password: process.env.BRAINCHILD_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || temporaryAdminPassword() },
  manager: { email: 'manager@brainchild.games', password: temporaryAdminPassword() },
  editor: { email: 'editor@brainchild.games', password: temporaryAdminPassword() },
};

export async function apiReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
