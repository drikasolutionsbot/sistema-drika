
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
