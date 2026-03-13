ALTER TABLE public.product_fields
  ADD COLUMN IF NOT EXISTS pre_purchase_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS post_purchase_messages jsonb NOT NULL DEFAULT '[]'::jsonb;