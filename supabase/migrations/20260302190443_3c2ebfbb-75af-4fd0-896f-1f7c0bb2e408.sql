ALTER TABLE public.tenant_permissions
  ADD COLUMN IF NOT EXISTS can_change_server boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_permissions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_bot_appearance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_products boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_store boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_protection boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_ecloud boolean NOT NULL DEFAULT false;