#!/usr/bin/env node
/**
 * Local development database.
 *
 * Starts a real PostgreSQL server (bundled binaries via `embedded-postgres`) so
 * the project runs with production parity — no SQLite-only shortcuts — without
 * requiring a system Postgres install.
 *
 *   npm run db:up      # start, create the database if needed, keep running
 *   npm run db:down    # stop the server
 *   npm run db:status  # print connection details
 *
 * Connection matches server/.env.example:
 *   postgresql://brainchild:brainchild@127.0.0.1:55432/brainchild_games
 */
import EmbeddedPostgres from 'embedded-postgres';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// Kept outside the repository: a Postgres data directory must never be committed.
const DATA_DIR = process.env.PG_DATA_DIR || path.join(os.tmpdir(), 'brainchild-pgdata');
const PORT = Number(process.env.PG_PORT || 55432);
const USER = process.env.PG_USER || 'brainchild';
const PASSWORD = process.env.PG_PASSWORD || 'brainchild';
const DATABASE = process.env.PG_DATABASE || 'brainchild_games';

const command = process.argv[2] || 'start';

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: command === 'start',
});

function banner(action) {
  const url = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}`;
  console.log(`\n  Brainchild dev database — ${action}`);
  console.log(`  DATABASE_URL="${url}"`);
  console.log(`  data: ${DATA_DIR}\n`);
}

try {
  if (command === 'start') {
    const alreadyInitialised = fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));

    if (!alreadyInitialised) {
      console.log('  Initialising a new PostgreSQL cluster…');
      await pg.initialise();
    }
    await pg.start();

    try {
      await pg.createDatabase(DATABASE);
      console.log(`  Created database "${DATABASE}".`);
    } catch (error) {
      const message = String(error?.message ?? error);
      if (!/already exists/i.test(message)) throw error;
    }

    banner('running (Ctrl+C to stop)');
    console.log('  Next: npm run db:setup   # push schema + seed content\n');

    const stop = async () => {
      console.log('\n  Stopping PostgreSQL…');
      await pg.stop().catch(() => {});
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } else if (command === 'stop') {
    await pg.stop().catch((error) => {
      console.log(`  Nothing to stop (${String(error?.message ?? error)}).`);
    });
    banner('stopped');
  } else if (command === 'status') {
    banner(fs.existsSync(path.join(DATA_DIR, 'PG_VERSION')) ? 'initialised' : 'not initialised yet');
  } else {
    console.error(`Unknown command "${command}". Use start | stop | status.`);
    process.exit(1);
  }
} catch (error) {
  console.error('\n  Failed to start the dev database:', error?.message ?? error);
  console.error(`  Try: rm -rf ${DATA_DIR} && npm run db:up\n`);
  process.exit(1);
}
