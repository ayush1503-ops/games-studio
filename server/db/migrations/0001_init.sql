-- Brainchild Studio — initial schema
-- PostgreSQL 13+. Applied by `npm run db:migrate` (see scripts/migrate.mjs).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

/* ------------------------------ studio team ------------------------------ */

CREATE TABLE IF NOT EXISTS admin_users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text        NOT NULL,
  password_hash       text        NOT NULL,
  name                text,
  role                text        NOT NULL DEFAULT 'EDITOR'
                        CHECK (role IN ('SUPER_ADMIN','ADMIN','EDITOR')),
  is_active           boolean     NOT NULL DEFAULT true,
  failed_login_count  integer     NOT NULL DEFAULT 0,
  locked_until        timestamptz,
  last_login_at       timestamptz,
  last_login_ip       text,
  password_changed_at timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_key ON admin_users (lower(email));

CREATE TABLE IF NOT EXISTS admin_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  uuid        NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash     text        NOT NULL,
  user_agent     text,
  ip_address     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz,
  revoked_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_sessions_token_hash_key ON admin_sessions (token_hash);
CREATE INDEX IF NOT EXISTS admin_sessions_admin_user_idx ON admin_sessions (admin_user_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid        NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash    text        NOT NULL,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  requested_ip  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_key ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS password_reset_tokens_admin_user_idx ON password_reset_tokens (admin_user_id);

CREATE TABLE IF NOT EXISTS admin_activity (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_email   text,
  action        text        NOT NULL,
  entity_type   text        NOT NULL,
  entity_id     text,
  summary       text,
  metadata      jsonb,
  ip_address    text,
  user_agent    text,
  request_id    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_activity_admin_user_idx ON admin_activity (admin_user_id);
CREATE INDEX IF NOT EXISTS admin_activity_entity_idx ON admin_activity (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS admin_activity_action_idx ON admin_activity (action);
CREATE INDEX IF NOT EXISTS admin_activity_created_idx ON admin_activity (created_at);

/* --------------------------------- catalog ------------------------------- */

CREATE TABLE IF NOT EXISTS games (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text        NOT NULL,
  title            text        NOT NULL,
  subtitle         text,
  genre            text        NOT NULL,
  categories       text[]      NOT NULL DEFAULT ARRAY['Indie']::text[],
  rating           real        DEFAULT 0,
  price            text        NOT NULL DEFAULT 'Wishlist free',
  sale_price       text,
  currency         text        NOT NULL DEFAULT 'USD',
  is_free          boolean     NOT NULL DEFAULT false,
  platforms        text[]      NOT NULL DEFAULT ARRAY['PC (Steam)']::text[],
  status           text        NOT NULL DEFAULT 'IN_DEVELOPMENT'
                     CHECK (status IN ('IN_DEVELOPMENT','EARLY_ACCESS','WISHLIST_NOW','AVAILABLE_NOW')),
  release_year     text        NOT NULL DEFAULT '2027',
  description      text        NOT NULL,
  long_description text        NOT NULL DEFAULT '',
  hero_image       text,
  secondary_image  text,
  screenshots      text[]      NOT NULL DEFAULT ARRAY[]::text[],
  trailer_url      text,
  tags             text[]      NOT NULL DEFAULT ARRAY[]::text[],
  features         text[]      NOT NULL DEFAULT ARRAY[]::text[],
  dev_story        text        NOT NULL DEFAULT '',
  awards           text[]      NOT NULL DEFAULT ARRAY[]::text[],
  featured         boolean     NOT NULL DEFAULT false,
  featured_order   integer,
  published        boolean     NOT NULL DEFAULT false,
  published_at     timestamptz,
  wishlist_count   integer     NOT NULL DEFAULT 0,
  view_count       integer     NOT NULL DEFAULT 0,
  version          integer     NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT games_rating_range CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5))
);
CREATE UNIQUE INDEX IF NOT EXISTS games_slug_key ON games (slug);
CREATE INDEX IF NOT EXISTS games_status_idx ON games (status);
CREATE INDEX IF NOT EXISTS games_published_idx ON games (published);
CREATE INDEX IF NOT EXISTS games_featured_idx ON games (featured, featured_order);

CREATE TABLE IF NOT EXISTS gameplay_mechanics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     uuid    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  title       text    NOT NULL,
  description text    NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS gameplay_mechanics_game_idx ON gameplay_mechanics (game_id);

CREATE TABLE IF NOT EXISTS store_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id    uuid    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name       text    NOT NULL,
  url        text    NOT NULL,
  badge      text,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS store_links_game_idx ON store_links (game_id);

/* -------------------------------- newsroom ------------------------------- */

CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        NOT NULL,
  color      text        NOT NULL DEFAULT '#6C4CF1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_key ON categories (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON categories (slug);

CREATE TABLE IF NOT EXISTS news_posts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text        NOT NULL,
  title              text        NOT NULL,
  excerpt            text        NOT NULL DEFAULT '',
  content_html       text        NOT NULL DEFAULT '',
  cover_image        text,
  category_id        uuid        NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  author_name        text        NOT NULL DEFAULT 'Studio Team',
  author_role        text        NOT NULL DEFAULT 'Editor',
  author_image       text,
  tags               text[]      NOT NULL DEFAULT ARRAY[]::text[],
  status             text        NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED')),
  featured           boolean     NOT NULL DEFAULT false,
  read_time_override text,
  published_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS news_posts_slug_key ON news_posts (slug);
CREATE INDEX IF NOT EXISTS news_posts_status_idx ON news_posts (status, published_at);
CREATE INDEX IF NOT EXISTS news_posts_category_idx ON news_posts (category_id);

/* -------------------------------- audience ------------------------------- */

CREATE TABLE IF NOT EXISTS players (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text        NOT NULL,
  display_name   text,
  password_hash  text,
  role           text        NOT NULL DEFAULT 'PLAYER' CHECK (role IN ('PLAYER','PRESS','PARTNER')),
  status         text        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
  country        text,
  wishlist       text[]      NOT NULL DEFAULT ARRAY[]::text[],
  email_verified boolean     NOT NULL DEFAULT false,
  last_seen_at   timestamptz,
  last_seen_ip   text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS players_email_key ON players (lower(email));
CREATE INDEX IF NOT EXISTS players_status_idx ON players (status);
CREATE INDEX IF NOT EXISTS players_created_idx ON players (created_at);

CREATE TABLE IF NOT EXISTS subscribers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text        NOT NULL,
  name            text,
  interests       text[]      NOT NULL DEFAULT ARRAY[]::text[],
  status          text        NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','UNSUBSCRIBED','BOUNCED')),
  source          text        DEFAULT 'website',
  subscribed_at   timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  metadata        jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_key ON subscribers (lower(email));
CREATE INDEX IF NOT EXISTS subscribers_status_idx ON subscribers (status);

CREATE TABLE IF NOT EXISTS contact_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  email        text        NOT NULL,
  company      text,
  subject      text        NOT NULL,
  project_type text        NOT NULL DEFAULT 'Player Support',
  budget       text,
  message      text        NOT NULL,
  status       text        NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD','REVIEWED','ARCHIVED')),
  handled_by   text,
  handled_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON contact_messages (status);
CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON contact_messages (created_at);

/* --------------------------------- careers ------------------------------- */

CREATE TABLE IF NOT EXISTS jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text        NOT NULL,
  department       text        NOT NULL,
  location         text        NOT NULL,
  type             text        NOT NULL DEFAULT 'FULL_TIME'
                     CHECK (type IN ('FULL_TIME','CONTRACT','FREELANCE','REMOTE_HYBRID')),
  experience       text        NOT NULL,
  description      text        NOT NULL,
  responsibilities text[]      NOT NULL DEFAULT ARRAY[]::text[],
  requirements     text[]      NOT NULL DEFAULT ARRAY[]::text[],
  nice_to_have     text[]      NOT NULL DEFAULT ARRAY[]::text[],
  perks            text[]      NOT NULL DEFAULT ARRAY[]::text[],
  status           text        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  posted_date      text        NOT NULL,
  sort_order       integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);

/* ---------------------------- editable content --------------------------- */

CREATE TABLE IF NOT EXISTS website_content (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text        NOT NULL,
  value      jsonb       NOT NULL,
  section    text        NOT NULL,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS website_content_key_key ON website_content (key);
CREATE INDEX IF NOT EXISTS website_content_section_idx ON website_content (section);

CREATE TABLE IF NOT EXISTS site_settings (
  key        text PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

/* ------------------------------ media library ---------------------------- */

CREATE TABLE IF NOT EXISTS media_assets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename       text        NOT NULL,
  original_name  text        NOT NULL,
  url            text        NOT NULL,
  mime_type      text        NOT NULL,
  size_bytes     integer     NOT NULL,
  width          integer,
  height         integer,
  checksum       text        NOT NULL,
  uploaded_by_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_filename_key ON media_assets (filename);
CREATE INDEX IF NOT EXISTS media_assets_created_idx ON media_assets (created_at);

/* --------------------------- updated_at upkeep --------------------------- */

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['admin_users','games','categories','news_posts','players','contact_messages','jobs','website_content']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_updated_at ON %I', target);
    EXECUTE format(
      'CREATE TRIGGER touch_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
      target
    );
  END LOOP;
END;
$$;
