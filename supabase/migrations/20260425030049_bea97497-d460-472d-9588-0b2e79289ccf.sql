CREATE TABLE IF NOT EXISTS public.order_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  discord_user_id text NOT NULL,
  discord_username text,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, discord_user_id)
);

CREATE INDEX IF NOT EXISTS idx_order_feedbacks_tenant ON public.order_feedbacks(tenant_id, created_at DESC);

ALTER TABLE public.order_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view feedbacks"
ON public.order_feedbacks FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));