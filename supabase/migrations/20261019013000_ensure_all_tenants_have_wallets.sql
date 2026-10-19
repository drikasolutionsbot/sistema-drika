-- Ensure all existing and future tenants have a wallet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_tenant_unique'
  ) THEN
    ALTER TABLE public.wallets ADD CONSTRAINT wallets_tenant_unique UNIQUE (tenant_id);
  END IF;
END $$;

-- 1. Insert wallets for all existing tenants that don't have one
INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents, created_at, updated_at)
SELECT id, 0, 0, 0, 0, NOW(), NOW()
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- 2. Trigger function to automatically create a wallet for newly created tenants
CREATE OR REPLACE FUNCTION public.handle_new_tenant_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents, created_at, updated_at)
  VALUES (NEW.id, 0, 0, 0, 0, NOW(), NOW())
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_new_tenant_wallet ON public.tenants;
CREATE TRIGGER trigger_new_tenant_wallet
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant_wallet();
