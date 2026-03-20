ALTER TABLE public.landing_config
  ADD COLUMN IF NOT EXISTS global_bot_status text NOT NULL DEFAULT '/panel',
  ADD COLUMN IF NOT EXISTS global_bot_banner_url text;