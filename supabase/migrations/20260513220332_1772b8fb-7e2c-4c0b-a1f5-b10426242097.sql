-- Estende landing_config com configs do Marketplace Global
ALTER TABLE public.landing_config
  ADD COLUMN IF NOT EXISTS global_marketplace_commission_percent integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS global_marketplace_guild_id text,
  ADD COLUMN IF NOT EXISTS global_marketplace_approver_discord_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS global_marketplace_category_channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS global_marketplace_payment_provider text;

-- Tabela de listagens globais
CREATE TABLE IF NOT EXISTS public.global_marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  global_status text NOT NULL DEFAULT 'pending' CHECK (global_status IN ('pending','approved','rejected','removed')),
  category_global text,
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  discord_message_id text,
  discord_channel_id text,
  total_sales integer NOT NULL DEFAULT 0,
  total_revenue_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gml_status ON public.global_marketplace_listings(global_status);
CREATE INDEX IF NOT EXISTS idx_gml_tenant ON public.global_marketplace_listings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gml_product ON public.global_marketplace_listings(product_id);

ALTER TABLE public.global_marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view approved listings"
  ON public.global_marketplace_listings FOR SELECT TO authenticated
  USING (global_status = 'approved');

CREATE POLICY "Tenant members can view own listings"
  ON public.global_marketplace_listings FOR SELECT TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage own listings"
  ON public.global_marketplace_listings FOR ALL TO authenticated
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Super admins manage all listings"
  ON public.global_marketplace_listings FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Estende orders com campos de marketplace global
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS global_listing_id uuid,
  ADD COLUMN IF NOT EXISTS commission_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_received_cents integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_global_listing ON public.orders(global_listing_id) WHERE is_global = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_gml_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_gml_updated_at ON public.global_marketplace_listings;
CREATE TRIGGER trg_gml_updated_at
  BEFORE UPDATE ON public.global_marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.touch_gml_updated_at();