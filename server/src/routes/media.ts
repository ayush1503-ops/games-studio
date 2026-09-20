import { Router, Response } from 'express';
import multer from 'multer';
import { count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { games, mediaAssets, newsPosts, websiteContent } from '../db/schema.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { idSchema, paginated, paginationSchema } from '../middleware/validate.js';
import { uploadLimiter } from '../middleware/security.js';
import { audit } from '../services/activity.js';
import { deleteAsset, isManagedUrl, STORE_ROOT_NOTE, storeImage } from '../services/storage.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const router = Router();
router.use(authenticate);

// Files are held in memory (bounded by MAX_UPLOAD_MB) so we can inspect magic
// bytes before anything touches disk; nothing is written under the original name.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 12, fields: 10 },
});

/** GET /api/admin/media */
router.get(
  '/',
  requirePermission('media:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = paginationSchema
      .extend({ mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).optional() })
      .parse(req.query);

    const where = query.search
      ? or(
          ilike(mediaAssets.originalName, `%${query.search}%`),
          ilike(mediaAssets.filename, `%${query.search}%`)
        )
      : query.mimeType
        ? eq(mediaAssets.mimeType, query.mimeType)
        : undefined;

    const [items, totals, totalBytes] = await Promise.all([
      db
        .select()
        .from(mediaAssets)
        .where(where)
        .orderBy(desc(mediaAssets.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db.select({ value: count() }).from(mediaAssets).where(where),
      db.select({ value: sql<number>`coalesce(sum(${mediaAssets.sizeBytes}), 0)` }).from(mediaAssets),
    ]);

    res.json({
      ...paginated(items, totals[0]?.value ?? 0, query.page, query.limit),
      storage: {
        totalFiles: totals[0]?.value ?? 0,
        totalBytes: Number(totalBytes[0]?.value ?? 0),
        note: STORE_ROOT_NOTE,
      },
    });
  })
);

/** POST /api/admin/media/upload — multipart, up to 12 images per request. */
router.post(
  '/upload',
  requirePermission('media:upload'),
  uploadLimiter,
  upload.array('images', 12) as any,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw new AppError(400, 'Choose at least one image to upload.', 'no_files');

    const stored = [];
    for (const file of files) {
      stored.push(
        await storeImage({
          buffer: file.buffer,
          originalName: file.originalname,
          uploadedById: req.admin?.id ?? null,
        })
      );
    }

    audit(req)('MEDIA_UPLOADED', 'media', {
      summary: `Uploaded ${stored.length} image${stored.length === 1 ? '' : 's'}`,
      metadata: { files: stored.map((asset) => asset.filename) },
    });

    res.status(201).json({
      files: stored.map((asset) => ({ url: asset.url, filename: asset.filename, width: asset.width, height: asset.height })),
      assets: stored,
    });
  })
);

/** DELETE /api/admin/media/:id — refuses to break content that still points at it. */
router.delete(
  '/:id',
  requirePermission('media:delete'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);

    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!asset) throw new AppError(404, 'That media item no longer exists.', 'not_found');

    const url = asset.url;
    const [gameRefs, postRefs, contentRefs] = await Promise.all([
      db.select({ value: count() }).from(games).where(
        sql`${games.heroImage} = ${url} or ${games.secondaryImage} = ${url} or ${url} = ANY(${games.screenshots})`
      ),
      db.select({ value: count() }).from(newsPosts).where(
        sql`${newsPosts.coverImage} = ${url} or ${newsPosts.authorImage} = ${url}`
      ),
      db.select({ value: count() }).from(websiteContent).where(sql`${websiteContent.value}::text like ${`%${url}%`}`),
    ]);

    const usage =
      Number(gameRefs[0]?.value ?? 0) + Number(postRefs[0]?.value ?? 0) + Number(contentRefs[0]?.value ?? 0);

    if (usage > 0) {
      throw new AppError(
        409,
        'That image is still used by published content. Replace it there first.',
        'media_in_use'
      );
    }

    await deleteAsset(id);

    audit(req)('MEDIA_DELETED', 'media', {
      entityId: id,
      summary: `Deleted image ${asset.originalName}`,
      metadata: { filename: asset.filename },
    });

    res.json({ ok: true });
  })
);

/** POST /api/admin/media/verify — checks whether a URL is a managed asset. */
router.post(
  '/verify',
  requirePermission('media:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { url } = z.object({ url: z.string().trim().max(500) }).strict().parse(req.body);
    if (!isManagedUrl(url)) {
      logger.debug('Rejected non-managed media reference', { url: url.slice(0, 80) });
      res.json({ managed: false });
      return;
    }
    const [asset] = await db
      .select({ id: mediaAssets.id, filename: mediaAssets.filename })
      .from(mediaAssets)
      .where(eq(mediaAssets.url, url))
      .limit(1);
    res.json({ managed: true, exists: Boolean(asset), assetId: asset?.id ?? null });
  })
);

export default router;
