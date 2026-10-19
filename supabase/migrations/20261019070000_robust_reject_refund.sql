-- Migration: Robustez no estorno de saque rejeitado
-- Garante que ao rejeitar (status pending), o valor bloqueado
-- volta corretamente para balance_cents, mesmo em edge cases.

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
  -- Carrega e bloqueia a linha da transação
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

  IF _tx.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Saque já foi %s e não pode ser rejeitado', _tx.status));
  END IF;

  -- Garante linha de carteira (segurança)
  INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents)
  VALUES (_tx.tenant_id, 0, 0, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Devolve o valor travado para o saldo disponível do cliente
  UPDATE public.wallets
  SET balance_cents       = COALESCE(balance_cents, 0) + _tx.amount_cents,
      locked_balance_cents = GREATEST(0, COALESCE(locked_balance_cents, 0) - _tx.amount_cents),
      updated_at           = now()
  WHERE tenant_id = _tx.tenant_id;

  -- Marca transação como rejeitada
  UPDATE public.wallet_transactions
  SET status           = 'rejected',
      completed_at     = now(),
      rejection_reason = COALESCE(_rejection_reason, 'Saque recusado pela administração')
  WHERE id = _tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'tx_id', _tx_id,
    'refunded_cents', _tx.amount_cents,
    'tenant_id', _tx.tenant_id
  );
END;
$$;

-- Garante que a coluna rejection_reason existe (compatibilidade)
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Garante que a coluna admin_notes existe (compatibilidade)
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS admin_notes text;
