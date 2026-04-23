ALTER TABLE public.landing_config
  ADD COLUMN IF NOT EXISTS pro_plan_name text NOT NULL DEFAULT 'Pro',
  ADD COLUMN IF NOT EXISTS master_plan_name text NOT NULL DEFAULT 'Master';