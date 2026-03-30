CREATE TABLE public.product_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  webhook_id TEXT,
  webhook_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, channel_id, message_id)
);

ALTER TABLE public.product_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on product_messages"
  ON public.product_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);