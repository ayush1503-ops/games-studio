/**
 * Thin helpers for the public (non-admin) site: newsletter subscription and
 * contact form. These hit the Supabase tables directly using the anon key, so
 * all access is gated by RLS policies defined in supabase/migrations/.
 */

import { supabase } from './supabase';

export interface NewsletterSignupResult {
  ok: boolean;
  message: string;
}

/**
 * Subscribe an email to the public newsletter. The RLS policy allows anon
 * inserts but not reads/updates, and a trigger deduplicates on lower(email).
 */
export async function subscribeNewsletter(
  email: string,
  opts: { name?: string; interests?: string[] } = {}
): Promise<NewsletterSignupResult> {
  if (!supabase) {
    return { ok: false, message: 'Newsletter is temporarily unavailable.' };
  }

  const emailTrimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return { ok: false, message: 'Please enter a valid email address.' };
  }

  const { error } = await supabase.from('subscribers').insert({
    email: emailTrimmed,
    name: opts.name?.trim() || null,
    interests: opts.interests ?? [],
    source: 'website',
    status: 'ACTIVE',
  });

  if (error) {
    // 23505 = unique_violation -> already subscribed, treat as success.
    if (error.code === '23505') {
      return { ok: true, message: "You're already on the list — thanks!" };
    }
    // eslint-disable-next-line no-console
    console.error('[supabase] newsletter subscribe failed', error);
    return { ok: false, message: 'Something went wrong. Please try again.' };
  }

  return { ok: true, message: "You're in — welcome!" };
}

export interface ContactFormResult {
  ok: boolean;
  message: string;
}

/**
 * Submit a public contact-form message. RLS allows anon inserts only; reads
 * are restricted to studio admins.
 */
export async function submitContactMessage(payload: {
  name: string;
  email: string;
  company?: string;
  subject: string;
  projectType?: string;
  budget?: string;
  message: string;
}): Promise<ContactFormResult> {
  if (!supabase) {
    return { ok: false, message: 'The contact form is temporarily unavailable.' };
  }

  const emailTrimmed = payload.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return { ok: false, message: 'Please enter a valid email address.' };
  }
  if (!payload.name.trim() || !payload.subject.trim() || !payload.message.trim()) {
    return { ok: false, message: 'Please fill in name, subject and message.' };
  }

  const { error } = await supabase.from('contact_messages').insert({
    name: payload.name.trim(),
    email: emailTrimmed,
    company: payload.company?.trim() || null,
    subject: payload.subject.trim(),
    project_type: payload.projectType ?? 'Player Support',
    budget: payload.budget?.trim() || null,
    message: payload.message.trim(),
    status: 'UNREAD',
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[supabase] contact form failed', error);
    return { ok: false, message: 'Something went wrong. Please try again.' };
  }

  return { ok: true, message: "Thanks — we'll be in touch!" };
}

/** Fetch the list of currently published, non-draft news posts. */
export async function fetchPublishedNews(options: { limit?: number; categorySlug?: string } = {}) {
  if (!supabase) return [];
  const limit = options.limit ?? 12;

  let q = supabase
    .from('news_posts')
    .select(
      `id, slug, title, excerpt, cover_image, tags, featured, published_at, read_time_override,
       categories ( id, name, slug, color )`
    )
    .eq('status', 'PUBLISHED')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (options.categorySlug) {
    q = q.eq('categories.slug', options.categorySlug);
  }

  const { data, error } = await q;
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[supabase] news fetch failed', error);
    return [];
  }
  return data ?? [];
}

/** Fetch published games (safe for the public site). */
export async function fetchPublishedGames(options: { limit?: number; featuredOnly?: boolean } = {}) {
  if (!supabase) return [];
  const limit = options.limit ?? 24;

  let q = supabase
    .from('games')
    .select(
      `id, slug, title, subtitle, genre, categories, rating, price, platforms, status,
       hero_image, tags, featured, wishlist_count, view_count`
    )
    .eq('published', true)
    .order('featured_order', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (options.featuredOnly) q = q.eq('featured', true);

  const { data, error } = await q;
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[supabase] games fetch failed', error);
    return [];
  }
  return data ?? [];
}
