import { Router, Response } from 'express';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { siteSettings, websiteContent } from '../db/schema.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { audit } from '../services/activity.js';
import { CONTENT_DEFAULTS, SETTING_DEFAULTS } from '../services/cms.js';
import { cleanPlainText } from '../utils/sanitize.js';

const router = Router();
router.use(authenticate);

const MAX_JSON_DEPTH = 6;
const MAX_STRING = 5000;
const MAX_ARRAY = 200;
const MAX_KEYS = 60;

/**
 * Every editable block is stored as JSON and re-validated on the way in.
 * The rules below keep payloads small, shallow, and free of markup so a
 * compromised admin session still cannot store a script payload or bloat the
 * database. Text fields are escaped by the frontend renderer, never innerHTML.
 */
function validateJsonValue(value: unknown, depth = 0): string | null {
  if (depth > MAX_JSON_DEPTH) return 'Content is nested too deeply.';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    if (typeof value === 'number' && !Number.isFinite(value)) return 'Numbers must be finite.';
    return null;
  }
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `Text fields must be under ${MAX_STRING} characters.` : null;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) return `Lists are limited to ${MAX_ARRAY} items.`;
    for (const item of value) {
      const problem = validateJsonValue(item, depth + 1);
      if (problem) return problem;
    }
    return null;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > MAX_KEYS) return `Objects are limited to ${MAX_KEYS} fields.`;
    for (const [key, entry] of entries) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key)) return `Invalid field name “${key.slice(0, 30)}”.`;
      const problem = validateJsonValue(entry, depth + 1);
      if (problem) return problem;
    }
    return null;
  }
  return 'Unsupported value type.';
}

const jsonValueSchema = z.unknown().superRefine((value, ctx) => {
  const problem = validateJsonValue(value);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
});

const httpUrl = z.string().trim().max(400).refine((value) => value === '' || /^https?:\/\//.test(value), 'Use a full https:// URL');
const shortText = z.string().trim().max(400);

/** Per-key shape rules for the blocks that have a fixed contract. */
const CONTENT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  'about.hero': z
    .object({
      badge: shortText,
      title: shortText,
      highlight: shortText,
      lead: z.string().trim().max(1500),
      mission: z.string().trim().max(1500),
      chips: z.array(shortText).max(12),
      quote: z.string().trim().max(600),
      quoteAttribution: z.string().trim().max(300),
      teamBadge: shortText,
    })
    .partial(),
  'home.hero': z
    .object({
      studioLine: shortText,
      est: shortText,
      worlds: shortText,
      motto: shortText,
      rating: shortText,
      players: shortText,
      madeIn: shortText,
      ticker: z.array(z.string().trim().max(120)).max(20),
    })
    .partial(),
  'home.values': z
    .object({
      items: z
        .array(
          z.object({
            icon: z.string().trim().max(30).optional(),
            title: z.string().trim().max(80),
            text: z.string().trim().max(400),
          })
        )
        .max(9),
    })
    .partial(),
  'about.timeline': z
    .object({
      items: z
        .array(
          z.object({
            year: z.string().trim().max(30),
            title: z.string().trim().max(160),
            description: z.string().trim().max(1000),
            tag: z.string().trim().max(40),
          })
        )
        .max(24),
    })
    .partial(),
  'about.team': z
    .object({
      members: z
        .array(
          z.object({
            name: z.string().trim().max(120),
            role: z.string().trim().max(120),
            bio: z.string().trim().max(1000),
            favoriteGame: z.string().trim().max(200).optional(),
            image: z.string().trim().max(400).optional(),
          })
        )
        .max(60),
    })
    .partial(),
  'about.philosophy': z
    .object({
      items: z
        .array(
          z.object({
            title: z.string().trim().max(120),
            description: z.string().trim().max(800),
            icon: z.string().trim().max(40).optional(),
          })
        )
        .max(20),
    })
    .partial(),
  'contact.details': z
    .object({
      email: z.string().trim().email().max(200),
      phone: z.string().trim().max(60),
      address: z.string().trim().max(300),
      responseTime: z.string().trim().max(120),
      discord: z.string().trim().max(120),
      channels: z
        .array(z.object({ label: z.string().trim().max(80), value: z.string().trim().max(200) }))
        .max(12),
      faq: z
        .array(z.object({ question: z.string().trim().max(200), answer: z.string().trim().max(1000) }))
        .max(20),
    })
    .partial(),
};

const SETTING_SCHEMAS: Record<string, z.ZodTypeAny> = {
  'site.brand': z
    .object({
      name: z.string().trim().min(1).max(120),
      shortName: z.string().trim().min(1).max(60),
      tagline: z.string().trim().max(200),
      logoUrl: z.string().trim().max(400).optional(),
    })
    .partial(),
  'site.social': z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        url: httpUrl,
        icon: z.string().trim().max(40),
      })
    )
    .max(12),
  'site.audience': z
    .object({
      discordMembers: z.coerce.number().int().min(0).max(100_000_000),
      newsletterReaders: z.coerce.number().int().min(0).max(100_000_000),
      newsletterBadge: z.string().trim().max(120),
    })
    .partial(),
  'site.seo': z
    .object({
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(400),
      ogImage: z.string().trim().max(400).optional(),
    })
    .partial(),
  'site.commerce': z
    .object({
      defaultCurrency: z.string().trim().length(3),
      saleBadge: z.string().trim().max(40),
      wishlistEnabled: z.boolean(),
    })
    .partial(),
  'players.registration': z
    .object({
      registrationOpen: z.boolean(),
      welcomeMessage: z.string().trim().max(300),
    })
    .partial(),
};

function schemaFor(kind: 'content' | 'setting', key: string) {
  const registry = kind === 'content' ? CONTENT_SCHEMAS : SETTING_SCHEMAS;
  return registry[key] ?? jsonValueSchema;
}

/** Strips control characters and trims strings inside nested JSON payloads. */
function cleanDeep(value: unknown): unknown {
  if (typeof value === 'string') return cleanPlainText(value, MAX_STRING);
  if (Array.isArray(value)) return value.map(cleanDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, cleanDeep(entry)])
    );
  }
  return value;
}

/** GET /api/admin/content — every editable block with defaults + customised flag. */
router.get(
  '/',
  requirePermission('content:read'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const [contentRows, settingRows] = await Promise.all([
      db.select().from(websiteContent).orderBy(asc(websiteContent.key)),
      db.select().from(siteSettings).orderBy(asc(siteSettings.key)),
    ]);

    const saved = new Map(contentRows.map((row) => [row.key, row]));
    const savedSettings = new Map(settingRows.map((row) => [row.key, row]));

    res.json({
      content: Object.entries(CONTENT_DEFAULTS).map(([key, entry]) => {
        const row = saved.get(key);
        return {
          key,
          section: row?.section ?? entry.section,
          value: row?.value ?? entry.value,
          defaultValue: entry.value,
          customized: Boolean(row),
          updatedAt: row?.updatedAt ?? null,
          updatedBy: row?.updatedBy ?? null,
        };
      }),
      settings: Object.entries(SETTING_DEFAULTS).map(([key, value]) => {
        const row = savedSettings.get(key);
        return {
          key,
          value: row?.value ?? value,
          defaultValue: value,
          customized: Boolean(row),
          updatedAt: row?.updatedAt ?? null,
        };
      }),
    });
  })
);

/** PUT /api/admin/content/:key */
router.put(
  '/:key',
  requirePermission('content:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const key = z
      .string()
      .trim()
      .regex(/^[a-z]+(\.[a-z_]+)+$/, 'Unknown content key')
      .max(60)
      .parse(req.params.key);

    const definition = CONTENT_DEFAULTS[key];
    if (!definition) throw new AppError(404, `“${key}” is not an editable content block.`, 'unknown_content_key');

    const value = schemaFor('content', key).parse(req.body?.value);
    const cleaned = cleanDeep(value);

    const [row] = await db
      .insert(websiteContent)
      .values({ key, section: definition.section, value: cleaned as object, updatedBy: req.admin!.email })
      .onConflictDoUpdate({
        target: websiteContent.key,
        set: { value: cleaned as object, updatedBy: req.admin!.email },
      })
      .returning();

    audit(req)('CONTENT_UPDATED', 'content', {
      entityId: key,
      summary: `Updated content block “${key}”`,
      metadata: { key, section: definition.section },
    });

    res.json({ block: { key, section: row.section, value: row.value, customized: true, updatedAt: row.updatedAt } });
  })
);

/** POST /api/admin/content/:key/reset */
router.post(
  '/:key/reset',
  requirePermission('content:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const key = z.string().trim().max(60).parse(req.params.key);
    const definition = CONTENT_DEFAULTS[key];
    if (!definition) throw new AppError(404, `“${key}” is not an editable content block.`, 'unknown_content_key');

    await db.delete(websiteContent).where(eq(websiteContent.key, key));

    audit(req)('CONTENT_RESET', 'content', {
      entityId: key,
      summary: `Reset content block “${key}” to the studio default`,
    });

    res.json({ block: { key, section: definition.section, value: definition.value, defaultValue: definition.value, customized: false } });
  })
);

/** PUT /api/admin/content/settings/:key */
router.put(
  '/settings/:key',
  requirePermission('settings:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const key = z
      .string()
      .trim()
      .regex(/^[a-z]+(\.[a-z_]+)+$/, 'Unknown setting key')
      .max(60)
      .parse(req.params.key);

    if (!(key in SETTING_DEFAULTS)) {
      throw new AppError(404, `“${key}” is not an editable setting.`, 'unknown_setting_key');
    }

    const value = schemaFor('setting', key).parse(req.body?.value);
    const cleaned = cleanDeep(value);

    const [row] = await db
      .insert(siteSettings)
      .values({ key, value: cleaned as object, updatedBy: req.admin!.email })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: cleaned as object, updatedBy: req.admin!.email } })
      .returning();

    audit(req)('SETTING_UPDATED', 'setting', {
      entityId: key,
      summary: `Updated setting “${key}”`,
      metadata: { key, fields: typeof value === 'object' && value ? Object.keys(value) : [] },
    });

    res.json({ setting: { key, value: row.value, customized: true, updatedAt: row.updatedAt } });
  })
);

/** POST /api/admin/content/settings/:key/reset */
router.post(
  '/settings/:key/reset',
  requirePermission('settings:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const key = z.string().trim().max(60).parse(req.params.key);
    if (!(key in SETTING_DEFAULTS)) {
      throw new AppError(404, `“${key}” is not an editable setting.`, 'unknown_setting_key');
    }

    await db.delete(siteSettings).where(eq(siteSettings.key, key));

    audit(req)('SETTING_RESET', 'setting', {
      entityId: key,
      summary: `Reset setting “${key}” to the studio default`,
    });

    res.json({ setting: { key, value: SETTING_DEFAULTS[key], defaultValue: SETTING_DEFAULTS[key], customized: false } });
  })
);

export default router;
