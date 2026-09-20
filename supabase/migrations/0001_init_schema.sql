-- =============================================================================
-- Brainchild Games — Supabase schema migration
-- =============================================================================
-- Run this in the Supabase SQL Editor (or via `supabase db push`) to set up the
-- project schema. Contents:
--   1. Helper types & utility functions
--   2. `profiles` table synced to auth.users via trigger
--   3. Catalog: games, gameplay_mechanics, store_links
--   4. Newsroom: categories, news_posts
--   5. Audience: players, subscribers, contact_messages
--   6. Careers: jobs
--   7. Editable content: website_content, site_settings
--   8. Admin team + RBAC helpers
--   9. Storage buckets for uploads
--  10. Row-Level Security policies (anon reads for public content,
--      authenticated writes for admins/editors, anon inserts for forms)
--  11. Updated-at trigger
-- =============================================================================

-- -------- 0. Enable required extensions --------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- -------- 1. Utility functions -----------------------------------------------

-- Check if the currently requesting user has the requested admin role.
-- Admin/editor roles are stored in the `admin_users` table keyed by auth.uid().
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
      AND is_active = true
      AND role IN ('SUPER_ADMIN','ADMIN','EDITOR')
  );
$$;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
      AND is_active = true
      AND role = 'SUPER_ADMIN'
  );
$$;

-- Automatically stamp updated_at on row updates.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Helper that adds the updated-at trigger to a table idempotently.
CREATE OR REPLACE FUNCTION add_touch_updated_at_trigger(target_table text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_updated_at ON %I', target_table);
  EXECUTE format(
    'CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
    target_table
  );
END;
$$;

-- -------- 2. Studio admin team ----------------------------------------------
--
-- This table extends auth.users for studio staff. Its `id` is the same uuid as
-- the auth.users row, so linking is zero-join.
CREATE TABLE IF NOT EXISTS admin_users (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                text,
  role                text        NOT NULL DEFAULT 'EDITOR'
                        CHECK (role IN ('SUPER_ADMIN','ADMIN','EDITOR')),
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

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
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_activity_admin_user_idx ON admin_activity (admin_user_id);
CREATE INDEX IF NOT EXISTS admin_activity_entity_idx    ON admin_activity (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS admin_activity_action_idx    ON admin_activity (action);
CREATE INDEX IF NOT EXISTS admin_activity_created_idx   ON admin_activity (created_at);

-- -------- 3. Player profiles (synced from auth.users) -----------------------
--
-- A mirror of auth.users for signed-up players. The trigger keeps it in sync
-- automatically so a player row exists as soon as someone signs up.
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    text,
  avatar_url      text,
  country         text,
  role            text        NOT NULL DEFAULT 'PLAYER'
                    CHECK (role IN ('PLAYER','PRESS','PARTNER')),
  email_verified  boolean     NOT NULL DEFAULT false,
  last_seen_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url, email_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name  = EXCLUDED.display_name,
    avatar_url    = EXCLUDED.avatar_url,
    email_verified= EXCLUDED.email_verified,
    updated_at    = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- -------- 4. Catalog --------------------------------------------------------

CREATE TABLE IF NOT EXISTS games (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             citext      NOT NULL,
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
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT games_rating_range CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5))
);
CREATE UNIQUE INDEX IF NOT EXISTS games_slug_key ON games (slug);
CREATE INDEX IF NOT EXISTS games_status_idx    ON games (status);
CREATE INDEX IF NOT EXISTS games_published_idx ON games (published);
CREATE INDEX IF NOT EXISTS games_featured_idx  ON games (featured, featured_order);

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

-- -------- 5. Newsroom -------------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       citext      NOT NULL,
  slug       citext      NOT NULL,
  color      text        NOT NULL DEFAULT '#6C4CF1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_key ON categories (name);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON categories (slug);

CREATE TABLE IF NOT EXISTS news_posts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               citext      NOT NULL,
  title              text        NOT NULL,
  excerpt            text        NOT NULL DEFAULT '',
  content_html       text        NOT NULL DEFAULT '',
  cover_image        text,
  category_id        uuid        NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  author_name        text        NOT NULL DEFAULT 'Studio Team',
  author_role        text        NOT NULL DEFAULT 'Editor',
  author_image       text,
  tags               text[]      NOT NULL DEFAULT ARRAY[]::text[],
  status             text        NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN ('DRAFT','PUBLISHED')),
  featured           boolean     NOT NULL DEFAULT false,
  read_time_override text,
  published_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES admin_users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS news_posts_slug_key       ON news_posts (slug);
CREATE INDEX IF NOT EXISTS news_posts_status_published_idx ON news_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS news_posts_category_idx         ON news_posts (category_id);

-- -------- 6. Audience -------------------------------------------------------

-- Players are a subset of `profiles` that have expressed interest (wishlist, etc.).
-- We keep a dedicated players table for backwards compatibility with the
-- original Postgres schema; profiles remain the source of identity.
CREATE TABLE IF NOT EXISTS players (
  id             uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email          citext      NOT NULL,
  display_name   text,
  wishlist       uuid[]      NOT NULL DEFAULT ARRAY[]::uuid[],
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS players_email_key   ON players (email);
CREATE INDEX IF NOT EXISTS players_created_idx        ON players (created_at);

CREATE TABLE IF NOT EXISTS wishlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id     uuid NOT NULL REFERENCES games(id)   ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, game_id)
);

CREATE TABLE IF NOT EXISTS subscribers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext      NOT NULL,
  name            text,
  interests       text[]      NOT NULL DEFAULT ARRAY[]::text[],
  status          text        NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','UNSUBSCRIBED','BOUNCED')),
  source          text        DEFAULT 'website',
  subscribed_at   timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  metadata        jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_key  ON subscribers (email);
CREATE INDEX IF NOT EXISTS subscribers_status_idx        ON subscribers (status);

CREATE TABLE IF NOT EXISTS contact_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  email        citext      NOT NULL,
  company      text,
  subject      text        NOT NULL,
  project_type text        NOT NULL DEFAULT 'Player Support',
  budget       text,
  message      text        NOT NULL,
  status       text        NOT NULL DEFAULT 'UNREAD'
                 CHECK (status IN ('UNREAD','REVIEWED','ARCHIVED')),
  handled_by   uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  handled_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_messages_status_idx  ON contact_messages (status);
CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON contact_messages (created_at);

-- -------- 7. Careers --------------------------------------------------------

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

-- -------- 8. Editable content & settings ------------------------------------

CREATE TABLE IF NOT EXISTS website_content (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        citext      NOT NULL,
  value      jsonb       NOT NULL,
  section    text        NOT NULL,
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS website_content_key_key     ON website_content (key);
CREATE INDEX IF NOT EXISTS website_content_section_idx ON website_content (section);

CREATE TABLE IF NOT EXISTS site_settings (
  key        citext PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -------- 9. Media library --------------------------------------------------

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
  alt_text       text,
  uploaded_by    uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_filename_key ON media_assets (filename);
CREATE INDEX IF NOT EXISTS media_assets_created_idx        ON media_assets (created_at);

-- -------- 10. Attach updated_at triggers ------------------------------------

SELECT add_touch_updated_at_trigger('admin_users');
SELECT add_touch_updated_at_trigger('profiles');
SELECT add_touch_updated_at_trigger('games');
SELECT add_touch_updated_at_trigger('categories');
SELECT add_touch_updated_at_trigger('news_posts');
SELECT add_touch_updated_at_trigger('players');
SELECT add_touch_updated_at_trigger('contact_messages');
SELECT add_touch_updated_at_trigger('jobs');
SELECT add_touch_updated_at_trigger('website_content');

-- =============================================================================
-- 11. ROW-LEVEL SECURITY
-- =============================================================================
--
-- Policy model:
--   * anon (not logged in):
--       - read published games, published news, categories, open jobs, public content blocks
--       - insert into subscribers, contact_messages (newsletter/contact forms)
--   * authenticated players (role=PLAYER):
--       - all anon privileges
--       - read/write their own profile + wishlist
--   * admins/editors (admin_users.is_active=true):
--       - full CRUD on everything

-- Enable RLS on every table.
ALTER TABLE admin_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE games             ENABLE ROW LEVEL SECURITY;
ALTER TABLE gameplay_mechanicsENABLE ROW LEVEL SECURITY;
ALTER TABLE store_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE players           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_content   ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets      ENABLE ROW LEVEL SECURITY;

-- -------- Helper policies (admins can do anything) --------------------------
-- A single "admin full access" policy per table.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_users','admin_activity','games','gameplay_mechanics','store_links',
    'categories','news_posts','players','wishlists','subscribers',
    'contact_messages','jobs','website_content','site_settings','media_assets'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I_admin_all ON %I FOR ALL TO authenticated
         USING (is_admin()) WITH CHECK (is_admin())',
       t || '_', t
    );
  END LOOP;
END $$;

-- Profiles: admins have full access (already covered); self read/write for owners.
CREATE POLICY profiles_self_read  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());
CREATE POLICY profiles_self_write ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- -------- Public read policies ----------------------------------------------

-- Games: anyone can read published games.
CREATE POLICY games_public_read ON games FOR SELECT TO anon, authenticated
  USING (published = true);

-- Mechanics & store links: readable when their parent game is published.
CREATE POLICY mechanics_public_read ON gameplay_mechanics FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.published));
CREATE POLICY store_links_public_read ON store_links FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.published));

-- Categories: public read.
CREATE POLICY categories_public_read ON categories FOR SELECT TO anon, authenticated
  USING (true);

-- News posts: public read for PUBLISHED rows.
CREATE POLICY news_public_read ON news_posts FOR SELECT TO anon, authenticated
  USING (status = 'PUBLISHED');

-- Jobs: public read for OPEN positions.
CREATE POLICY jobs_public_read ON jobs FOR SELECT TO anon, authenticated
  USING (status = 'OPEN');

-- Website content: public read for content flagged public = true (value->>public).
-- Editors store public content blocks with `{"public": true, ...}` so the same
-- table powers both the public site and internal CMS.
CREATE POLICY content_public_read ON website_content FOR SELECT TO anon, authenticated
  USING ((value->>'public')::boolean = true);

-- Media assets: public read for any referenced asset (used in published content).
-- We keep this permissive because assets are public when linked; storage RLS
-- handles upload controls.
CREATE POLICY media_public_read ON media_assets FOR SELECT TO anon, authenticated
  USING (true);

-- -------- Public form-write policies (inserts only) -------------------------

-- Newsletter: anon can insert a new ACTIVE subscriber, but cannot read/update.
CREATE POLICY subscribers_anon_insert ON subscribers FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'ACTIVE' AND auth.uid() IS NULL OR auth.uid() IS NOT NULL);

-- Contact form: anon can insert an UNREAD message, cannot read/update/delete.
CREATE POLICY contacts_anon_insert ON contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'UNREAD' AND handled_by IS NULL);

-- -------- Player-scope policies (wishlist, player record) -------------------

-- A player row exists for users who have added to a wishlist or signed up.
-- They can read & update their own row, insert their own row.
CREATE POLICY players_self ON players FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY wishlists_self_all ON wishlists FOR ALL TO authenticated
  USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());

-- =============================================================================
-- 12. STORAGE BUCKETS
-- =============================================================================
--
-- Creates three buckets:
--   games    – public images/screenshots for games
--   news     – public cover images for news posts
--   avatars  – public user avatars

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('games',   'games',   true, 10 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('news',    'news',    true, 10 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('avatars', 'avatars', true,  2 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Public reads for all three buckets (objects are public).
CREATE POLICY storage_public_read ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('games','news','avatars'));

-- Authenticated admins can upload/delete; players can upload their own avatar.
CREATE POLICY storage_admin_write ON storage.objects FOR ALL TO authenticated
  USING (
    is_admin() AND bucket_id IN ('games','news','avatars')
  ) WITH CHECK (
    is_admin() AND bucket_id IN ('games','news','avatars')
  );

CREATE POLICY storage_avatar_self_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY storage_avatar_self_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- 13. Utility RPCs
-- =============================================================================

-- Increment wishlist count safely from the client (RLS already restricts direct
-- updates; this RPC lets us atomically bump the counter when players add/remove).
CREATE OR REPLACE FUNCTION increment_wishlist(game_uuid uuid, delta int DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE games SET wishlist_count = GREATEST(wishlist_count + delta, 0) WHERE id = game_uuid;
END;
$$;

-- Increment view count (public, idempotent-ish).
CREATE OR REPLACE FUNCTION increment_view(game_uuid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE games SET view_count = view_count + 1 WHERE id = game_uuid AND published;
END;
$$;

-- Token-free unsubscribe: link emailed to subscriber contains their id.
CREATE OR REPLACE FUNCTION unsubscribe(subscriber_uuid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE subscribers
     SET status = 'UNSUBSCRIBED', unsubscribed_at = now()
   WHERE id = subscriber_uuid AND status = 'ACTIVE';
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_wishlist(uuid,int) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_view(uuid)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION unsubscribe(uuid)          TO anon, authenticated;
