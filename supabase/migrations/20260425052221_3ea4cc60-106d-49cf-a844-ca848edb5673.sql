CREATE TABLE IF NOT EXISTS public.dm_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  template_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  embed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_dm_templates_tenant ON public.dm_templates(tenant_id);

ALTER TABLE public.dm_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage dm templates"
ON public.dm_templates
FOR ALL
USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view dm templates"
ON public.dm_templates
FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Service role full access dm templates"
ON public.dm_templates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_dm_templates_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_dm_templates_updated_at ON public.dm_templates;
CREATE TRIGGER trg_dm_templates_updated_at
BEFORE UPDATE ON public.dm_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_dm_templates_updated_at();