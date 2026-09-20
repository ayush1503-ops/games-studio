import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Database schema (PostgreSQL).
 *
 * Notes:
 *  - Every identifier here is mirrored 1:1 by db/migrations/0001_init.sql,
 *    which is the single source of truth applied by `npm run db:migrate`.
 *  - Enumerations are stored as text with CHECK constraints (see the migration)
 *    so future values never require a type rewrite.
 *  - All queries go through Drizzle's query builder, which always emits
 *    parameterised SQL — user input is never concatenated into statements.
 */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/* ----------------------------- studio team ------------------------------ */

export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name'),
    role: text('role').notNull().default('EDITOR'),
    isActive: boolean('is_active').notNull().default(true),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastLoginIp: text('last_login_ip'),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex('admin_users_email_key').on(sql`lower(${table.email})`)],
);

export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
  },
  (table) => [
    uniqueIndex('admin_sessions_token_hash_key').on(table.tokenHash),
    index('admin_sessions_admin_user_idx').on(table.adminUserId),
    index('admin_sessions_expires_idx').on(table.expiresAt),
  ],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    requestedIp: text('requested_ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('password_reset_tokens_token_hash_key').on(table.tokenHash),
    index('password_reset_tokens_admin_user_idx').on(table.adminUserId),
  ],
);

export const adminActivity = pgTable(
  'admin_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    summary: text('summary'),
    metadata: jsonb('metadata'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('admin_activity_admin_user_idx').on(table.adminUserId),
    index('admin_activity_entity_idx').on(table.entityType, table.entityId),
    index('admin_activity_action_idx').on(table.action),
    index('admin_activity_created_idx').on(table.createdAt),
  ],
);

/* ------------------------------- catalog -------------------------------- */

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    genre: text('genre').notNull(),
    categories: text('categories').array().notNull().default(sql`ARRAY['Indie']::text[]`),
    rating: real('rating').default(0),
    price: text('price').notNull().default('Wishlist free'),
    salePrice: text('sale_price'),
    currency: text('currency').notNull().default('USD'),
    isFree: boolean('is_free').notNull().default(false),
    platforms: text('platforms').array().notNull().default(sql`ARRAY['PC (Steam)']::text[]`),
    status: text('status').notNull().default('IN_DEVELOPMENT'),
    releaseYear: text('release_year').notNull().default('2027'),
    description: text('description').notNull(),
    longDescription: text('long_description').notNull().default(''),
    heroImage: text('hero_image'),
    secondaryImage: text('secondary_image'),
    screenshots: text('screenshots').array().notNull().default(sql`ARRAY[]::text[]`),
    trailerUrl: text('trailer_url'),
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
    features: text('features').array().notNull().default(sql`ARRAY[]::text[]`),
    devStory: text('dev_story').notNull().default(''),
    awards: text('awards').array().notNull().default(sql`ARRAY[]::text[]`),
    featured: boolean('featured').notNull().default(false),
    featuredOrder: integer('featured_order'),
    published: boolean('published').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    wishlistCount: integer('wishlist_count').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('games_slug_key').on(table.slug),
    index('games_status_idx').on(table.status),
    index('games_published_idx').on(table.published),
    index('games_featured_idx').on(table.featured, table.featuredOrder),
  ],
);

export const gameplayMechanics = pgTable(
  'gameplay_mechanics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('gameplay_mechanics_game_idx').on(table.gameId)],
);

export const storeLinks = pgTable(
  'store_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    badge: text('badge'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('store_links_game_idx').on(table.gameId)],
);

/* -------------------------------- newsroom ------------------------------ */

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    color: text('color').notNull().default('#6C4CF1'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('categories_name_key').on(sql`lower(${table.name})`),
    uniqueIndex('categories_slug_key').on(table.slug),
  ],
);

export const newsPosts = pgTable(
  'news_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    excerpt: text('excerpt').notNull().default(''),
    contentHtml: text('content_html').notNull().default(''),
    coverImage: text('cover_image'),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    authorName: text('author_name').notNull().default('Studio Team'),
    authorRole: text('author_role').notNull().default('Editor'),
    authorImage: text('author_image'),
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
    status: text('status').notNull().default('DRAFT'),
    featured: boolean('featured').notNull().default(false),
    readTimeOverride: text('read_time_override'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('news_posts_slug_key').on(table.slug),
    index('news_posts_status_idx').on(table.status, table.publishedAt),
    index('news_posts_category_idx').on(table.categoryId),
  ],
);

/* -------------------------------- audience ------------------------------ */

export const players = pgTable(
  'players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    passwordHash: text('password_hash'),
    role: text('role').notNull().default('PLAYER'),
    status: text('status').notNull().default('ACTIVE'),
    country: text('country'),
    wishlist: text('wishlist').array().notNull().default(sql`ARRAY[]::text[]`),
    emailVerified: boolean('email_verified').notNull().default(false),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    lastSeenIp: text('last_seen_ip'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('players_email_key').on(sql`lower(${table.email})`),
    index('players_status_idx').on(table.status),
    index('players_created_idx').on(table.createdAt),
  ],
);

export const subscribers = pgTable(
  'subscribers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name'),
    interests: text('interests').array().notNull().default(sql`ARRAY[]::text[]`),
    status: text('status').notNull().default('ACTIVE'),
    source: text('source').default('website'),
    subscribedAt: timestamp('subscribed_at', { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
  },
  (table) => [
    uniqueIndex('subscribers_email_key').on(sql`lower(${table.email})`),
    index('subscribers_status_idx').on(table.status),
  ],
);

export const contactMessages = pgTable(
  'contact_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    company: text('company'),
    subject: text('subject').notNull(),
    projectType: text('project_type').notNull().default('Player Support'),
    budget: text('budget'),
    message: text('message').notNull(),
    status: text('status').notNull().default('UNREAD'),
    handledBy: text('handled_by'),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index('contact_messages_status_idx').on(table.status), index('contact_messages_created_idx').on(table.createdAt)],
);

/* --------------------------------- careers ------------------------------ */

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    department: text('department').notNull(),
    location: text('location').notNull(),
    type: text('type').notNull().default('FULL_TIME'),
    experience: text('experience').notNull(),
    description: text('description').notNull(),
    responsibilities: text('responsibilities').array().notNull().default(sql`ARRAY[]::text[]`),
    requirements: text('requirements').array().notNull().default(sql`ARRAY[]::text[]`),
    niceToHave: text('nice_to_have').array().notNull().default(sql`ARRAY[]::text[]`),
    perks: text('perks').array().notNull().default(sql`ARRAY[]::text[]`),
    status: text('status').notNull().default('OPEN'),
    postedDate: text('posted_date').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [index('jobs_status_idx').on(table.status)],
);

/* --------------------------- editable content --------------------------- */

export const websiteContent = pgTable(
  'website_content',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    section: text('section').notNull(),
    updatedBy: text('updated_by'),
    ...timestamps,
  },
  (table) => [uniqueIndex('website_content_key_key').on(table.key), index('website_content_section_idx').on(table.section)],
);

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------ media library --------------------------- */

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filename: text('filename').notNull(),
    originalName: text('original_name').notNull(),
    url: text('url').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    checksum: text('checksum').notNull(),
    uploadedById: uuid('uploaded_by_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('media_assets_filename_key').on(table.filename), index('media_assets_created_idx').on(table.createdAt)],
);

/* ------------------------------- relations ------------------------------ */

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
  activities: many(adminActivity),
  media: many(mediaAssets),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  adminUser: one(adminUsers, { fields: [adminSessions.adminUserId], references: [adminUsers.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  adminUser: one(adminUsers, {
    fields: [passwordResetTokens.adminUserId],
    references: [adminUsers.id],
  }),
}));

export const adminActivityRelations = relations(adminActivity, ({ one }) => ({
  adminUser: one(adminUsers, { fields: [adminActivity.adminUserId], references: [adminUsers.id] }),
}));

export const gamesRelations = relations(games, ({ many }) => ({
  mechanics: many(gameplayMechanics),
  storeLinks: many(storeLinks),
}));

export const gameplayMechanicsRelations = relations(gameplayMechanics, ({ one }) => ({
  game: one(games, { fields: [gameplayMechanics.gameId], references: [games.id] }),
}));

export const storeLinksRelations = relations(storeLinks, ({ one }) => ({
  game: one(games, { fields: [storeLinks.gameId], references: [games.id] }),
}));

export const newsPostsRelations = relations(newsPosts, ({ one }) => ({
  category: one(categories, { fields: [newsPosts.categoryId], references: [categories.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  posts: many(newsPosts),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  uploadedBy: one(adminUsers, { fields: [mediaAssets.uploadedById], references: [adminUsers.id] }),
}));

/* --------------------------------- types -------------------------------- */

export type AdminUserRow = typeof adminUsers.$inferSelect;
export type AdminSessionRow = typeof adminSessions.$inferSelect;
export type AdminActivityRow = typeof adminActivity.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type GameplayMechanicRow = typeof gameplayMechanics.$inferSelect;
export type StoreLinkRow = typeof storeLinks.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type NewsPostRow = typeof newsPosts.$inferSelect;
export type PlayerRow = typeof players.$inferSelect;
export type SubscriberRow = typeof subscribers.$inferSelect;
export type ContactMessageRow = typeof contactMessages.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type WebsiteContentRow = typeof websiteContent.$inferSelect;
export type SiteSettingRow = typeof siteSettings.$inferSelect;
export type MediaAssetRow = typeof mediaAssets.$inferSelect;
