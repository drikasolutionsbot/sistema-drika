ALTER TABLE public.tenants ADD COLUMN verify_slug text UNIQUE;

-- Generate short slugs for existing tenants using first 8 chars of md5
UPDATE public.tenants SET verify_slug = LOWER(SUBSTR(MD5(id::text), 1, 8)) WHERE verify_slug IS NULL;