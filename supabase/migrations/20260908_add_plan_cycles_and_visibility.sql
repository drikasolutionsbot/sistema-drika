-- Migration: Add plan cycles and visibility to landing_config and tenants
ALTER TABLE public.landing_config
  ADD COLUMN IF NOT EXISTS pro_quarterly_price_cents integer NOT NULL DEFAULT 3490,
  ADD COLUMN IF NOT EXISTS pro_semiannual_price_cents integer NOT NULL DEFAULT 5990,
  ADD COLUMN IF NOT EXISTS master_quarterly_price_cents integer NOT NULL DEFAULT 7290,
  ADD COLUMN IF NOT EXISTS master_semiannual_price_cents integer NOT NULL DEFAULT 12990,
  ADD COLUMN IF NOT EXISTS show_pro_plan boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_master_plan boolean NOT NULL DEFAULT true;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_cycle text NOT NULL DEFAULT 'monthly';

-- Update current landing_config row to set the new default prices & names
UPDATE public.landing_config
SET
  pro_plan_name = 'Básico',
  pro_price_cents = 1299,
  pro_quarterly_price_cents = 3490,
  pro_semiannual_price_cents = 5990,
  master_plan_name = 'Master',
  master_price_cents = 2699,
  master_quarterly_price_cents = 7290,
  master_semiannual_price_cents = 12990,
  show_pro_plan = true,
  show_master_plan = true;
