-- Migration: Add MisticPay central gateway columns to landing_config
ALTER TABLE public.landing_config
  ADD COLUMN IF NOT EXISTS misticpay_active        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS misticpay_client_id     text,
  ADD COLUMN IF NOT EXISTS misticpay_client_secret text;

COMMENT ON COLUMN public.landing_config.misticpay_active IS 'Whether MisticPay is active as the Central Platform Gateway for Split & Wallet mode';
COMMENT ON COLUMN public.landing_config.misticpay_client_id IS 'MisticPay Client ID (pk_...) for Central Platform Gateway';
COMMENT ON COLUMN public.landing_config.misticpay_client_secret IS 'MisticPay Client Secret (sk_...) for Central Platform Gateway';

