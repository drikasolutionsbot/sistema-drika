
CREATE TABLE public.store_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Canais
  sales_channel_id text,
  logs_channel_id text,
  
  -- Entrega
  payment_timeout_minutes integer NOT NULL DEFAULT 30,
  auto_delivery_global boolean NOT NULL DEFAULT true,
  delivery_instructions text DEFAULT '',
  
  -- Aparência
  embed_color text NOT NULL DEFAULT '#5865F2',
  store_title text DEFAULT '',
  store_description text DEFAULT '',
  store_banner_url text,
  store_logo_url text,
  
  -- Embed de compra
  purchase_embed_title text DEFAULT 'Compra realizada! ✅',
  purchase_embed_description text DEFAULT 'Obrigado pela sua compra, {user}!',
  purchase_embed_color text DEFAULT '#57F287',
  purchase_embed_footer text DEFAULT '',
  purchase_embed_image_url text,
  purchase_embed_thumbnail_url text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id)
);

ALTER TABLE public.store_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage store configs"
  ON public.store_configs FOR ALL TO authenticated
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view store configs"
  ON public.store_configs FOR SELECT TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id));
