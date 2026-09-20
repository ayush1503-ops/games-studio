import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, types } from 'pg';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import * as schema from './schema.js';

/**
 * PostgreSQL connection pool + Drizzle query builder.
 *
 * Why this shape:
 *  - Every value in a query is sent as a bind parameter by Drizzle, so user
 *    input can never change the shape of a statement (no string concatenation,
 *    no SQL injection).
 *  - Traffic is capped (`max`, `statement_timeout`) so a runaway request cannot
 *    exhaust the database.
 */

// Return BIGINT as a number (safe for our row counts) instead of a string.
types.setTypeParser(20, (value) => Number.parseInt(value, 10));

const useSsl =
  /sslmode=require|sslmode=verify-full/.test(config.databaseUrl) || process.env.PGSSL === 'true';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: 'brainchild-studio-api',
  ...(useSsl ? { ssl: { rejectUnauthorized: process.env.PGSSL_STRICT === 'true' } } : {}),
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 15_000),
  query_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 15_000),
});

pool.on('error', (error) => {
  logger.error('Postgres pool error', { message: error.message });
});

export const db = drizzle(pool, {
  schema,
  logger: config.logLevel === 'debug' && process.env.LOG_SQL === 'true'
    ? { logQuery: (query, params) => logger.debug('sql', { query, params: Array.isArray(params) ? params.length : 0 }) }
    : false,
});

export async function databaseHealth(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const result = await pool.query<{ version: string }>('SELECT version() AS version');
    return { ok: true, version: result.rows[0]?.version.split(' on ')[0] };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export { schema };
export default db;
