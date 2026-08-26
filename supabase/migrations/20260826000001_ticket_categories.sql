-- ============================================================
-- Ticket Categories (Tipos de Atendimento)
-- ============================================================

CREATE TABLE public.ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  emoji text NOT NULL DEFAULT '🎫',
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ticket categories"
  ON public.ticket_categories FOR ALL
  USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
    has_role(auth.uid(), tenant_id, 'admin'::app_role)
  );

CREATE POLICY "Members can view ticket categories"
  ON public.ticket_categories FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE INDEX idx_ticket_categories_tenant_sort
  ON public.ticket_categories(tenant_id, sort_order);

-- Coluna topic_name no ticket para guardar a categoria selecionada
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS topic_name text;
