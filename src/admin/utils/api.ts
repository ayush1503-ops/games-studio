import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type {
  ActivityEntry,
  AdminGame,
  AdminJob,
  AdminPost,
  AdminUser,
  Category,
  ContactMessage,
  ContentBlock,
  DashboardStats,
  MediaAsset,
  Paged,
  Player,
  Role,
  SessionSummary,
  Subscriber,
  SystemSnapshot,
  TeamMember,
} from '../types';

const SAFE_METHODS = new Set(['get', 'head', 'options']);

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/* ---------------------------- session transport ---------------------------- */

/**
 * The console signs in with HttpOnly cookies — except when it cannot.
 *
 * Inside a cross-site iframe (an embedded preview panel) the browser will not
 * attach `SameSite=Lax` cookies to API calls and blocks third-party cookies
 * outright in several browsers, so a cookie-based sign-in can never complete:
 * every request arrives at the API without a session and it answers
 * `csrf_missing` / `unauthenticated`. Nothing the user types can fix that.
 *
 * In that situation the console uses the API's documented header transport
 * instead: the same tokens are returned in the response body and sent back as
 * `Authorization: Bearer`. Cookie mode stays the default everywhere else, so
 * the deployed site is unchanged.
 */
export type AuthTransport = 'cookie' | 'header';

const HEADER_ACCESS_KEY = 'bc_header_access';
const HEADER_REFRESH_KEY = 'bc_header_refresh';

let transport: AuthTransport | null = null;
// In-memory fallback for browsers that also block sessionStorage in a
// third-party frame: the session then lasts for the life of the tab.
let memoryAccess: string | null = null;
let memoryRefresh: string | null = null;

function storageGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return key === HEADER_ACCESS_KEY ? memoryAccess : memoryRefresh;
  }
}

function storageSet(key: string, value: string | null): void {
  if (key === HEADER_ACCESS_KEY) memoryAccess = value;
  else memoryRefresh = value;
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable in this context — the in-memory copy is enough */
  }
}

export function storeSessionTokens(accessToken?: string, refreshToken?: string): void {
  if (accessToken) storageSet(HEADER_ACCESS_KEY, accessToken);
  if (refreshToken) storageSet(HEADER_REFRESH_KEY, refreshToken);
}

export function clearSessionTokens(): void {
  storageSet(HEADER_ACCESS_KEY, null);
  storageSet(HEADER_REFRESH_KEY, null);
}

/** True when the page is rendered inside another document (preview panels). */
function inEmbeddedFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin parent: reading window.top throws, which means we are framed.
    return true;
  }
}

/** True when the browser will actually keep a cookie we set from script. */
function cookiesWritable(): boolean {
  try {
    document.cookie = '__bc_probe=1; Path=/; SameSite=Lax';
    const writable = document.cookie.includes('__bc_probe=1');
    document.cookie = '__bc_probe=; Path=/; Max-Age=0; SameSite=Lax';
    return writable;
  } catch {
    return false;
  }
}

export function authTransport(): AuthTransport {
  if (!transport) transport = inEmbeddedFrame() || !cookiesWritable() ? 'header' : 'cookie';
  return transport;
}

/** Switches to the header transport for the rest of this page's lifetime. */
export function useHeaderTransport(): void {
  if (transport !== 'header') {
    transport = 'header';
    // A cookie-mode CSRF token is meaningless in header mode; drop it so the
    // next request does not try to reuse it.
    csrfReady = null;
  }
}

/** Raised for every non-2xx API response so pages can render field errors. */
export class ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  fields: { field: string; message: string }[];

  constructor(message: string, status: number, code = 'request_failed', fields: { field: string; message: string }[] = [], requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
  }

  fieldError(field: string): string | undefined {
    return this.fields.find((entry) => entry.field === field)?.message;
  }
}

export const client: AxiosInstance = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 20_000,
  headers: { Accept: 'application/json' },
});

/* ------------------------------ CSRF priming ------------------------------ */

let csrfReady: Promise<void> | null = null;

/**
 * Ensures an `bc_csrf` cookie exists and returns its value. Every mutating
 * action is preceded by this so the double-submit check never surprises a user.
 */
export async function ensureCsrf(): Promise<string | null> {
  let token = readCookie('bc_csrf');
  if (token) return token;

  if (!csrfReady) {
    csrfReady = client
      .get<{ csrfToken: string }>('/auth/csrf')
      .then((response) => {
        token = response.data.csrfToken ?? readCookie('bc_csrf');
      })
      .catch(() => undefined)
      .finally(() => {
        csrfReady = null;
      });
  }
  await csrfReady;
  return readCookie('bc_csrf');
}

client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toLowerCase();
  const headerMode = authTransport() === 'header';

  if (headerMode) {
    const access = storageGet(HEADER_ACCESS_KEY);
    if (access) config.headers.set('Authorization', `Bearer ${access}`);
    config.headers.set('X-Auth-Transport', 'header');
    // No CSRF token needed: the API accepts a Bearer request without one
    // because a cross-site attacker cannot attach that header.
    return config;
  }

  if (SAFE_METHODS.has(method)) return config;
  const token = await ensureCsrf();
  if (token) config.headers.set('X-CSRF-Token', token);
  return config;
});

/* --------------------------- refresh-on-401 once -------------------------- */

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    const headerMode = authTransport() === 'header';
    const body = headerMode ? { refreshToken: storageGet(HEADER_REFRESH_KEY) ?? undefined } : {};

    refreshInFlight = client
      .post<{ accessToken?: string; refreshToken?: string }>('/auth/refresh', body)
      .then((response) => {
        if (headerMode) {
          const { accessToken, refreshToken } = response.data ?? {};
          if (!accessToken) return false;
          storeSessionTokens(accessToken, refreshToken);
        }
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const code = (error.response?.data as { code?: string } | undefined)?.code;
    const isAuthRoute = typeof config?.url === 'string' && config.url.startsWith('/auth/');
    // `/auth/me` is the session probe, not a credential submission: it is safe
    // to refresh and retry it, so a reload after the access token's 30 minutes
    // keeps the session instead of bouncing back to the login page.
    const refreshable = !isAuthRoute || config?.url === '/auth/me';

    // Browsers that silently drop third-party cookies make cookie mode
    // impossible; switch transports and retry instead of showing the user a
    // "security token missing" dead end they cannot act on.
    if (code === 'csrf_missing' && authTransport() === 'cookie' && config && !config._retried) {
      config._retried = true;
      useHeaderTransport();
      return client.request(config);
    }

    if (status === 401 && config && !config._retried && refreshable) {
      config._retried = true;
      if (await refreshSession()) {
        return client.request(config);
      }
    }

    if (error.response?.data) {
      const data = error.response.data as {
        error?: string;
        code?: string;
        message?: string;
        details?: { field: string; message: string }[];
        requestId?: string;
      };
      throw new ApiError(
        data.message || data.error || 'Something went wrong. Please try again.',
        status ?? 0,
        data.code,
        Array.isArray(data.details) ? data.details : [],
        data.requestId
      );
    }

    if (error.code === 'ECONNABORTED') {
      throw new ApiError('The studio server took too long to respond. Try again.', 0, 'timeout');
    }
    throw new ApiError('Cannot reach the studio server. Check your connection.', 0, 'network_error');
  }
);

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

/* --------------------------------- auth ---------------------------------- */

export const authApi = {
  async me() {
    // The API's auth responses are keyed `admin` (not `user`).
    const { data } = await client.get<{ admin: AdminUser; csrfToken?: string }>('/auth/me');
    return data.admin;
  },
  async login(email: string, password: string) {
    const { data } = await client.post<{
      admin: AdminUser;
      csrfToken?: string;
      /** Present for the header transport (embedded consoles). */
      accessToken?: string;
      refreshToken?: string;
    }>('/auth/login', { email, password });
    storeSessionTokens(data.accessToken, data.refreshToken);
    return data;
  },
  async logout() {
    try {
      await client.post('/auth/logout');
    } finally {
      clearSessionTokens();
    }
  },
  async logoutAll() {
    try {
      await client.post('/auth/logout-all');
    } finally {
      clearSessionTokens();
    }
  },
  async changePassword(currentPassword: string, newPassword: string) {
    await client.post('/auth/change-password', { currentPassword, newPassword });
  },
  /**
   * Requests a reset link. Always resolves with the same message whether or not
   * the address exists (no account enumeration).
   *
   * `emailDeliveryEnabled` describes the *deployment*, not the address, so the
   * form can warn when no mail transport is configured instead of promising an
   * email that will never arrive.
   */
  async forgotPassword(email: string) {
    const { data } = await client.post<{
      message: string;
      devResetUrl?: string;
      /** Development only: why the send failed (never returned in production). */
      devDeliveryError?: string;
      emailDeliveryEnabled?: boolean;
      /** Which service carries the email for this deployment. */
      emailDeliveryChannel?: 'supabase' | 'smtp' | 'console' | 'none';
      emailDeliveryReason?: string;
    }>('/auth/forgot-password', { email });
    return data;
  },
  /**
   * Sets a new password using one of two proofs from the reset email:
   *  - `{ token }`               the one-time token in an SMTP/console reset link
   *  - `{ supabaseAccessToken }` the session Supabase created when its emailed
   *                              recovery link was opened
   *
   * The payload key is `newPassword`, not `password`: the route validates with
   * a `.strict()` Zod object (see `server/src/routes/auth.ts`), so a wrong key
   * is rejected with a 400 before the password is ever touched.
   */
  async resetPassword(
    proof: { token: string } | { supabaseAccessToken: string },
    newPassword: string
  ) {
    const { data } = await client.post<{ message: string }>('/auth/reset-password', { ...proof, newPassword });
    return data;
  },
  async sessions() {
    const { data } = await client.get<{ sessions: SessionSummary[] }>('/auth/sessions');
    return data.sessions;
  },
  async revokeSession(id: string) {
    await client.delete(`/auth/sessions/${encodeURIComponent(id)}`);
  },
};

/* ------------------------------- dashboard -------------------------------- */

export const dashboardApi = {
  async overview() {
    const { data } = await client.get<DashboardStats>('/admin/dashboard');
    return data;
  },
};

/* --------------------------------- games ---------------------------------- */

export interface GameFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  published?: 'true' | 'false' | 'all';
  featured?: 'true' | 'false' | 'all';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const gamesApi = {
  async list(filters: GameFilters = {}) {
    const { data } = await client.get<Paged<AdminGame>>('/admin/games', { params: filters });
    return data;
  },
  async featured() {
    const { data } = await client.get<{ games: AdminGame[] }>('/admin/games/featured');
    return data.games;
  },
  async get(id: string) {
    const { data } = await client.get<{ game: AdminGame }>(`/admin/games/${id}`);
    return data.game;
  },
  async create(payload: Partial<AdminGame>) {
    const { data } = await client.post<{ game: AdminGame }>('/admin/games', payload);
    return data.game;
  },
  async update(id: string, payload: Partial<AdminGame>) {
    const { data } = await client.patch<{ game: AdminGame }>(`/admin/games/${id}`, payload);
    return data.game;
  },
  async remove(id: string, confirm: string) {
    await client.delete(`/admin/games/${id}`, { data: { confirm } });
  },
  async publish(id: string, published: boolean) {
    const { data } = await client.post<{ game: AdminGame }>(`/admin/games/${id}/publish`, { published });
    return data.game;
  },
  async feature(id: string, featured: boolean) {
    const { data } = await client.post<{ game: AdminGame }>(`/admin/games/${id}/featured`, { featured });
    return data.game;
  },
  async reorderFeatured(ids: string[]) {
    await client.post('/admin/games/reorder-featured', { ids });
  },
  async duplicate(id: string) {
    const { data } = await client.post<{ game: AdminGame }>(`/admin/games/${id}/duplicate`);
    return data.game;
  },
};

/* ---------------------------------- news ---------------------------------- */

export interface NewsFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ALL';
  categoryId?: string;
}

export const newsApi = {
  async list(filters: NewsFilters = {}) {
    const { data } = await client.get<Paged<AdminPost>>('/admin/news', { params: filters });
    return data;
  },
  async get(id: string) {
    const { data } = await client.get<{ post: AdminPost }>(`/admin/news/${id}`);
    return data.post;
  },
  async create(payload: Record<string, unknown>) {
    const { data } = await client.post<{ post: AdminPost }>('/admin/news', payload);
    return data.post;
  },
  async update(id: string, payload: Record<string, unknown>) {
    const { data } = await client.patch<{ post: AdminPost }>(`/admin/news/${id}`, payload);
    return data.post;
  },
  async remove(id: string, confirm: string) {
    await client.delete(`/admin/news/${id}`, { data: { confirm } });
  },
  async publish(id: string, published: boolean) {
    const { data } = await client.post<{ post: AdminPost }>(`/admin/news/${id}/publish`, { published });
    return data.post;
  },
  async feature(id: string, featured: boolean) {
    const { data } = await client.post<{ post: AdminPost }>(`/admin/news/${id}/featured`, { featured });
    return data.post;
  },
};

/* ------------------------------- categories ------------------------------- */

export const categoriesApi = {
  async list() {
    const { data } = await client.get<{ categories: Category[] }>('/admin/categories');
    return data.categories;
  },
  async create(payload: { name: string; description?: string; color?: string }) {
    const { data } = await client.post<{ category: Category }>('/admin/categories', payload);
    return data.category;
  },
  async update(id: string, payload: { name?: string; description?: string; color?: string }) {
    const { data } = await client.patch<{ category: Category }>(`/admin/categories/${id}`, payload);
    return data.category;
  },
  async remove(id: string) {
    await client.delete(`/admin/categories/${id}`);
  },
};

/* ---------------------------------- jobs ---------------------------------- */

export const jobsApi = {
  async list(params: { status?: 'open' | 'closed' | 'all' } = {}) {
    const { data } = await client.get<Paged<AdminJob>>('/admin/jobs', { params });
    return data;
  },
  async create(payload: Record<string, unknown>) {
    const { data } = await client.post<{ job: AdminJob }>('/admin/jobs', payload);
    return data.job;
  },
  async update(id: string, payload: Record<string, unknown>) {
    const { data } = await client.patch<{ job: AdminJob }>(`/admin/jobs/${id}`, payload);
    return data.job;
  },
  async remove(id: string, confirm: string) {
    await client.delete(`/admin/jobs/${id}`, { data: { confirm } });
  },
};

/* --------------------------------- media ---------------------------------- */

export const mediaApi = {
  async list(params: { page?: number; limit?: number; search?: string } = {}) {
    const { data } = await client.get<Paged<MediaAsset>>('/admin/media', { params });
    return data;
  },
  async upload(file: File, alt?: string) {
    const form = new FormData();
    form.append('file', file);
    if (alt) form.append('alt', alt);
    const { data } = await client.post<{ asset: MediaAsset }>('/admin/media/upload', form);
    return data.asset;
  },
  async remove(id: string) {
    await client.delete(`/admin/media/${id}`);
  },
  async verify(url: string) {
    const { data } = await client.post<{ exists: boolean; asset?: MediaAsset }>('/admin/media/verify', { url });
    return data;
  },
};

/* -------------------------------- players --------------------------------- */

export const playersApi = {
  async list(params: { page?: number; limit?: number; search?: string; status?: string; role?: string } = {}) {
    const { data } = await client.get<Paged<Player>>('/admin/players', { params });
    return data;
  },
  async get(id: string) {
    const { data } = await client.get<{ player: Player }>(`/admin/players/${id}`);
    return data.player;
  },
  async update(id: string, payload: Partial<Player>) {
    const { data } = await client.patch<{ player: Player }>(`/admin/players/${id}`, payload);
    return data.player;
  },
  async remove(id: string, confirm: string) {
    await client.delete(`/admin/players/${id}`, { data: { confirm } });
  },
};

/* ------------------------------ subscribers ------------------------------- */

export const subscribersApi = {
  async list(params: { page?: number; limit?: number; search?: string; status?: string } = {}) {
    const { data } = await client.get<Paged<Subscriber>>('/admin/subscribers', { params });
    return data;
  },
  async create(payload: { email: string; name?: string; interests?: string[]; source?: string }) {
    const { data } = await client.post<{ subscriber: Subscriber }>('/admin/subscribers', payload);
    return data.subscriber;
  },
  async update(id: string, payload: { status?: string; name?: string; interests?: string[] }) {
    const { data } = await client.patch<{ subscriber: Subscriber }>(`/admin/subscribers/${id}`, payload);
    return data.subscriber;
  },
  async remove(id: string) {
    await client.delete(`/admin/subscribers/${id}`);
  },
  async exportCsv(params: { search?: string; status?: string } = {}) {
    const { data } = await client.get<Blob>('/admin/subscribers/export.csv', { params, responseType: 'blob' });
    return data;
  },
  async exportJson(params: { search?: string; status?: string } = {}) {
    const { data } = await client.get<unknown>('/admin/subscribers/export.json', { params });
    return data;
  },
};

/* -------------------------------- contacts -------------------------------- */

export const contactsApi = {
  async list(params: { page?: number; limit?: number; search?: string; status?: string } = {}) {
    const { data } = await client.get<Paged<ContactMessage>>('/admin/contacts', { params });
    return data;
  },
  async get(id: string) {
    const { data } = await client.get<{ message: ContactMessage }>(`/admin/contacts/${id}`);
    return data.message;
  },
  async update(id: string, payload: { status?: string; notes?: string }) {
    const { data } = await client.patch<{ message: ContactMessage }>(`/admin/contacts/${id}`, payload);
    return data.message;
  },
  async remove(id: string) {
    await client.delete(`/admin/contacts/${id}`);
  },
};

/* ---------------------------------- team ---------------------------------- */

export const teamApi = {
  async list() {
    const { data } = await client.get<{ team: TeamMember[] }>('/admin/team');
    return data.team;
  },
  async create(payload: { email: string; name: string; role: Role }) {
    const { data } = await client.post<{ member: TeamMember; oneTimePassword?: string }>('/admin/team', payload);
    return data;
  },
  async update(id: string, payload: { name?: string; role?: Role; isActive?: boolean }) {
    const { data } = await client.patch<{ member: TeamMember }>(`/admin/team/${id}`, payload);
    return data.member;
  },
  async remove(id: string, confirm: string) {
    await client.delete(`/admin/team/${id}`, { data: { confirm } });
  },
  async resetPassword(id: string) {
    const { data } = await client.post<{ oneTimePassword?: string; message: string }>(`/admin/team/${id}/reset-password`);
    return data;
  },
  async unlock(id: string) {
    const { data } = await client.post<{ member: TeamMember }>(`/admin/team/${id}/unlock`);
    return data.member;
  },
};

/* -------------------------------- content --------------------------------- */

export const contentApi = {
  async blocks() {
    // The API keys editable content blocks `content` (and `settings`).
    const { data } = await client.get<{ content: ContentBlock[]; settings: ContentBlock[] }>('/admin/content');
    return { blocks: data.content, settings: data.settings };
  },
  async updateBlock(key: string, value: unknown) {
    const { data } = await client.put<{ block: ContentBlock }>(`/admin/content/${encodeURIComponent(key)}`, { value });
    return data.block;
  },
  async resetBlock(key: string) {
    await client.post(`/admin/content/${encodeURIComponent(key)}/reset`);
  },
  async updateSetting(key: string, value: unknown) {
    const { data } = await client.put<{ setting: ContentBlock }>(`/admin/content/settings/${encodeURIComponent(key)}`, { value });
    return data.setting;
  },
  async resetSetting(key: string) {
    await client.post(`/admin/content/settings/${encodeURIComponent(key)}/reset`);
  },
};

/* -------------------------------- activity -------------------------------- */

export const activityApi = {
  async list(params: { page?: number; limit?: number; search?: string; action?: string; adminId?: string } = {}) {
    const { data } = await client.get<Paged<ActivityEntry>>('/admin/activity', { params });
    return data;
  },
  async stats() {
    const { data } = await client.get<{
      daily: { day: string; count: number }[];
      topActors: { id: string; name: string; count: number }[];
      topActions: { action: string; count: number }[];
      total: number;
    }>('/admin/activity/stats');
    return data;
  },
};

/* --------------------------------- backup --------------------------------- */

export const backupApi = {
  async exportBundle() {
    const { data } = await client.get<Record<string, unknown>>('/admin/backup/export');
    return data;
  },
  async system() {
    const { data } = await client.get<SystemSnapshot>('/admin/backup/system');
    return data;
  },
  async roles() {
    const { data } = await client.get<{
      roles: { role: Role; description: string; permissions: string[] }[];
      permissions: string[];
    }>('/admin/backup/roles');
    return data;
  },
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadJson = (payload: unknown, filename: string) => {
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), filename);
};

export const api = {
  auth: authApi,
  dashboard: dashboardApi,
  games: gamesApi,
  news: newsApi,
  categories: categoriesApi,
  jobs: jobsApi,
  media: mediaApi,
  players: playersApi,
  subscribers: subscribersApi,
  contacts: contactsApi,
  team: teamApi,
  content: contentApi,
  activity: activityApi,
  backup: backupApi,
};

export default api;
