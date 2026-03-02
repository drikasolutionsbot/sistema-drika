CREATE TABLE public.tenant_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  discord_role_id text,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#99AAB5',
  synced boolean NOT NULL DEFAULT false,
  can_view boolean NOT NULL DEFAULT true,
  can_manage_app boolean NOT NULL DEFAULT false,
  can_manage_resources boolean NOT NULL DEFAULT false,
  can_change_server boolean NOT NULL DEFAULT false,
  can_manage_permissions boolean NOT NULL DEFAULT false,
  can_manage_bot_appearance boolean NOT NULL DEFAULT false,
  can_manage_products boolean NOT NULL DEFAULT false,
  can_manage_store boolean NOT NULL DEFAULT false,
  can_manage_stock boolean NOT NULL DEFAULT false,
  can_manage_protection boolean NOT NULL DEFAULT false,
  can_manage_ecloud boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, discord_role_id)
);

ALTER TABLE public.tenant_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view roles"
  ON public.tenant_roles FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage roles"
  ON public.tenant_roles FOR ALL
  USING (
    has_role(auth.uid(), tenant_id, 'owner') OR
    has_role(auth.uid(), tenant_id, 'admin')
  );