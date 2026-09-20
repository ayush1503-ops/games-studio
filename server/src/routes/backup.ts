import { Router, Response } from 'express';
import { asc, count, desc, sql } from 'drizzle-orm';
import { db, databaseHealth } from '../db/index.js';
import {
  adminUsers,
  categories,
  contactMessages,
  games,
  jobs,
  mediaAssets,
  newsPosts,
  players,
  siteSettings,
  subscribers,
  websiteContent,
} from '../db/schema.js';
import { asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { exportLimiter } from '../middleware/security.js';
import { audit } from '../services/activity.js';
import { ROLE_MATRIX } from '../services/permissions.js';
import { config } from '../config/env.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/admin/backup/export
 *
 * A portable content export (JSON) for recovery and migration. It deliberately
 * excludes credentials: admin accounts, password hashes, session tokens and
 * reset tokens are never part of a backup file.
 */
router.get(
  '/export',
  requirePermission('backup:export'),
  exportLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const [gameRows, postRows, categoryRows, jobRows, contentRows, settingRows, subscriberRows, playerRows, messageRows] =
      await Promise.all([
        db.query.games.findMany({ with: { mechanics: true, storeLinks: true }, orderBy: [asc(games.createdAt)] }),
        db.query.newsPosts.findMany({ orderBy: [asc(newsPosts.createdAt)] }),
        db.select().from(categories).orderBy(asc(categories.name)),
        db.select().from(jobs).orderBy(asc(jobs.sortOrder)),
        db.select().from(websiteContent).orderBy(asc(websiteContent.key)),
        db.select().from(siteSettings).orderBy(asc(siteSettings.key)),
        db.select().from(subscribers).orderBy(asc(subscribers.subscribedAt)),
        // Players are exported WITHOUT password hashes.
        db
          .select({
            id: players.id,
            email: players.email,
            displayName: players.displayName,
            country: players.country,
            role: players.role,
            status: players.status,
            emailVerified: players.emailVerified,
            wishlist: players.wishlist,
            createdAt: players.createdAt,
          })
          .from(players),
        db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(5000),
      ]);

    const payload = {
      meta: {
        application: 'Brainchild Studio',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: req.admin!.email,
        excludes: ['admin users', 'password hashes', 'sessions', 'reset tokens'],
      },
      games: gameRows,
      news: postRows,
      categories: categoryRows,
      jobs: jobRows,
      content: contentRows,
      settings: settingRows,
      subscribers: subscriberRows,
      players: playerRows,
      contactMessages: messageRows,
    };

    audit(req)('BACKUP_EXPORTED', 'system', {
      summary: 'Exported a content backup',
      metadata: { games: gameRows.length, posts: postRows.length, subscribers: subscriberRows.length },
    });

    res.setHeader('Content-Disposition', `attachment; filename="brainchild-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(payload);
  })
);

/** GET /api/admin/backup/system — operational snapshot for the settings screen. */
router.get(
  '/system',
  requirePermission('settings:read'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const health = await databaseHealth();

    const [games_, posts, subscribers_, admins, media] = await Promise.all([
      db.select({ value: count() }).from(games),
      db.select({ value: count() }).from(newsPosts),
      db.select({ value: count() }).from(subscribers),
      db.select({ value: count() }).from(adminUsers),
      db.select({ value: sql<number>`coalesce(sum(${mediaAssets.sizeBytes}), 0)` }).from(mediaAssets),
    ]);

    res.json({
      database: {
        connected: health.ok,
        version: health.version ?? null,
        // Redacted: never echo the connection string or credentials.
        host: safeHost(config.databaseUrl),
        poolMax: Number(process.env.DB_POOL_MAX || 10),
      },
      counts: {
        games: games_[0]?.value ?? 0,
        posts: posts[0]?.value ?? 0,
        subscribers: subscribers_[0]?.value ?? 0,
        admins: admins[0]?.value ?? 0,
        mediaBytes: Number(media[0]?.value ?? 0),
      },
      runtime: {
        nodeVersion: process.version,
        environment: config.env,
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      security: {
        httpsEnforced: config.forceHttps,
        secureCookies: config.cookieSecure,
        accessTokenMinutes: config.accessTokenTtlMinutes,
        refreshTokenDays: config.refreshTokenTtlDays,
        passwordStorage: 'bcrypt cost 12 over a sha256 pre-hash; hashes never leave the database',
        resetLinkExposedInApi: config.exposeResetLink,
      },
      recommendations: [
        'Run a nightly database dump: npm run backup (pg_dump to disk or object storage)',
        'Store backups outside the app server and test a restore quarterly (npm run restore <file>)',
        'Keep database credentials, JWT secrets and SMTP credentials in the platform secret manager',
      ],
    });
  })
);

/** GET /api/admin/backup/roles — the RBAC matrix, for the team screen. */
router.get(
  '/roles',
  requirePermission('team:read'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ roles: ROLE_MATRIX });
  })
);

function safeHost(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
  } catch {
    return 'unparseable connection string';
  }
}

export default router;
