import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

import { config, configReport } from './config/env.js';
import { logger } from './utils/logger.js';
import { UPLOAD_ROOT, ensureUploadRoot } from './services/storage.js';
import {
  adminLimiter,
  enforceOrigin,
  globalLimiter,
  permissionsPolicy,
  requestContext,
  requireHttps,
  securityHeaders,
  uploadHeaders,
} from './middleware/security.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { databaseHealth, closeDatabase } from './db/index.js';

import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import gamesRoutes from './routes/games.js';
import newsRoutes from './routes/news.js';
import categoryRoutes from './routes/categories.js';
import jobRoutes from './routes/jobs.js';
import mediaRoutes from './routes/media.js';
import playerRoutes from './routes/players.js';
import subscriberRoutes from './routes/subscribers.js';
import contactRoutes from './routes/contacts.js';
import teamRoutes from './routes/team.js';
import contentRoutes from './routes/content.js';
import activityRoutes from './routes/activity.js';
import backupRoutes from './routes/backup.js';

const app = express();

// Behind a load balancer/CDN the client IP arrives in X-Forwarded-For; without
// this the rate limiters would treat every visitor as one machine.
app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');
app.disable('etag');

app.use(requestContext);
// securityHeaders is a factory: it must be invoked to build the helmet middleware.
app.use(securityHeaders());
app.use(permissionsPolicy);
app.use(requireHttps);
app.use(enforceOrigin);

app.use(
  cors({
    origin: config.frontendOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
    maxAge: 600,
  })
);

// JSON bodies are capped well below the upload limit; images use multipart.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(cookieParser());
app.use(globalLimiter);

// Uploaded images are served read-only with a strict content policy. They are
// never executed, never listed, and cannot be requested by path traversal
// because the route only ever maps an exact filename inside the upload root.
app.use(
  '/uploads',
  uploadHeaders,
  express.static(UPLOAD_ROOT, {
    index: false,
    dotfiles: 'deny',
    maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
    },
  })
);

/** Liveness/readiness probe — deliberately shallow, no secrets in the payload. */
app.get('/health', async (_req: Request, res: Response) => {
  const database = await databaseHealth();
  res.status(database.ok ? 200 : 503).json({
    status: database.ok ? 'ok' : 'degraded',
    database: database.ok ? 'connected' : 'unavailable',
    environment: config.env,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

/* ------------------------------- API routes ------------------------------- */

app.use('/api/public', publicRoutes);
app.use('/api/auth', csrfProtection, authRoutes);

// Every admin surface sits behind auth + RBAC inside its router, and every
// mutating request has already passed the CSRF + origin checks above.
const admin = express.Router();
admin.use(adminLimiter);
admin.use(csrfProtection);
admin.use('/dashboard', dashboardRoutes);
admin.use('/games', gamesRoutes);
admin.use('/news', newsRoutes);
admin.use('/categories', categoryRoutes);
admin.use('/jobs', jobRoutes);
admin.use('/media', mediaRoutes);
admin.use('/players', playerRoutes);
admin.use('/subscribers', subscriberRoutes);
admin.use('/contacts', contactRoutes);
admin.use('/team', teamRoutes);
admin.use('/content', contentRoutes);
admin.use('/activity', activityRoutes);
admin.use('/backup', backupRoutes);
app.use('/api/admin', admin);

/* --------------------------- optional SPA hosting ------------------------- */

if (config.serveFrontend) {
  const distDir = path.resolve(process.cwd(), config.frontendDistDir);
  if (fs.existsSync(distDir)) {
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          const isHashed = /-[A-Za-z0-9_]{8,}\.(js|css)$/.test(filePath);
          res.setHeader('Cache-Control', isHashed ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
        },
      })
    );
    // SPA fallback: unknown paths return index.html so client routing works.
    app.get(/^\/(?!api|uploads|health).*/, (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
    logger.info('Serving built frontend', { distDir });
  } else {
    logger.warn('SERVE_FRONTEND is on but the build directory was not found', { distDir });
  }
}

app.use(notFoundHandler);

// Errors always go through one handler so responses stay consistent and no
// stack traces, SQL text or driver messages ever reach a client.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => errorHandler(err, req, res, next));

/* --------------------------------- startup -------------------------------- */

async function start(): Promise<void> {
  await ensureUploadRoot();

  const health = await databaseHealth();
  if (!health.ok) {
    logger.error('Database unreachable at startup', { error: health.error });
    // Keep booting: /health reports degraded and the API returns clean 5xx
    // responses instead of crashing the process during rolling deploys.
  }

  const server = app.listen(config.port, config.host, () => {
    logger.info('Brainchild Studio API listening', {
      url: `http://${config.host}:${config.port}`,
      ...Object.fromEntries(configReport().map((line) => line.split(/:(.*)/s).map((part) => part.trim()))),
    });
  });

  server.headersTimeout = 65_000;
  server.requestTimeout = 70_000;

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down`);
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
    // Safety net if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { message: error.message, stack: error.stack?.split('\n').slice(0, 4) });
    process.exit(1);
  });
}

/**
 * Only boot the HTTP server when this file is executed directly
 * (`tsx src/index.ts` / `node dist/index.js`). When the app is imported as a
 * module — e.g. by the Vercel serverless entry in `api/[...path].ts` — Vercel
 * owns the HTTP layer and `app.listen()` must never run.
 */
const isDirectRun =
  !process.env.VERCEL &&
  (() => {
    try {
      const entry = process.argv[1];
      return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
    } catch {
      return false;
    }
  })();

if (isDirectRun) {
  start().catch((error) => {
    logger.error('Failed to start API', { message: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}

export default app;
