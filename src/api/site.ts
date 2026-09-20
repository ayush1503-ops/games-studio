/**
 * Supabase-backed public content client.
 *
 * The site talks directly to Supabase with the publishable key. RLS is the
 * security boundary: anonymous visitors can only read published content and
 * can only create newsletter/contact submissions. No browser request depends
 * on localhost or on a second API deployment.
 */
import type { Article, Game, Job } from '../types';
import { supabase } from '../lib/supabase';
import { submitContactMessage as insertContactMessage, subscribeNewsletter as insertNewsletter } from '../lib/supabase-public';

export interface SitePayload {
  games: Game[];
  news: Article[];
  jobs: Job[];
  content: Record<string, any>;
  settings: Record<string, any>;
  counters?: { games: number; posts: number; openRoles: number };
  generatedAt?: string;
}

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

function gameFromRow(row: any): Game {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? '',
    genre: row.genre,
    categories: row.categories ?? ['Indie'],
    rating: row.rating ?? undefined,
    price: row.price ?? undefined,
    platforms: row.platforms ?? [],
    status: row.status === 'IN_DEVELOPMENT' ? 'In Development'
      : row.status === 'EARLY_ACCESS' ? 'Early Access'
      : row.status === 'AVAILABLE_NOW' ? 'Available Now' : 'Wishlist Now',
    releaseYear: row.release_year ?? 'TBA',
    description: row.description ?? '',
    longDescription: row.long_description ?? '',
    heroImage: row.hero_image ?? '',
    secondaryImage: row.secondary_image ?? undefined,
    screenshots: row.screenshots ?? [],
    videoUrl: row.trailer_url ?? undefined,
    tags: row.tags ?? [],
    features: row.features ?? [],
    gameplayMechanics: (row.gameplay_mechanics ?? []).map((item: any) => ({
      title: item.title,
      description: item.description,
    })),
    devStory: row.dev_story ?? '',
    storeLinks: (row.store_links ?? []).map((item: any) => ({
      name: item.name,
      url: item.url,
      badge: item.badge ?? undefined,
    })),
    awards: row.awards ?? [],
    featured: Boolean(row.featured),
  };
}

function articleFromRow(row: any): Article {
  const category = row.categories?.name ?? row.category ?? 'NEWS';
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: String(category).toUpperCase() as Article['category'],
    date: row.published_at ?? row.created_at,
    readTime: row.read_time_override ?? '5 min read',
    excerpt: row.excerpt ?? '',
    content: row.content_html ?? '',
    coverImage: row.cover_image ?? '',
    author: {
      name: row.author_name ?? 'Studio Team',
      role: row.author_role ?? 'Editor',
      avatar: row.author_image ?? undefined,
    },
    tags: row.tags ?? [],
    featured: Boolean(row.featured),
    published: row.status === 'PUBLISHED',
  };
}

function jobFromRow(row: any): Job {
  const type = row.type === 'FULL_TIME' ? 'Full-time'
    : row.type === 'REMOTE_HYBRID' ? 'Remote / Hybrid'
    : row.type === 'FREELANCE' ? 'Contract' : 'Contract';
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    location: row.location,
    type,
    experience: row.experience as Job['experience'],
    description: row.description,
    responsibilities: row.responsibilities ?? [],
    requirements: row.requirements ?? [],
    niceToHave: row.nice_to_have ?? [],
    perks: row.perks ?? [],
    status: row.status === 'OPEN' ? 'open' : 'closed',
    postedDate: row.posted_date,
  };
}

/** Loads the published catalog, newsroom, careers and public CMS blocks. */
export async function fetchSite(): Promise<SitePayload> {
  const client = requireClient();
  const [gamesResult, newsResult, jobsResult, contentResult, settingsResult] = await Promise.all([
    client.from('games').select('*, gameplay_mechanics(*), store_links(*)').eq('published', true)
      .order('featured_order', { ascending: true, nullsFirst: false }),
    client.from('news_posts').select('*, categories(name, slug, color)').eq('status', 'PUBLISHED')
      .order('published_at', { ascending: false }),
    client.from('jobs').select('*').eq('status', 'OPEN').order('sort_order', { ascending: true }),
    client.from('website_content').select('key, value').eq('value->>public', 'true'),
    client.from('site_settings').select('key, value'),
  ]);

  const firstError = [gamesResult, newsResult, jobsResult, contentResult, settingsResult].find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const content = Object.fromEntries((contentResult.data ?? []).map((row: any) => [row.key, row.value]));
  const settings = Object.fromEntries((settingsResult.data ?? []).map((row: any) => [row.key, row.value]));
  const games = (gamesResult.data ?? []).map(gameFromRow);
  const news = (newsResult.data ?? []).map(articleFromRow);
  const jobs = (jobsResult.data ?? []).map(jobFromRow);

  return {
    games,
    news,
    jobs,
    content,
    settings,
    counters: { games: games.length, posts: news.length, openRoles: jobs.length },
    generatedAt: new Date().toISOString(),
  };
}

export const subscribeToNewsletter = async (payload: {
  email: string;
  name?: string;
  interests?: string[];
  website?: string;
}) => {
  if (payload.website?.trim()) return { ok: true, message: 'Thanks for joining the list!' };
  return insertNewsletter(payload.email, { name: payload.name, interests: payload.interests });
};

export const sendContactMessage = async (payload: {
  name: string;
  email: string;
  company?: string;
  subject?: string;
  projectType: string;
  budget?: string;
  message: string;
  website?: string;
}) => {
  if (payload.website?.trim()) return { ok: true, message: 'Message received.' };
  return insertContactMessage({
    name: payload.name,
    email: payload.email,
    company: payload.company,
    subject: payload.subject ?? `${payload.projectType} inquiry`,
    projectType: payload.projectType,
    budget: payload.budget,
    message: payload.message,
  });
};

export const registerPlayer = async (payload: { email: string; password: string; displayName: string }) => {
  const client = requireClient();
  const { error } = await client.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: { data: { display_name: payload.displayName } },
  });
  if (error) throw new Error(error.message);
  return { ok: true, message: 'Check your inbox to verify your account.' };
};
