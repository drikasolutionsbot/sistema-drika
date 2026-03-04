
ALTER TABLE public.landing_config
  ADD COLUMN pushinpay_api_key text,
  ADD COLUMN pushinpay_active boolean NOT NULL DEFAULT false,
  ADD COLUMN pro_price_cents integer NOT NULL DEFAULT 2690;
