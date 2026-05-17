ALTER TABLE public.global_marketplace_listings
  ADD CONSTRAINT global_marketplace_listings_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.global_marketplace_listings
  ADD CONSTRAINT global_marketplace_listings_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_gml_tenant ON public.global_marketplace_listings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gml_product ON public.global_marketplace_listings(product_id);
CREATE INDEX IF NOT EXISTS idx_gml_status ON public.global_marketplace_listings(global_status);