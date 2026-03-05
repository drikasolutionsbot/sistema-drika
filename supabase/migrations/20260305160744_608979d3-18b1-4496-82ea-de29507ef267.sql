
-- Create webhook_logs table (missing)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  event_type text,
  payload jsonb DEFAULT '{}'::jsonb,
  result jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_logs' AND policyname = 'Members can view webhook logs') THEN
    CREATE POLICY "Members can view webhook logs" ON public.webhook_logs FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_logs' AND policyname = 'Service role can manage webhook logs') THEN
    CREATE POLICY "Service role can manage webhook logs" ON public.webhook_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant_created ON public.webhook_logs(tenant_id, created_at DESC);

-- Create welcome_configs table (missing)
CREATE TABLE IF NOT EXISTS public.welcome_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  channel_enabled boolean NOT NULL DEFAULT false,
  channel_id text,
  dm_enabled boolean NOT NULL DEFAULT false,
  embed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  dm_embed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_role_enabled boolean NOT NULL DEFAULT false,
  auto_role_id text,
  content text DEFAULT '',
  dm_content text DEFAULT '',
  goodbye_enabled boolean NOT NULL DEFAULT false,
  goodbye_channel_id text,
  goodbye_embed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  goodbye_content text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.welcome_configs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'welcome_configs' AND policyname = 'Members can view welcome configs') THEN
    CREATE POLICY "Members can view welcome configs" ON public.welcome_configs FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'welcome_configs' AND policyname = 'Admins can manage welcome configs') THEN
    CREATE POLICY "Admins can manage welcome configs" ON public.welcome_configs FOR ALL USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'welcome_configs' AND policyname = 'Service role can manage welcome configs') THEN
    CREATE POLICY "Service role can manage welcome configs" ON public.welcome_configs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_wallet_tx_tenant_created ON public.wallet_transactions(tenant_id, created_at DESC);
