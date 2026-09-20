import { Router, Response } from 'express';
import { and, asc, count, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { categories, newsPosts } from '../db/schema.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { idSchema } from '../middleware/validate.js';
import { audit } from '../services/activity.js';
import { cleanText } from '../utils/sanitize.js';

const router = Router();
router.use(authenticate);

const categorySchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]{2,60}$/, 'Use lowercase letters, numbers and dashes')
      .optional(),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #FF5A3C')
      .default('#FF5A3C'),
  })
  .strict();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .slice(0, 60);
}

/** GET /api/admin/categories */
router.get(
  '/',
  requirePermission('categories:read'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const rows = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        color: categories.color,
        postCount: count(newsPosts.id),
      })
      .from(categories)
      .leftJoin(newsPosts, eq(newsPosts.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(asc(categories.name));

    res.json({ categories: rows.map((row) => ({ ...row, postCount: Number(row.postCount) })) });
  })
);

/** POST /api/admin/categories */
router.post(
  '/',
  requirePermission('categories:create'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = categorySchema.parse(req.body);
    const slug = data.slug ?? slugify(data.name);
    if (!slug) throw new AppError(400, 'Could not derive a URL slug from that name.', 'invalid_slug');

    const [created] = await db
      .insert(categories)
      .values({
        name: cleanText(data.name, 60),
        slug,
        color: data.color.toUpperCase(),
      })
      .returning();

    audit(req)('CATEGORY_CREATED', 'category', {
      entityId: created.id,
      summary: `Created category “${created.name}”`,
    });

    res.status(201).json({ category: { ...created, postCount: 0 } });
  })
);

/** PATCH /api/admin/categories/:id */
router.patch(
  '/:id',
  requirePermission('categories:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const data = categorySchema.partial().parse(req.body);

    const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'That category no longer exists.', 'not_found');

    if (data.slug && data.slug !== existing.slug) {
      const [clash] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.slug, data.slug), ne(categories.id, id)))
        .limit(1);
      if (clash) throw new AppError(409, 'Another category already uses that slug.', 'duplicate');
    }

    const [updated] = await db
      .update(categories)
      .set({
        ...(data.name !== undefined ? { name: cleanText(data.name, 60) } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.color !== undefined ? { color: data.color.toUpperCase() } : {}),
      })
      .where(eq(categories.id, id))
      .returning();

    const [counts] = await db
      .select({ value: count() })
      .from(newsPosts)
      .where(eq(newsPosts.categoryId, id));

    audit(req)('CATEGORY_UPDATED', 'category', {
      entityId: id,
      summary: `Updated category “${updated.name}”`,
    });

    res.json({ category: { ...updated, postCount: Number(counts?.value ?? 0) } });
  })
);

/** DELETE /api/admin/categories/:id — blocked while posts still reference it. */
router.delete(
  '/:id',
  requirePermission('categories:delete'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);

    const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'That category no longer exists.', 'not_found');

    const [usage] = await db.select({ value: count() }).from(newsPosts).where(eq(newsPosts.categoryId, id));
    const used = Number(usage?.value ?? 0);
    if (used > 0) {
      throw new AppError(
        409,
        `“${existing.name}” is used by ${used} post${used === 1 ? '' : 's'}. Move them to another category first.`,
        'category_in_use'
      );
    }

    await db.delete(categories).where(eq(categories.id, id));

    audit(req)('CATEGORY_DELETED', 'category', {
      entityId: id,
      summary: `Deleted category “${existing.name}”`,
    });

    res.json({ ok: true });
  })
);

export default router;
