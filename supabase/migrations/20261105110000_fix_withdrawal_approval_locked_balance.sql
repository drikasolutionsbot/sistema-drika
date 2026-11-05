-- Migration: Fix and enhance withdrawal approval and balance locking
-- Ensures locked_balance_cents is cleanly deducted upon approval,
-- and returned upon rejection, keeping balance_cents accurate at all times.

-- 1. Ensure approve_wallet_withdrawal correctly releases locked_balance_cents
CREATE OR REPLACE FUNCTION public.approve_wallet_withdrawal(
  _tx_id uuid,
  _admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx record;
BEGIN
  SELECT * INTO _tx
  FROM public.wallet_transactions
  WHERE id = _tx_id
  FOR UPDATE;

  IF _tx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não encontrada');
  END IF;

  IF _tx.type <> 'withdrawal' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não é um saque');
  END IF;

  -- Se já foi completado anteriormente, retorna idempotente
  IF _tx.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'amount_cents', _tx.amount_cents);
  END IF;

  IF _tx.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Transação já está com status %s', _tx.status));
  END IF;

  -- Garante linha de carteira
  INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents)
  VALUES (_tx.tenant_id, 0, 0, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Remove do saldo bloqueado (já que saiu definitivamente da plataforma) e incrementa total sacado
  UPDATE public.wallets
  SET locked_balance_cents = GREATEST(0, COALESCE(locked_balance_cents, 0) - _tx.amount_cents),
      total_withdrawn_cents = COALESCE(total_withdrawn_cents, 0) + _tx.amount_cents,
      updated_at = now()
  WHERE tenant_id = _tx.tenant_id;

  -- Marca transação como completed
  UPDATE public.wallet_transactions
  SET status = 'completed',
      completed_at = now(),
      admin_notes = COALESCE(_admin_notes, admin_notes)
  WHERE id = _tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', _tx_id,
    'amount_cents', _tx.amount_cents,
    'tenant_id', _tx.tenant_id
  );
END;
$$;

-- 2. Enhanced debit_wallet_withdrawal signature (_tenant_id, _amount_cents)
CREATE OR REPLACE FUNCTION public.debit_wallet_withdrawal(
  _tenant_id uuid,
  _amount_cents integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wallets
  SET locked_balance_cents = GREATEST(0, COALESCE(locked_balance_cents, 0) - _amount_cents),
      total_withdrawn_cents = COALESCE(total_withdrawn_cents, 0) + _amount_cents,
      updated_at = now()
  WHERE tenant_id = _tenant_id;
  RETURN true;
END;
$$;

-- 3. Overload debit_wallet_withdrawal(_tx_id)
CREATE OR REPLACE FUNCTION public.debit_wallet_withdrawal(_tx_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx record;
BEGIN
  SELECT * INTO _tx FROM public.wallet_transactions WHERE id = _tx_id;
  IF _tx IS NULL THEN RETURN false; END IF;

  UPDATE public.wallets
  SET locked_balance_cents = GREATEST(0, COALESCE(locked_balance_cents, 0) - _tx.amount_cents),
      total_withdrawn_cents = COALESCE(total_withdrawn_cents, 0) + _tx.amount_cents,
      updated_at = now()
  WHERE tenant_id = _tx.tenant_id;

  UPDATE public.wallet_transactions
  SET status = 'completed', completed_at = now()
  WHERE id = _tx_id;

  RETURN true;
END;
$$;
