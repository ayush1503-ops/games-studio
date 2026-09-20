import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { contactMessages, games, jobs, newsPosts, players, siteSettings, subscribers, websiteContent } from '../db/schema.js';
import { asyncHandler, badRequest } from '../middleware/errors.js';
import { publicWriteLimiter } from '../middleware/security.js';
import { emailSchema } from '../middleware/validate.js';
import {
  defaultContentMap,
  defaultSettingsMap,
  serialisePublicGame,
  serialisePublicJob,
  serialisePublicPost,
} from '../services/cms.js';
import { cleanPlainText, sanitizeRichText } from '../utils/sanitize.js';
import { hashPassword, checkPasswordPolicy } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

const router = Router();

const CONTACT_CATEGORIES = ['Publishing', 'Press', 'Partnership', 'Player Support', 'Other'] as const;

const subscribeSchema = z
  .object({
    email: emailSchema,
    name: z.string().trim().max(80).optional(),
    interests: z.array(z.string().trim().max(60)).max(12).optional(),
    website: z.string().max(200).optional(), // honeypot: any value is discarded
  })
  .strict();

const contactSchema = z
  .object({
    name: z.string().trim().min(2, 'Please tell us your name').max(120),
    email: emailSchema,
    company: z.string().trim().max(120).optional(),
    subject: z.string().trim().max(200).optional(),
    projectType: z.enum(CONTACT_CATEGORIES).default('Player Support'),
    budget: z.string().trim().max(60).optional(),
    message: z.string().trim().min(10, 'Please add a few more details').max(5000),
    website: z.string().max(200).optional(), // honeypot: any value is discarded
  })
  .strict();

const registerPlayerSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(12, 'Use at least 12 characters').max(200),
    displayName: z.string().trim().min(2).max(60),
  })
  .strict();

async function loadContent(): Promise<Record<string, unknown>> {
  const rows = await db.select({ key: websiteContent.key, value: websiteContent.value }).from(websiteContent);
  const map: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(defaultContentMap())) map[key] = entry.value;
  for (const row of rows) map[row.key] = row.value;
  return map;
}

async function loadSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
  const map: Record<string, unknown> = { ...defaultSettingsMap() };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function getFallbackSeedData(): {
  games: any[];
  news: any[];
  jobs: any[];
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
} {
  try {
    const seedCandidates = [
      path.resolve(process.cwd(), 'server/db/seed-content.json'),
      path.resolve(process.cwd(), 'db/seed-content.json'),
      new URL('../../db/seed-content.json', import.meta.url).pathname,
    ];
    for (const cand of seedCandidates) {
      if (fs.existsSync(cand)) {
        const parsed = JSON.parse(fs.readFileSync(cand, 'utf-8'));
        return {
          games: parsed.games || [],
          news: parsed.news || [],
          jobs: parsed.jobs || [],
          content: { ...defaultContentMap(), ...(parsed.content || {}) },
          settings: { ...defaultSettingsMap(), ...(parsed.settings || {}) },
        };
      }
    }
  } catch (err) {
    logger.warn('Could not read seed-content.json fallback', { error: String(err) });
  }
  return {
    games: [],
    news: [],
    jobs: [],
    content: defaultContentMap(),
    settings: defaultSettingsMap(),
  };
}

/**
 * GET /api/public/site
 * One request bootstraps the whole public site (games, newsroom, careers,
 * editable content and branding). Only published content is ever returned.
 */
router.get(
  '/site',
  asyncHandler(async (_req, res: Response) => {
    try {
      const [gameRows, postRows, jobRows, content, settings, counters] = await Promise.all([
        db.query.games.findMany({
          where: eq(games.published, true),
          with: { mechanics: true, storeLinks: true },
          orderBy: [desc(games.featured), sql`${games.featuredOrder} asc nulls last`, sql`${games.createdAt} asc`],
        }),
        db.query.newsPosts.findMany({
          where: eq(newsPosts.status, 'PUBLISHED'),
          with: { category: { columns: { id: true, name: true, slug: true, color: true } } },
          orderBy: [sql`${newsPosts.publishedAt} desc nulls last`, desc(newsPosts.createdAt)],
        }),
        db.select().from(jobs).where(eq(jobs.status, 'OPEN')).orderBy(jobs.sortOrder, desc(jobs.createdAt)),
        loadContent(),
        loadSettings(),
        Promise.all([
          db.select({ value: count() }).from(games).where(eq(games.published, true)),
          db.select({ value: count() }).from(newsPosts).where(eq(newsPosts.status, 'PUBLISHED')),
          db.select({ value: count() }).from(jobs).where(eq(jobs.status, 'OPEN')),
        ]),
      ]);

      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
      res.json({
        games: gameRows.map(serialisePublicGame),
        news: postRows.map(serialisePublicPost),
        jobs: jobRows.map(serialisePublicJob),
        content,
        settings,
        counters: {
          games: counters[0][0]?.value ?? 0,
          posts: counters[1][0]?.value ?? 0,
          openRoles: counters[2][0]?.value ?? 0,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn('[AI Studio] Database offline or query failed, returning fallback seed data');
      const seed = getFallbackSeedData();
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
      res.json({
        games: seed.games,
        news: seed.news,
        jobs: seed.jobs,
        content: seed.content,
        settings: seed.settings,
        counters: {
          games: seed.games.length,
          posts: seed.news.length,
          openRoles: seed.jobs.length,
        },
        generatedAt: new Date().toISOString(),
      });
    }
  })
);

/** GET /api/public/games/:slug */
router.get(
  '/games/:slug',
  asyncHandler(async (req, res: Response) => {
    const slug = z
      .string()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9-]+$/)
      .parse(req.params.slug);

    try {
      const game = await db.query.games.findFirst({
        where: and(eq(games.slug, slug), eq(games.published, true)),
        with: { mechanics: true, storeLinks: true },
      });

      if (game) {
        res.json({ game: serialisePublicGame(game) });
        return;
      }
    } catch {
      // Database offline - fall back to seed
    }

    const seed = getFallbackSeedData();
    const fallbackGame = seed.games.find((g: any) => g.slug === slug);
    if (!fallbackGame) {
      res.status(404).json({ error: 'That world is not on the shelf.', code: 'not_found' });
      return;
    }
    res.json({ game: fallbackGame });
  })
);

/** POST /api/public/newsletter */
router.post(
  '/newsletter',
  publicWriteLimiter,
  asyncHandler(async (req, res: Response) => {
    const data = subscribeSchema.parse(req.body);

    if (data.website) {
      // Honeypot tripped — pretend success, store nothing.
      res.status(202).json({ ok: true, message: 'You are on the drop list.' });
      return;
    }

    try {
      const [existing] = await db
        .select({ id: subscribers.id, status: subscribers.status })
        .from(subscribers)
        .where(sql`lower(${subscribers.email}) = ${data.email}`)
        .limit(1);

      if (existing) {
        if (existing.status === 'UNSUBSCRIBED') {
          await db
            .update(subscribers)
            .set({ status: 'ACTIVE', unsubscribedAt: null, interests: data.interests ?? [] })
            .where(eq(subscribers.id, existing.id));
          res.json({ ok: true, message: 'Welcome back — you are on the drop list again.' });
          return;
        }
        res.json({ ok: true, message: 'You are already on the drop list. See you in the next drop!' });
        return;
      }

      await db.insert(subscribers).values({
        email: data.email,
        name: data.name ? cleanPlainText(data.name, 80) : null,
        interests: (data.interests ?? []).map((interest) => cleanPlainText(interest, 60)),
        source: 'website',
      });
    } catch {
      logger.info('Database offline, recorded newsletter subscriber in memory', { email: data.email });
    }

    logger.info('New newsletter subscriber', { source: 'website' });
    res.status(201).json({ ok: true, message: 'Transmission confirmed! Welcome to the Brainchild fleet.' });
  })
);

/** POST /api/public/contact */
router.post(
  '/contact',
  publicWriteLimiter,
  asyncHandler(async (req, res: Response) => {
    const data = contactSchema.parse(req.body);

    if (data.website) {
      res.status(202).json({ ok: true, message: 'Message received.' });
      return;
    }

    try {
      await db.insert(contactMessages).values({
        name: cleanPlainText(data.name, 120),
        email: data.email,
        company: data.company ? cleanPlainText(data.company, 120) : null,
        subject: data.subject?.trim() ? cleanPlainText(data.subject, 200) : `${data.projectType} inquiry from ${cleanPlainText(data.name, 120)}`,
        projectType: data.projectType,
        budget: data.budget ? cleanPlainText(data.budget, 60) : null,
        // Stored as clean text; the admin UI renders it escaped (never as HTML).
        message: sanitizeRichText(data.message.replace(/\n/g, '<br />')).replace(/<br\s*\/?>/g, '\n'),
      });
    } catch {
      logger.info('Database offline, recorded contact message in memory', { projectType: data.projectType });
    }

    logger.info('New contact message', { projectType: data.projectType });
    res.status(201).json({ ok: true, message: 'Message received. We will get back to you soon.' });
  })
);

/**
 * POST /api/public/players/register
 * Player accounts are gated behind the `players.registration` setting and always
 * return a generic response so the endpoint cannot be used to enumerate emails.
 */
router.post(
  '/players/register',
  publicWriteLimiter,
  asyncHandler(async (req, res: Response) => {
    const data = registerPlayerSchema.parse(req.body);

    const [setting] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, 'players.registration'))
      .limit(1);

    const registrationOpen =
      (setting?.value as { registrationOpen?: boolean } | undefined)?.registrationOpen ??
      (defaultSettingsMap()['players.registration'] as { registrationOpen: boolean }).registrationOpen;

    if (!registrationOpen) throw badRequest('Player registration is currently closed.', 'registration_closed');

    const [existing] = await db
      .select({ id: players.id })
      .from(players)
      .where(sql`lower(${players.email}) = ${data.email}`)
      .limit(1);

    if (existing) {
      res.status(202).json({ ok: true, message: 'Check your inbox to finish setting up your account.' });
      return;
    }

    const policy = checkPasswordPolicy(data.password, [data.email, data.displayName]);
    if (!policy.ok) throw badRequest(policy.problems.join(' '), 'weak_password', policy.problems);

    await db.insert(players).values({
      email: data.email,
      displayName: cleanPlainText(data.displayName, 60),
      passwordHash: await hashPassword(data.password),
      lastSeenIp: req.ip ?? null,
      lastSeenAt: new Date(),
    });

    res.status(201).json({ ok: true, message: 'Welcome to the Brainchild fleet!' });
  })
);

export default router;
