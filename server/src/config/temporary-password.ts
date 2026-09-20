/**
 * TEMPORARY studio password.
 *
 * The primary studio admin (`brainchildgamesin@gmail.com`) is seeded with this
 * password so the console can always be opened on a temporary basis — local
 * development, a fresh database, or a locked-out production deploy. It is a
 * deliberate, documented fallback, never a hidden backdoor:
 *
 *  - `seed.ts` and `reset-brainchild-password.ts` use it as their default when
 *    neither `ADMIN_PASSWORD` nor `BRAINCHILD_ADMIN_PASSWORD` is set.
 *  - `db/migrations/0003_temporary_admin_password.sql` applies the same hash to
 *    an existing database (already-migrated installs included).
 *  - A signed-in console that is still using it gets `temporaryPasswordInUse`
 *    (see `routes/auth.ts`) and shows a "change this now" banner, so the
 *    temporary password is visible to whoever keeps using it.
 *
 * Overrides:
 *  - `TEMPORARY_ADMIN_PASSWORD` — use a different temporary value for this
 *    process (scripts, seed, migration instructions, API flag).
 *  - `TEMPORARY_PASSWORD_DISABLED=true` — stop the API from flagging it (used
 *    when a team has rotated away and no longer wants the hint surface).
 *
 * Changing your password in Settings → Change Your Password clears the flag
 * immediately: the API compares the stored hash, not a "has changed" boolean.
 */

/** The value baked into the seed, the reset script and migration 0003. */
export const DEFAULT_TEMPORARY_PASSWORD = 'Brainchild@2026';

/**
 * Read lazily (never at import time) so `dotenv` and per-command env vars such
 * as `TEMPORARY_ADMIN_PASSWORD=… npm run seed` are always honoured.
 */
export function temporaryAdminPassword(): string {
  const provided = process.env.TEMPORARY_ADMIN_PASSWORD?.trim();
  return provided && provided.length > 0 ? provided : DEFAULT_TEMPORARY_PASSWORD;
}

/** `true` when the API should report that the temporary password is in use. */
export function temporaryPasswordTrackingEnabled(): boolean {
  return process.env.TEMPORARY_PASSWORD_DISABLED?.trim().toLowerCase() !== 'true';
}
