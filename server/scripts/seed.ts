import 'dotenv/config';
/**
 * Seeds the studio database with the site's real content so the public website
 * renders identically once it is connected to the API.
 *
 *   npm run db:setup      → migrate + seed
 *   npm run seed          → seed only (idempotent upserts, safe to re-run)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { db, closeDatabase } from '../src/db/index.js';
import {
  adminUsers,
  categories,
  contactMessages,
  games,
  gameplayMechanics,
  jobs,
  newsPosts,
  players,
  siteSettings,
  storeLinks,
  subscribers,
  websiteContent,
} from '../src/db/schema.js';
import { textToHtml } from '../src/utils/sanitize.js';
import { hashPassword } from '../src/utils/crypto.js';
import { CONTENT_DEFAULTS, SETTING_DEFAULTS } from '../src/services/cms.js';
import { temporaryAdminPassword } from '../src/config/temporary-password.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
// Shared temporary password (see src/config/temporary-password.ts). Used for the
// primary admin when ADMIN_PASSWORD is unset, and for the local demo accounts.
const DEV_PASSWORD = temporaryAdminPassword();

interface SeedContent {
  games: any[];
  news: any[];
  jobs: any[];
  studioTimeline: any[];
  teamMembers: any[];
}

const MONTHS: Record<string, number> = {
  JANUARY: 0, FEBRUARY: 1, MARCH: 2, APRIL: 3, MAY: 4, JUNE: 5,
  JULY: 6, AUGUST: 7, SEPTEMBER: 8, OCTOBER: 9, NOVEMBER: 10, DECEMBER: 11,
};

function parseMonthYear(value: string): Date {
  const [monthName, year] = (value || '').toUpperCase().split(/\s+/);
  const month = MONTHS[monthName];
  const parsedYear = Number.parseInt(year, 10);
  if (month === undefined || Number.isNaN(parsedYear)) return new Date();
  return new Date(Date.UTC(parsedYear, month, 15));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 140);
}

const CATEGORY_SEED = [
  { name: 'News', slug: 'news', color: '#FF5A3C' },
  { name: 'Devlog', slug: 'devlog', color: '#6C4CF1' },
  { name: 'Behind the Scenes', slug: 'behind-the-scenes', color: '#FFC53D' },
  { name: 'Announcement', slug: 'announcement', color: '#A8D92C' },
  { name: 'Studio', slug: 'studio', color: '#2FB9DD' },
  { name: 'Community', slug: 'community', color: '#FF5A3C' },
];

const CATEGORY_BY_LABEL: Record<string, string> = {
  NEWS: 'news',
  DEVLOG: 'devlog',
  'BEHIND THE SCENES': 'behind-the-scenes',
  ANNOUNCEMENT: 'announcement',
  STUDIO: 'studio',
  COMMUNITY: 'community',
};

const GAME_STATUS: Record<string, string> = {
  'In Development': 'IN_DEVELOPMENT',
  'Early Access': 'EARLY_ACCESS',
  'Wishlist Now': 'WISHLIST_NOW',
  'Available Now': 'AVAILABLE_NOW',
};

const JOB_TYPE: Record<string, string> = {
  'Full-time': 'FULL_TIME',
  Contract: 'CONTRACT',
  Freelance: 'FREELANCE',
  'Remote / Hybrid': 'REMOTE_HYBRID',
};

async function main() {
  console.log('\n🌱  Seeding the Brainchild studio database…\n');

  const seedContent: SeedContent = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../db/seed-content.json'), 'utf8')
  );

  /* ------------------------------ studio team ----------------------------- */

  const PRIMARY_ADMIN_EMAIL = 'brainchildgamesin@gmail.com';
  const PRIMARY_ADMIN_NAME = 'Brainchild Games';

  const ownerEmail = (process.env.ADMIN_EMAIL || PRIMARY_ADMIN_EMAIL).toLowerCase();
  let ownerPassword = process.env.ADMIN_PASSWORD;
  if (!ownerPassword) {
    if (isProduction) throw new Error('ADMIN_PASSWORD must be set when seeding production.');
    ownerPassword = DEV_PASSWORD;
  }
  if (ownerPassword.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');

  // Email uniqueness is enforced case-insensitively by a partial index, so the
  // seed looks the account up first instead of relying on ON CONFLICT.
  const [existingOwner] = await db
    .select({ id: adminUsers.id, email: adminUsers.email })
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = ${ownerEmail}`)
    .limit(1);

  const owner = existingOwner
    ? (
        await db
          .update(adminUsers)
          .set({ role: 'SUPER_ADMIN', isActive: true, name: process.env.ADMIN_NAME || 'Julian Vance' })
          .where(eq(adminUsers.id, existingOwner.id))
          .returning({ id: adminUsers.id, email: adminUsers.email })
      )[0]
    : (
        await db
          .insert(adminUsers)
          .values({
            email: ownerEmail,
            name: process.env.ADMIN_NAME || 'Julian Vance',
            role: 'SUPER_ADMIN',
            passwordHash: await hashPassword(ownerPassword),
            passwordChangedAt: new Date(),
          })
          .returning({ id: adminUsers.id, email: adminUsers.email })
      )[0];
  console.log(`   ✓ Studio owner      ${owner.email}${existingOwner ? ' (exists, role ensured)' : ''}`);

  // Always ensure the primary studio account brainchildgamesin@gmail.com exists as SUPER_ADMIN
  if (ownerEmail !== PRIMARY_ADMIN_EMAIL) {
    const [existingPrimary] = await db
      .select({ id: adminUsers.id, email: adminUsers.email })
      .from(adminUsers)
      .where(sql`lower(${adminUsers.email}) = ${PRIMARY_ADMIN_EMAIL}`)
      .limit(1);

    if (existingPrimary) {
      await db
        .update(adminUsers)
        .set({ role: 'SUPER_ADMIN', isActive: true, name: PRIMARY_ADMIN_NAME })
        .where(eq(adminUsers.id, existingPrimary.id));
      console.log(`   ✓ Primary admin     ${PRIMARY_ADMIN_EMAIL} (exists, role ensured SUPER_ADMIN)`);
    } else {
      const primaryPassword = process.env.BRAINCHILD_ADMIN_PASSWORD || ownerPassword;
      await db.insert(adminUsers).values({
        email: PRIMARY_ADMIN_EMAIL,
        name: PRIMARY_ADMIN_NAME,
        role: 'SUPER_ADMIN',
        passwordHash: await hashPassword(primaryPassword),
        passwordChangedAt: new Date(),
      });
      console.log(`   ✓ Primary admin     ${PRIMARY_ADMIN_EMAIL} (created as SUPER_ADMIN)`);
    }
  } else {
    // Owner is already the primary admin, ensure name is set correctly if not custom
    if ((process.env.ADMIN_NAME || '').trim() === '' || process.env.ADMIN_NAME === 'Julian Vance') {
      await db
        .update(adminUsers)
        .set({ name: PRIMARY_ADMIN_NAME })
        .where(eq(adminUsers.id, owner.id));
    }
  }

  if (!isProduction) {
    for (const member of [
      { email: 'manager@brainchild.games', name: 'Maya Lin-Torvalds', role: 'ADMIN' },
      { email: 'editor@brainchild.games', name: 'Elena Rostova', role: 'EDITOR' },
    ]) {
      const [existingMember] = await db
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .where(sql`lower(${adminUsers.email}) = ${member.email}`)
        .limit(1);

      if (existingMember) {
        await db
          .update(adminUsers)
          .set({ name: member.name, role: member.role, isActive: true })
          .where(eq(adminUsers.id, existingMember.id));
      } else {
        await db.insert(adminUsers).values({
          email: member.email,
          name: member.name,
          role: member.role,
          passwordHash: await hashPassword(DEV_PASSWORD),
          passwordChangedAt: new Date(),
        });
      }
      console.log(`   ✓ Demo ${member.role.padEnd(12)} ${member.email}`);
    }
  }

  /* ------------------------------ categories ------------------------------ */

  const categoryIds = new Map<string, string>();
  for (const category of CATEGORY_SEED) {
    const [row] = await db
      .insert(categories)
      .values(category)
      .onConflictDoUpdate({ target: categories.slug, set: { name: category.name, color: category.color } })
      .returning({ id: categories.id });
    categoryIds.set(category.slug, row.id);
  }
  console.log(`   ✓ Categories        ${CATEGORY_SEED.length}`);

  /* --------------------------------- games -------------------------------- */

  let featuredOrder = 0;
  for (const game of seedContent.games) {
    const slug = game.slug ?? slugify(game.title);
    const values = {
      slug,
      title: game.title,
      subtitle: game.subtitle ?? null,
      genre: game.genre ?? 'Indie',
      categories: game.categories ?? ['Indie'],
      rating: game.rating ?? 0,
      price: game.price ?? 'Wishlist free',
      salePrice: game.salePrice ?? null,
      currency: game.currency ?? 'USD',
      isFree: Boolean(game.isFree ?? /free|soon/i.test(game.price ?? '')),
      platforms: game.platforms ?? ['PC (Steam)'],
      status: GAME_STATUS[game.status] ?? 'IN_DEVELOPMENT',
      releaseYear: game.releaseYear ?? '2027',
      description: game.description ?? '',
      longDescription: game.longDescription ?? '',
      heroImage: game.heroImage ?? null,
      secondaryImage: game.secondaryImage ?? null,
      screenshots: game.screenshots ?? [],
      trailerUrl: game.videoUrl ?? null,
      tags: game.tags ?? [],
      features: game.features ?? [],
      devStory: game.devStory ?? '',
      awards: game.awards ?? [],
      featured: Boolean(game.featured),
      featuredOrder: game.featured ? ++featuredOrder : null,
      published: true,
      publishedAt: new Date(),
    };

    const [existing] = await db.select({ id: games.id }).from(games).where(eq(games.slug, slug)).limit(1);

    if (existing) {
      await db.update(games).set(values).where(eq(games.id, existing.id));
      continue;
    }

    const [created] = await db.insert(games).values(values).returning({ id: games.id });

    if (game.gameplayMechanics?.length) {
      await db.insert(gameplayMechanics).values(
        game.gameplayMechanics.map((mechanic: any, index: number) => ({
          gameId: created.id,
          title: mechanic.title,
          description: mechanic.description,
          sortOrder: index,
        }))
      );
    }
    if (game.storeLinks?.length) {
      await db.insert(storeLinks).values(
        game.storeLinks.map((link: any, index: number) => ({
          gameId: created.id,
          name: link.name,
          url: link.url,
          badge: link.badge ?? null,
          sortOrder: index,
        }))
      );
    }
  }
  console.log(`   ✓ Games             ${seedContent.games.length}`);

  /* --------------------------------- news --------------------------------- */

  for (const post of seedContent.news) {
    const slug = post.slug ?? slugify(post.title);
    const status = post.published === false ? 'DRAFT' : 'PUBLISHED';
    const values = {
      slug,
      title: post.title,
      excerpt: post.excerpt ?? '',
      contentHtml: textToHtml(post.content ?? ''),
      coverImage: post.coverImage ?? null,
      categoryId: categoryIds.get(CATEGORY_BY_LABEL[post.category] ?? 'news')!,
      authorName: post.author?.name ?? 'Studio Team',
      authorRole: post.author?.role ?? 'Editor',
      authorImage: post.author?.avatar ?? null,
      tags: post.tags ?? [],
      status,
      featured: Boolean(post.featured),
      readTimeOverride: post.readTime ?? null,
      publishedAt: status === 'PUBLISHED' ? parseMonthYear(post.date) : null,
    };

    await db
      .insert(newsPosts)
      .values(values)
      .onConflictDoUpdate({ target: newsPosts.slug, set: values });
  }
  console.log(`   ✓ News posts        ${seedContent.news.length}`);

  /* --------------------------------- jobs --------------------------------- */

  for (const [index, job] of seedContent.jobs.entries()) {
    const values = {
      title: job.title,
      department: job.department ?? 'Studio',
      location: job.location ?? 'Remote',
      type: JOB_TYPE[job.type] ?? 'FULL_TIME',
      experience: job.experience ?? 'Mid',
      description: job.description ?? '',
      responsibilities: job.responsibilities ?? [],
      requirements: job.requirements ?? [],
      niceToHave: job.niceToHave ?? [],
      perks: job.perks ?? [],
      status: job.status === 'closed' ? 'CLOSED' : 'OPEN',
      postedDate: job.postedDate ?? '',
      sortOrder: index,
    };

    const [existing] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.title, job.title)).limit(1);
    if (existing) await db.update(jobs).set(values).where(eq(jobs.id, existing.id));
    else await db.insert(jobs).values(values);
  }
  console.log(`   ✓ Open roles        ${seedContent.jobs.length}`);

  /* ------------------------------- content -------------------------------- */

  const content: Record<string, unknown> = {
    ...Object.fromEntries(Object.entries(CONTENT_DEFAULTS).map(([key, entry]) => [key, entry.value])),
    'about.timeline': { items: seedContent.studioTimeline },
    'about.team': { members: seedContent.teamMembers },
  };

  for (const [key, value] of Object.entries(content)) {
    const section = CONTENT_DEFAULTS[key]?.section ?? key.split('.')[0];
    await db
      .insert(websiteContent)
      .values({ key, value: value as object, section, updatedBy: 'seed' })
      .onConflictDoUpdate({
        target: websiteContent.key,
        set: { value: value as object, section, updatedBy: 'seed' },
      });
  }
  console.log(`   ✓ Content blocks    ${Object.keys(content).length}`);

  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await db
      .insert(siteSettings)
      .values({ key, value: value as object, updatedBy: 'seed' })
      .onConflictDoNothing();
  }
  console.log(`   ✓ Site settings     ${Object.keys(SETTING_DEFAULTS).length}`);

  /* ------------------------------- audience ------------------------------- */

  const baseSubscribers = [
    { email: 'pilot.orion@nebula.io', name: 'Commander Orion', interests: ['Aetherbound', 'Beta Testing'] },
    { email: 'mira.design@celestial.dev', name: 'Mira Vance', interests: ['Devlogs', 'Studio News'] },
  ];
  for (const subscriber of baseSubscribers) {
    await db
      .insert(subscribers)
      .values({ ...subscriber, source: 'website' })
      .onConflictDoNothing();
  }
  console.log(`   ✓ Subscribers       ${baseSubscribers.length}`);

  if (!isProduction) {
    const demoSubscribers = Array.from({ length: 23 }, (_, index) => {
      const n = index + 1;
      const interestsPool = [
        ['Beta access', 'New game drops'],
        ['Devlogs & tech'],
        ['Merch & vinyl', 'New game drops'],
        ['Beta access'],
      ];
      return {
        email: `playtester${String(n).padStart(2, '0')}@example.com`,
        name: `Playtester ${n}`,
        interests: interestsPool[index % interestsPool.length],
        source: 'demo-seed',
        status: index % 9 === 0 ? 'UNSUBSCRIBED' : 'ACTIVE',
        subscribedAt: new Date(Date.now() - index * 36 * 60 * 60 * 1000),
      };
    });
    await db.insert(subscribers).values(demoSubscribers).onConflictDoNothing();

    const demoPlayers = [
      { email: 'nova.rider@example.com', displayName: 'NovaRider', country: 'Canada' },
      { email: 'pixel.pilot@example.com', displayName: 'PixelPilot', country: 'Germany' },
      { email: 'sky.cartographer@example.com', displayName: 'SkyCartographer', country: 'Japan' },
      { email: 'press@indiepress.example', displayName: 'Indie Press Desk', country: 'USA' },
      { email: 'glowcore.diver@example.com', displayName: 'GlowcoreDiver', country: 'Brazil' },
      { email: 'tether.king@example.com', displayName: 'TetherKing', country: 'UK' },
      { email: 'sand.collector@example.com', displayName: 'SandCollector', country: 'India' },
      { email: 'heist.captain@example.com', displayName: 'HeistCaptain', country: 'Australia' },
      { email: 'bell.ringer@example.com', displayName: 'BellRinger', country: 'France' },
      { email: 'wind.reader@example.com', displayName: 'WindReader', country: 'Norway' },
      { email: 'monolith.fan@example.com', displayName: 'MonolithFan', country: 'Poland' },
      { email: 'community.mod@example.com', displayName: 'CommunityMod', country: 'Netherlands' },
    ];
    const gameRows = await db.select({ id: games.id }).from(games).limit(4);

    await db
      .insert(players)
      .values(
        demoPlayers.map((player, index) => ({
          email: player.email,
          displayName: player.displayName,
          country: player.country,
          role: index === 3 ? 'PRESS' : 'PLAYER',
          status: index === 10 ? 'DISABLED' : 'ACTIVE',
          emailVerified: index % 3 !== 0,
          wishlist: gameRows.slice(0, (index % 3) + 1).map((game) => game.id),
          createdAt: new Date(Date.now() - index * 4 * 24 * 60 * 60 * 1000),
          lastSeenAt: new Date(Date.now() - index * 7 * 60 * 60 * 1000),
        }))
      )
      .onConflictDoNothing();

    const demoMessages = [
      {
        name: 'Harrison Gray',
        email: 'h.gray@venturegames.example',
        company: 'Venture Games Publishing',
        subject: 'Co-publishing inquiry for Asian territories',
        projectType: 'Publishing',
        budget: '$500k+',
        message:
          'Loved your physics demonstration at GDC. We would love to discuss physical distribution and localization opportunities for Aetherbound.',
        status: 'UNREAD',
      },
      {
        name: 'Priya Raman',
        email: 'priya@edgecase.press',
        company: 'Edge Case Magazine',
        subject: 'Review keys for Solaris Diver 0.8',
        projectType: 'Press',
        message: 'We are running a golden-sea feature next month and would love early access for our reviewer.',
        status: 'REVIEWED',
      },
      {
        name: 'Tomas Adeyemi',
        email: 'tomas@playtesters.example',
        subject: 'Accessibility feedback from alpha weekend',
        projectType: 'Player Support',
        message:
          'The new tether feedback is wonderful, but the shrine chimes are hard to place with the music at 100%. Consider a separate audio slider?',
        status: 'UNREAD',
      },
    ];
    await db.insert(contactMessages).values(demoMessages).onConflictDoNothing();

    console.log(
      `   ✓ Demo audience     ${demoSubscribers.length} subscribers, ${demoPlayers.length} players, ${demoMessages.length} messages`
    );
  }

  console.log('\n🎉  Seed complete.\n');
  if (!isProduction) {
    console.log('   Sign in at  /admin/login');
    console.log(`   Owner       ${ownerEmail} / ${ownerPassword}`);
    if (ownerEmail !== PRIMARY_ADMIN_EMAIL) {
      console.log(`   Primary     ${PRIMARY_ADMIN_EMAIL} / ${process.env.BRAINCHILD_ADMIN_PASSWORD || ownerPassword}`);
    }
    console.log(`   Manager     manager@brainchild.games / ${DEV_PASSWORD}`);
    console.log(`   Editor      editor@brainchild.games / ${DEV_PASSWORD}`);
    console.log('\n   Primary admin brainchildgamesin@gmail.com is always valid SUPER_ADMIN');
    console.log('\n   ⚠  Demo credentials — change them (Team → Set password) before going live.\n');
  } else {
    console.log(`   Primary admin ${PRIMARY_ADMIN_EMAIL} ensured as SUPER_ADMIN`);
  }
}

main()
  .catch((error) => {
    console.error('\n❌  Seeding failed:', error instanceof Error ? (process.env.SEED_DEBUG ? error.stack : error.message) : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
