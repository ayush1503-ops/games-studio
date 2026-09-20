import { AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { adminActivity } from '../db/schema.js';
import { logger } from '../utils/logger.js';

export interface ActivityInput {
  adminUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Writes an audit record. Audit logging must never break the request itself,
 * so failures are logged and swallowed.
 */
export async function recordActivity(input: ActivityInput): Promise<void> {
  try {
    await db.insert(adminActivity).values({
      adminUserId: input.adminUserId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary ?? null,
      metadata: (input.metadata as object) ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent?.slice(0, 400) ?? null,
      requestId: input.requestId ?? null,
    });
  } catch (error) {
    logger.error('Failed to write audit record', {
      action: input.action,
      entityType: input.entityType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Convenience wrapper used inside routes. */
export function audit(req: AuthRequest) {
  return (
    action: string,
    entityType: string,
    options: {
      entityId?: string | null;
      summary?: string;
      metadata?: Record<string, unknown>;
      actorEmail?: string | null;
      adminUserId?: string | null;
    } = {}
  ) => {
    void recordActivity({
      adminUserId: options.adminUserId ?? req.admin?.id ?? null,
      actorEmail: options.actorEmail ?? req.admin?.email ?? null,
      action,
      entityType,
      entityId: options.entityId,
      summary: options.summary,
      metadata: options.metadata,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: (req as AuthRequest & { id?: string }).id,
    });
  };
}
