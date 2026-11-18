-- SECURITY LOCKDOWN: carteira / split
-- Problema: policies "Service role can manage ..." eram USING(true) para role PUBLIC,
-- permitindo que anon/authenticated lessem e ALTERASSEM qualquer carteira via REST.
-- Além disso as funções SECURITY DEFINER de carteira eram executáveis por anon/authenticated.
-- Todo o fluxo de escrita roda em Edge Functions com service_role (que ignora RLS).

-- 1. Remove policies permissivas
DROP POLICY IF EXISTS "Service role can manage wallets" ON public.wallets;
DROP POLICY IF EXISTS "Service role can manage transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Owners can create withdrawals" ON public.wallet_transactions;

-- 2. Mantém RLS ativo (somente SELECT por membro/super_admin permanece)
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- 3. Revoga privilégios de tabela: anon sem nada, authenticated só leitura
REVOKE ALL ON public.wallets FROM anon, authenticated;
REVOKE ALL ON public.wallet_transactions FROM anon, authenticated;
GRANT SELECT ON public.wallets TO authenticated;
GRANT SELECT ON public.wallet_transactions TO authenticated;

-- 4. Revoga EXECUTE das funções financeiras (apenas service_role)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'request_wallet_withdrawal','approve_wallet_withdrawal','reject_wallet_withdrawal',
        'credit_order_to_wallet','admin_adjust_wallet','credit_wallet_deposit','debit_wallet_withdrawal'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
