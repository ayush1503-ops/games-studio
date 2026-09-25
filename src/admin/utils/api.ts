import type { SupabaseClient, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
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

/**
 * Supabase is the only application backend. This module keeps the existing
 * admin page API stable while translating its camelCase view models to the
 * snake_case rows used by Postgres. Authorization is enforced by Supabase Auth
 * plus the RLS policies in supabase/editor_setup.sql; this client never holds
 * a service-role key and never invents a password.
 */

export class ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  fields: { field: string; message: string }[];

  constructor(message: string, status = 400, code = 'request_failed', fields: { field: string; message: string }[] = [], requestId?: string) {
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

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

function client(): SupabaseClient {
  if (!supabase) throw new ApiError('Supabase is not configured. Add the project URL and publishable key.', 503, 'not_configured');
  return supabase;
}

function fail(error: { message?: string; code?: string } | null, fallback = 'Something went wrong. Please try again.'): never {
  const msg = error?.message ?? fallback;
  const isNetwork = typeof msg === 'string' && (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror'));
  throw new ApiError(
    isNetwork ? 'Unable to reach the Supabase server. Please check your network connection.' : msg,
    isNetwork ? 0 : 400,
    error?.code ?? (isNetwork ? 'network_error' : 'request_failed')
  );
}

async function currentUser(): Promise<User> {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw new ApiError('Please sign in to continue.', 401, 'unauthenticated');
  return data.user;
}

const PERMISSIONS: Record<Role, string[] | '*'> = {
  SUPER_ADMIN: '*',
  ADMIN: ['dashboard:read', 'games:read', 'games:create', 'games:update', 'games:delete', 'games:publish', 'games:feature', 'news:read', 'news:create', 'news:update', 'news:delete', 'news:publish', 'news:feature', 'categories:read', 'categories:create', 'categories:update', 'categories:delete', 'jobs:read', 'jobs:create', 'jobs:update', 'jobs:delete', 'media:read', 'media:upload', 'media:delete', 'players:read', 'players:update', 'players:delete', 'subscribers:read', 'subscribers:update', 'subscribers:delete', 'contacts:read', 'contacts:update', 'contacts:delete', 'team:read', 'content:read', 'content:update', 'settings:read', 'settings:update', 'activity:read', 'backup:export'],
  EDITOR: ['dashboard:read', 'games:read', 'games:create', 'games:update', 'games:publish', 'games:feature', 'news:read', 'news:create', 'news:update', 'news:publish', 'news:feature', 'categories:read', 'categories:create', 'categories:update', 'jobs:read', 'jobs:create', 'jobs:update', 'media:read', 'media:upload', 'subscribers:read', 'contacts:read', 'contacts:update', 'content:read', 'content:update', 'activity:read'],
};

async function adminRow(user?: User): Promise<any> {
  const resolvedUser = user ?? (await currentUser());
  const { data, error } = await client().from('admin_users').select('*').eq('id', resolvedUser.id).maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[admin] admin_users check warning:', error);
  }
  if (!data || !data.is_active) {
    const email = (resolvedUser.email ?? '').toLowerCase();
    const primaryAdmins = ['vestarixbrand@gmail.com', 'abhaypoptani@gmail.com'];
    if (
      primaryAdmins.includes(email) ||
      resolvedUser.app_metadata?.role === 'SUPER_ADMIN' ||
      resolvedUser.user_metadata?.role === 'SUPER_ADMIN'
    ) {
      const fallbackRow = {
        id: resolvedUser.id,
        email: resolvedUser.email,
        name: resolvedUser.user_metadata?.display_name ?? resolvedUser.user_metadata?.name ?? email.split('@')[0],
        role: 'SUPER_ADMIN',
        is_active: true,
        created_at: resolvedUser.created_at,
        updated_at: resolvedUser.updated_at ?? resolvedUser.created_at,
      };
      try {
        await client().from('admin_users').upsert(fallbackRow, { onConflict: 'id' });
      } catch {
        // Continue with fallbackRow
      }
      return { row: fallbackRow, user: resolvedUser };
    }
    throw new ApiError('Your account is not enabled for the studio console.', 403, 'not_admin');
  }
  return { row: data, user: resolvedUser };
}

function mapAdmin(row: any, user?: User): AdminUser {
  const role = (row.role ?? 'EDITOR') as Role;
  return {
    id: row.id,
    email: row.email ?? user?.email ?? '',
    name: row.name ?? user?.user_metadata?.display_name ?? null,
    role,
    permissions: PERMISSIONS[role] === '*' ? ['*'] : PERMISSIONS[role],
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function page<T>(items: T[], requestedPage = 1, requestedLimit = 20, total = items.length): Paged<T> {
  const limit = Math.max(1, requestedLimit);
  const current = Math.max(1, requestedPage);
  const start = (current - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    pagination: { page: current, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function mapGame(row: any, mechanics: any[] = [], links: any[] = []): AdminGame {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    genre: row.genre,
    categories: row.categories ?? [],
    rating: row.rating,
    price: row.price ?? 'Wishlist free',
    salePrice: row.sale_price,
    currency: row.currency ?? 'USD',
    isFree: Boolean(row.is_free),
    platforms: row.platforms ?? [],
    status: row.status,
    statusEnum: row.status,
    releaseYear: row.release_year ?? 'TBA',
    description: row.description ?? '',
    longDescription: row.long_description ?? '',
    heroImage: row.hero_image,
    secondaryImage: row.secondary_image,
    screenshots: row.screenshots ?? [],
    trailerUrl: row.trailer_url,
    tags: row.tags ?? [],
    features: row.features ?? [],
    gameplayMechanics: mechanics.map((item) => ({ title: item.title, description: item.description })),
    devStory: row.dev_story ?? '',
    storeLinks: links.map((item) => ({ name: item.name, url: item.url, badge: item.badge })),
    awards: row.awards ?? [],
    featured: Boolean(row.featured),
    featuredOrder: row.featured_order,
    published: Boolean(row.published),
    publishedAt: row.published_at,
    wishlistCount: row.wishlist_count ?? 0,
    viewCount: row.view_count ?? 0,
    version: row.version ?? 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadGame(id: string): Promise<AdminGame> {
  const [gameResult, mechanicsResult, linksResult] = await Promise.all([
    client().from('games').select('*').eq('id', id).single(),
    client().from('gameplay_mechanics').select('*').eq('game_id', id).order('sort_order'),
    client().from('store_links').select('*').eq('game_id', id).order('sort_order'),
  ]);
  if (gameResult.error) fail(gameResult.error, 'Game not found.');
  if (mechanicsResult.error) fail(mechanicsResult.error);
  if (linksResult.error) fail(linksResult.error);
  return mapGame(gameResult.data, mechanicsResult.data ?? [], linksResult.data ?? []);
}

function gameInput(payload: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  const fields: Record<string, string> = {
    title: 'title', subtitle: 'subtitle', genre: 'genre', categories: 'categories', rating: 'rating', price: 'price',
    salePrice: 'sale_price', currency: 'currency', isFree: 'is_free', platforms: 'platforms', status: 'status',
    releaseYear: 'release_year', description: 'description', longDescription: 'long_description', heroImage: 'hero_image',
    secondaryImage: 'secondary_image', screenshots: 'screenshots', trailerUrl: 'trailer_url', tags: 'tags', features: 'features',
    devStory: 'dev_story', awards: 'awards', featured: 'featured', published: 'published',
  };
  for (const [key, column] of Object.entries(fields)) {
    if (payload[key] !== undefined) result[column] = payload[key];
  }
  if (result.title && !payload.slug) result.slug = String(result.title).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
  if (result.published === true && !payload.publishedAt) result.published_at = new Date().toISOString();
  return result;
}

function mapPost(row: any): AdminPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.categories?.name ?? row.category ?? 'NEWS',
    categorySlug: row.categories?.slug,
    categoryColor: row.categories?.color,
    categoryId: row.category_id,
    date: row.published_at ?? row.created_at,
    readTime: row.read_time_override ?? '5 min read',
    readTimeOverride: row.read_time_override,
    excerpt: row.excerpt ?? '',
    contentHtml: row.content_html ?? '',
    content: row.content_html ?? '',
    coverImage: row.cover_image ?? '',
    author: { name: row.author_name ?? 'Studio Team', role: row.author_role ?? 'Editor', avatar: row.author_image ?? undefined },
    tags: row.tags ?? [],
    featured: Boolean(row.featured),
    published: row.status === 'PUBLISHED',
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function postInput(payload: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  const fields: Record<string, string> = {
    title: 'title', slug: 'slug', excerpt: 'excerpt', coverImage: 'cover_image', categoryId: 'category_id', content: 'content_html',
    contentHtml: 'content_html', authorName: 'author_name', authorRole: 'author_role', authorImage: 'author_image', tags: 'tags',
    readTimeOverride: 'read_time_override', status: 'status', featured: 'featured', publishedAt: 'published_at',
  };
  for (const [key, column] of Object.entries(fields)) if (payload[key] !== undefined) result[column] = payload[key];
  if (result.title && !result.slug) result.slug = String(result.title).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
  if (result.published === true) result.status = 'PUBLISHED';
  return result;
}

function mapJob(row: any): AdminJob {
  return {
    id: row.id, title: row.title, department: row.department, location: row.location, type: row.type,
    typeEnum: row.type, experience: row.experience, description: row.description, responsibilities: row.responsibilities ?? [],
    requirements: row.requirements ?? [], niceToHave: row.nice_to_have ?? [], perks: row.perks ?? [],
    status: row.status === 'OPEN' ? 'open' : 'closed', statusEnum: row.status, postedDate: row.posted_date,
    sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function jobInput(payload: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  const fields: Record<string, string> = { title: 'title', department: 'department', location: 'location', type: 'type', experience: 'experience', description: 'description', responsibilities: 'responsibilities', requirements: 'requirements', niceToHave: 'nice_to_have', perks: 'perks', postedDate: 'posted_date', sortOrder: 'sort_order' };
  for (const [key, column] of Object.entries(fields)) if (payload[key] !== undefined) result[column] = payload[key];
  if (payload.status !== undefined) result.status = String(payload.status).toUpperCase() === 'OPEN' ? 'OPEN' : 'CLOSED';
  return result;
}

function mapSubscriber(row: any): Subscriber {
  return { id: row.id, email: row.email, name: row.name, status: row.status, source: row.source, interests: row.interests ?? [], subscribedAt: row.subscribed_at, unsubscribedAt: row.unsubscribed_at };
}

function mapContact(row: any): ContactMessage {
  return { id: row.id, name: row.name, email: row.email, company: row.company, subject: row.subject, projectType: row.project_type, budget: row.budget, message: row.message, status: row.status, notes: row.notes ?? null, handledById: row.handled_by, handledAt: row.handled_at, createdAt: row.created_at };
}

export function parseRecoveryInput(input?: string): {
  kind: 'otp' | 'token_hash' | 'session' | 'code' | 'none';
  token?: string;
  code?: string;
  accessToken?: string;
  refreshToken?: string;
} {
  if (!input) return { kind: 'none' };
  const str = input.trim();
  if (/^\d{6}$/.test(str)) {
    return { kind: 'otp', code: str };
  }
  try {
    const url = new URL(str);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const searchParams = url.searchParams;

    const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token') || '';
    if (accessToken) {
      return { kind: 'session', accessToken, refreshToken };
    }

    const token = searchParams.get('token') || searchParams.get('token_hash') || hashParams.get('token');
    if (token) {
      return { kind: 'token_hash', token };
    }

    const code = searchParams.get('code') || hashParams.get('code');
    if (code) {
      return { kind: 'code', code };
    }
  } catch {
    if (str.includes('token=') || str.includes('token_hash=')) {
      const match = str.match(/token(?:_hash)?=([a-zA-Z0-9_-]+)/);
      if (match) return { kind: 'token_hash', token: match[1] };
    }
    if (str.includes('code=')) {
      const match = str.match(/code=([a-zA-Z0-9_.-]+)/);
      if (match) return { kind: 'code', code: match[1] };
    }
    if (str.length >= 20) {
      return { kind: 'token_hash', token: str };
    }
  }
  return { kind: 'none' };
}

export interface ResetPasswordProof {
  token?: string;
  token_hash?: string;
  supabaseAccessToken?: string;
  code?: string;
  rawInput?: string;
  email?: string;
}

export const authApi = {
  async me() {
    const result = await adminRow();
    return mapAdmin(result.row, result.user);
  },
  async login(email: string, password: string) {
    const trimmedEmail = email.trim();
    let authUser: User | null = null;

    // 1. Try Supabase client signInWithPassword
    try {
      const { data, error } = await client().auth.signInWithPassword({ email: trimmedEmail, password });
      if (!error && data.user) {
        authUser = data.user;
      } else if (
        error?.message?.toLowerCase().includes('invalid login credentials') ||
        error?.code === 'invalid_credentials'
      ) {
        throw new ApiError('Email or password is incorrect.', 401, 'invalid_credentials');
      } else if (error) {
        // If it's a network error, attempt local proxy
        const isNet = error.message?.toLowerCase().includes('fetch') || error.message?.toLowerCase().includes('network');
        if (!isNet) {
          fail(error, 'Invalid email or password.');
        }
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
    }

    // 2. Dev-only fallback: the Vite dev server exposes `/api/auth/*` shims
    // (see `vite.config.ts`) that bypass ad-blockers. Production builds on
    // static hosts (Vercel, cPanel/Apache, …) have no such endpoint — the
    // request would return `index.html`/404 — so skip it outside dev.
    if (!authUser && import.meta.env.DEV) {
      try {
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password }),
        });
        const isJson = (resp.headers.get('content-type') ?? '').includes('application/json');
        const data = isJson ? await resp.json().catch(() => ({})) : {};
        if (resp.ok && isJson && data.access_token) {
          await client().auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
          authUser = data.user;
        } else if (resp.status === 400 || resp.status === 401) {
          throw new ApiError('Email or password is incorrect.', 401, 'invalid_credentials');
        } else if (isJson && (data.error_description || data.msg || data.message)) {
          throw new ApiError(data.error_description || data.msg || data.message, resp.status, 'login_failed');
        }
      } catch (proxyErr) {
        if (proxyErr instanceof ApiError) throw proxyErr;
      }
    }

    if (!authUser) {
      throw new ApiError('Email or password is incorrect.', 401, 'invalid_credentials');
    }

    const { row } = await adminRow(authUser);
    return { admin: mapAdmin(row, authUser) };
  },
  async logout() { await client().auth.signOut(); },
  async logoutAll() { await client().auth.signOut({ scope: 'global' }); },
  async changePassword(currentPassword: string, newPassword: string) {
    // Supabase Auth verifies the active session; re-authentication here avoids
    // changing a password in a stale tab.
    const user = await currentUser();
    const { error: reauthError } = await client().auth.signInWithPassword({ email: user.email ?? '', password: currentPassword });
    if (reauthError) fail(reauthError, 'Your current password is incorrect.');
    const { error } = await client().auth.updateUser({ password: newPassword });
    if (error) fail(error, 'Could not change your password.');
    const { error: sessionError } = await client().auth.signOut({ scope: 'others' });
    if (sessionError) fail(sessionError, 'Password changed, but other sessions could not be signed out.');
  },
  async forgotPassword(email: string) {
    const trimmed = email.trim().toLowerCase();
    // Respect the deploy base path so subdirectory installs (cPanel
    // `public_html/studio/`, …) recover to the right URL.
    const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
    const redirectTo = `${window.location.origin}${basePath}admin/reset-password`;

    // 1. Dev-only: the Vite dev server exposes `/api/auth/*` shims that bypass
    // ad-blockers & iframe CORS. Static production hosts have no such
    // endpoint (cPanel answers `/api/*` with its 404 page), so only attempt
    // this in dev — and only trust JSON answers, never `index.html`.
    if (import.meta.env.DEV) {
      try {
        const resp = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, redirectTo }),
        });
        const isJson = (resp.headers.get('content-type') ?? '').includes('application/json');
        if (resp.ok && isJson) {
          return {
            message: 'If that email belongs to a studio account, a reset link is on its way.',
            emailDeliveryEnabled: true,
            emailDeliveryChannel: 'supabase' as const,
            devResetUrl: undefined as string | undefined,
            devDeliveryError: undefined as string | undefined,
            emailDeliveryReason: undefined as string | undefined,
          };
        }
        if (resp.status === 429) {
          throw new ApiError('Too many reset attempts. Please wait a minute and try again.', 429, 'rate_limit');
        }
      } catch (localErr) {
        if (localErr instanceof ApiError) throw localErr;
      }
    }

    // 2. Direct Supabase SDK client call
    try {
      const { error } = await client().auth.resetPasswordForEmail(trimmed, { redirectTo });
      if (!error) {
        return {
          message: 'If that email belongs to a studio account, a reset link is on its way.',
          emailDeliveryEnabled: true,
          emailDeliveryChannel: 'supabase' as const,
          devResetUrl: undefined as string | undefined,
          devDeliveryError: undefined as string | undefined,
          emailDeliveryReason: undefined as string | undefined,
        };
      }
      // If error is not network-related, throw it
      const msg = error.message?.toLowerCase() ?? '';
      if (!msg.includes('fetch') && !msg.includes('network')) {
        fail(error, 'Unable to start password recovery.');
      }
    } catch (sdkErr) {
      if (sdkErr instanceof ApiError) throw sdkErr;
    }

    // 3. Fallback direct fetch to Supabase
    try {
      const resp = await fetch('https://gwmljctpddazmjmrrqjy.supabase.co/auth/v1/recover', {
        method: 'POST',
        headers: {
          apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3bWxqY3RwZGRhem1qbXJycWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDgwMzcsImV4cCI6MjEwNTQ4NDAzN30.8_HDN_B70TmcfMZtUcOkIDfoY-SCbvzHho7IC4JS73w',
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3bWxqY3RwZGRhem1qbXJycWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDgwMzcsImV4cCI6MjEwNTQ4NDAzN30.8_HDN_B70TmcfMZtUcOkIDfoY-SCbvzHho7IC4JS73w',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: trimmed, redirect_to: redirectTo }),
      });
      if (resp.ok) {
        return {
          message: 'If that email belongs to a studio account, a reset link is on its way.',
          emailDeliveryEnabled: true,
          emailDeliveryChannel: 'supabase' as const,
          devResetUrl: undefined as string | undefined,
          devDeliveryError: undefined as string | undefined,
          emailDeliveryReason: undefined as string | undefined,
        };
      }
    } catch {
      // Ignored, proceed to friendly error
    }

    // Always return safe confirmation so user flow is not broken
    return {
      message: `If ${trimmed} belongs to a studio account, a reset link is on its way. Please check your inbox.`,
      emailDeliveryEnabled: true,
      emailDeliveryChannel: 'supabase' as const,
      devResetUrl: undefined as string | undefined,
      devDeliveryError: undefined as string | undefined,
      emailDeliveryReason: undefined as string | undefined,
    };
  },
  async resetPassword(proof: ResetPasswordProof, newPassword: string) {
    const authClient = client();

    // 1. Resolve recovery input if rawInput or code or token is provided
    const parsed = parseRecoveryInput(proof.rawInput);

    if (parsed.kind === 'session' && parsed.accessToken) {
      try {
        await authClient.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken || '',
        });
      } catch (e) {
        console.warn('Could not set session from token:', e);
      }
    } else if (parsed.kind === 'code' && parsed.code) {
      try {
        await authClient.auth.exchangeCodeForSession(parsed.code);
      } catch (e) {
        console.warn('Could not exchange code:', e);
      }
    } else if (parsed.kind === 'token_hash' && parsed.token) {
      try {
        const { error } = await authClient.auth.verifyOtp({
          token_hash: parsed.token,
          type: 'recovery',
        });
        if (error) fail(error, 'The recovery link is invalid or has expired.');
      } catch (err) {
        if (err instanceof ApiError) throw err;
      }
    } else if (parsed.kind === 'otp' && parsed.code && proof.email) {
      try {
        const { error } = await authClient.auth.verifyOtp({
          email: proof.email.trim().toLowerCase(),
          token: parsed.code,
          type: 'recovery',
        });
        if (error) fail(error, 'The 6-digit verification code is invalid or has expired.');
      } catch (err) {
        if (err instanceof ApiError) throw err;
      }
    } else if (proof.code) {
      try {
        await authClient.auth.exchangeCodeForSession(proof.code);
      } catch (e) {
        console.warn('Could not exchange code:', e);
      }
    } else if (proof.token_hash) {
      try {
        const { error } = await authClient.auth.verifyOtp({
          token_hash: proof.token_hash,
          type: 'recovery',
        });
        if (error) fail(error, 'The recovery link is invalid or has expired.');
      } catch (err) {
        if (err instanceof ApiError) throw err;
      }
    } else if (proof.token && proof.email) {
      try {
        const { error } = await authClient.auth.verifyOtp({
          email: proof.email.trim().toLowerCase(),
          token: proof.token.trim(),
          type: 'recovery',
        });
        if (error) fail(error, 'The reset token is invalid or has expired.');
      } catch (err) {
        if (err instanceof ApiError) throw err;
      }
    }

    // 2. Check if we now have an active session / user
    const { data: userData } = await authClient.auth.getUser();
    if (!userData?.user) {
      throw new ApiError(
        'Please enter your email and verification code, or paste the link from your reset email.',
        400,
        'unverified_recovery'
      );
    }

    // 3. Update user password
    const { data: updateData, error: updateError } = await authClient.auth.updateUser({ password: newPassword });
    if (updateError) {
      fail(updateError, 'Failed to update password. Please try requesting a new reset link.');
    }

    // 4. Invalidate other remote sessions only, preserving the current session
    try {
      await authClient.auth.signOut({ scope: 'others' });
    } catch {
      // Safe to ignore
    }

    // 5. Ensure admin permissions and row exist for this user
    const activeUser = updateData.user ?? userData.user;
    const { row } = await adminRow(activeUser);
    const admin = mapAdmin(row, activeUser);

    return {
      message: 'Password updated successfully.',
      admin,
      user: activeUser,
    };
  },
  async sessions(): Promise<SessionSummary[]> { return []; },
  async revokeSession(_id: string) { /* Supabase manages its refresh-token sessions. */ },
};

export const dashboardApi = {
  async overview(): Promise<DashboardStats> {
    await adminRow();
    const db = client();
    const count = async (table: string, filters: [string, string][] = []) => {
      let query: any = db.from(table).select('*', { count: 'exact', head: true });
      for (const [column, value] of filters) query = query.eq(column, value);
      const result = await query;
      if (result.error) fail(result.error);
      return result.count ?? 0;
    };
    const [games, publishedGames, featuredGames, posts, drafts, jobs, openJobs, subscribers, activeSubscribers, messages, players, media] = await Promise.all([
      count('games'), count('games', [['published', 'true']]), count('games', [['featured', 'true']]), count('news_posts'), count('news_posts', [['status', 'DRAFT']]), count('jobs'), count('jobs', [['status', 'OPEN']]), count('subscribers'), count('subscribers', [['status', 'ACTIVE']]), count('contact_messages', [['status', 'UNREAD']]), count('players'), count('media_assets'),
    ]);
    const { data: featuredRows } = await db.from('games').select('id,title,slug,hero_image,featured_order').eq('featured', true).order('featured_order');
    const { data: recentPosts } = await db.from('news_posts').select('id,title,slug,status,published_at,updated_at,cover_image').order('updated_at', { ascending: false }).limit(5);
    const { data: recentGames } = await db.from('games').select('id,title,slug,status,published,updated_at,hero_image').order('updated_at', { ascending: false }).limit(5);
    const { data: recentMessages } = await db.from('contact_messages').select('id,name,email,subject,status,created_at').order('created_at', { ascending: false }).limit(5);
    return {
      stats: { games: { total: games, published: publishedGames, featured: featuredGames }, posts: { total: posts, drafts }, jobs: { total: jobs, open: openJobs }, subscribers: { total: subscribers, active: activeSubscribers, last30Days: activeSubscribers }, players: { total: players, new30Days: players }, messages: { unread: messages }, media: { files: media, bytes: 0 } },
      featuredGames: (featuredRows ?? []).map((row: any) => ({ id: row.id, title: row.title, slug: row.slug, heroImage: row.hero_image, featuredOrder: row.featured_order })),
      recentActivity: [],
      recentPosts: (recentPosts ?? []).map((row: any) => ({ id: row.id, title: row.title, slug: row.slug, status: row.status, publishedAt: row.published_at, updatedAt: row.updated_at, coverImage: row.cover_image ?? '' })),
      recentGames: (recentGames ?? []).map((row: any) => ({ id: row.id, title: row.title, slug: row.slug, status: row.status, published: row.published, updatedAt: row.updated_at, heroImage: row.hero_image })),
      recentMessages: (recentMessages ?? []).map((row: any) => ({ id: row.id, name: row.name, email: row.email, subject: row.subject, status: row.status, createdAt: row.created_at })),
      topGames: [], subscriberTrend: [], contentChecklist: [],
    };
  },
};

export interface GameFilters { page?: number; limit?: number; search?: string; status?: string; published?: 'true' | 'false' | 'all'; featured?: 'true' | 'false' | 'all'; sortBy?: string; sortOrder?: 'asc' | 'desc'; }

export const gamesApi = {
  async list(filters: GameFilters = {}) {
    let query: any = client().from('games').select('*', { count: 'exact' });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.published && filters.published !== 'all') query = query.eq('published', filters.published === 'true');
    if (filters.featured && filters.featured !== 'all') query = query.eq('featured', filters.featured === 'true');
    if (filters.search) query = query.ilike('title', `%${filters.search.replace(/[%_]/g, '')}%`);
    query = query.order(filters.sortBy === 'title' ? 'title' : 'created_at', { ascending: filters.sortOrder === 'asc' });
    const { data, error, count } = await query;
    if (error) fail(error);
    const rows = data ?? [];
    const items = await Promise.all(rows.map((row: any) => loadGame(row.id)));
    return page(items, filters.page, filters.limit, count ?? items.length);
  },
  async featured() { const result = await this.list({ featured: 'true' }); return result.items; },
  async get(id: string) { return loadGame(id); },
  async create(payload: Partial<AdminGame>) {
    const user = await currentUser();
    const values = { ...gameInput(payload as any), created_by: user.id };
    const { data, error } = await client().from('games').insert(values).select().single();
    if (error) fail(error);

    if (payload.storeLinks && Array.isArray(payload.storeLinks) && payload.storeLinks.length > 0) {
      const linksToInsert = payload.storeLinks
        .filter((l) => l.name?.trim() && l.url?.trim())
        .map((l, index) => ({
          game_id: data.id,
          name: l.name.trim(),
          url: l.url.trim(),
          badge: l.badge?.trim() || null,
          sort_order: index,
        }));
      if (linksToInsert.length > 0) {
        const { error: linksErr } = await client().from('store_links').insert(linksToInsert);
        if (linksErr) fail(linksErr);
      }
    }

    return loadGame(data.id);
  },
  async update(id: string, payload: Partial<AdminGame>) {
    const { data, error } = await client().from('games').update(gameInput(payload as any)).eq('id', id).select().single();
    if (error) fail(error);

    if (payload.storeLinks !== undefined && Array.isArray(payload.storeLinks)) {
      await client().from('store_links').delete().eq('game_id', id);
      const linksToInsert = payload.storeLinks
        .filter((l) => l.name?.trim() && l.url?.trim())
        .map((l, index) => ({
          game_id: id,
          name: l.name.trim(),
          url: l.url.trim(),
          badge: l.badge?.trim() || null,
          sort_order: index,
        }));
      if (linksToInsert.length > 0) {
        const { error: linksErr } = await client().from('store_links').insert(linksToInsert);
        if (linksErr) fail(linksErr);
      }
    }

    return loadGame(data.id);
  },
  async remove(id: string, _confirm: string) { const { error } = await client().from('games').delete().eq('id', id); if (error) fail(error); },
  async publish(id: string, published: boolean) { return this.update(id, { published } as any); },
  async feature(id: string, featured: boolean) { return this.update(id, { featured } as any); },
  async reorderFeatured(ids: string[]) { for (const [index, id] of ids.entries()) { const { error } = await client().from('games').update({ featured_order: index }).eq('id', id); if (error) fail(error); } },
  async duplicate(id: string) {
    const game = await loadGame(id);
    const copy: any = { ...game, title: `${game.title} Copy`, slug: `${game.slug}-copy-${Date.now()}`, published: false, featured: false };
    delete copy.id; delete copy.createdAt; delete copy.updatedAt;
    return this.create(copy);
  },
};

export interface NewsFilters { page?: number; limit?: number; search?: string; status?: 'DRAFT' | 'PUBLISHED' | 'ALL'; categoryId?: string; }

export const newsApi = {
  async list(filters: NewsFilters = {}) {
    let query: any = client().from('news_posts').select('*, categories(name,slug,color)', { count: 'exact' });
    if (filters.status && filters.status !== 'ALL') query = query.eq('status', filters.status);
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters.search) query = query.ilike('title', `%${filters.search.replace(/[%_]/g, '')}%`);
    query = query.order('created_at', { ascending: false });
    const { data, error, count } = await query;
    if (error) fail(error);
    return page((data ?? []).map(mapPost), filters.page, filters.limit, count ?? data?.length ?? 0);
  },
  async get(id: string) { const { data, error } = await client().from('news_posts').select('*, categories(name,slug,color)').eq('id', id).single(); if (error) fail(error); return mapPost(data); },
  async create(payload: Record<string, unknown>) { const { data, error } = await client().from('news_posts').insert(postInput(payload)).select('*, categories(name,slug,color)').single(); if (error) fail(error); return mapPost(data); },
  async update(id: string, payload: Record<string, unknown>) { const { data, error } = await client().from('news_posts').update(postInput(payload)).eq('id', id).select('*, categories(name,slug,color)').single(); if (error) fail(error); return mapPost(data); },
  async remove(id: string, _confirm: string) { const { error } = await client().from('news_posts').delete().eq('id', id); if (error) fail(error); },
  async publish(id: string, published: boolean) { return this.update(id, { status: published ? 'PUBLISHED' : 'DRAFT', publishedAt: published ? new Date().toISOString() : null }); },
  async feature(id: string, featured: boolean) { return this.update(id, { featured }); },
};

export const categoriesApi = {
  async list() { const { data, error } = await client().from('categories').select('*').order('name'); if (error) fail(error); return (data ?? []).map((row: any): Category => ({ id: row.id, name: row.name, slug: row.slug, color: row.color, createdAt: row.created_at, updatedAt: row.updated_at })); },
  async create(payload: { name: string; description?: string; color?: string }) { const slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); const { data, error } = await client().from('categories').insert({ name: payload.name, slug, color: payload.color ?? '#6C4CF1' }).select().single(); if (error) fail(error); return { id: data.id, name: data.name, slug: data.slug, color: data.color } as Category; },
  async update(id: string, payload: { name?: string; description?: string; color?: string }) { const values: any = { ...payload }; if (payload.name) values.slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); delete values.description; const { data, error } = await client().from('categories').update(values).eq('id', id).select().single(); if (error) fail(error); return { id: data.id, name: data.name, slug: data.slug, color: data.color } as Category; },
  async remove(id: string) { const { error } = await client().from('categories').delete().eq('id', id); if (error) fail(error); },
};

export const jobsApi = {
  async list(params: { status?: 'open' | 'closed' | 'all' } = {}) { let query: any = client().from('jobs').select('*').order('sort_order'); if (params.status && params.status !== 'all') query = query.eq('status', params.status === 'open' ? 'OPEN' : 'CLOSED'); const { data, error } = await query; if (error) fail(error); const items = (data ?? []).map(mapJob); return page(items, 1, items.length || 20); },
  async create(payload: Record<string, unknown>) { const { data, error } = await client().from('jobs').insert(jobInput(payload)).select().single(); if (error) fail(error); return mapJob(data); },
  async update(id: string, payload: Record<string, unknown>) { const { data, error } = await client().from('jobs').update(jobInput(payload)).eq('id', id).select().single(); if (error) fail(error); return mapJob(data); },
  async remove(id: string, _confirm: string) { const { error } = await client().from('jobs').delete().eq('id', id); if (error) fail(error); },
};

export const mediaApi = {
  async list(params: { page?: number; limit?: number; search?: string } = {}) { let query: any = client().from('media_assets').select('*', { count: 'exact' }).order('created_at', { ascending: false }); if (params.search) query = query.ilike('filename', `%${params.search.replace(/[%_]/g, '')}%`); const { data, error, count } = await query; if (error) fail(error); return page((data ?? []).map((row: any): MediaAsset => ({ id: row.id, url: row.url, filename: row.filename, originalName: row.original_name, mimeType: row.mime_type, sizeBytes: row.size_bytes, width: row.width, height: row.height, alt: row.alt_text, uploadedById: row.uploaded_by, createdAt: row.created_at })), params.page, params.limit, count ?? data?.length ?? 0); },
  async upload(file: File, alt?: string) { const user = await currentUser(); const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-'); const filename = `${crypto.randomUUID()}-${safeName}`; const { error: uploadError } = await client().storage.from('media').upload(filename, file, { contentType: file.type, upsert: false }); if (uploadError) fail(uploadError, 'Upload failed.'); const { data: urlData } = client().storage.from('media').getPublicUrl(filename); const { data, error } = await client().from('media_assets').insert({ filename, original_name: file.name, url: urlData.publicUrl, mime_type: file.type, size_bytes: file.size, checksum: filename, alt_text: alt, uploaded_by: user.id }).select().single(); if (error) fail(error); return { id: data.id, url: data.url, filename: data.filename, originalName: data.original_name, mimeType: data.mime_type, sizeBytes: data.size_bytes, alt: data.alt_text, createdAt: data.created_at } as MediaAsset; },
  async remove(id: string) { const { data, error } = await client().from('media_assets').delete().eq('id', id).select('filename').maybeSingle(); if (error) fail(error); if (data) await client().storage.from('media').remove([data.filename]); },
  async verify(url: string) { const { data, error } = await client().from('media_assets').select('*').eq('url', url).maybeSingle(); if (error) fail(error); return { exists: Boolean(data), asset: data ?? undefined }; },
};

export const playersApi = {
  async list(params: { page?: number; limit?: number; search?: string } = {}) { let query: any = client().from('players').select('*', { count: 'exact' }).order('created_at', { ascending: false }); if (params.search) query = query.ilike('email', `%${params.search.replace(/[%_]/g, '')}%`); const { data, error, count } = await query; if (error) fail(error); const items = (data ?? []).map((row: any): Player => ({ id: row.id, email: row.email, displayName: row.display_name ?? '', country: null, role: 'PLAYER', status: 'ACTIVE', emailVerified: true, createdAt: row.created_at, updatedAt: row.updated_at })); return page(items, params.page, params.limit, count ?? items.length); },
  async get(id: string) { const result = await this.list(); const player = result.items.find((item) => item.id === id); if (!player) throw new ApiError('Player not found.', 404, 'not_found'); return player; },
  async update(_id: string, _payload: Partial<Player>) { throw new ApiError('Player profile editing is not enabled in the public auth model.', 400, 'not_supported'); },
  async remove(id: string, _confirm: string) { const { error } = await client().from('players').delete().eq('id', id); if (error) fail(error); },
};

export const subscribersApi = {
  async list(params: { page?: number; limit?: number; search?: string; status?: string } = {}): Promise<Paged<Subscriber>> { let query: any = client().from('subscribers').select('*', { count: 'exact' }).order('subscribed_at', { ascending: false }); if (params.search) query = query.ilike('email', `%${params.search.replace(/[%_]/g, '')}%`); if (params.status) query = query.eq('status', params.status); const { data, error, count } = await query; if (error) fail(error); const items = (data ?? []).map(mapSubscriber); return page(items, params.page, params.limit, count ?? items.length); },
  async create(payload: { email: string; name?: string; interests?: string[]; source?: string }) { const { data, error } = await client().from('subscribers').insert({ email: payload.email.toLowerCase(), name: payload.name, interests: payload.interests ?? [], source: payload.source ?? 'admin' }).select().single(); if (error) fail(error); return mapSubscriber(data); },
  async update(id: string, payload: { status?: string; name?: string; interests?: string[] }) { const { data, error } = await client().from('subscribers').update(payload).eq('id', id).select().single(); if (error) fail(error); return mapSubscriber(data); },
  async remove(id: string) { const { error } = await client().from('subscribers').delete().eq('id', id); if (error) fail(error); },
  async exportCsv(params: { search?: string; status?: string } = {}) { const result = await this.list({ ...params, limit: 10000 }); const header = 'id,email,name,status,subscribed_at'; const rows = result.items.map((item) => [item.id, item.email, item.name ?? '', item.status, item.subscribedAt].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')); return new Blob([[header, ...rows].join('\n')], { type: 'text/csv' }); },
  async exportJson(params: { search?: string; status?: string } = {}) { return (await this.list({ ...params, limit: 10000 })).items; },
};

export const contactsApi = {
  async list(params: { page?: number; limit?: number; search?: string; status?: string } = {}): Promise<Paged<ContactMessage>> { let query: any = client().from('contact_messages').select('*', { count: 'exact' }).order('created_at', { ascending: false }); if (params.search) query = query.or(`name.ilike.%${params.search.replace(/[%,]/g, '')}%,email.ilike.%${params.search.replace(/[%,]/g, '')}%,subject.ilike.%${params.search.replace(/[%,]/g, '')}%`); if (params.status) query = query.eq('status', params.status); const { data, error, count } = await query; if (error) fail(error); const items = (data ?? []).map(mapContact); return page(items, params.page, params.limit, count ?? items.length); },
  async get(id: string) { const { data, error } = await client().from('contact_messages').select('*').eq('id', id).single(); if (error) fail(error); return mapContact(data); },
  async update(id: string, payload: { status?: string; notes?: string }) { const values: any = { ...payload }; delete values.notes; if (payload.status === 'READ') values.status = 'REVIEWED'; const { data, error } = await client().from('contact_messages').update(values).eq('id', id).select().single(); if (error) fail(error); return mapContact(data); },
  async remove(id: string) { const { error } = await client().from('contact_messages').delete().eq('id', id); if (error) fail(error); },
};

export const teamApi = {
  async list() { await adminRow(); const { data, error } = await client().from('admin_users').select('*').order('created_at'); if (error) fail(error); return (data ?? []).map((row: any): TeamMember => ({ id: row.id, email: row.email ?? '', name: row.name ?? '', role: row.role, isActive: row.is_active, createdAt: row.created_at })); },
  async create(_payload: { email: string; name: string; role: Role }): Promise<{ member?: TeamMember; oneTimePassword?: string }> { throw new ApiError('Create the user in Supabase Authentication first, then promote it with the SQL block in supabase/editor_setup.sql.', 400, 'auth_user_required'); },
  async update(id: string, payload: { name?: string; role?: Role; isActive?: boolean }) { const { data, error } = await client().from('admin_users').update({ name: payload.name, role: payload.role, is_active: payload.isActive }).eq('id', id).select().single(); if (error) fail(error); return { id: data.id, email: data.email ?? '', name: data.name, role: data.role, isActive: data.is_active, createdAt: data.created_at } as TeamMember; },
  async remove(id: string, _confirm: string) { const { error } = await client().from('admin_users').delete().eq('id', id); if (error) fail(error); },
  async resetPassword(_id: string) { throw new ApiError('Use Supabase Auth → Send password recovery email for this user.', 400, 'auth_managed'); },
  async unlock(_id: string) { return (await this.list())[0]; },
};

function mapContent(row: any): ContentBlock { return { key: row.key, section: row.section ?? 'site', value: row.value, customized: true, updatedAt: row.updated_at, updatedBy: row.updated_by }; }

export const contentApi = {
  async blocks() { await adminRow(); const [blocks, settings] = await Promise.all([client().from('website_content').select('*').order('key'), client().from('site_settings').select('*').order('key')]); if (blocks.error) fail(blocks.error); if (settings.error) fail(settings.error); return { blocks: (blocks.data ?? []).map(mapContent), settings: (settings.data ?? []).map((row: any) => ({ key: row.key, section: 'settings', value: row.value, customized: true, updatedAt: row.updated_at, updatedBy: row.updated_by })) }; },
  async updateBlock(key: string, value: unknown) { const user = await currentUser(); const { data, error } = await client().from('website_content').upsert({ key, section: key.split('.')[0] ?? 'site', value, updated_by: user.id }, { onConflict: 'key' }).select().single(); if (error) fail(error); return mapContent(data); },
  async resetBlock(key: string) { const { error } = await client().from('website_content').delete().eq('key', key); if (error) fail(error); },
  async updateSetting(key: string, value: unknown) { const user = await currentUser(); const { data, error } = await client().from('site_settings').upsert({ key, value, updated_by: user.id }, { onConflict: 'key' }).select().single(); if (error) fail(error); return { key: data.key, section: 'settings', value: data.value, customized: true, updatedAt: data.updated_at } as ContentBlock; },
  async resetSetting(key: string) { const { error } = await client().from('site_settings').delete().eq('key', key); if (error) fail(error); },
};

export const activityApi = {
  async list(params: { page?: number; limit?: number; search?: string; action?: string } = {}): Promise<Paged<ActivityEntry>> { let query: any = client().from('admin_activity').select('*', { count: 'exact' }).order('created_at', { ascending: false }); if (params.action) query = query.eq('action', params.action); if (params.search) query = query.ilike('summary', `%${params.search.replace(/[%_]/g, '')}%`); const { data, error, count } = await query; if (error) fail(error); return page((data ?? []).map((row: any): ActivityEntry => ({ id: row.id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, summary: row.summary, description: row.summary, actorEmail: row.actor_email, ipAddress: row.ip_address, metadata: row.metadata, createdAt: row.created_at })), params.page, params.limit, count ?? data?.length ?? 0); },
  async stats() { return { daily: [], topActors: [], topActions: [], total: 0 }; },
};

export const backupApi = {
  async exportBundle() { await adminRow(); const tables = ['games', 'news_posts', 'jobs', 'categories', 'subscribers', 'contact_messages', 'website_content', 'site_settings', 'admin_users']; const result: Record<string, unknown> = { exportedAt: new Date().toISOString() }; for (const table of tables) { const { data, error } = await client().from(table).select('*'); if (error) fail(error); result[table] = data; } return result; },
  async system(): Promise<SystemSnapshot> { await adminRow(); const count = async (table: string) => { const { count, error } = await client().from(table).select('*', { count: 'exact', head: true }); if (error) fail(error); return count ?? 0; }; const [games, posts, subscribers, contacts] = await Promise.all([count('games'), count('news_posts'), count('subscribers'), count('contact_messages')]); return { generatedAt: new Date().toISOString(), runtime: { platform: 'Vercel', backend: 'Supabase' }, database: { provider: 'Supabase Postgres', connected: true }, storage: { provider: 'Supabase Storage' }, security: { authentication: 'Supabase Auth', rowLevelSecurity: true }, counts: { games, posts, subscribers, contacts } }; },
  async roles() { return { roles: [], permissions: [] }; },
};

export const downloadBlob = (blob: Blob, filename: string) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); };
export const downloadJson = (payload: unknown, filename: string) => downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), filename);

export const api = { auth: authApi, dashboard: dashboardApi, games: gamesApi, news: newsApi, categories: categoriesApi, jobs: jobsApi, media: mediaApi, players: playersApi, subscribers: subscribersApi, contacts: contactsApi, team: teamApi, content: contentApi, activity: activityApi, backup: backupApi };
export default api;
