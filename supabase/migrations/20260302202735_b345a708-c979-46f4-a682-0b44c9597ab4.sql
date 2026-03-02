
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS bot_status text DEFAULT '/panel',
  ADD COLUMN IF NOT EXISTS bot_status_interval integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS bot_prefix text DEFAULT 'd!';
