import { Router, Response } from 'express';
import { and, asc, count, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { games, gameplayMechanics, storeLinks } from '../db/schema.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { idSchema, paginated, paginationSchema, slugSchema } from '../middleware/validate.js';
import { audit } from '../services/activity.js';
import { GAME_STATUS_VALUES, serialiseAdminGame } from '../services/cms.js';
import { cleanText } from '../utils/sanitize.js';

const router = Router();
router.use(authenticate);

const GAME_CATEGORIES = ['Action', 'Puzzle', 'Racing', 'Adventure', 'Sports', 'RPG', 'Horror', 'Indie'] as const;

const SORT_COLUMNS = {
  createdAt: games.createdAt,
  updatedAt: games.updatedAt,
  title: games.title,
  releaseYear: games.releaseYear,
  featuredOrder: games.featuredOrder,
  status: games.status,
} as const;

const urlOrPath = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => value === '' || value.startsWith('/') || /^https?:\/\//.test(value),
    'Use an /uploads path or a full http(s) URL'
  );

const gamePayload = z
  .object({
    slug: slugSchema.optional(),
    title: z.string().trim().min(1).max(160),
    subtitle: z.string().trim().max(160).optional().nullable(),
    genre: z.string().trim().min(1).max(120),
    categories: z.array(z.enum(GAME_CATEGORIES)).min(1).max(8),
    rating: z.coerce.number().min(0).max(5).optional(),
    price: z.string().trim().max(60).default('Wishlist free'),
    salePrice: z.string().trim().max(60).optional().nullable(),
    currency: z.string().trim().length(3).default('USD'),
    isFree: z.boolean().default(false),
    platforms: z.array(z.string().trim().min(1).max(60)).min(1).max(12),
    status: z.enum(GAME_STATUS_VALUES as [string, ...string[]]).default('IN_DEVELOPMENT'),
    releaseYear: z.string().trim().max(30).default('2027'),
    description: z.string().trim().min(1).max(600),
    longDescription: z.string().trim().max(6000).default(''),
    heroImage: urlOrPath.optional().nullable(),
    secondaryImage: urlOrPath.optional().nullable(),
    screenshots: z.array(urlOrPath).max(20).default([]),
    trailerUrl: z.string().trim().max(500).optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    features: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
    gameplayMechanics: z
      .array(z.object({ title: z.string().trim().min(1).max(80), description: z.string().trim().min(1).max(600) }))
      .max(12)
      .default([]),
    devStory: z.string().trim().max(4000).default(''),
    storeLinks: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          url: z.string().trim().min(1).max(500),
          badge: z.string().trim().max(60).optional().nullable(),
        })
      )
      .max(12)
      .default([]),
    awards: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  })
  .strict();

const createSchema = gamePayload;
const updateSchema = gamePayload.partial();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 140)
    .replace(/^-|-$/g, '');
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || 'game';
  let candidate = root;
  let suffix = 2;
  while (suffix < 200) {
    const [clash] = await db
      .select({ id: games.id })
      .from(games)
      .where(excludeId ? and(eq(games.slug, candidate), ne(games.id, excludeId)) : eq(games.slug, candidate))
      .limit(1);
    if (!clash) return candidate;
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return `${root}-${Date.now().toString(36)}`;
}

const withRelations = { mechanics: true, storeLinks: true } as const;

async function fetchGame(id: string) {
  return db.query.games.findFirst({ where: eq(games.id, id), with: withRelations });
}

/** GET /api/admin/games */
router.get(
  '/',
  requirePermission('games:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = paginationSchema
      .extend({
        status: z.enum(GAME_STATUS_VALUES as [string, ...string[]]).optional(),
        published: z.enum(['true', 'false', 'all']).default('all'),
        featured: z.enum(['true', 'false', 'all']).default('all'),
      })
      .parse(req.query);

    const conditions = [
      query.search
        ? or(
            sql`${games.title} ilike ${`%${query.search}%`}`,
            sql`${games.subtitle} ilike ${`%${query.search}%`}`,
            sql`${games.slug} ilike ${`%${query.search}%`}`,
            sql`${games.genre} ilike ${`%${query.search}%`}`,
            sql`array_to_string(${games.tags}, ' ') ilike ${`%${query.search}%`}`,
            sql`array_to_string(${games.platforms}, ' ') ilike ${`%${query.search}%`}`
          )
        : undefined,
      query.status ? eq(games.status, query.status) : undefined,
      query.published === 'all' ? undefined : eq(games.published, query.published === 'true'),
      query.featured === 'all' ? undefined : eq(games.featured, query.featured === 'true'),
    ].filter(Boolean);

    const where = conditions.length ? and(...(conditions as never[])) : undefined;
    const sortColumn = SORT_COLUMNS[(query.sortBy as keyof typeof SORT_COLUMNS) ?? 'createdAt'] ?? games.createdAt;
    const orderBy = query.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const [items, totals] = await Promise.all([
      db.query.games.findMany({
        where,
        with: withRelations,
        orderBy: [orderBy],
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
      }),
      db.select({ value: count() }).from(games).where(where),
    ]);

    res.json(paginated(items.map(serialiseAdminGame), totals[0]?.value ?? 0, query.page, query.limit));
  })
);

/** GET /api/admin/games/featured — source list for drag-and-drop ordering. */
router.get(
  '/featured',
  requirePermission('games:read'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const featured = await db
      .select({
        id: games.id,
        title: games.title,
        slug: games.slug,
        heroImage: games.heroImage,
        published: games.published,
        featuredOrder: games.featuredOrder,
        status: games.status,
      })
      .from(games)
      .where(eq(games.featured, true))
      .orderBy(sql`${games.featuredOrder} asc nulls last`, desc(games.updatedAt));

    res.json({ games: featured });
  })
);

/** POST /api/admin/games */
router.post(
  '/',
  requirePermission('games:create'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = createSchema.parse(req.body);
    const slug = await uniqueSlug(data.slug ? slugify(data.slug) : slugify(data.title));

    const [created] = await db
      .insert(games)
      .values({
        slug,
        title: cleanText(data.title, 160),
        subtitle: data.subtitle ? cleanText(data.subtitle, 160) : null,
        genre: cleanText(data.genre, 120),
        categories: data.categories,
        rating: data.rating ?? 0,
        price: cleanText(data.price, 60),
        salePrice: data.salePrice ? cleanText(data.salePrice, 60) : null,
        currency: data.currency.toUpperCase(),
        isFree: data.isFree,
        platforms: data.platforms.map((platform) => cleanText(platform, 60)),
        status: data.status,
        releaseYear: cleanText(data.releaseYear, 30),
        description: cleanText(data.description, 600),
        longDescription: cleanText(data.longDescription, 6000),
        heroImage: data.heroImage || null,
        secondaryImage: data.secondaryImage || null,
        screenshots: data.screenshots,
        trailerUrl: data.trailerUrl || null,
        tags: data.tags.map((tag) => cleanText(tag, 40)),
        features: data.features.map((feature) => cleanText(feature, 300)),
        devStory: cleanText(data.devStory, 4000),
        awards: data.awards.map((award) => cleanText(award, 160)),
      })
      .returning({ id: games.id });

    if (data.gameplayMechanics.length) {
      await db.insert(gameplayMechanics).values(
        data.gameplayMechanics.map((mechanic, index) => ({
          gameId: created.id,
          title: cleanText(mechanic.title, 80),
          description: cleanText(mechanic.description, 600),
          sortOrder: index,
        }))
      );
    }
    if (data.storeLinks.length) {
      await db.insert(storeLinks).values(
        data.storeLinks.map((link, index) => ({
          gameId: created.id,
          name: cleanText(link.name, 80),
          url: link.url,
          badge: link.badge ? cleanText(link.badge, 60) : null,
          sortOrder: index,
        }))
      );
    }

    const game = await fetchGame(created.id);

    audit(req)('GAME_CREATED', 'game', {
      entityId: created.id,
      summary: `Created game “${game!.title}”`,
      metadata: { slug: game!.slug, status: game!.status },
    });

    res.status(201).json({ game: serialiseAdminGame(game!) });
  })
);

/** GET /api/admin/games/:id */
router.get(
  '/:id',
  requirePermission('games:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const game = await fetchGame(id);
    if (!game) throw new AppError(404, 'That game no longer exists.', 'not_found');
    res.json({ game: serialiseAdminGame(game) });
  })
);

/** PATCH /api/admin/games/:id */
router.patch(
  '/:id',
  requirePermission('games:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const data = updateSchema.parse(req.body);

    const [existing] = await db
      .select({ id: games.id, title: games.title, slug: games.slug })
      .from(games)
      .where(eq(games.id, id))
      .limit(1);
    if (!existing) throw new AppError(404, 'That game no longer exists.', 'not_found');

    const slug = data.slug ? await uniqueSlug(slugify(data.slug), id) : undefined;

    await db.transaction(async (tx) => {
      if (data.gameplayMechanics) {
        await tx.delete(gameplayMechanics).where(eq(gameplayMechanics.gameId, id));
      }
      if (data.storeLinks) {
        await tx.delete(storeLinks).where(eq(storeLinks.gameId, id));
      }

      await tx
        .update(games)
        .set({
          ...(slug ? { slug } : {}),
          ...(data.title !== undefined ? { title: cleanText(data.title, 160) } : {}),
          ...(data.subtitle !== undefined ? { subtitle: data.subtitle ? cleanText(data.subtitle, 160) : null } : {}),
          ...(data.genre !== undefined ? { genre: cleanText(data.genre, 120) } : {}),
          ...(data.categories !== undefined ? { categories: data.categories } : {}),
          ...(data.rating !== undefined ? { rating: data.rating } : {}),
          ...(data.price !== undefined ? { price: cleanText(data.price, 60) } : {}),
          ...(data.salePrice !== undefined ? { salePrice: data.salePrice ? cleanText(data.salePrice, 60) : null } : {}),
          ...(data.currency !== undefined ? { currency: data.currency.toUpperCase() } : {}),
          ...(data.isFree !== undefined ? { isFree: data.isFree } : {}),
          ...(data.platforms !== undefined ? { platforms: data.platforms.map((platform) => cleanText(platform, 60)) } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.releaseYear !== undefined ? { releaseYear: cleanText(data.releaseYear, 30) } : {}),
          ...(data.description !== undefined ? { description: cleanText(data.description, 600) } : {}),
          ...(data.longDescription !== undefined ? { longDescription: cleanText(data.longDescription, 6000) } : {}),
          ...(data.heroImage !== undefined ? { heroImage: data.heroImage || null } : {}),
          ...(data.secondaryImage !== undefined ? { secondaryImage: data.secondaryImage || null } : {}),
          ...(data.screenshots !== undefined ? { screenshots: data.screenshots } : {}),
          ...(data.trailerUrl !== undefined ? { trailerUrl: data.trailerUrl || null } : {}),
          ...(data.tags !== undefined ? { tags: data.tags.map((tag) => cleanText(tag, 40)) } : {}),
          ...(data.features !== undefined ? { features: data.features.map((feature) => cleanText(feature, 300)) } : {}),
          ...(data.devStory !== undefined ? { devStory: cleanText(data.devStory, 4000) } : {}),
          ...(data.awards !== undefined ? { awards: data.awards.map((award) => cleanText(award, 160)) } : {}),
          version: sql`${games.version} + 1`,
        })
        .where(eq(games.id, id));

      if (data.gameplayMechanics) {
        await tx.insert(gameplayMechanics).values(
          data.gameplayMechanics.map((mechanic, index) => ({
            gameId: id,
            title: cleanText(mechanic.title, 80),
            description: cleanText(mechanic.description, 600),
            sortOrder: index,
          }))
        );
      }
      if (data.storeLinks) {
        await tx.insert(storeLinks).values(
          data.storeLinks.map((link, index) => ({
            gameId: id,
            name: cleanText(link.name, 80),
            url: link.url,
            badge: link.badge ? cleanText(link.badge, 60) : null,
            sortOrder: index,
          }))
        );
      }
    });

    const game = await fetchGame(id);

    audit(req)('GAME_UPDATED', 'game', {
      entityId: id,
      summary: `Updated game “${game!.title}”`,
      metadata: { fields: Object.keys(data) },
    });

    res.json({ game: serialiseAdminGame(game!) });
  })
);

/** POST /api/admin/games/:id/publish */
router.post(
  '/:id/publish',
  requirePermission('games:publish'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const { published } = z.object({ published: z.boolean() }).strict().parse(req.body);

    const [existing] = await db.select().from(games).where(eq(games.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'That game no longer exists.', 'not_found');

    await db
      .update(games)
      .set({
        published,
        publishedAt: published ? existing.publishedAt ?? new Date() : existing.publishedAt,
        // Unpublishing also removes it from the featured rail.
        ...(published ? {} : { featured: false, featuredOrder: null }),
      })
      .where(eq(games.id, id));

    const game = await fetchGame(id);

    audit(req)('GAME_PUBLISHED', 'game', {
      entityId: id,
      summary: `${published ? 'Published' : 'Unpublished'} “${game!.title}”`,
    });

    res.json({ game: serialiseAdminGame(game!) });
  })
);

/** POST /api/admin/games/:id/featured */
router.post(
  '/:id/featured',
  requirePermission('games:feature'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const { featured } = z.object({ featured: z.boolean() }).strict().parse(req.body);

    const [existing] = await db.select().from(games).where(eq(games.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'That game no longer exists.', 'not_found');
    if (featured && !existing.published) {
      throw new AppError(400, 'Publish the game before featuring it.', 'not_published');
    }

    const [last] = await db
      .select({ featuredOrder: games.featuredOrder })
      .from(games)
      .where(eq(games.featured, true))
      .orderBy(sql`${games.featuredOrder} desc nulls last`)
      .limit(1);

    await db
      .update(games)
      .set({ featured, featuredOrder: featured ? (last?.featuredOrder ?? 0) + 1 : null })
      .where(eq(games.id, id));

    const game = await fetchGame(id);

    audit(req)('GAME_FEATURED', 'game', {
      entityId: id,
      summary: `${featured ? 'Featured' : 'Unfeatured'} “${game!.title}”`,
    });

    res.json({ game: serialiseAdminGame(game!) });
  })
);

/** POST /api/admin/games/reorder-featured */
router.post(
  '/reorder-featured',
  requirePermission('games:feature'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { gameIds } = z.object({ gameIds: z.array(idSchema).min(1).max(60) }).strict().parse(req.body);

    const found = await db.select({ id: games.id }).from(games).where(inArray(games.id, gameIds));

    if (found.length !== gameIds.length) {
      throw new AppError(400, 'One of those games is no longer available.', 'invalid_selection');
    }

    await db.transaction(async (tx) => {
      for (const [index, gameId] of gameIds.entries()) {
        await tx.update(games).set({ featuredOrder: index + 1 }).where(eq(games.id, gameId));
      }
    });

    audit(req)('GAMES_REORDERED', 'game', {
      summary: `Reordered ${gameIds.length} featured games`,
      metadata: { order: gameIds },
    });

    res.json({ ok: true, order: gameIds });
  })
);

/** POST /api/admin/games/:id/duplicate */
router.post(
  '/:id/duplicate',
  requirePermission('games:create'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const source = await fetchGame(id);
    if (!source) throw new AppError(404, 'That game no longer exists.', 'not_found');

    const slug = await uniqueSlug(`${source.slug}-copy`);

    const [copy] = await db
      .insert(games)
      .values({
        slug,
        title: `${source.title} (copy)`.slice(0, 160),
        subtitle: source.subtitle,
        genre: source.genre,
        categories: source.categories,
        rating: source.rating,
        price: source.price,
        salePrice: source.salePrice,
        currency: source.currency,
        isFree: source.isFree,
        platforms: source.platforms,
        status: source.status,
        releaseYear: source.releaseYear,
        description: source.description,
        longDescription: source.longDescription,
        heroImage: source.heroImage,
        secondaryImage: source.secondaryImage,
        screenshots: source.screenshots,
        trailerUrl: source.trailerUrl,
        tags: source.tags,
        features: source.features,
        devStory: source.devStory,
        awards: source.awards,
        // A duplicate always starts as an unpublished draft.
        published: false,
        featured: false,
      })
      .returning({ id: games.id });

    if (source.mechanics?.length) {
      await db.insert(gameplayMechanics).values(
        source.mechanics.map((mechanic, index) => ({
          gameId: copy.id,
          title: mechanic.title,
          description: mechanic.description,
          sortOrder: index,
        }))
      );
    }
    if (source.storeLinks?.length) {
      await db.insert(storeLinks).values(
        source.storeLinks.map((link, index) => ({
          gameId: copy.id,
          name: link.name,
          url: link.url,
          badge: link.badge,
          sortOrder: index,
        }))
      );
    }

    const game = await fetchGame(copy.id);

    audit(req)('GAME_DUPLICATED', 'game', {
      entityId: copy.id,
      summary: `Duplicated “${source.title}”`,
      metadata: { sourceId: source.id },
    });

    res.status(201).json({ game: serialiseAdminGame(game!) });
  })
);

/** DELETE /api/admin/games/:id — requires typing the slug to confirm. */
router.delete(
  '/:id',
  requirePermission('games:delete'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const { confirm } = z.object({ confirm: z.string().min(1).max(160) }).strict().parse(req.body);

    const [game] = await db
      .select({ id: games.id, title: games.title, slug: games.slug })
      .from(games)
      .where(eq(games.id, id))
      .limit(1);
    if (!game) throw new AppError(404, 'That game no longer exists.', 'not_found');

    if (confirm !== game.slug) {
      throw new AppError(400, `To confirm, type the game slug (${game.slug}) exactly.`, 'confirmation_required');
    }

    await db.delete(games).where(eq(games.id, id));

    audit(req)('GAME_DELETED', 'game', {
      entityId: id,
      summary: `Deleted game “${game.title}”`,
      metadata: { slug: game.slug },
    });

    res.json({ ok: true });
  })
);

export default router;
