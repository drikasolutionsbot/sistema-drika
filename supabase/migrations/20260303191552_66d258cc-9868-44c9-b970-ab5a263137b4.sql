ALTER TABLE public.product_fields ADD COLUMN IF NOT EXISTS icon_url text DEFAULT NULL;
ALTER TABLE public.product_fields ADD COLUMN IF NOT EXISTS banner_url text DEFAULT NULL;