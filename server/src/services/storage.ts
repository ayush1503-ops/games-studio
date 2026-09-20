import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { StorageClient } from '@supabase/storage-js';
import { db } from '../db/index.js';
import { mediaAssets } from '../db/schema.js';
import { config } from '../config/env.js';
import { AppError, badRequest } from '../middleware/errors.js';
import { logger } from '../utils/logger.js';

export const UPLOAD_ROOT = path.resolve(process.cwd(), config.uploadDir);

/**
 * Media storage backends:
 *  - `local`    – development / single-server deploys. Files live under
 *                 UPLOAD_ROOT and are served read-only from `/uploads`.
 *  - `supabase` – serverless deploys (Vercel). Files are uploaded to a public
 *                 Supabase Storage bucket with the service-role key and served
 *                 from the storage CDN. The rest of the app only ever sees the
 *                 returned URL, so both drivers are interchangeable.
 */
export const STORE_ROOT_NOTE =
  config.storageDriver === 'supabase'
    ? `Images are stored in Supabase Storage (public bucket "${config.storageBucket}") and served from the storage CDN.`
    : 'Images are stored on the API server under the upload directory and served read-only from /uploads.';

/* ------------------------ Supabase Storage client ------------------------ */
/**
 * We use the raw `StorageClient` (not the full Supabase JS client) because the
 * API only ever touches Storage. This keeps the serverless bundle small and
 * avoids dragging in auth/realtime/postgrest. The service-role key is sent as
 * a bearer token, which bypasses RLS — exactly what an admin upload needs.
 */
let storageClient: StorageClient | null = null;

function getStorageClient(): StorageClient {
  if (config.storageDriver !== 'supabase') {
    throw new AppError(500, 'Media storage is not configured.', 'storage_not_configured');
  }
  if (!storageClient) {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new AppError(500, 'Supabase Storage is not configured.', 'storage_not_configured');
    }
    const baseUrl = config.supabaseUrl.replace(/\/$/, '');
    storageClient = new StorageClient(`${baseUrl}/storage/v1`, {
      // Service-role key via both accepted auth headers (belt and suspenders).
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
    });
  }
  return storageClient;
}

function supabasePublicBase(): string | null {
  if (!config.supabaseUrl) return null;
  return `${config.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${config.storageBucket}`;
}

const MAX_DIMENSION = 12_000;
const MAX_PIXELS = 60_000_000;

export interface DetectedImage {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  extension: 'jpg' | 'png' | 'webp' | 'gif';
  width: number | null;
  height: number | null;
}

/**
 * Sniffs the real file type from magic bytes.
 * The browser-supplied MIME type and filename are never trusted.
 */
export function detectImage(buffer: Buffer): DetectedImage | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg', ...jpegDimensions(buffer) };
  }

  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    const width = buffer.length >= 24 ? buffer.readUInt32BE(16) : null;
    const height = buffer.length >= 28 ? buffer.readUInt32BE(20) : null;
    return { mimeType: 'image/png', extension: 'png', width, height };
  }

  const gifHeader = buffer.subarray(0, 6).toString('ascii');
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
    return {
      mimeType: 'image/gif',
      extension: 'gif',
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
    };
  }

  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    const chunk = buffer.subarray(12, 16).toString('ascii');
    if (chunk === 'VP8X' && buffer.length >= 30) {
      const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      return { mimeType: 'image/webp', extension: 'webp', width, height };
    }
    return { mimeType: 'image/webp', extension: 'webp', width: null, height: null };
  }

  return null;
}

function jpegDimensions(buffer: Buffer): { width: number | null; height: number | null } {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    const isFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isFrame) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return { width: null, height: null };
}

export function assertSafeImage(detected: DetectedImage | null, sizeBytes: number): DetectedImage {
  if (!detected) {
    throw badRequest('That file is not a supported image (JPEG, PNG, WebP or GIF).', 'invalid_file_type');
  }
  if (sizeBytes > config.maxUploadBytes) {
    throw badRequest(
      `Images must be smaller than ${Math.round(config.maxUploadBytes / (1024 * 1024))} MB.`,
      'file_too_large'
    );
  }
  if (detected.width && detected.height) {
    if (detected.width > MAX_DIMENSION || detected.height > MAX_DIMENSION) {
      throw badRequest('Image dimensions are too large.', 'image_too_large');
    }
    if (detected.width * detected.height > MAX_PIXELS) {
      throw badRequest('Image resolution is too large.', 'image_too_large');
    }
  }
  return detected;
}

export async function ensureUploadRoot(): Promise<void> {
  if (config.storageDriver !== 'local') return;
  await fs.mkdir(UPLOAD_ROOT, { recursive: true, mode: 0o755 });
}

/** Random, non-guessable filename — original names are never reused on disk. */
function randomFilename(extension: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${stamp}-${crypto.randomBytes(12).toString('hex')}.${extension}`;
}

export interface StoredAsset {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

export async function storeImage(input: {
  buffer: Buffer;
  originalName: string;
  uploadedById?: string | null;
}): Promise<StoredAsset> {
  const detected = assertSafeImage(detectImage(input.buffer), input.buffer.length);
  const filename = randomFilename(detected.extension);

  let url: string;
  if (config.storageDriver === 'supabase') {
    const client = getStorageClient();
    const { error } = await client
      .from(config.storageBucket)
      .upload(filename, input.buffer, {
        contentType: detected.mimeType,
        upsert: false,
        cacheControl: '31536000',
      });
    if (error) {
      logger.error('Supabase Storage upload failed', { error: error.message, filename });
      throw new AppError(502, 'Could not store the image. Please try again.', 'storage_upload_failed');
    }
    url = client.from(config.storageBucket).getPublicUrl(filename).data.publicUrl;
  } else {
    await ensureUploadRoot();
    const absolutePath = path.join(UPLOAD_ROOT, filename);
    if (!absolutePath.startsWith(UPLOAD_ROOT + path.sep)) {
      throw new AppError(400, 'Invalid upload path.', 'invalid_path');
    }
    await fs.writeFile(absolutePath, input.buffer, { mode: 0o644 });
    url = `/uploads/${filename}`;
  }

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      filename,
      originalName: input.originalName.replace(/[^\w.\- ]/g, '_').slice(0, 180),
      url,
      mimeType: detected.mimeType,
      sizeBytes: input.buffer.length,
      width: detected.width,
      height: detected.height,
      checksum: crypto.createHash('sha256').update(input.buffer).digest('hex'),
      uploadedById: input.uploadedById ?? null,
    })
    .returning();

  logger.info('Stored media asset', { id: asset.id, filename, size: asset.sizeBytes, driver: config.storageDriver });

  return {
    id: asset.id,
    url: asset.url,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
  };
}

const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/;

export type ManagedUrl =
  | { kind: 'local'; filename: string }
  | { kind: 'supabase'; filename: string };

/**
 * Recognises URLs this application manages:
 *  - `/uploads/<file>` — local-disk assets
 *  - `<supabase public base>/<file>` — Supabase Storage assets
 */
export function parseManagedUrl(url: string): ManagedUrl | null {
  if (typeof url !== 'string') return null;

  const localMatch = url.match(/^\/uploads\/([A-Za-z0-9][A-Za-z0-9._-]{0,180})$/);
  if (localMatch) return { kind: 'local', filename: localMatch[1] };

  const base = supabasePublicBase();
  if (base) {
    const prefix = `${base}/`;
    if (url.startsWith(prefix)) {
      const filename = url.slice(prefix.length);
      if (SAFE_FILENAME.test(filename) && !filename.includes('..')) {
        return { kind: 'supabase', filename };
      }
    }
  }
  return null;
}

/**
 * Resolves a stored filename to an absolute path, refusing anything that could
 * escape the upload directory (path traversal, null bytes, unicode tricks).
 */
export function resolveStoredFile(filename: string): string {
  if (typeof filename !== 'string' || !SAFE_FILENAME.test(filename) || filename.includes('..')) {
    throw badRequest('Invalid file reference.', 'invalid_filename');
  }
  const absolute = path.resolve(UPLOAD_ROOT, filename);
  if (!absolute.startsWith(UPLOAD_ROOT + path.sep)) {
    throw badRequest('Invalid file reference.', 'invalid_filename');
  }
  return absolute;
}

export async function deleteAsset(id: string): Promise<void> {
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  if (!asset) throw new AppError(404, 'That media item no longer exists.', 'not_found');

  const managed = parseManagedUrl(asset.url);
  if (managed) {
    if (managed.kind === 'supabase') {
      if (config.storageDriver === 'supabase') {
        const client = getStorageClient();
        const { error } = await client.from(config.storageBucket).remove([managed.filename]);
        if (error) logger.warn('Supabase Storage delete failed (DB row still removed)', { id, error: error.message });
      } else {
        logger.warn('Deleting a Supabase-hosted asset while local storage is active; skipping object removal', { id });
      }
    } else {
      await fs.rm(resolveStoredFile(managed.filename), { force: true });
    }
  } else {
    // Legacy rows with unknown URLs: best-effort local removal.
    await fs.rm(resolveStoredFile(asset.filename), { force: true }).catch(() => undefined);
  }

  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  logger.info('Deleted media asset', { id, filename: asset.filename });
}

/** True when the URL points at a file we manage. */
export function isManagedUrl(url: string): boolean {
  return parseManagedUrl(url) !== null;
}
