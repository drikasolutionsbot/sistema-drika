-- Migration: Split 1% directly on sale (credit_order_to_wallet)
-- 1% goes to Platform Admin profit, 99% net credited to Client Store Wallet.
-- Withdrawal is fee-free (0% fee) and without minimum amount.

-- 1. Update credit_order_to_wallet: deduct 1% at sale time
CREATE OR REPLACE FUNCTION public.credit_order_to_wallet(
  _tenant_id uuid,
  _order_id text,
  _amount_cents integer,
  _description text DEFAULT 'Venda de Produto'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_id uuid;
  _new_tx_id uuid;
  _fee_cents integer;
  _net_cents integer;
BEGIN
  IF _amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Valor inválido');
  END IF;

  -- Check idempotency: avoid double-crediting the same order
  SELECT id INTO _existing_id
  FROM public.wallet_transactions
  WHERE tenant_id = _tenant_id AND payment_id = _order_id AND type = 'deposit'
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_credited', true, 'tx_id', _existing_id);
  END IF;

  -- Calculate 1% platform fee (retained for admin/platform profit)
  _fee_cents := ROUND(_amount_cents * 0.01);
  _net_cents := _amount_cents - _fee_cents;

  -- Ensure wallet row exists
  INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents)
  VALUES (_tenant_id, 0, 0, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Add NET amount (99%) to balance_cents and total_earned_cents
  UPDATE public.wallets
  SET balance_cents = COALESCE(balance_cents, 0) + _net_cents,
      total_earned_cents = COALESCE(total_earned_cents, 0) + _net_cents,
      updated_at = now()
  WHERE tenant_id = _tenant_id;

  -- Insert completed deposit transaction with 1% fee_cents and 99% net_amount_cents
  INSERT INTO public.wallet_transactions (
    tenant_id,
    type,
    amount_cents,
    fee_cents,
    net_amount_cents,
    description,
    status,
    payment_id,
    completed_at,
    created_at
  ) VALUES (
    _tenant_id,
    'deposit',
    _amount_cents,
    _fee_cents,
    _net_cents,
    _description,
    'completed',
    _order_id,
    now(),
    now()
  ) RETURNING id INTO _new_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', _new_tx_id,
    'amount_cents', _amount_cents,
    'fee_cents', _fee_cents,
    'net_amount_cents', _net_cents
  );
END;
$$;

-- 2. Update request_wallet_withdrawal: no withdrawal fee (already taken on sale) & no minimum
CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(
  _tenant_id uuid,
  _amount_cents integer,
  _pix_key text,
  _pix_key_type text,
  _description text DEFAULT 'Solicitação de Saque PIX'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_balance integer;
  _fee_cents integer;
  _net_cents integer;
  _new_tx_id uuid;
BEGIN
  IF _amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe um valor válido para saque');
  END IF;

  IF _pix_key IS NULL OR length(trim(_pix_key)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chave PIX obrigatória');
  END IF;

  -- Ensure wallet row exists
  INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents)
  VALUES (_tenant_id, 0, 0, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Lock wallet row
  SELECT balance_cents INTO _current_balance
  FROM public.wallets
  WHERE tenant_id = _tenant_id
  FOR UPDATE;

  IF _current_balance IS NULL OR _current_balance < _amount_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo disponível insuficiente para saque');
  END IF;

  -- No fee on withdrawal because 1% was already deducted upon the sale
  _fee_cents := 0;
  _net_cents := _amount_cents;

  -- Hold the funds: remove from balance_cents, place in locked_balance_cents
  UPDATE public.wallets
  SET balance_cents = balance_cents - _amount_cents,
      locked_balance_cents = COALESCE(locked_balance_cents, 0) + _amount_cents,
      updated_at = now()
  WHERE tenant_id = _tenant_id;

  -- Insert pending transaction
  INSERT INTO public.wallet_transactions (
    tenant_id,
    type,
    amount_cents,
    fee_cents,
    net_amount_cents,
    description,
    status,
    pix_key,
    pix_key_type,
    created_at
  ) VALUES (
    _tenant_id,
    'withdrawal',
    _amount_cents,
    _fee_cents,
    _net_cents,
    COALESCE(_description, 'Solicitação de Saque PIX'),
    'pending',
    _pix_key,
    _pix_key_type,
    now()
  ) RETURNING id INTO _new_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', _new_tx_id,
    'amount_cents', _amount_cents,
    'fee_cents', _fee_cents,
    'net_amount_cents', _net_cents
  );
END;
$$;
