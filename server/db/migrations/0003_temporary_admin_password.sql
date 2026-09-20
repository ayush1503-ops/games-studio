-- 0003_temporary_admin_password.sql
-- ---------------------------------------------------------------------------
-- TEMPORARY password for the primary studio admin.
--
-- Sets brainchildgamesin@gmail.com (SUPER_ADMIN) to the shared temporary
-- password "Brainchild@2026" on whatever database this migration runs against:
-- local dev, preview, or the deployed production database.
--
--   Email:    brainchildgamesin@gmail.com
--   Password: Brainchild@2026
--
-- The hash below is bcrypt(12) of SHA256('Brainchild@2026') — the exact scheme
-- used by server/src/utils/crypto.ts hashPassword(), so it verifies through the
-- normal login route. Keep it in sync with
-- server/src/config/temporary-password.ts (DEFAULT_TEMPORARY_PASSWORD).
--
-- Why a migration instead of only the seed script:
--   * `npm run db:migrate` runs on every deploy, so the primary admin can
--     always be opened on a temporary basis without touching the dashboard.
--   * Installations that ran 0002 before this file existed only get the new
--     hash through a migration (0002 is recorded as already applied).
--
-- TEMPORARY means exactly that: sign in, then go to Settings → Change Your
-- Password (or run `npm run admin:set-password --prefix server` with
-- BRAINCHILD_ADMIN_PASSWORD) and set a private password. While this value is
-- still in use the console shows a warning banner, and the API reports
-- `temporaryPasswordInUse: true`.
--
-- Safe to re-run by hand: every statement is idempotent. It is *not* re-applied
-- automatically once this file is recorded in schema_migrations, so a password
-- you rotate afterwards is never silently overwritten by a later deploy.
-- ---------------------------------------------------------------------------

-- 1. Create the account if this database never ran 0002.
INSERT INTO admin_users (email, name, role, is_active, password_hash, password_changed_at)
SELECT
  'brainchildgamesin@gmail.com',
  'Brainchild Games',
  'SUPER_ADMIN',
  true,
  -- bcrypt(12) of SHA256('Brainchild@2026')
  '$2a$12$yRNCygEoX7MAqPpW8xjg8uDB5bxf1lqY7EhNZqS8u79bmI0PqBc7O',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM admin_users WHERE lower(email) = 'brainchildgamesin@gmail.com'
);

-- 2. Apply the temporary password, clear any lockout, and (re)activate the
--    account so a temporary login is always possible.
UPDATE admin_users
SET password_hash       = '$2a$12$yRNCygEoX7MAqPpW8xjg8uDB5bxf1lqY7EhNZqS8u79bmI0PqBc7O',
    password_changed_at = now(),
    failed_login_count  = 0,
    locked_until        = NULL,
    is_active           = true,
    role                = 'SUPER_ADMIN',
    name                = COALESCE(name, 'Brainchild Games'),
    updated_at          = now()
WHERE lower(email) = 'brainchildgamesin@gmail.com';

-- 3. Sessions created with the previous password can no longer be trusted.
UPDATE admin_sessions
SET revoked_at = now(),
    revoked_reason = 'temporary_password_rotation'
WHERE admin_user_id IN (
        SELECT id FROM admin_users WHERE lower(email) = 'brainchildgamesin@gmail.com'
      )
  AND revoked_at IS NULL;

-- 4. Leave an audit trail that the studio password was reset to a temporary
--    value, so it shows up in the console's Activity log.
INSERT INTO admin_activity (admin_user_id, actor_email, action, entity_type, summary, metadata)
SELECT
  id,
  email,
  'PASSWORD_RESET_COMPLETED',
  'auth',
  'Temporary admin password installed by migration 0003 (Brainchild@2026)',
  '{"channel":"migration","migration":"0003_temporary_admin_password.sql","temporary":true}'::jsonb
FROM admin_users
WHERE lower(email) = 'brainchildgamesin@gmail.com';
