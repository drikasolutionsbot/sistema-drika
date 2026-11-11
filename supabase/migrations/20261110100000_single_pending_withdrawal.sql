-- Bloqueia mais de 1 solicitação de saque pendente simultânea por loja (tenant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_withdrawal_per_tenant
  ON public.wallet_transactions (tenant_id)
  WHERE type = 'withdrawal' AND status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(
  _tenant_id UUID,
  _amount_cents BIGINT,
  _pix_key TEXT,
  _pix_key_type TEXT DEFAULT 'aleatoria',
  _description TEXT DEFAULT 'Solicitação de Saque PIX'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _current_balance BIGINT;
  _tx_id UUID;
  _fee_cents BIGINT := 0;
  _net_cents BIGINT;
  _min_withdrawal BIGINT := 1000;
  _standard_fee BIGINT := 100;
  _free_per_week INT := 1;
  _withdrawals_this_week INT := 0;
  _start_of_week TIMESTAMPTZ;
  _pending_count INT := 0;
BEGIN
  IF _amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor do saque deve ser maior que zero');
  END IF;

  -- Lock wallet row para impedir condição de corrida (clique duplo simultâneo)
  SELECT balance_cents INTO _current_balance
  FROM public.wallets
  WHERE tenant_id = _tenant_id
  FOR UPDATE;

  IF _current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira não encontrada');
  END IF;

  -- Bloqueia nova solicitação enquanto houver saque pendente ou em processamento
  SELECT COUNT(*) INTO _pending_count
  FROM public.wallet_transactions
  WHERE tenant_id = _tenant_id
    AND type = 'withdrawal'
    AND status IN ('pending', 'processing');

  IF _pending_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você já possui 1 saque pendente. Aguarde a aprovação para solicitar um novo saque.',
      'code', 'PENDING_WITHDRAWAL_EXISTS'
    );
  END IF;

  -- Read config rules
  SELECT
    COALESCE(min_withdrawal_cents, 1000),
    COALESCE(withdrawal_fee_cents, 100),
    COALESCE(weekly_free_withdrawals, 1)
  INTO _min_withdrawal, _standard_fee, _free_per_week
  FROM public.landing_config
  LIMIT 1;

  IF _amount_cents < _min_withdrawal THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor mínimo para saque é R$ ' || TRIM(TO_CHAR(_min_withdrawal / 100.0, '999G990D00')));
  END IF;

  IF _current_balance < _amount_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente para realizar este saque');
  END IF;

  -- Check how many withdrawals this tenant made in the current week (starting Monday 00:00 BRT)
  _start_of_week := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';

  SELECT COUNT(*) INTO _withdrawals_this_week
  FROM public.wallet_transactions
  WHERE tenant_id = _tenant_id
    AND type = 'withdrawal'
    AND status IN ('pending', 'completed', 'processing')
    AND created_at >= _start_of_week;

  IF _withdrawals_this_week < _free_per_week THEN
    _fee_cents := 0;
  ELSE
    _fee_cents := _standard_fee;
  END IF;

  IF _amount_cents <= _fee_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor do saque deve ser superior à taxa de saque');
  END IF;

  _net_cents := _amount_cents - _fee_cents;

  -- Deduct from available balance and add to total_withdrawn
  UPDATE public.wallets
  SET balance_cents = balance_cents - _amount_cents,
      total_withdrawn_cents = total_withdrawn_cents + _amount_cents,
      updated_at = now()
  WHERE tenant_id = _tenant_id;

  -- Create pending withdrawal transaction
  INSERT INTO public.wallet_transactions (
    tenant_id, type, status, amount_cents, fee_cents, net_amount_cents,
    description, pix_key, pix_key_type
  ) VALUES (
    _tenant_id, 'withdrawal', 'pending', _amount_cents, _fee_cents, _net_cents,
    _description, _pix_key, _pix_key_type
  ) RETURNING id INTO _tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', _tx_id,
    'amount_cents', _amount_cents,
    'fee_cents', _fee_cents,
    'net_amount_cents', _net_cents,
    'is_free', (_fee_cents = 0),
    'new_balance_cents', _current_balance - _amount_cents
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você já possui 1 saque pendente. Aguarde a aprovação para solicitar um novo saque.',
      'code', 'PENDING_WITHDRAWAL_EXISTS'
    );
END;
$$;

