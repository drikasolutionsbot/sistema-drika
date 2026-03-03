ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS enable_credits boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_sold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_instructions boolean NOT NULL DEFAULT false;