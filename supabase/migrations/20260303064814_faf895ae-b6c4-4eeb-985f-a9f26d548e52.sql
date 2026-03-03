-- Product fields (variations) table
CREATE TABLE public.product_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  emoji text,
  price_cents integer NOT NULL DEFAULT 0,
  compare_price_cents integer,
  sort_order integer DEFAULT 0,
  enable_credits boolean NOT NULL DEFAULT false,
  is_subscription boolean NOT NULL DEFAULT false,
  show_stock boolean NOT NULL DEFAULT false,
  show_sold boolean NOT NULL DEFAULT false,
  enable_instructions boolean NOT NULL DEFAULT false,
  require_role_id text,
  min_quantity integer DEFAULT 1,
  max_quantity integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage product fields"
ON public.product_fields FOR ALL
USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view product fields"
ON public.product_fields FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

-- Product stock items table
CREATE TABLE public.product_stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.product_fields(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content text NOT NULL,
  delivered boolean NOT NULL DEFAULT false,
  delivered_to text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stock items"
ON public.product_stock_items FOR ALL
USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view stock items"
ON public.product_stock_items FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));