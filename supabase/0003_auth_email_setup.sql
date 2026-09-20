-- =============================================================================
--  Supabase Auth: confirm the admin account + promote it to SUPER_ADMIN
-- -----------------------------------------------------------------------------
--  Run this in Supabase SQL Editor after apply_now.sql (0001 + 0002).
--
--  ⚠️ READ THIS FIRST
--  The admin console password lives in `admin_users.password_hash` (Express
--  API), NOT in Supabase. Supabase Auth only *delivers* the admin reset email:
--  `POST /api/auth/forgot-password` creates/reuses the auth user and asks
--  Supabase to send the recovery link; `POST /api/auth/reset-password` then
--  verifies that recovery session server-side and rotates the API password.
--  Changing the password in Supabase (dashboard → Users → Reset password) has
--  no effect on the console. To set an ADMIN console password directly use:
--      npm run admin:set-password --prefix server
--  See supabase/README.md → "Admin password reset" and PASSWORD_RESET_FIX.md.
--  If creating brainchildgamesin@gmail.com in Auth → Users fails with
--  "Database error creating new user", run migrations/0006 first.
--
--  What this file deliberately does NOT do:
--  There is no `auth.config` table. Site URL and the redirect allow-list are
--  platform settings, not rows in your database — `supabase/auth` ships no
--  `config` table in any of its migrations. Set them here instead:
--      Dashboard → Authentication → URL Configuration
--        Site URL        = https://YOUR-VERCEL-PROJECT.vercel.app
--        Redirect URLs   = https://YOUR-VERCEL-PROJECT.vercel.app/**
--                          http://localhost:3000/**
--                          http://127.0.0.1:3000/**
--  (or the equivalent `[auth]` block in supabase/config.toml for
--  config-as-code). An `INSERT INTO auth.config` fails with
--  `relation "auth.config" does not exist`.
--
--  Email delivery is a separate setting:
--      Dashboard → Project Settings → Auth → SMTP
--  Supabase's built-in email service works with no configuration. A custom SMTP
--  host with bad credentials is the most common cause of the 500
--  "Unable to process request" on POST /auth/v1/recover — see the
--  troubleshooting section of supabase/README.md.
-- =============================================================================

BEGIN;

-- 1. Auto-confirm the admin email so Supabase will issue recovery links for it
--    without waiting for a verification click.
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmation_token = NULL,
    confirmation_sent_at = NULL,
    recovery_token       = NULL,
    recovery_sent_at     = NULL
WHERE lower(email) = 'brainchildgamesin@gmail.com';

-- 2. Make sure a profile row exists for the admin account (covers the case
--    where the user was created in the dashboard before the trigger existed).
INSERT INTO profiles (id, display_name, email_verified)
SELECT id, 'Brainchild Games', true
FROM auth.users
WHERE lower(email) = 'brainchildgamesin@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  email_verified = true,
  updated_at     = now();

-- 3. Promote the account to SUPER_ADMIN in admin_users (primary studio owner).
INSERT INTO admin_users (id, name, role, is_active)
SELECT id, 'Brainchild Games', 'SUPER_ADMIN', true
FROM auth.users
WHERE lower(email) = 'brainchildgamesin@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role       = 'SUPER_ADMIN',
  is_active  = true,
  name       = 'Brainchild Games',
  updated_at = now();

COMMIT;

-- --- Sanity checks ----------------------------------------------------------
-- Zero rows here means the account was never created in THIS project.
SELECT id, email, email_confirmed_at, last_sign_in_at
FROM auth.users
WHERE lower(email) = 'brainchildgamesin@gmail.com';

-- Confirm the promotion.
SELECT id, name, role, is_active FROM admin_users
WHERE id IN (SELECT id FROM auth.users WHERE lower(email) = 'brainchildgamesin@gmail.com');

-- Duplicate rows are harmless for the recovery lookup (`findUser` uses .First()
-- and the query lower-cases the address), but this shows you what is there.
SELECT lower(email) AS email, count(*) AS rows
FROM auth.users
GROUP BY lower(email)
HAVING count(*) > 1;
