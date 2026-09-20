-- 0002_add_brainchild_admin.sql
-- Ensures brainchildgamesin@gmail.com exists as SUPER_ADMIN in the Express/Drizzle admin system.
-- The password hash here is for the dev default password "BrainchildStudio2026" (bcrypt 12 rounds).
-- In production, the seed script overwrites this with ADMIN_PASSWORD, so this hash is only a fallback.
-- If the account already exists, this migration only ensures role = SUPER_ADMIN and is_active = true.

-- On databases migrated after 2026-09, 0003_temporary_admin_password.sql
-- replaces the hash below with the current shared temporary password
-- ("Brainchild@2026"). Fresh installs run both in filename order, so the value
-- from 0003 is the one that ends up in effect; this row is kept as-is so the
-- migration history stays an accurate record of what each step did.

-- Insert primary admin if missing (idempotent)
INSERT INTO admin_users (email, name, role, is_active, password_hash, password_changed_at)
SELECT
  'brainchildgamesin@gmail.com',
  'Brainchild Games',
  'SUPER_ADMIN',
  true,
  -- bcrypt hash for SHA256('BrainchildStudio2026') (12 rounds) - matches server/src/utils/crypto.ts hashPassword()
  -- This is a fallback; `npm run seed` will set the real password from env if ADMIN_PASSWORD is provided.
  '$2a$12$cOPqAXIt8PBr6rGqI1SKm.FKbMlxklRZQ/pQyUk96PmOkToXDJGle',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM admin_users WHERE lower(email) = 'brainchildgamesin@gmail.com'
);

-- Ensure role is SUPER_ADMIN and active even if it already existed
UPDATE admin_users
SET role = 'SUPER_ADMIN',
    is_active = true,
    name = COALESCE(name, 'Brainchild Games'),
    updated_at = now()
WHERE lower(email) = 'brainchildgamesin@gmail.com';

-- Add comment for documentation
COMMENT ON TABLE admin_users IS 'Studio team - primary admin brainchildgamesin@gmail.com always valid SUPER_ADMIN';
