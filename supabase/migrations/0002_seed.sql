-- =============================================================================
-- Brainchild Games — seed content
-- =============================================================================
-- Run AFTER 0001_init_schema.sql. Inserts starter categories, content blocks,
-- and an example job so the public site has something to show immediately.
--
-- The first SUPER_ADMIN user is created through the Supabase dashboard
-- (Authentication → Add user) — after inviting/inserting them, run:
--
--   INSERT INTO admin_users (id, name, role, is_active)
--   VALUES ((SELECT id FROM auth.users WHERE email = 'brainchildgamesin@gmail.com'),
--           'Brainchild Games', 'SUPER_ADMIN', true);
--
-- Primary admin brainchildgamesin@gmail.com is always valid SUPER_ADMIN.
-- =============================================================================

-- Default categories ---------------------------------------------------------
INSERT INTO categories (name, slug, color) VALUES
  ('Announcements', 'announcements', '#6C4CF1'),
  ('Dev Diary',     'dev-diary',     '#F59E0B'),
  ('Community',     'community',     '#10B981'),
  ('Releases',      'releases',      '#EF4444')
ON CONFLICT (slug) DO NOTHING;

-- Site settings defaults -----------------------------------------------------
INSERT INTO site_settings (key, value) VALUES
  ('site_title',       '"Brainchild Games"'),
  ('site_tagline',     '"Indie studio crafting strange & wonderful worlds."'),
  ('social_twitter',   '"https://twitter.com/brainchild"'),
  ('social_discord',   '"https://discord.gg/brainchild"'),
  ('social_youtube',   '"https://youtube.com/@brainchild"'),
  ('contact_email',    '"hello@brainchild.games"'),
  ('press_email',      '"press@brainchild.games"')
ON CONFLICT (key) DO NOTHING;

-- Example public website content blocks --------------------------------------
INSERT INTO website_content (key, section, value) VALUES
  ('home.hero.headline', 'home', jsonb_build_object(
     'public', true,
     'headline', 'Games that feel like daydreams you can play.',
     'subhead',  'Brainchild is a tiny indie studio building curious worlds, stubborn characters, and mechanics that stick in your head long after the credits.'
   )),
  ('home.about.band', 'home', jsonb_build_object(
     'public', true,
     'title', 'A studio built for the long game.',
     'body',  'We are a remote team of designers, engineers and artists who believe the best games are made slowly, with obsession and care.'
   ))
ON CONFLICT (key) DO NOTHING;

-- An example open job posting (visible on /careers until you close it).
INSERT INTO jobs (title, department, location, type, experience, description,
                  responsibilities, requirements, nice_to_have, perks,
                  status, posted_date, sort_order) VALUES
  (
    'Senior Gameplay Engineer (Unreal)',
    'Engineering',
    'Remote (UTC ± 4 hours)',
    'REMOTE_HYBRID',
    '5+ years',
    'Join our small engineering team building our unannounced flagship title. You will own core character and combat systems end-to-end.',
    ARRAY[
      'Design and implement gameplay systems in C++ and Blueprints',
      'Collaborate with design on prototyping, iteration and polish',
      'Profile and optimize for PC and console targets',
      'Mentor mid-level engineers and review code'
    ],
    ARRAY[
      '5+ years shipping gameplay in Unreal Engine',
      'Strong C++ and systems design skills',
      'Comfortable owning a feature from prototype to ship'
    ],
    ARRAY[
      'Experience with online/multiplayer systems',
      'Shipped at least one Steam title',
      'Interest in narrative or weird indie games'
    ],
    ARRAY[
      'Remote-first, async-friendly culture',
      'Four-day work weeks during production',
      'Health, dental, and a generous hardware budget',
      'Profit share on every title we ship'
    ],
    'OPEN',
    to_char(current_date, 'YYYY-MM-DD'),
    0
  )
ON CONFLICT DO NOTHING;
