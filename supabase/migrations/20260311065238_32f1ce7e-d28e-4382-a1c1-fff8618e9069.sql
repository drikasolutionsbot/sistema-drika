ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS commission_fixed_cents integer NOT NULL DEFAULT 0;