-- Allow anon uploads to tenant-assets bucket (token-based users don't have auth session)
DROP POLICY IF EXISTS "Authenticated users can upload tenant assets" ON storage.objects;
CREATE POLICY "Anyone can upload tenant assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tenant-assets');

DROP POLICY IF EXISTS "Authenticated users can update tenant assets" ON storage.objects;
CREATE POLICY "Anyone can update tenant assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tenant-assets');

DROP POLICY IF EXISTS "Authenticated users can delete tenant assets" ON storage.objects;
CREATE POLICY "Anyone can delete tenant assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'tenant-assets');