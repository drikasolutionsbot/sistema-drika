ALTER TABLE public.landing_config
ADD COLUMN IF NOT EXISTS global_bot_banner_force_reapply_at timestamptz;