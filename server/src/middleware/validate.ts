import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny, z } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * Request validation.
 *
 * Parsed (and therefore whitelisted) values replace the raw input, which makes
 * mass-assignment impossible downstream: anything not declared in the schema is
 * stripped or rejected by `.strict()`.
 */
export function validate(schema: ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === 'query') {
        // Express 5 exposes a getter-only `query`; assigning via defineProperty
        // keeps compatibility with both Express 4 and 5.
        Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
      } else {
        (req as unknown as Record<string, unknown>)[source] = parsed;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

// --- shared primitives ------------------------------------------------------

export const idSchema = z
  .string()
  .min(5)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid identifier');

export const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes only');

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(190);

export const shortText = (max = 200) => z.string().trim().min(1).max(max);
export const optionalText = (max = 200) => z.string().trim().max(max).optional();

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    sortBy: z.string().trim().max(40).optional(),
    sortOrder: sortOrderSchema,
  })
  .strict();

export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/** Whitelisted sort helper: unknown columns silently fall back to a default. */
export function resolveSort<T extends Record<string, unknown>>(
  sortBy: string | undefined,
  allowed: readonly (keyof T & string)[],
  order: 'asc' | 'desc',
  fallback: keyof T & string
): Record<string, 'asc' | 'desc'> {
  const column = sortBy && allowed.includes(sortBy as keyof T & string) ? sortBy : fallback;
  return { [column as string]: order };
}
