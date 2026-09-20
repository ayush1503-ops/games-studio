-- =============================================================================
-- 0005_add_brainchild_admin.sql
-- Ensures brainchildgamesin@gmail.com is always a valid SUPER_ADMIN
-- =============================================================================
-- This migration promotes the primary studio account to SUPER_ADMIN if it
-- exists in auth.users, and creates helper logic for future signups.

-- 1. Auto-confirm the primary admin email if it exists
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmation_token = NULL,
    confirmation_sent_at = NULL
WHERE email = 'brainchildgamesin@gmail.com'
  AND email_confirmed_at IS NULL;

-- 2. Ensure profile exists for primary admin
INSERT INTO profiles (id, display_name, email_verified)
SELECT id, 'Brainchild Games', true
FROM auth.users
WHERE email = 'brainchildgamesin@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  display_name = 'Brainchild Games',
  email_verified = true,
  updated_at = now();

-- 3. Ensure admin_users entry exists and is SUPER_ADMIN + active
INSERT INTO admin_users (id, name, role, is_active)
SELECT id, 'Brainchild Games', 'SUPER_ADMIN', true
FROM auth.users WHERE email = 'brainchildgamesin@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'SUPER_ADMIN',
  is_active = true,
  name = 'Brainchild Games',
  updated_at = now();

-- 4. Create or replace a trigger that auto-promotes brainchildgamesin@gmail.com
--    on any future INSERT into auth.users (e.g. if user signs up again).
--    Hardened in 0006: AFTER INSERT (profiles/admin_users reference
--    auth.users(id), so the row must exist first) and exception-guarded so a
--    public-schema problem can never block creating the auth user. If your
--    project already ran the original BEFORE INSERT version, run 0006.
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

      -- Auto-confirm so login works without email verification
      UPDATE auth.users
      SET email_confirmed_at   = COALESCE(email_confirmed_at, now()),
          confirmation_token   = NULL,
          confirmation_sent_at = NULL
      WHERE id = NEW.id
        AND email_confirmed_at IS NULL;
    EXCEPTION WHEN OTHERS THEN
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

-- 5. Verification query (will show row if admin exists, empty if not yet created)
-- SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'brainchildgamesin@gmail.com';
-- SELECT id, name, role, is_active FROM admin_users WHERE id IN (SELECT id FROM auth.users WHERE email = 'brainchildgamesin@gmail.com');
