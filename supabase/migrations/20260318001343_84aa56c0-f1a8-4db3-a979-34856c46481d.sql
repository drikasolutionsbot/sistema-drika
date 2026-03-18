ALTER TABLE public.saved_ticket_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their tenant ticket presets"
ON public.saved_ticket_presets
FOR ALL
TO authenticated
USING (
  public.is_tenant_member(tenant_id, auth.uid())
)
WITH CHECK (
  public.is_tenant_member(tenant_id, auth.uid())
);