ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wallet_tx_payment_id ON public.wallet_transactions(tenant_id, payment_id);

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_tenant_unique'
  ) THEN
    ALTER TABLE public.wallets ADD CONSTRAINT wallets_tenant_unique UNIQUE (tenant_id);
  END IF;
END $mig$;

CREATE OR REPLACE FUNCTION public.credit_wallet_deposit(_tx_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _tenant uuid;
  _amount integer;
  _status text;
  _type text;
BEGIN
  SELECT tenant_id, amount_cents, status, type
    INTO _tenant, _amount, _status, _type
  FROM public.wallet_transactions WHERE id = _tx_id FOR UPDATE;

  IF _tenant IS NULL THEN RETURN false; END IF;
  IF _type <> 'deposit' OR _status <> 'pending' THEN RETURN false; END IF;

  UPDATE public.wallet_transactions
    SET status = 'completed', completed_at = now()
    WHERE id = _tx_id;

  INSERT INTO public.wallets (tenant_id, balance_cents, total_earned_cents)
  VALUES (_tenant, _amount, _amount)
  ON CONFLICT (tenant_id) DO UPDATE
    SET balance_cents = wallets.balance_cents + EXCLUDED.balance_cents,
        total_earned_cents = wallets.total_earned_cents + EXCLUDED.total_earned_cents,
        updated_at = now();

  RETURN true;
END;
$fn$;