-- Add referral fields to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS referred_by_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS referral_credits_cents integer NOT NULL DEFAULT 0;

-- Add referral config to landing_config
ALTER TABLE public.landing_config
  ADD COLUMN IF NOT EXISTS referral_bonus_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS referral_bonus_credits_cents integer NOT NULL DEFAULT 500;

-- Backfill existing tenants with unique referral codes
UPDATE public.tenants
SET referral_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8))
WHERE referral_code IS NULL;