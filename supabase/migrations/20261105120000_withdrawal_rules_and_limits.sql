-- Migration: Withdrawal rules and limits (Min R$ 10,00, 1 Free Withdrawal per Week, R$ 1,00 fee on subsequent)
-- Adds dynamic config to landing_config and enhances request_wallet_withdrawal

ALTER TABLE public.landing_config
  ADD COLUMN IF NOT EXISTS min_withdrawal_cents integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS withdrawal_fee_cents integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS weekly_free_withdrawals integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.landing_config.min_withdrawal_cents IS 'Valor mínimo em centavos para solicitação de saque (ex: 1000 = R$ 10,00)';
COMMENT ON COLUMN public.landing_config.withdrawal_fee_cents IS 'Taxa fixa em centavos cobrada a partir do 2º saque da semana (ex: 100 = R$ 1,00)';
COMMENT ON COLUMN public.landing_config.weekly_free_withdrawals IS 'Quantidade de saques gratuitos concedidos por semana ao lojista (padrão: 1)';

-- Enhanced request_wallet_withdrawal with dynamic weekly free saque + fee deduction
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
  _min_withdrawal_cents integer;
  _withdrawal_fee_cents integer;
  _weekly_free_withdrawals integer;
  _withdrawals_this_week integer;
  _fee_cents integer := 0;
  _net_cents integer := 0;
  _is_free boolean := true;
  _new_tx_id uuid;
  _start_of_week timestamptz;
BEGIN
  IF _amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe um valor válido para saque');
  END IF;

  IF _pix_key IS NULL OR length(trim(_pix_key)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chave PIX obrigatória');
  END IF;

  -- Lê configurações globais de saque da landing_config
  SELECT 
    COALESCE(min_withdrawal_cents, 1000),
    COALESCE(withdrawal_fee_cents, 100),
    COALESCE(weekly_free_withdrawals, 1)
  INTO 
    _min_withdrawal_cents,
    _withdrawal_fee_cents,
    _weekly_free_withdrawals
  FROM public.landing_config
  LIMIT 1;

  IF _min_withdrawal_cents IS NULL THEN _min_withdrawal_cents := 1000; END IF;
  IF _withdrawal_fee_cents IS NULL THEN _withdrawal_fee_cents := 100; END IF;
  IF _weekly_free_withdrawals IS NULL THEN _weekly_free_withdrawals := 1; END IF;

  -- Validação de Valor Mínimo de Saque
  IF _amount_cents < _min_withdrawal_cents THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('O valor mínimo para solicitação de saque é de R$ %s', trim(to_char(_min_withdrawal_cents / 100.0, '999990D00')))
    );
  END IF;

  -- Garante linha de carteira
  INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents)
  VALUES (_tenant_id, 0, 0, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Bloqueia a linha da carteira para leitura e atualização segura
  SELECT balance_cents INTO _current_balance
  FROM public.wallets
  WHERE tenant_id = _tenant_id
  FOR UPDATE;

  IF _current_balance IS NULL OR _current_balance < _amount_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo disponível insuficiente para saque');
  END IF;

  -- Início da semana atual (Segunda-feira 00:00:00 fuso de Brasília)
  _start_of_week := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';

  -- Conta saques já solicitados/processados nesta semana pelo lojista
  SELECT count(*) INTO _withdrawals_this_week
  FROM public.wallet_transactions
  WHERE tenant_id = _tenant_id
    AND type = 'withdrawal'
    AND status IN ('pending', 'completed', 'processing')
    AND created_at >= _start_of_week;

  -- Aplica a regra: 1 saque grátis por semana. Passou de 1, desconta R$ 1,00 de taxa
  IF COALESCE(_withdrawals_this_week, 0) < _weekly_free_withdrawals THEN
    _fee_cents := 0;
    _is_free := true;
  ELSE
    _fee_cents := _withdrawal_fee_cents;
    _is_free := false;
  END IF;

  -- Valor líquido que será transferido no PIX (mínimo 0)
  _net_cents := GREATEST(0, _amount_cents - _fee_cents);

  IF _net_cents < 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor líquido do saque após taxas deve ser de no mínimo R$ 1,00');
  END IF;

  -- Retém os fundos da carteira: debita do saldo livre e adiciona ao saldo bloqueado (em custódia)
  UPDATE public.wallets
  SET balance_cents = balance_cents - _amount_cents,
      locked_balance_cents = COALESCE(locked_balance_cents, 0) + _amount_cents,
      updated_at = now()
  WHERE tenant_id = _tenant_id;

  -- Insere o registro de transação com auditoria completa de taxas
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
    admin_notes,
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
    CASE 
      WHEN _is_free THEN '1º saque da semana (Isento de taxa)'
      ELSE format('Taxa de saque de R$ %s retida (saque adicional na semana)', trim(to_char(_fee_cents / 100.0, '999990D00')))
    END,
    now()
  ) RETURNING id INTO _new_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', _new_tx_id,
    'amount_cents', _amount_cents,
    'fee_cents', _fee_cents,
    'net_amount_cents', _net_cents,
    'is_free', _is_free,
    'withdrawals_this_week', _withdrawals_this_week
  );
END;
$$;

