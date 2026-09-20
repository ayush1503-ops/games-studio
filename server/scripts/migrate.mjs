#!/usr/bin/env node
/**
 * Minimal, dependency-light migration runner.
 *
 *   npm run db:migrate          # apply pending migrations
 *   npm run db:migrate -- --list # show status only
 *
 * Migrations are plain .sql files in db/migrations, applied in filename order,
 * each inside a transaction, and recorded in `schema_migrations` so re-runs are
 * safe and idempotent. This keeps schema changes reviewable in code review and
 * works in any environment (local, container, Supabase, RDS).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../db/migrations');
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://brainchild:brainchild@127.0.0.1:55432/brainchild_games?schema=public';

const listOnly = process.argv.includes('--list');

const client = new pg.Client({
  connectionString: DATABASE_URL,
  application_name: 'brainchild-migrate',
  ...(/sslmode=require/.test(DATABASE_URL) ? { ssl: { rejectUnauthorized: false } } : {}),
});

async function main() {
  console.log(`\n  Migrations from ${MIGRATIONS_DIR}`);
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await client.query('SELECT filename FROM schema_migrations')).rows.map((row) => row.filename)
  );

  const files = (await fs.readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();

  let pending = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  ✓ ${file} (already applied)`);
      continue;
    }
    pending += 1;
    if (listOnly) {
      console.log(`  • ${file} (pending)`);
      continue;
    }

    const sqlText = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`  → applying ${file} … `);
    try {
      await client.query('BEGIN');
      await client.query(sqlText);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log('done');
    } catch (error) {
      await client.query('ROLLBACK');
      console.log('failed');
      throw error;
    }
  }

  console.log(
    listOnly
      ? `\n  ${pending} migration(s) pending.\n`
      : `\n  ${pending === 0 ? 'Schema already up to date.' : `Applied ${pending} migration(s).`}\n`
  );
}

main()
  .catch((error) => {
    // pg surfaces socket failures (e.g. ECONNREFUSED when the dev DB is not
    // running) with an empty `message`, which used to print as
    // "Migration failed: " — a dead end. Fall back to the error code/cause
    // and point at the fix.
    const detail =
      error?.message ||
      error?.code ||
      error?.cause?.message ||
      (error instanceof Error ? error.constructor.name : String(error));
    console.error(`\n  Migration failed: ${detail}\n`);
    if (error?.code === 'ECONNREFUSED' || /ECONNREFUSED/.test(String(error?.stack ?? ''))) {
      console.error(
        '  Could not reach the database. For the embedded dev DB run: npm run db:up --prefix server\n',
      );
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
