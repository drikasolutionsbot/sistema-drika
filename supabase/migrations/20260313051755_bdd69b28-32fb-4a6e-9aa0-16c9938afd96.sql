
CREATE TABLE public.ecloud_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  backup_type text NOT NULL DEFAULT 'daily',
  status text NOT NULL DEFAULT 'running',
  members_count integer NOT NULL DEFAULT 0,
  verified_count integer NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  products_count integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ecloud_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage backups"
  ON public.ecloud_backups FOR ALL TO public
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view backups"
  ON public.ecloud_backups FOR SELECT TO public
  USING (is_tenant_member(auth.uid(), tenant_id));
