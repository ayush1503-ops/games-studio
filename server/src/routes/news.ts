import { Router, Response } from 'express';
import { and, asc, count, desc, eq, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { categories, newsPosts } from '../db/schema.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { idSchema, paginated, paginationSchema, slugSchema } from '../middleware/validate.js';
import { audit } from '../services/activity.js';
import { serialiseAdminPost } from '../services/cms.js';
import { cleanText, estimateExcerpt, sanitizeRichText, textToHtml } from '../utils/sanitize.js';

const router = Router();
router.use(authenticate);

const SORT_COLUMNS = {
  createdAt: newsPosts.createdAt,
  updatedAt: newsPosts.updatedAt,
  publishedAt: newsPosts.publishedAt,
  title: newsPosts.title,
} as const;

const MAX_CONTENT_BYTES = 400_000;

const postPayload = z
  .object({
    slug: slugSchema.optional(),
    title: z.string().trim().min(3).max(220),
    excerpt: z.string().trim().max(500).optional(),
    // Accepts editor HTML or legacy plain text; sanitised server-side either way.
    content: z.string().min(1).max(MAX_CONTENT_BYTES),
    contentFormat: z.enum(['html', 'text']).default('html'),
    coverImage: z.string().trim().max(500).optional().nullable(),
    categoryId: idSchema,
    authorName: z.string().trim().min(1).max(120).default('Studio Team'),
    authorRole: z.string().trim().min(1).max(120).default('Editor'),
    authorImage: z.string().trim().max(500).optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
    status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
    featured: z.boolean().default(false),
    readTimeOverride: z.string().trim().max(40).optional().nullable(),
    publishedAt: z.coerce.date().optional().nullable(),
  })
  .strict();

const createSchema = postPayload;
const updateSchema = postPayload.partial();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 150)
    .replace(/^-|-$/g, '');
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || 'post';
  let candidate = root;
  let suffix = 2;
  while (suffix < 200) {
    const [clash] = await db
      .select({ id: newsPosts.id })
      .from(newsPosts)
      .where(
        excludeId
          ? and(eq(newsPosts.slug, candidate), ne(newsPosts.id, excludeId))
          : eq(newsPosts.slug, candidate)
      )
      .limit(1);
    if (!clash) return candidate;
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function prepareContent(content: string, format: 'html' | 'text'): string {
  const html = format === 'text' ? textToHtml(content) : content;
  const sanitised = sanitizeRichText(html);
  if (!sanitised.replace(/<[^>]*>/g, '').trim()) {
    throw new AppError(400, 'The post body is empty once unsafe markup is removed.', 'empty_content');
  }
  return sanitised;
}

const withCategory = { category: { columns: { id: true, name: true, slug: true, color: true } } } as const;

const fetchPost = (id: string) => db.query.newsPosts.findFirst({ where: eq(newsPosts.id, id), with: withCategory });

/** GET /api/admin/news */
router.get(
  '/',
  requirePermission('news:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = paginationSchema
      .extend({
        status: z.enum(['DRAFT', 'PUBLISHED', 'ALL']).default('ALL'),
        categoryId: idSchema.optional(),
      })
      .parse(req.query);

    const conditions = [
      query.search
        ? or(
            sql`${newsPosts.title} ilike ${`%${query.search}%`}`,
            sql`${newsPosts.excerpt} ilike ${`%${query.search}%`}`,
            sql`${newsPosts.slug} ilike ${`%${query.search}%`}`,
            sql`${newsPosts.authorName} ilike ${`%${query.search}%`}`
          )
        : undefined,
      query.status === 'ALL' ? undefined : eq(newsPosts.status, query.status),
      query.categoryId ? eq(newsPosts.categoryId, query.categoryId) : undefined,
    ].filter(Boolean);

    const where = conditions.length ? and(...(conditions as never[])) : undefined;
    const sortColumn = SORT_COLUMNS[(query.sortBy as keyof typeof SORT_COLUMNS) ?? 'createdAt'] ?? newsPosts.createdAt;
    const orderBy = query.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const [items, totals, drafts, published] = await Promise.all([
      db.query.newsPosts.findMany({
        where,
        with: withCategory,
        orderBy: [orderBy],
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
      }),
      db.select({ value: count() }).from(newsPosts).where(where),
      db.select({ value: count() }).from(newsPosts).where(eq(newsPosts.status, 'DRAFT')),
      db.select({ value: count() }).from(newsPosts).where(eq(newsPosts.status, 'PUBLISHED')),
    ]);

    res.json({
      ...paginated(items.map(serialiseAdminPost), totals[0]?.value ?? 0, query.page, query.limit),
      counts: { drafts: drafts[0]?.value ?? 0, published: published[0]?.value ?? 0 },
    });
  })
);

/** GET /api/admin/news/:id */
router.get(
  '/:id',
  requirePermission('news:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const post = await fetchPost(id);
    if (!post) throw new AppError(404, 'That post no longer exists.', 'not_found');
    res.json({ post: serialiseAdminPost(post) });
  })
);

/** POST /api/admin/news */
router.post(
  '/',
  requirePermission('news:create'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = createSchema.parse(req.body);

    const [category] = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.id, data.categoryId))
      .limit(1);
    if (!category) throw new AppError(400, 'Pick a valid category.', 'invalid_category');

    const contentHtml = prepareContent(data.content, data.contentFormat);
    const slug = await uniqueSlug(data.slug ? slugify(data.slug) : slugify(data.title));
    const publishing = data.status === 'PUBLISHED';

    const [created] = await db
      .insert(newsPosts)
      .values({
        slug,
        title: cleanText(data.title, 220),
        excerpt: cleanText(data.excerpt?.trim() || estimateExcerpt(contentHtml, 220), 500),
        contentHtml,
        coverImage: data.coverImage || null,
        categoryId: data.categoryId,
        authorName: cleanText(data.authorName, 120),
        authorRole: cleanText(data.authorRole, 120),
        authorImage: data.authorImage || null,
        tags: data.tags.map((tag) => cleanText(tag, 40)),
        status: data.status,
        featured: data.featured,
        readTimeOverride: data.readTimeOverride ? cleanText(data.readTimeOverride, 40) : null,
        publishedAt: publishing ? data.publishedAt ?? new Date() : null,
      })
      .returning({ id: newsPosts.id, title: newsPosts.title, slug: newsPosts.slug });

    const post = await fetchPost(created.id);

    audit(req)('POST_CREATED', 'news', {
      entityId: created.id,
      summary: `Created ${publishing ? 'and published' : 'draft'} post “${created.title}”`,
      metadata: { slug: created.slug, category: category.name },
    });

    res.status(201).json({ post: serialiseAdminPost(post!) });
  })
);

/** PATCH /api/admin/news/:id */
router.patch(
  '/:id',
  requirePermission('news:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const data = updateSchema.parse(req.body);

    const [existing] = await db.select().from(newsPosts).where(eq(newsPosts.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'That post no longer exists.', 'not_found');

    if (data.categoryId) {
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, data.categoryId))
        .limit(1);
      if (!category) throw new AppError(400, 'Pick a valid category.', 'invalid_category');
    }

    const slug = data.slug ? await uniqueSlug(slugify(data.slug), id) : undefined;
    const contentHtml =
      data.content !== undefined ? prepareContent(data.content, data.contentFormat ?? 'html') : undefined;

    const status = data.status ?? existing.status;
    const publishedAt =
      status === 'PUBLISHED'
        ? existing.publishedAt ?? data.publishedAt ?? new Date()
        : data.publishedAt === null
          ? null
          : existing.publishedAt;

    await db
      .update(newsPosts)
      .set({
        ...(slug ? { slug } : {}),
        ...(data.title !== undefined ? { title: cleanText(data.title, 220) } : {}),
        ...(contentHtml !== undefined
          ? { contentHtml, excerpt: cleanText(data.excerpt?.trim() || estimateExcerpt(contentHtml, 220), 500) }
          : data.excerpt !== undefined
            ? { excerpt: cleanText(data.excerpt, 500) }
            : {}),
        ...(data.coverImage !== undefined ? { coverImage: data.coverImage || null } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.authorName !== undefined ? { authorName: cleanText(data.authorName, 120) } : {}),
        ...(data.authorRole !== undefined ? { authorRole: cleanText(data.authorRole, 120) } : {}),
        ...(data.authorImage !== undefined ? { authorImage: data.authorImage || null } : {}),
        ...(data.tags !== undefined ? { tags: data.tags.map((tag) => cleanText(tag, 40)) } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.featured !== undefined ? { featured: data.featured } : {}),
        ...(data.readTimeOverride !== undefined
          ? { readTimeOverride: data.readTimeOverride ? cleanText(data.readTimeOverride, 40) : null }
          : {}),
        publishedAt,
      })
      .where(eq(newsPosts.id, id));

    const post = await fetchPost(id);

    audit(req)('POST_UPDATED', 'news', {
      entityId: id,
      summary: `Updated post “${post!.title}”`,
      metadata: { fields: Object.keys(data) },
    });

    res.json({ post: serialiseAdminPost(post!) });
  })
);

/** POST /api/admin/news/:id/publish */
router.post(
  '/:id/publish',
  requirePermission('news:publish'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const { published, publishedAt } = z
      .object({ published: z.boolean(), publishedAt: z.coerce.date().optional() })
      .strict()
      .parse(req.body);

    const [existing] = await db.select().from(newsPosts).where(eq(newsPosts.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'That post no longer exists.', 'not_found');

    await db
      .update(newsPosts)
      .set({
        status: published ? 'PUBLISHED' : 'DRAFT',
        publishedAt: published ? publishedAt ?? existing.publishedAt ?? new Date() : existing.publishedAt,
        ...(published ? {} : { featured: false }),
      })
      .where(eq(newsPosts.id, id));

    const post = await fetchPost(id);

    audit(req)('POST_PUBLISHED', 'news', {
      entityId: id,
      summary: `${published ? 'Published' : 'Unpublished'} “${post!.title}”`,
    });

    res.json({ post: serialiseAdminPost(post!) });
  })
);

/** POST /api/admin/news/:id/featured */
router.post(
  '/:id/featured',
  requirePermission('news:feature'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const { featured } = z.object({ featured: z.boolean() }).strict().parse(req.body);

    const [existing] = await db.select().from(newsPosts).where(eq(newsPosts.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'That post no longer exists.', 'not_found');
    if (featured && existing.status !== 'PUBLISHED') {
      throw new AppError(400, 'Publish the post before featuring it.', 'not_published');
    }

    if (featured) {
      // Only one featured story at a time keeps the public hero deterministic.
      await db
        .update(newsPosts)
        .set({ featured: false })
        .where(and(eq(newsPosts.featured, true), ne(newsPosts.id, id)));
    }

    await db.update(newsPosts).set({ featured }).where(eq(newsPosts.id, id));
    const post = await fetchPost(id);

    audit(req)('POST_FEATURED', 'news', {
      entityId: id,
      summary: `${featured ? 'Featured' : 'Unfeatured'} “${post!.title}”`,
    });

    res.json({ post: serialiseAdminPost(post!) });
  })
);

/** DELETE /api/admin/news/:id — requires typing the slug to confirm. */
router.delete(
  '/:id',
  requirePermission('news:delete'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const { confirm } = z.object({ confirm: z.string().min(1).max(200) }).strict().parse(req.body);

    const [post] = await db
      .select({ id: newsPosts.id, title: newsPosts.title, slug: newsPosts.slug })
      .from(newsPosts)
      .where(eq(newsPosts.id, id))
      .limit(1);
    if (!post) throw new AppError(404, 'That post no longer exists.', 'not_found');

    if (confirm !== post.slug) {
      throw new AppError(400, `To confirm, type the post slug (${post.slug}) exactly.`, 'confirmation_required');
    }

    await db.delete(newsPosts).where(eq(newsPosts.id, id));

    audit(req)('POST_DELETED', 'news', {
      entityId: id,
      summary: `Deleted post “${post.title}”`,
      metadata: { slug: post.slug },
    });

    res.json({ ok: true });
  })
);

export default router;
