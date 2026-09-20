#!/usr/bin/env node
/**
 * Deploy-time migration step (run by the Vercel build).
 *
 * Why: migrations are how the primary studio admin gets its temporary password
 * (`0003_temporary_admin_password.sql`), and a deployment that skips them can
 * leave a database where no documented password works. Running them during the
 * build means "deploy" and "schema up to date" are the same action, instead of
 * depending on someone remembering a manual command.
 *
 * Failure is never fatal — a build must not break because the database was
 * briefly unreachable or `DATABASE_URL` is not exposed to the build
 * environment. Anything skipped here can be applied later with:
 *
 *   DATABASE_URL="postgresql://…" npm run db:migrate --prefix server
 *
 * Disable with SKIP_DB_MIGRATE_ON_BUILD=true.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const die = (message) => {
  console.warn(`[migrate] ${message}`);
  console.warn('[migrate] The build continues — apply them later with: DATABASE_URL="postgresql://…" npm run db:migrate --prefix server');
  process.exit(0);
};

if (process.env.SKIP_DB_MIGRATE_ON_BUILD?.trim().toLowerCase() === 'true') {
  console.log('[migrate] Skipped (SKIP_DB_MIGRATE_ON_BUILD=true).');
  process.exit(0);
}

if (!process.env.DATABASE_URL?.trim()) {
  console.log('[migrate] DATABASE_URL is not set for this build — skipping migrations.');
  process.exit(0);
}

console.log('[migrate] Applying pending migrations…');
const result = spawnSync(process.execPath, [path.join(here, 'migrate.mjs')], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) die(`Could not start the migration runner: ${result.error.message}`);
if (result.status !== 0) die('Migrations did not complete.');
