-- Brainchild Games — Supabase SQL Editor setup
-- Project: gwmljctpddazmjmrrqjy
--
-- Run this entire file in Supabase Dashboard → SQL Editor. It creates the
-- content model, RLS policies, storage buckets and safe public-form access.
-- It intentionally does not create a user or contain a password.
--
-- =============================================================================
--  BRAINCHILD GAMES — SUPABASE SETUP (run this in one go)
-- -----------------------------------------------------------------------------
--  Open Supabase Dashboard → SQL Editor → New Query → paste this entire file
--  → Run. Then create an account in Authentication → Users with a password
--  chosen by you and run the promotion block at the bottom.
--
--  This script never creates, stores, or assumes a password. Supabase Auth owns
--  credentials; the public API key belongs only in the browser environment.
--
--  NOTE: Tables are created BEFORE any functions/policies that reference them
--  to avoid "relation does not exist" errors.
-- =============================================================================

BEGIN;

-- ---------- 0. Extensions ---------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- 1. Utility helpers that depend on NOTHING -----------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION add_touch_updated_at_trigger(target_table text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_updated_at ON %I', target_table);
  EXECUTE format(
    'CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', target_table);
END;
$$;

-- ---------- 2. CREATE ALL TABLES FIRST --------------------------------------
-- (Functions/policies/triggers that reference these come after.)

-- Studio admin team
CREATE TABLE IF NOT EXISTS admin_users (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text,
  name       text,
  role       text    NOT NULL DEFAULT 'EDITOR'
               CHECK (role IN ('SUPER_ADMIN','ADMIN','EDITOR')),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS email text;

CREATE TABLE IF NOT EXISTS admin_activity (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_email   text,
  action        text    NOT NULL,
  entity_type   text    NOT NULL,
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

-- Player profiles
CREATE TABLE IF NOT EXISTS profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   text,
  avatar_url     text,
  country        text,
  role           text    NOT NULL DEFAULT 'PLAYER'
                   CHECK (role IN ('PLAYER','PRESS','PARTNER')),
  email_verified boolean NOT NULL DEFAULT false,
  last_seen_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Catalog
CREATE TABLE IF NOT EXISTS games (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             citext  NOT NULL,
  title            text    NOT NULL,
  subtitle         text,
  genre            text    NOT NULL,
  categories       text[]  NOT NULL DEFAULT ARRAY['Indie']::text[],
  rating           real    DEFAULT 0,
  price            text    NOT NULL DEFAULT 'Wishlist free',
  sale_price       text,
  currency         text    NOT NULL DEFAULT 'USD',
  is_free          boolean NOT NULL DEFAULT false,
  platforms        text[]  NOT NULL DEFAULT ARRAY['PC (Steam)']::text[],
  status           text    NOT NULL DEFAULT 'IN_DEVELOPMENT'
                     CHECK (status IN ('IN_DEVELOPMENT','EARLY_ACCESS','WISHLIST_NOW','AVAILABLE_NOW')),
  release_year     text    NOT NULL DEFAULT '2027',
  description      text    NOT NULL,
  long_description text    NOT NULL DEFAULT '',
  hero_image       text,
  secondary_image  text,
  screenshots      text[]  NOT NULL DEFAULT ARRAY[]::text[],
  trailer_url      text,
  tags             text[]  NOT NULL DEFAULT ARRAY[]::text[],
  features         text[]  NOT NULL DEFAULT ARRAY[]::text[],
  dev_story        text    NOT NULL DEFAULT '',
  awards           text[]  NOT NULL DEFAULT ARRAY[]::text[],
  featured         boolean NOT NULL DEFAULT false,
  featured_order   integer,
  published        boolean NOT NULL DEFAULT false,
  published_at     timestamptz,
  wishlist_count   integer NOT NULL DEFAULT 0,
  view_count       integer NOT NULL DEFAULT 0,
  created_by       uuid    REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT games_rating_range CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5))
);
CREATE UNIQUE INDEX IF NOT EXISTS games_slug_key       ON games (slug);
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

-- Newsroom
CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       citext  NOT NULL,
  slug       citext  NOT NULL,
  color      text    NOT NULL DEFAULT '#6C4CF1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_key ON categories (name);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON categories (slug);

CREATE TABLE IF NOT EXISTS news_posts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               citext  NOT NULL,
  title              text    NOT NULL,
  excerpt            text    NOT NULL DEFAULT '',
  content_html       text    NOT NULL DEFAULT '',
  cover_image        text,
  category_id        uuid    NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  author_name        text    NOT NULL DEFAULT 'Studio Team',
  author_role        text    NOT NULL DEFAULT 'Editor',
  author_image       text,
  tags               text[]  NOT NULL DEFAULT ARRAY[]::text[],
  status             text    NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN ('DRAFT','PUBLISHED')),
  featured           boolean NOT NULL DEFAULT false,
  read_time_override text,
  published_at       timestamptz,
  created_by         uuid    REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS news_posts_slug_key             ON news_posts (slug);
CREATE INDEX IF NOT EXISTS news_posts_status_published_idx ON news_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS news_posts_category_idx         ON news_posts (category_id);

-- Audience
CREATE TABLE IF NOT EXISTS players (
  id           uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email        citext  NOT NULL,
  display_name text,
  wishlist     uuid[]  NOT NULL DEFAULT ARRAY[]::uuid[],
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS players_email_key ON players (email);
CREATE INDEX IF NOT EXISTS players_created_idx ON players (created_at);

CREATE TABLE IF NOT EXISTS wishlists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id    uuid NOT NULL REFERENCES games(id)   ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, game_id)
);

CREATE TABLE IF NOT EXISTS subscribers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext  NOT NULL,
  name            text,
  interests       text[]  NOT NULL DEFAULT ARRAY[]::text[],
  status          text    NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE','UNSUBSCRIBED','BOUNCED')),
  source          text    DEFAULT 'website',
  subscribed_at   timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  metadata        jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_key ON subscribers (email);
CREATE INDEX IF NOT EXISTS subscribers_status_idx ON subscribers (status);

CREATE TABLE IF NOT EXISTS contact_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text    NOT NULL,
  email        citext  NOT NULL,
  company      text,
  subject      text    NOT NULL,
  project_type text    NOT NULL DEFAULT 'Player Support',
  budget       text,
  message      text    NOT NULL,
  status       text    NOT NULL DEFAULT 'UNREAD'
                 CHECK (status IN ('UNREAD','READ','REVIEWED','REPLIED','ARCHIVED')),
  handled_by   uuid    REFERENCES admin_users(id) ON DELETE SET NULL,
  handled_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_messages_status_idx  ON contact_messages (status);
CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON contact_messages (created_at);

-- Careers
CREATE TABLE IF NOT EXISTS jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text    NOT NULL,
  department       text    NOT NULL,
  location         text    NOT NULL,
  type             text    NOT NULL DEFAULT 'FULL_TIME'
                     CHECK (type IN ('FULL_TIME','CONTRACT','FREELANCE','REMOTE_HYBRID')),
  experience       text    NOT NULL,
  description      text    NOT NULL,
  responsibilities text[]  NOT NULL DEFAULT ARRAY[]::text[],
  requirements     text[]  NOT NULL DEFAULT ARRAY[]::text[],
  nice_to_have     text[]  NOT NULL DEFAULT ARRAY[]::text[],
  perks            text[]  NOT NULL DEFAULT ARRAY[]::text[],
  status           text    NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  posted_date      text    NOT NULL,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);

-- CMS
CREATE TABLE IF NOT EXISTS website_content (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        citext  NOT NULL,
  value      jsonb   NOT NULL,
  section    text    NOT NULL,
  updated_by uuid    REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS website_content_key_key     ON website_content (key);
CREATE INDEX IF NOT EXISTS website_content_section_idx ON website_content (section);

CREATE TABLE IF NOT EXISTS site_settings (
  key        citext PRIMARY KEY,
  value      jsonb   NOT NULL,
  updated_by uuid    REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Media library
CREATE TABLE IF NOT EXISTS media_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      text    NOT NULL,
  original_name text    NOT NULL,
  url           text    NOT NULL,
  mime_type     text    NOT NULL,
  size_bytes    integer NOT NULL,
  width         integer,
  height        integer,
  checksum      text    NOT NULL,
  alt_text      text,
  uploaded_by   uuid    REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_filename_key ON media_assets (filename);
CREATE INDEX IF NOT EXISTS media_assets_created_idx ON media_assets (created_at);

-- ---------- 3. NOW create functions that reference the tables --------------

-- RBAC helpers (must come after admin_users exists).
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid() AND is_active = true
      AND role IN ('SUPER_ADMIN','ADMIN','EDITOR')
  );
$$;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid() AND is_active = true AND role = 'SUPER_ADMIN'
  );
$$;

-- Auto-create a profile when a user signs up via Supabase Auth.
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
    display_name   = EXCLUDED.display_name,
    avatar_url     = EXCLUDED.avatar_url,
    email_verified = EXCLUDED.email_verified,
    updated_at     = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------- 4. Attach updated_at triggers ----------------------------------
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
--  5. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE admin_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity     ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE games              ENABLE ROW LEVEL SECURITY;
ALTER TABLE gameplay_mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE players            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_content    ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets       ENABLE ROW LEVEL SECURITY;

-- Admins/editors get full CRUD on every table.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_users','admin_activity','games','gameplay_mechanics','store_links',
    'categories','news_posts','players','wishlists','subscribers',
    'contact_messages','jobs','website_content','site_settings','media_assets'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I;
       CREATE POLICY %I ON %I FOR ALL TO authenticated
         USING (is_admin()) WITH CHECK (is_admin())',
      t || '_admin_all', t, t || '_admin_all', t
    );
  END LOOP;
END $$;

-- Profiles: owners can read/update their own row.
DROP POLICY IF EXISTS profiles_self_read  ON profiles;
CREATE POLICY profiles_self_read  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS profiles_self_write ON profiles;
CREATE POLICY profiles_self_write ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Public READ policies.
DROP POLICY IF EXISTS games_public_read         ON games;
CREATE POLICY games_public_read         ON games              FOR SELECT TO anon, authenticated USING (published = true);
DROP POLICY IF EXISTS mechanics_public_read     ON gameplay_mechanics;
CREATE POLICY mechanics_public_read     ON gameplay_mechanics FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.published));
DROP POLICY IF EXISTS store_links_public_read   ON store_links;
CREATE POLICY store_links_public_read   ON store_links        FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.published));
DROP POLICY IF EXISTS categories_public_read    ON categories;
CREATE POLICY categories_public_read    ON categories         FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS news_public_read          ON news_posts;
CREATE POLICY news_public_read          ON news_posts         FOR SELECT TO anon, authenticated USING (status = 'PUBLISHED');
DROP POLICY IF EXISTS jobs_public_read          ON jobs;
CREATE POLICY jobs_public_read          ON jobs               FOR SELECT TO anon, authenticated USING (status = 'OPEN');
DROP POLICY IF EXISTS content_public_read       ON website_content;
CREATE POLICY content_public_read       ON website_content    FOR SELECT TO anon, authenticated
  USING ((value->>'public')::boolean = true);
DROP POLICY IF EXISTS settings_public_read       ON site_settings;
CREATE POLICY settings_public_read       ON site_settings    FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS media_public_read         ON media_assets;
CREATE POLICY media_public_read         ON media_assets       FOR SELECT TO anon, authenticated USING (true);

-- Public INSERT policies (forms).
DROP POLICY IF EXISTS subscribers_anon_insert ON subscribers;
CREATE POLICY subscribers_anon_insert ON subscribers     FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'ACTIVE');
DROP POLICY IF EXISTS contacts_anon_insert    ON contact_messages;
CREATE POLICY contacts_anon_insert    ON contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'UNREAD' AND handled_by IS NULL);

-- Player-scope.
DROP POLICY IF EXISTS players_self     ON players;
CREATE POLICY players_self    ON players   FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS wishlists_self_all ON wishlists;
CREATE POLICY wishlists_self_all ON wishlists FOR ALL TO authenticated USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());

-- =============================================================================
--  6. STORAGE BUCKETS
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('games',   'games',   true, 10 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('news',    'news',    true, 10 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('avatars', 'avatars', true,  2 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('media',   'media',   true, 25 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS storage_public_read ON storage.objects;
CREATE POLICY storage_public_read ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('games','news','avatars','media'));

DROP POLICY IF EXISTS storage_admin_write ON storage.objects;
CREATE POLICY storage_admin_write ON storage.objects FOR ALL TO authenticated
  USING      (is_admin() AND bucket_id IN ('games','news','avatars','media'))
  WITH CHECK (is_admin() AND bucket_id IN ('games','news','avatars','media'));

DROP POLICY IF EXISTS storage_avatar_self_upload ON storage.objects;
CREATE POLICY storage_avatar_self_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS storage_avatar_self_delete ON storage.objects;
CREATE POLICY storage_avatar_self_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================================
--  7. UTILITY RPCs
-- =============================================================================
CREATE OR REPLACE FUNCTION increment_wishlist(game_uuid uuid, delta int DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE games SET wishlist_count = GREATEST(wishlist_count + delta, 0) WHERE id = game_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION increment_view(game_uuid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE games SET view_count = view_count + 1 WHERE id = game_uuid AND published;
END;
$$;

CREATE OR REPLACE FUNCTION unsubscribe(subscriber_uuid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE subscribers SET status = 'UNSUBSCRIBED', unsubscribed_at = now()
   WHERE id = subscriber_uuid AND status = 'ACTIVE';
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_wishlist(uuid,int) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_view(uuid)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION unsubscribe(uuid)          TO anon, authenticated;

-- =============================================================================
--  8. SEED CONTENT
-- =============================================================================
INSERT INTO categories (name, slug, color) VALUES
  ('Announcements', 'announcements', '#6C4CF1'),
  ('Dev Diary',     'dev-diary',     '#F59E0B'),
  ('Community',     'community',     '#10B981'),
  ('Releases',      'releases',      '#EF4444')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO site_settings (key, value) VALUES
  ('site_title',     '"Brainchild Games"'),
  ('site_tagline',   '"Indie studio crafting strange & wonderful worlds."'),
  ('social_twitter', '"https://twitter.com/brainchild"'),
  ('social_discord', '"https://discord.gg/brainchild"'),
  ('social_youtube', '"https://youtube.com/@brainchild"'),
  ('contact_email',  '"hello@brainchild.games"'),
  ('press_email',    '"press@brainchild.games"')
ON CONFLICT (key) DO NOTHING;

INSERT INTO website_content (key, section, value) VALUES
  ('home.hero.headline', 'home', jsonb_build_object(
     'public', true,
     'headline', 'Games that feel like daydreams you can play.',
     'subhead',  'Brainchild is a tiny indie studio building curious worlds, stubborn characters, and mechanics that stick in your head long after the credits.')),
  ('home.about.band', 'home', jsonb_build_object(
     'public', true,
     'title', 'A studio built for the long game.',
     'body',  'We are a remote team of designers, engineers and artists who believe the best games are made slowly, with obsession and care.'))
ON CONFLICT (key) DO NOTHING;

INSERT INTO jobs (title, department, location, type, experience, description,
                  responsibilities, requirements, nice_to_have, perks,
                  status, posted_date, sort_order) VALUES
  ('Senior Gameplay Engineer (Unreal)',
   'Engineering', 'Remote (UTC ± 4 hours)', 'REMOTE_HYBRID', '5+ years',
   'Join our small engineering team building our unannounced flagship title. You will own core character and combat systems end-to-end.',
   ARRAY['Design and implement gameplay systems in C++ and Blueprints',
         'Collaborate with design on prototyping, iteration and polish',
         'Profile and optimize for PC and console targets',
         'Mentor mid-level engineers and review code'],
   ARRAY['5+ years shipping gameplay in Unreal Engine',
         'Strong C++ and systems design skills',
         'Comfortable owning a feature from prototype to ship'],
   ARRAY['Experience with online/multiplayer systems',
         'Shipped at least one Steam title',
         'Interest in narrative or weird indie games'],
   ARRAY['Remote-first, async-friendly culture',
         'Four-day work weeks during production',
         'Health, dental, and a generous hardware budget',
         'Profit share on every title we ship'],
   'OPEN', to_char(current_date, 'YYYY-MM-DD'), 0)
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- CREATE YOUR FIRST STUDIO ADMIN (run after creating the user in Auth → Users)
-- This block is ready for the studio owner email below. Change only the
-- display name if you want a different label. Do not add a password here.
-- The password is set privately in Supabase Auth when you create the user.
-- ============================================================================
INSERT INTO admin_users (id, email, name, role, is_active)
SELECT id, lower(email), 'Studio Admin', 'SUPER_ADMIN', true
FROM auth.users
WHERE lower(email) = lower('abhaypoptani@gmail.com')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = 'SUPER_ADMIN',
  is_active = true,
  updated_at = now();

-- Verify the account is ready.
SELECT au.id, au.email, au.name, au.role, au.is_active
FROM admin_users au
JOIN auth.users u ON u.id = au.id
WHERE lower(u.email) = lower('abhaypoptani@gmail.com');
