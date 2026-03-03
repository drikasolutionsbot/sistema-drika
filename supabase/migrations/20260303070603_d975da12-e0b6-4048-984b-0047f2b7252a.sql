
-- Protection settings per tenant - stores all protection module configs
CREATE TABLE public.protection_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, module_key)
);

ALTER TABLE public.protection_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage protection settings" ON public.protection_settings FOR ALL
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view protection settings" ON public.protection_settings FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

-- Protection logs - audit trail for protection events
CREATE TABLE public.protection_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  action text NOT NULL,
  target_user_id text,
  target_username text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.protection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage protection logs" ON public.protection_logs FOR ALL
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view protection logs" ON public.protection_logs FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

-- Whitelist for protection (users/roles exempt from protection)
CREATE TABLE public.protection_whitelist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('user', 'role')),
  discord_id text NOT NULL,
  label text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, type, discord_id)
);

ALTER TABLE public.protection_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage protection whitelist" ON public.protection_whitelist FOR ALL
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view protection whitelist" ON public.protection_whitelist FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));
