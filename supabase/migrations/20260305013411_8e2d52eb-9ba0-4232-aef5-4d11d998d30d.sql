
CREATE TABLE public.tenant_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_name text,
  actor_discord_id text,
  actor_name text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant audit logs"
  ON public.tenant_audit_logs FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert tenant audit logs"
  ON public.tenant_audit_logs FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), tenant_id, 'owner'::app_role)
    OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
  );

CREATE POLICY "Service role can manage tenant audit logs"
  ON public.tenant_audit_logs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_tenant_audit_logs_tenant_id ON public.tenant_audit_logs(tenant_id);
CREATE INDEX idx_tenant_audit_logs_created_at ON public.tenant_audit_logs(created_at DESC);
