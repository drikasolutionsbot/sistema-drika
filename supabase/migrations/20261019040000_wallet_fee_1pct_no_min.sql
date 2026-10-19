-- Migration: Change platform fee to 1% and remove minimum withdrawal amount
-- Updated request_wallet_withdrawal function

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
  -- Sem valor mínimo para saque: apenas deve ser maior que 0
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

  -- Calculate 1% platform fee
  _fee_cents := ROUND(_amount_cents * 0.01);
  _net_cents := _amount_cents - _fee_cents;

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
