
CREATE TABLE public.saved_embeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  embed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_embeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage embeds"
ON public.saved_embeds FOR ALL
USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view embeds"
ON public.saved_embeds FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE INDEX idx_saved_embeds_tenant ON public.saved_embeds(tenant_id);
