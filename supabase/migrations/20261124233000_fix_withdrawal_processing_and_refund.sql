-- ============================================================================
-- Fix withdrawal state transitions & add safe refund RPC for payouts
-- that were marked completed while actually failing asynchronously on MisticPay.
-- ============================================================================

-- 1. Update request_wallet_withdrawal:
--    - Reject EMV QR ("PIX Copia e Cola" starting with 000201) pasted as PIX key.
--    - Hold funds in locked_balance_cents instead of prematurely incrementing total_withdrawn_cents.
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
SET search_path = public
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
  _clean_key TEXT := trim(COALESCE(_pix_key, ''));
BEGIN
  IF _amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor do saque deve ser maior que zero');
  END IF;

  IF length(_clean_key) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chave PIX obrigatória');
  END IF;

  IF _clean_key ~* '^000201' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você colou um código PIX Copia e Cola em vez de uma chave PIX. Informe sua chave CPF, CNPJ, e-mail, telefone ou chave aleatória.'
    );
  END IF;

  SELECT balance_cents INTO _current_balance
  FROM public.wallets
  WHERE tenant_id = _tenant_id
  FOR UPDATE;

  IF _current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira não encontrada');
  END IF;

  SELECT COUNT(*) INTO _pending_count
  FROM public.wallet_transactions
  WHERE tenant_id = _tenant_id
    AND type = 'withdrawal'
    AND status IN ('pending', 'processing');

  IF _pending_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você já possui 1 saque em andamento. Aguarde a conclusão para solicitar um novo saque.',
      'code', 'PENDING_WITHDRAWAL_EXISTS'
    );
  END IF;

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

  -- Deduct from available balance and place in locked_balance_cents until gateway confirms
  UPDATE public.wallets
  SET balance_cents = balance_cents - _amount_cents,
      locked_balance_cents = COALESCE(locked_balance_cents, 0) + _amount_cents,
      updated_at = now()
  WHERE tenant_id = _tenant_id;

  INSERT INTO public.wallet_transactions (
    tenant_id, type, status, amount_cents, fee_cents, net_amount_cents,
    description, pix_key, pix_key_type
  ) VALUES (
    _tenant_id, 'withdrawal', 'pending', _amount_cents, _fee_cents, _net_cents,
    _description, _clean_key, _pix_key_type
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
      'error', 'Você já possui 1 saque em andamento. Aguarde a conclusão para solicitar um novo saque.',
      'code', 'PENDING_WITHDRAWAL_EXISTS'
    );
END;
$$;

-- 2. Update approve_wallet_withdrawal to accept both 'pending' and 'processing' states.
CREATE OR REPLACE FUNCTION public.approve_wallet_withdrawal(_tx_id uuid, _admin_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF _tx.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'amount_cents', _tx.amount_cents);
  END IF;

  IF _tx.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Transação já está com status %s', _tx.status));
  END IF;

  INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents)
  VALUES (_tx.tenant_id, 0, 0, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  UPDATE public.wallets
  SET locked_balance_cents = GREATEST(0, COALESCE(locked_balance_cents, 0) - _tx.amount_cents),
      total_withdrawn_cents = COALESCE(total_withdrawn_cents, 0) + _tx.amount_cents,
      updated_at = now()
  WHERE tenant_id = _tx.tenant_id;

  UPDATE public.wallet_transactions
  SET status = 'completed',
      completed_at = now(),
      last_error = NULL,
      admin_notes = COALESCE(_admin_notes, admin_notes)
  WHERE id = _tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', _tx_id,
    'amount_cents', _tx.amount_cents,
    'tenant_id', _tx.tenant_id
  );
END;
$function$;

-- 3. Update reject_wallet_withdrawal to accept both 'pending' and 'processing' states.
CREATE OR REPLACE FUNCTION public.reject_wallet_withdrawal(
  _tx_id uuid,
  _rejection_reason text DEFAULT 'Saque recusado pela administração'
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

  IF _tx IS NULL OR NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não encontrada');
  END IF;

  IF _tx.type <> 'withdrawal' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não é um saque');
  END IF;

  IF _tx.status = 'rejected' THEN
    RETURN jsonb_build_object('success', true, 'already_rejected', true, 'refunded_cents', 0, 'tenant_id', _tx.tenant_id);
  END IF;

  IF _tx.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Saque já foi %s e não pode ser rejeitado por esta ação', _tx.status));
  END IF;

  INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents)
  VALUES (_tx.tenant_id, 0, 0, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  UPDATE public.wallets
  SET balance_cents        = COALESCE(balance_cents, 0) + _tx.amount_cents,
      locked_balance_cents = GREATEST(0, COALESCE(locked_balance_cents, 0) - _tx.amount_cents),
      updated_at           = now()
  WHERE tenant_id = _tx.tenant_id;

  UPDATE public.wallet_transactions
  SET status           = 'rejected',
      completed_at     = now(),
      rejection_reason = COALESCE(_rejection_reason, 'Saque recusado pela administração'),
      last_error       = COALESCE(_rejection_reason, last_error)
  WHERE id = _tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', _tx_id,
    'refunded_cents', _tx.amount_cents,
    'tenant_id', _tx.tenant_id
  );
END;
$$;

-- 4. Dedicated RPC for refunding withdrawals confirmed as FAILED on MisticPay
--    even if erroneously transitioned to 'completed' earlier.
CREATE OR REPLACE FUNCTION public.refund_failed_completed_withdrawal(
  _tx_id uuid,
  _rejection_reason text DEFAULT 'PIX recusado/falhou na gateway — valor devolvido ao saldo'
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

  IF _tx IS NULL OR NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não encontrada');
  END IF;

  IF _tx.type <> 'withdrawal' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não é um saque');
  END IF;

  IF _tx.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_rejected', true,
      'refunded_cents', 0,
      'tenant_id', _tx.tenant_id
    );
  END IF;

  IF _tx.status NOT IN ('pending', 'processing', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Status inválido para estorno: %s', _tx.status));
  END IF;

  INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents)
  VALUES (_tx.tenant_id, 0, 0, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  UPDATE public.wallets
  SET balance_cents         = COALESCE(balance_cents, 0) + _tx.amount_cents,
      locked_balance_cents  = CASE WHEN _tx.status IN ('pending', 'processing')
                                THEN GREATEST(0, COALESCE(locked_balance_cents, 0) - _tx.amount_cents)
                                ELSE COALESCE(locked_balance_cents, 0)
                              END,
      total_withdrawn_cents = CASE WHEN _tx.status = 'completed'
                                THEN GREATEST(0, COALESCE(total_withdrawn_cents, 0) - _tx.amount_cents)
                                ELSE COALESCE(total_withdrawn_cents, 0)
                              END,
      updated_at            = now()
  WHERE tenant_id = _tx.tenant_id;

  UPDATE public.wallet_transactions
  SET status           = 'rejected',
      completed_at     = now(),
      rejection_reason = COALESCE(_rejection_reason, 'PIX recusado/falhou na gateway — valor devolvido ao saldo'),
      last_error       = COALESCE(_rejection_reason, last_error)
  WHERE id = _tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', _tx_id,
    'previous_status', _tx.status,
    'refunded_cents', _tx.amount_cents,
    'tenant_id', _tx.tenant_id
  );
END;
$$;

-- Preserve strict RPC access lock (service_role only)
REVOKE ALL ON FUNCTION public.request_wallet_withdrawal(uuid, bigint, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_wallet_withdrawal(uuid, bigint, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.approve_wallet_withdrawal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_wallet_withdrawal(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.reject_wallet_withdrawal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_wallet_withdrawal(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.refund_failed_completed_withdrawal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_failed_completed_withdrawal(uuid, text) TO service_role;
