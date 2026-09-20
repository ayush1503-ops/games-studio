import { config } from '../config/env.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Minimal structured logger.
 *
 * Never pass secrets/user objects into these helpers: only the metadata keys
 * listed in REDACT_KEYS are scrubbed and everything else is emitted as-is.
 */
const REDACT_KEYS = [
  'password', 'passwordhash', 'currentpassword', 'newpassword', 'token', 'accesstoken',
  'refreshtoken', 'authorization', 'cookie', 'secret', 'apikey', 'api_key', 'service_role',
];

export function redact<T>(value: T, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 25).map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.includes(key.toLowerCase())) {
      out[key] = '[redacted]';
    } else {
      out[key] = redact(val, depth + 1);
    }
  }
  return out;
}

function currentLevel(): number {
  const configured = config.logLevel as Level;
  return LEVELS[configured] ?? LEVELS.info;
}

function emit(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < currentLevel()) return;

  const line = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(meta ? { meta: redact(meta) } : {}),
  };

  const serialised = JSON.stringify(line);
  if (level === 'error') console.error(serialised);
  else if (level === 'warn') console.warn(serialised);
  else console.log(serialised);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
};
