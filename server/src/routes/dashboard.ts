import { Router, Response } from 'express';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  adminActivity,
  contactMessages,
  games,
  jobs,
  mediaAssets,
  newsPosts,
  players,
  subscribers,
  websiteContent,
} from '../db/schema.js';
import { asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { CONTENT_DEFAULTS } from '../services/cms.js';

const router = Router();
router.use(authenticate);

/** GET /api/admin/dashboard — one bundle for the studio overview screen. */
router.get(
  '/',
  requirePermission('dashboard:read'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

    const [
      gameTotals,
      publishedGames,
      featuredGames,
      postTotals,
      draftPosts,
      jobTotals,
      openJobs,
      subscriberTotals,
      activeSubscribers,
      recentSubscribers,
      playerTotals,
      newPlayers,
      unreadMessages,
      mediaTotals,
      activity,
      recentPosts,
      recentGames,
      recentMessages,
      topGames,
      contentRows,
      trend,
    ] = await Promise.all([
      db.select({ value: count() }).from(games),
      db.select({ value: count() }).from(games).where(eq(games.published, true)),
      db
        .select({ id: games.id, title: games.title, slug: games.slug, heroImage: games.heroImage, featuredOrder: games.featuredOrder })
        .from(games)
        .where(eq(games.featured, true))
        .orderBy(sql`${games.featuredOrder} asc nulls last`)
        .limit(12),
      db.select({ value: count() }).from(newsPosts),
      db.select({ value: count() }).from(newsPosts).where(eq(newsPosts.status, 'DRAFT')),
      db.select({ value: count() }).from(jobs),
      db.select({ value: count() }).from(jobs).where(eq(jobs.status, 'OPEN')),
      db.select({ value: count() }).from(subscribers),
      db.select({ value: count() }).from(subscribers).where(eq(subscribers.status, 'ACTIVE')),
      db.select({ value: count() }).from(subscribers).where(gte(subscribers.subscribedAt, thirtyDaysAgo)),
      db.select({ value: count() }).from(players),
      db.select({ value: count() }).from(players).where(gte(players.createdAt, thirtyDaysAgo)),
      db.select({ value: count() }).from(contactMessages).where(eq(contactMessages.status, 'UNREAD')),
      db
        .select({ files: count(), bytes: sql<number>`coalesce(sum(${mediaAssets.sizeBytes}), 0)` })
        .from(mediaAssets),
      db.select().from(adminActivity).orderBy(desc(adminActivity.createdAt)).limit(12),
      db
        .select({
          id: newsPosts.id,
          title: newsPosts.title,
          slug: newsPosts.slug,
          status: newsPosts.status,
          publishedAt: newsPosts.publishedAt,
          updatedAt: newsPosts.updatedAt,
          coverImage: newsPosts.coverImage,
        })
        .from(newsPosts)
        .orderBy(desc(newsPosts.updatedAt))
        .limit(6),
      db
        .select({
          id: games.id,
          title: games.title,
          slug: games.slug,
          status: games.status,
          published: games.published,
          updatedAt: games.updatedAt,
          heroImage: games.heroImage,
        })
        .from(games)
        .orderBy(desc(games.updatedAt))
        .limit(6),
      db
        .select({
          id: contactMessages.id,
          name: contactMessages.name,
          email: contactMessages.email,
          subject: contactMessages.subject,
          status: contactMessages.status,
          createdAt: contactMessages.createdAt,
        })
        .from(contactMessages)
        .orderBy(desc(contactMessages.createdAt))
        .limit(5),
      db
        .select({
          id: games.id,
          title: games.title,
          slug: games.slug,
          views: games.viewCount,
          wishlists: games.wishlistCount,
          heroImage: games.heroImage,
          published: games.published,
        })
        .from(games)
        .orderBy(desc(games.wishlistCount), desc(games.viewCount))
        .limit(5),
      db.select({ key: websiteContent.key, updatedAt: websiteContent.updatedAt }).from(websiteContent),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${subscribers.subscribedAt}), 'YYYY-MM-DD')`,
          value: count(),
        })
        .from(subscribers)
        .where(and(gte(subscribers.subscribedAt, thirtyDaysAgo), eq(subscribers.status, 'ACTIVE')))
        .groupBy(sql`date_trunc('day', ${subscribers.subscribedAt})`)
        .orderBy(sql`date_trunc('day', ${subscribers.subscribedAt})`),
    ]);

    const customised = new Set(contentRows.map((row) => row.key));
    const contentChecklist = Object.entries(CONTENT_DEFAULTS).map(([key, entry]) => ({
      key,
      section: entry.section,
      customized: customised.has(key),
      updatedAt: contentRows.find((row) => row.key === key)?.updatedAt ?? null,
    }));

    res.json({
      stats: {
        games: { total: gameTotals[0]?.value ?? 0, published: publishedGames[0]?.value ?? 0, featured: featuredGames.length },
        posts: { total: postTotals[0]?.value ?? 0, drafts: draftPosts[0]?.value ?? 0 },
        jobs: { total: jobTotals[0]?.value ?? 0, open: openJobs[0]?.value ?? 0 },
        subscribers: {
          total: subscriberTotals[0]?.value ?? 0,
          active: activeSubscribers[0]?.value ?? 0,
          last30Days: recentSubscribers[0]?.value ?? 0,
        },
        players: { total: playerTotals[0]?.value ?? 0, new30Days: newPlayers[0]?.value ?? 0 },
        messages: { unread: unreadMessages[0]?.value ?? 0 },
        media: { files: mediaTotals[0]?.files ?? 0, bytes: Number(mediaTotals[0]?.bytes ?? 0) },
      },
      featuredGames,
      recentActivity: activity,
      recentPosts,
      recentGames,
      recentMessages,
      topGames,
      subscriberTrend: trend.map((row) => ({ day: row.day, count: Number(row.value) })),
      contentChecklist,
    });
  })
);

export default router;
