-- Migration: Taxa Gateway R$0,60 fixo + 2% Plataforma na venda
-- Aplicado no momento da venda (descontado da carteira do lojista).
-- O comprador paga o valor normal; o lojista recebe: valor - R$0,60 - 2%.

-- Atualiza credit_order_to_wallet: R$0,60 gateway + 2% plataforma
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
  _gateway_fee_cents integer;
  _platform_fee_cents integer;
  _fee_cents integer;
  _net_cents integer;
BEGIN
  IF _amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Valor inválido');
  END IF;

  -- Idempotência: evita crédito duplo no mesmo pedido
  SELECT id INTO _existing_id
  FROM public.wallet_transactions
  WHERE tenant_id = _tenant_id AND payment_id = _order_id AND type = 'deposit'
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_credited', true, 'tx_id', _existing_id);
  END IF;

  -- Taxa Gateway: R$0,60 fixo (60 centavos)
  _gateway_fee_cents := 60;

  -- Taxa Plataforma: 2% do valor da venda (lucro da plataforma)
  _platform_fee_cents := ROUND(_amount_cents * 0.02);

  -- Total de taxas deduzidas do lojista
  _fee_cents := _gateway_fee_cents + _platform_fee_cents;

  -- Valor líquido creditado ao lojista (mínimo 0)
  _net_cents := GREATEST(0, _amount_cents - _fee_cents);

  -- Garante linha de carteira
  INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents)
  VALUES (_tenant_id, 0, 0, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Credita valor líquido na carteira do lojista
  UPDATE public.wallets
  SET balance_cents = COALESCE(balance_cents, 0) + _net_cents,
      total_earned_cents = COALESCE(total_earned_cents, 0) + _net_cents,
      updated_at = now()
  WHERE tenant_id = _tenant_id;

  -- Insere transação de depósito com breakdown completo
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
    'gateway_fee_cents', _gateway_fee_cents,
    'platform_fee_cents', _platform_fee_cents,
    'fee_cents', _fee_cents,
    'net_amount_cents', _net_cents
  );
END;
$$;
