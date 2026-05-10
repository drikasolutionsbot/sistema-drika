
-- Add PIX OUT capability flag to payment providers
ALTER TABLE public.payment_providers
  ADD COLUMN IF NOT EXISTS pix_out_enabled boolean NOT NULL DEFAULT false;

-- Atomically debit wallet balance and mark a withdrawal tx as completed
CREATE OR REPLACE FUNCTION public.debit_wallet_withdrawal(_tx_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _amount integer;
  _status text;
  _type text;
  _balance integer;
BEGIN
  SELECT tenant_id, amount_cents, status, type
    INTO _tenant, _amount, _status, _type
  FROM public.wallet_transactions WHERE id = _tx_id FOR UPDATE;

  IF _tenant IS NULL THEN RETURN false; END IF;
  IF _type <> 'withdrawal' OR _status NOT IN ('pending','processing') THEN RETURN false; END IF;

  SELECT balance_cents INTO _balance FROM public.wallets WHERE tenant_id = _tenant FOR UPDATE;
  IF _balance IS NULL OR _balance < _amount THEN
    UPDATE public.wallet_transactions
      SET status = 'rejected', completed_at = now()
      WHERE id = _tx_id;
    RETURN false;
  END IF;

  UPDATE public.wallets
    SET balance_cents = balance_cents - _amount,
        total_withdrawn_cents = total_withdrawn_cents + _amount,
        updated_at = now()
    WHERE tenant_id = _tenant;

  UPDATE public.wallet_transactions
    SET status = 'completed', completed_at = now()
    WHERE id = _tx_id;

  RETURN true;
END;
$$;
