CREATE TABLE public.marketplace_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lzt_item_id bigint NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  cost_cents integer NOT NULL DEFAULT 0,
  resale_price_cents integer NOT NULL DEFAULT 0,
  lzt_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'available',
  bought_by_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  bought_at timestamptz,
  payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage marketplace items"
  ON public.marketplace_items FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Anyone can view available marketplace items"
  ON public.marketplace_items FOR SELECT TO authenticated
  USING (status = 'available');

CREATE POLICY "Tenants can view own purchases"
  ON public.marketplace_items FOR SELECT TO authenticated
  USING (bought_by_tenant_id IS NOT NULL AND is_tenant_member(auth.uid(), bought_by_tenant_id));