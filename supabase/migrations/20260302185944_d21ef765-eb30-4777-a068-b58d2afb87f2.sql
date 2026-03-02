CREATE TABLE public.tenant_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  discord_user_id text NOT NULL,
  discord_username text,
  discord_display_name text,
  discord_avatar_url text,
  can_view boolean NOT NULL DEFAULT true,
  can_manage_app boolean NOT NULL DEFAULT false,
  can_manage_resources boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, discord_user_id)
);

ALTER TABLE public.tenant_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view permissions"
  ON public.tenant_permissions FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage permissions"
  ON public.tenant_permissions FOR ALL
  USING (
    has_role(auth.uid(), tenant_id, 'owner') OR 
    has_role(auth.uid(), tenant_id, 'admin')
  );