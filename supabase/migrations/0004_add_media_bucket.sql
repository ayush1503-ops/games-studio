-- =============================================================================
-- 0004_add_media_bucket.sql
-- -----------------------------------------------------------------------------
-- Adds the `media` bucket used by the Express admin API for CMS image uploads
-- (Vercel deployment). The API uploads with the Supabase service-role key,
-- which bypasses RLS; the policies below keep the bucket consistent with the
-- others and allow authenticated studio admins to upload via the Supabase
-- client as well.
--
-- Run this in the Supabase SQL Editor after 0001/0002 (or `apply_now.sql`).
-- It is idempotent: safe to re-run.
-- =============================================================================

-- Public bucket for CMS-uploaded images (matches the 4 MB MAX_UPLOAD_BYTES
-- default on the API side).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  4 * 1024 * 1024,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 4 * 1024 * 1024,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

-- Public reads (objects are public when linked).
DROP POLICY IF EXISTS storage_public_read_media ON storage.objects;
CREATE POLICY storage_public_read_media ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'media');

-- Authenticated studio admins can manage objects in this bucket.
DROP POLICY IF EXISTS storage_admin_write_media ON storage.objects;
CREATE POLICY storage_admin_write_media ON storage.objects FOR ALL TO authenticated
  USING (is_admin() AND bucket_id = 'media')
  WITH CHECK (is_admin() AND bucket_id = 'media');
