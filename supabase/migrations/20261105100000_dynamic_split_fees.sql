-- Migration: Dynamic Split Fees configured via landing_config
-- Allows owner to define fixed fee (R$) + percent fee (%) dynamically

ALTER TABLE public.landing_config
  ADD COLUMN IF NOT EXISTS split_fixed_fee_cents integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS split_percent_fee numeric(5,2) NOT NULL DEFAULT 2.00;

COMMENT ON COLUMN public.landing_config.split_fixed_fee_cents IS 'Taxa fixa em centavos retida por venda no Split (ex: 100 = R$ 1,00)';
COMMENT ON COLUMN public.landing_config.split_percent_fee IS 'Taxa percentual retida por venda no Split (ex: 2.00 = 2%)';

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
  _fixed_fee_cents integer;
  _percent_fee numeric;
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

  -- Lê taxas configuradas dinamicamente na landing_config
  SELECT 
    COALESCE(split_fixed_fee_cents, 100),
    COALESCE(split_percent_fee, 2.0)
  INTO 
    _fixed_fee_cents,
    _percent_fee
  FROM public.landing_config
  LIMIT 1;

  IF _fixed_fee_cents IS NULL THEN
    _fixed_fee_cents := 100;
  END IF;
  IF _percent_fee IS NULL THEN
    _percent_fee := 2.0;
  END IF;

  -- Taxa Percentual: % sobre o valor bruto da venda
  _platform_fee_cents := ROUND(_amount_cents * (_percent_fee / 100.0));

  -- Total de taxas deduzidas do lojista (Taxa Fixa + Taxa Percentual)
  _fee_cents := _fixed_fee_cents + _platform_fee_cents;

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

  -- Atualiza o pedido com os centavos retidos de comissão e recebidos pelo lojista
  UPDATE public.orders
  SET commission_cents = _fee_cents,
      seller_received_cents = _net_cents
  WHERE id::text = _order_id OR id::text = REPLACE(_order_id, 'order_', '');

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', _new_tx_id,
    'amount_cents', _amount_cents,
    'fixed_fee_cents', _fixed_fee_cents,
    'percent_fee', _percent_fee,
    'platform_fee_cents', _platform_fee_cents,
    'fee_cents', _fee_cents,
    'net_amount_cents', _net_cents
  );
END;
$$;

