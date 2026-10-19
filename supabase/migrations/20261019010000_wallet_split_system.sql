-- Wallet & Split System migration
-- Adds locked_balance_cents to wallets, fee/net columns to wallet_transactions, and functions for withdrawal/approval/credit

-- 1. Alter wallets table
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS locked_balance_cents integer NOT NULL DEFAULT 0;

-- 2. Alter wallet_transactions table
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pix_key_type text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS approved_by text;

-- Update constraints on wallet_transactions to allow 'adjustment' type and 'processing' status
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check 
  CHECK (type IN ('deposit', 'withdrawal', 'adjustment'));

ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_status_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_status_check 
  CHECK (status IN ('pending', 'completed', 'rejected', 'processing'));

-- 3. RLS: allow super admins to read all wallets and transactions
DROP POLICY IF EXISTS "Super admins can view all wallets" ON public.wallets;
CREATE POLICY "Super admins can view all wallets"
  ON public.wallets FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Super admins can view all transactions" ON public.wallet_transactions;
CREATE POLICY "Super admins can view all transactions"
  ON public.wallet_transactions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- 4. Function: request_wallet_withdrawal (Min R$ 5,00, 2% platform fee, manual approval)
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
  IF _amount_cents < 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor mínimo para saque é de R$ 5,00');
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

  -- Calculate 2% platform fee
  _fee_cents := ROUND(_amount_cents * 0.02);
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

-- 5. Function: approve_wallet_withdrawal (Admin manual approval)
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

  IF _tx.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não está pendente de aprovação');
  END IF;

  -- Release locked balance and increment total_withdrawn_cents
  UPDATE public.wallets
  SET locked_balance_cents = GREATEST(0, COALESCE(locked_balance_cents, 0) - _tx.amount_cents),
      total_withdrawn_cents = COALESCE(total_withdrawn_cents, 0) + _tx.amount_cents,
      updated_at = now()
  WHERE tenant_id = _tx.tenant_id;

  UPDATE public.wallet_transactions
  SET status = 'completed',
      completed_at = now(),
      admin_notes = _admin_notes
  WHERE id = _tx_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Function: reject_wallet_withdrawal (Admin rejection with reason)
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

  IF _tx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não encontrada');
  END IF;

  IF _tx.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não está pendente');
  END IF;

  -- Refund locked balance back to balance_cents
  UPDATE public.wallets
  SET balance_cents = COALESCE(balance_cents, 0) + _tx.amount_cents,
      locked_balance_cents = GREATEST(0, COALESCE(locked_balance_cents, 0) - _tx.amount_cents),
      updated_at = now()
  WHERE tenant_id = _tx.tenant_id;

  UPDATE public.wallet_transactions
  SET status = 'rejected',
      completed_at = now(),
      rejection_reason = _rejection_reason
  WHERE id = _tx_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Function: credit_order_to_wallet (Automatic deposit on paid orders)
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

  -- Ensure wallet row exists
  INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents)
  VALUES (_tenant_id, 0, 0, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Add to balance_cents and total_earned_cents
  UPDATE public.wallets
  SET balance_cents = COALESCE(balance_cents, 0) + _amount_cents,
      total_earned_cents = COALESCE(total_earned_cents, 0) + _amount_cents,
      updated_at = now()
  WHERE tenant_id = _tenant_id;

  -- Insert completed deposit transaction
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
    0,
    _amount_cents,
    _description,
    'completed',
    _order_id,
    now(),
    now()
  ) RETURNING id INTO _new_tx_id;

  RETURN jsonb_build_object('success', true, 'tx_id', _new_tx_id);
END;
$$;

-- 8. Function: admin_adjust_wallet (Manual admin adjustment)
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
  _tenant_id uuid,
  _amount_cents integer,
  _reason text DEFAULT 'Ajuste administrativo'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx_id uuid;
BEGIN
  -- Ensure wallet row exists
  INSERT INTO public.wallets (tenant_id, balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents)
  VALUES (_tenant_id, 0, 0, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  UPDATE public.wallets
  SET balance_cents = GREATEST(0, COALESCE(balance_cents, 0) + _amount_cents),
      updated_at = now()
  WHERE tenant_id = _tenant_id;

  INSERT INTO public.wallet_transactions (
    tenant_id,
    type,
    amount_cents,
    fee_cents,
    net_amount_cents,
    description,
    status,
    completed_at,
    created_at
  ) VALUES (
    _tenant_id,
    'adjustment',
    ABS(_amount_cents),
    0,
    ABS(_amount_cents),
    'Ajuste Administrativo: ' || COALESCE(_reason, 'Sem justificativa'),
    'completed',
    now(),
    now()
  ) RETURNING id INTO _tx_id;

  RETURN jsonb_build_object('success', true, 'tx_id', _tx_id);
END;
$$;
