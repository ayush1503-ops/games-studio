import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, code = 'bad_request', details?: unknown) =>
  new AppError(400, message, code, details);
export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, message, 'unauthenticated');
export const forbidden = (message = 'You do not have access to this action') =>
  new AppError(403, message, 'forbidden');
export const notFound = (message = 'Resource not found') => new AppError(404, message, 'not_found');
export const conflict = (message: string, code = 'conflict') => new AppError(409, message, code);
export const tooMany = (message = 'Too many requests') => new AppError(429, message, 'rate_limited');

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

/** Wraps async route handlers so rejections reach the error middleware. */
export function asyncHandler(fn: Handler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found', code: 'not_found' });
}

interface PgError {
  code?: string;
  constraint?: string;
  detail?: string;
  column?: string;
}

/** SQLSTATE codes are five characters (e.g. 23505, 42P01). */
const SQLSTATE = /^[0-9A-Z]{5}$/;

function isPgError(error: unknown): error is PgError {
  if (error instanceof AppError) return false;
  if (!(error instanceof Error)) return false;
  const code = (error as PgError).code;
  return typeof code === 'string' && SQLSTATE.test(code);
}

const CONSTRAINT_LABELS: Record<string, string> = {
  games_slug_key: 'That game URL (slug) is already in use.',
  news_posts_slug_key: 'That post URL (slug) is already in use.',
  admin_users_email_key: 'That email already has a studio account.',
  players_email_key: 'That email already has a player account.',
  subscribers_email_key: 'That email is already on the list.',
  categories_name_key: 'A category with that name already exists.',
  categories_slug_key: 'A category with that URL already exists.',
  media_assets_filename_key: 'A media file with that name already exists.',
  website_content_key_key: 'That content block already exists.',
};

/**
 * Single place that turns errors into *safe* client responses.
 * Stack traces, SQL statements and driver details never leave the server.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req as Request & { id?: string }).id;

  if (res.headersSent) {
    logger.error('Error after response started', { requestId, path: req.path });
    res.end();
    return;
  }

  // --- validation --------------------------------------------------------
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Please check the highlighted fields.',
      code: 'validation_error',
      details: err.errors.slice(0, 20).map((issue) => ({
        field: issue.path.join('.') || '(body)',
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Malformed JSON body.', code: 'invalid_json' });
    return;
  }

  // --- application errors ------------------------------------------------
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error(err.message, { requestId, path: req.path });
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // --- framework/http errors (body too large, unsupported media type…) ----
  const httpish = err as { status?: number; statusCode?: number; type?: string };
  const httpStatus = httpish.status ?? httpish.statusCode;
  if (typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 500) {
    const tooLarge = httpStatus === 413 || httpish.type === 'entity.too.large';
    res.status(httpStatus).json({
      error: tooLarge ? 'That request body is too large.' : 'The request could not be processed.',
      code: tooLarge ? 'payload_too_large' : 'bad_request',
    });
    return;
  }

  // --- database ----------------------------------------------------------
  if (isPgError(err)) {
    const constraint = err.constraint ?? '';
    logger.warn('Database error', { requestId, code: err.code, constraint, path: req.path });

    if (err.code === '23505' || /_key$/.test(constraint)) {
      res.status(409).json({
        error: CONSTRAINT_LABELS[constraint] ?? 'That value is already taken.',
        code: 'duplicate',
      });
      return;
    }
    if (err.code === '23503') {
      res.status(409).json({
        error: 'This item is still referenced elsewhere and cannot be changed.',
        code: 'relation_conflict',
      });
      return;
    }
    if (err.code === '23514' || err.code === '22P02' || err.code === '22001') {
      res.status(400).json({ error: 'One of the supplied values is not allowed.', code: 'invalid_value' });
      return;
    }
    if (err.code === '57014') {
      res.status(503).json({ error: 'The request took too long. Please try again.', code: 'timeout' });
      return;
    }
    res.status(500).json({ error: 'A database error occurred.', code: 'database_error' });
    return;
  }

  // --- uploads -----------------------------------------------------------
  if (err instanceof Error && err.name === 'MulterError') {
    const message =
      (err as Error & { code?: string }).code === 'LIMIT_FILE_SIZE'
        ? 'That image is larger than the upload limit.'
        : 'That upload was rejected.';
    res.status(400).json({ error: message, code: 'upload_error' });
    return;
  }

  // --- unknown -----------------------------------------------------------
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Unhandled error', {
    requestId,
    path: req.path,
    method: req.method,
    name: error.name,
    message: error.message,
    stack: error.stack?.split('\n').slice(0, 5),
  });

  res.status(500).json({
    error: 'Something went wrong on our side. The team has been notified.',
    code: 'internal_error',
    requestId,
  });
}
