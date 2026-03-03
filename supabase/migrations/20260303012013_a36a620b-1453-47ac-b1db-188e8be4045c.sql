-- Webhook logs table
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  event_type TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_logs_tenant ON public.webhook_logs(tenant_id, created_at DESC);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view webhook logs"
ON public.webhook_logs FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Service role can insert logs"
ON public.webhook_logs FOR INSERT
WITH CHECK (true);