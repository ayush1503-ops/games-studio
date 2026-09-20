/**
 * Vercel serverless entry point for the Brainchild Studio API.
 *
 * Every request under `/api/*` is handled by the existing Express app
 * (compiled to `server/dist` during the build). Vercel invokes this handler
 * with a raw Node.js (IncomingMessage, ServerResponse) pair, which is exactly
 * what Express expects — so the API code runs unchanged, with no per-route
 * rewrites.
 *
 * Why this works on a serverless platform:
 *  - The Postgres pool lives at module scope and is reused across warm
 *    invocations; idle connections are released automatically.
 *  - `start()` (which calls `app.listen`) is guarded in `server/src/index.ts`
 *    and never runs on Vercel.
 *  - Media uploads go to Supabase Storage when `STORAGE_DRIVER=supabase`, so
 *    nothing depends on the ephemeral function filesystem.
 *  - Cookies are same-origin (site + API share the Vercel domain), so the
 *    JWT/CSRF cookie flow works exactly like in development.
 *
 * Dependency layout: every runtime dependency of the API (express, pg,
 * drizzle-orm, …) lives in the repository root `node_modules` (see the root
 * `package.json`). Vercel's function builder traces `server/dist` from this
 * file and resolves bare imports from the root `node_modules`, so the
 * function stays self-contained with no `includeFiles` needed.
 *
 * Note: the handler is typed with plain Node `http` types instead of
 * `@vercel/node` so this file has no dependencies outside the compiled server
 * bundle, and `api/tsconfig.json` keeps its type-check program separate from
 * the frontend tsconfig (which targets the browser, not Node).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import app from '../server/dist/index.js';
import { closeDatabase, databaseHealth } from '../server/dist/db/index.js';

function requestPath(req: IncomingMessage): string {
  const rawUrl = req.url ?? '/';
  try {
    return new URL(rawUrl, 'http://vercel.internal').pathname;
  } catch {
    // IncomingMessage.url is normally an origin-form path, but keeping a
    // conservative fallback makes the health check safe for unusual runtimes.
    return rawUrl.split('?')[0] || '/';
  }
}

/** Report a shallow health status on GET /api/health (used by uptime monitors). */
function handleHealth(_req: IncomingMessage, res: ServerResponse): void {
  void (async () => {
    let body: string;
    let status = 200;
    try {
      const health = await databaseHealth();
      status = health.ok ? 200 : 503;
      body = JSON.stringify({
        status: health.ok ? 'ok' : 'degraded',
        database: health.ok ? 'connected' : 'unavailable',
        environment: 'vercel',
        uptimeSeconds: Math.round(process.uptime()),
      });
    } catch {
      status = 500;
      body = JSON.stringify({ status: 'error' });
    }
    // The Vercel runtime hands us a raw Node response — write it as such.
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(body);
  })();
}

let shuttingDown = false;

/** Release Postgres connections when Vercel recycles the function instance. */
process.on('SIGTERM', () => {
  if (shuttingDown) return;
  shuttingDown = true;
  void closeDatabase()
    .catch(() => undefined)
    .finally(() => process.exit(0));
});

/**
 * Vercel's Node runtime invokes the default export with raw Node streams
 * (IncomingMessage, ServerResponse) — exactly what `app(req, res)` expects.
 */
const handler = (req: IncomingMessage, res: ServerResponse): void => {
  // The Vercel runtime hands us raw Node streams; Express reads them directly.
  // Catch both forms because Vercel normally keeps the /api prefix in
  // IncomingMessage.url, while some adapters or environments strip it before
  // invoking the catch-all function.
  const path = requestPath(req);
  if (req.method === 'GET' && (path === '/health' || path === '/api/health')) {
    handleHealth(req, res);
    return;
  }

  // Ensure req.url has the /api prefix that Express routes expect
  if (req.url && !req.url.startsWith('/api') && req.url !== '/health') {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  app(req, res);
};

export default handler;
