import { Router, Response } from 'express';
import { asc, count, desc, eq, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { jobs } from '../db/schema.js';
import { AppError, asyncHandler } from '../middleware/errors.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { idSchema, paginated, paginationSchema } from '../middleware/validate.js';
import { audit } from '../services/activity.js';
import { JOB_TYPE_VALUES, serialiseAdminJob } from '../services/cms.js';
import { cleanText } from '../utils/sanitize.js';

const router = Router();
router.use(authenticate);

const SORT_COLUMNS = {
  createdAt: jobs.createdAt,
  updatedAt: jobs.updatedAt,
  title: jobs.title,
  sortOrder: jobs.sortOrder,
  department: jobs.department,
} as const;

const jobPayload = z
  .object({
    title: z.string().trim().min(3).max(160),
    department: z.string().trim().min(1).max(80),
    location: z.string().trim().min(1).max(120),
    type: z.enum(JOB_TYPE_VALUES as [string, ...string[]]),
    experience: z.string().trim().min(1).max(80).default('Mid'),
    description: z.string().trim().min(1).max(4000),
    responsibilities: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
    requirements: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
    niceToHave: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
    perks: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    status: z.enum(['OPEN', 'CLOSED']).default('OPEN'),
    postedDate: z.string().trim().max(40).default(''),
    sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  })
  .strict();

/** GET /api/admin/jobs */
router.get(
  '/',
  requirePermission('jobs:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = paginationSchema
      .extend({ status: z.enum(['OPEN', 'CLOSED', 'ALL']).default('ALL') })
      .parse(req.query);

    const where = query.search
      ? or(
          sql`${jobs.title} ilike ${`%${query.search}%`}`,
          sql`${jobs.department} ilike ${`%${query.search}%`}`,
          sql`${jobs.location} ilike ${`%${query.search}%`}`
        )
      : query.status === 'ALL'
        ? undefined
        : eq(jobs.status, query.status);

    const sortColumn = SORT_COLUMNS[(query.sortBy as keyof typeof SORT_COLUMNS) ?? 'sortOrder'] ?? jobs.sortOrder;
    const orderBy = query.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);

    const [items, totals] = await Promise.all([
      db
        .select()
        .from(jobs)
        .where(where)
        .orderBy(orderBy)
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db.select({ value: count() }).from(jobs).where(where),
    ]);

    res.json(paginated(items.map(serialiseAdminJob), totals[0]?.value ?? 0, query.page, query.limit));
  })
);

/** GET /api/admin/jobs/:id */
router.get(
  '/:id',
  requirePermission('jobs:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) throw new AppError(404, 'That role no longer exists.', 'not_found');
    res.json({ job: serialiseAdminJob(job) });
  })
);

/** POST /api/admin/jobs */
router.post(
  '/',
  requirePermission('jobs:create'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = jobPayload.parse(req.body);

    const [last] = await db.select({ sortOrder: jobs.sortOrder }).from(jobs).orderBy(desc(jobs.sortOrder)).limit(1);

    const [created] = await db
      .insert(jobs)
      .values({
        title: cleanText(data.title, 160),
        department: cleanText(data.department, 80),
        location: cleanText(data.location, 120),
        type: data.type,
        experience: cleanText(data.experience, 80),
        description: cleanText(data.description, 4000),
        responsibilities: data.responsibilities.map((item) => cleanText(item, 300)),
        requirements: data.requirements.map((item) => cleanText(item, 300)),
        niceToHave: data.niceToHave.map((item) => cleanText(item, 300)),
        perks: data.perks.map((item) => cleanText(item, 200)),
        status: data.status,
        postedDate: cleanText(data.postedDate, 40),
        sortOrder: data.sortOrder ?? (last?.sortOrder ?? 0) + 1,
      })
      .returning();

    audit(req)('JOB_CREATED', 'job', {
      entityId: created.id,
      summary: `Created role “${created.title}”`,
    });

    res.status(201).json({ job: serialiseAdminJob(created) });
  })
);

/** PATCH /api/admin/jobs/:id */
router.patch(
  '/:id',
  requirePermission('jobs:update'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const data = jobPayload.partial().parse(req.body);

    const [existing] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'That role no longer exists.', 'not_found');

    await db
      .update(jobs)
      .set({
        ...(data.title !== undefined ? { title: cleanText(data.title, 160) } : {}),
        ...(data.department !== undefined ? { department: cleanText(data.department, 80) } : {}),
        ...(data.location !== undefined ? { location: cleanText(data.location, 120) } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.experience !== undefined ? { experience: cleanText(data.experience, 80) } : {}),
        ...(data.description !== undefined ? { description: cleanText(data.description, 4000) } : {}),
        ...(data.responsibilities !== undefined
          ? { responsibilities: data.responsibilities.map((item) => cleanText(item, 300)) }
          : {}),
        ...(data.requirements !== undefined
          ? { requirements: data.requirements.map((item) => cleanText(item, 300)) }
          : {}),
        ...(data.niceToHave !== undefined ? { niceToHave: data.niceToHave.map((item) => cleanText(item, 300)) } : {}),
        ...(data.perks !== undefined ? { perks: data.perks.map((item) => cleanText(item, 200)) } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.postedDate !== undefined ? { postedDate: cleanText(data.postedDate, 40) } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      })
      .where(eq(jobs.id, id));

    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);

    audit(req)('JOB_UPDATED', 'job', {
      entityId: id,
      summary: `Updated role “${job!.title}”`,
      metadata: { fields: Object.keys(data) },
    });

    res.json({ job: serialiseAdminJob(job!) });
  })
);

/** DELETE /api/admin/jobs/:id — requires typing the job title to confirm. */
router.delete(
  '/:id',
  requirePermission('jobs:delete'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = idSchema.parse(req.params.id);
    const { confirm } = z.object({ confirm: z.string().min(1).max(160) }).strict().parse(req.body);

    const [job] = await db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) throw new AppError(404, 'That role no longer exists.', 'not_found');
    if (confirm.trim().toLowerCase() !== job.title.toLowerCase()) {
      throw new AppError(400, `To confirm, type the role title exactly: ${job.title}`, 'confirmation_required');
    }

    await db.delete(jobs).where(eq(jobs.id, id));

    audit(req)('JOB_DELETED', 'job', { entityId: id, summary: `Deleted role “${job.title}”` });
    res.json({ ok: true });
  })
);

export default router;
