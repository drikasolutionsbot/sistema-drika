ALTER TABLE public.marketplace_items 
  ADD COLUMN IF NOT EXISTS delivery_content text,
  ADD COLUMN IF NOT EXISTS delivered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone;