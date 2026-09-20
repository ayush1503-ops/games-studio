-- =============================================================================
-- 0006_harden_primary_admin_trigger.sql
-- Makes creating brainchildgamesin@gmail.com in Supabase Auth impossible to break
-- =============================================================================
-- WHY
--   0005 (and the copy in apply_now.sql) installed `trg_auto_promote_primary_admin`
--   as a BEFORE INSERT trigger on auth.users. Inside a BEFORE trigger the new
--   auth.users row does not exist yet, so its INSERTs into `profiles` and
--   `admin_users` — both `id REFERENCES auth.users(id)` — fail with
--     insert or update on table "profiles" violates foreign key constraint
--   and the whole INSERT is rolled back. Supabase Auth reports that as
--   "Database error creating new user" / "unexpected_failure": the primary admin
--   could not be created from the dashboard, from sign-up, or by the API's
--   password-reset flow (which creates the auth user on first use), while every
--   other address worked. Reproduced against a local Postgres before this fix.
--
-- WHAT
--   1. Same promotion logic, but as an AFTER INSERT trigger (the row exists, the
--      FKs are satisfied — the same pattern 0001's handle_new_user() uses).
--   2. The body is wrapped in an exception handler: whatever happens in the
--      public schema (e.g. an admin_users table with a different shape because
--      the API's Drizzle schema was pushed to the same database) is logged as a
--      WARNING and never aborts auth user creation.
--   3. Auto-confirm is done with an UPDATE instead of mutating NEW (which only
--      works in BEFORE triggers). The API creates the user with
--      email_confirm = true anyway; this only matters for a manual sign-up.
--
-- Safe to run repeatedly. Run in Supabase Dashboard → SQL Editor.
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_promote_primary_admin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'brainchildgamesin@gmail.com' THEN
    BEGIN
      INSERT INTO profiles (id, display_name, email_verified)
      VALUES (NEW.id, 'Brainchild Games', true)
      ON CONFLICT (id) DO UPDATE SET
        display_name   = 'Brainchild Games',
        email_verified = true,
        updated_at     = now();

      INSERT INTO admin_users (id, name, role, is_active)
      VALUES (NEW.id, 'Brainchild Games', 'SUPER_ADMIN', true)
      ON CONFLICT (id) DO UPDATE SET
        role       = 'SUPER_ADMIN',
        is_active  = true,
        name       = 'Brainchild Games',
        updated_at = now();

      UPDATE auth.users
      SET email_confirmed_at   = COALESCE(email_confirmed_at, now()),
          confirmation_token   = NULL,
          confirmation_sent_at = NULL
      WHERE id = NEW.id
        AND email_confirmed_at IS NULL;
    EXCEPTION WHEN OTHERS THEN
      -- Never block auth user creation because of a public-schema problem.
      RAISE WARNING 'auto_promote_primary_admin skipped for %: % (%)', NEW.id, SQLERRM, SQLSTATE;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_promote_primary_admin ON auth.users;
CREATE TRIGGER trg_auto_promote_primary_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION auto_promote_primary_admin();

-- Sanity check: should show the trigger with tgtype AFTER (no BEFORE bit set).
-- SELECT tgname, tgenabled, (tgtype & 2) = 2 AS is_before
-- FROM pg_trigger WHERE tgname = 'trg_auto_promote_primary_admin';
