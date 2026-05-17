ALTER TABLE public.global_marketplace_listings
  ADD COLUMN IF NOT EXISTS seller_pix_key text,
  ADD COLUMN IF NOT EXISTS seller_pix_key_type text;