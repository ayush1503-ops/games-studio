/**
 * Public content client.
 *
 * Every call uses a relative URL, so the exact same code works behind the Vite
 * dev proxy and in production where the API and site share an origin. Nothing
 * here is trusted for authorisation — the public API only ever exposes content
 * the studio has published.
 */
import type { Article, Game, Job } from '../types';

export interface SitePayload {
  games: Game[];
  news: Article[];
  jobs: Job[];
  content: Record<string, any>;
  settings: Record<string, any>;
  counters?: { games: number; posts: number; openRoles: number };
  generatedAt?: string;
}

const TIMEOUT_MS = 12_000;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      ...init,
      signal: controller.signal,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error = new Error(data?.error || 'Something went wrong. Please try again.') as Error & { code?: string };
      error.code = data?.code;
      throw error;
    }
    return data as T;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Bootstraps the whole site: published games, newsroom, careers and CMS content. */
export const fetchSite = () => request<SitePayload>('/api/public/site');

export const subscribeToNewsletter = (payload: { email: string; name?: string; interests?: string[]; website?: string }) =>
  request<{ ok: boolean; message: string }>('/api/public/newsletter', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const sendContactMessage = (payload: {
  name: string;
  email: string;
  company?: string;
  subject?: string;
  projectType: string;
  budget?: string;
  message: string;
  website?: string;
}) =>
  request<{ ok: boolean; message: string }>('/api/public/contact', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const registerPlayer = (payload: { email: string; password: string; displayName: string }) =>
  request<{ ok: boolean; message: string }>('/api/public/players/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
