-- ============================================================================
-- SECURITY LOCKDOWN:
-- 1. Hide global payment gateway secret columns in landing_config from anon
-- 2. Lock down debug_logs table (enable RLS & revoke anon/authenticated access)
-- 3. Rotate all active access_tokens so any token previously leaked via
--    unauthenticated get-tenant is immediately invalidated
-- ============================================================================

-- 1. In PostgreSQL, table-level SELECT overrides column-level REVOKE.
-- So we first REVOKE table-level SELECT from anon, then GRANT SELECT only on
-- non-secret columns of public.landing_config to anon.
REVOKE SELECT ON public.landing_config FROM anon;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'landing_config'
    AND column_name NOT IN (
      'misticpay_client_id',
      'misticpay_client_secret',
      'efi_client_id',
      'efi_client_secret',
      'efi_cert_pem',
      'efi_key_pem',
      'pushinpay_api_key',
      'abacatepay_api_key'
    );

  IF cols IS NOT NULL THEN
    EXECUTE format('GRANT SELECT (%s) ON public.landing_config TO anon', cols);
  END IF;
END $$;

-- 2. Lock down debug_logs (should never be readable or writable by anon/authenticated)
ALTER TABLE IF EXISTS public.debug_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.debug_logs FROM anon, authenticated;

-- 3. Rotate all active access_tokens to invalidate any token leaked prior to lockdown
UPDATE public.access_tokens
SET
  token = replace(gen_random_uuid()::text, '-', ''),
  expires_at = now() + interval '365 days'
WHERE revoked = false;
