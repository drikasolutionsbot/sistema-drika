-- Migration: Add ColdPayments gateway columns to landing_config
-- ColdPayments is used as a Central Platform Gateway in Split & Wallet mode

ALTER TABLE public.landing_config
  ADD COLUMN IF NOT EXISTS coldpayments_api_key        text,
  ADD COLUMN IF NOT EXISTS coldpayments_active         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coldpayments_webhook_secret text;

COMMENT ON COLUMN public.landing_config.coldpayments_api_key IS 'ColdPayments secret key (sk_live_...) for Central Platform Gateway';
COMMENT ON COLUMN public.landing_config.coldpayments_active IS 'Whether ColdPayments is the active central gateway for Split & Wallet mode';
COMMENT ON COLUMN public.landing_config.coldpayments_webhook_secret IS 'HMAC-SHA256 secret for validating ColdPayments webhook signatures';
