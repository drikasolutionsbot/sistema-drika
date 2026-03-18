
CREATE TABLE public.saved_ticket_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  preset_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_ticket_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ticket presets"
  ON public.saved_ticket_presets FOR ALL
  TO public
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view ticket presets"
  ON public.saved_ticket_presets FOR SELECT
  TO public
  USING (is_tenant_member(auth.uid(), tenant_id));
