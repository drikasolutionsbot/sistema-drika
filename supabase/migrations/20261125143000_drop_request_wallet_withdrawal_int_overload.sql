-- Drop legacy integer-typed overload of request_wallet_withdrawal so PostgREST
-- unambiguously resolves public.request_wallet_withdrawal(uuid, bigint, text, text, text).
DROP FUNCTION IF EXISTS public.request_wallet_withdrawal(uuid, integer, text, text, text);

-- Ensure strict service_role permissions remain active and reload PostgREST schema cache
REVOKE ALL ON FUNCTION public.request_wallet_withdrawal(uuid, bigint, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_wallet_withdrawal(uuid, bigint, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
