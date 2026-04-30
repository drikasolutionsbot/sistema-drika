ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL';
COMMENT ON COLUMN public.orders.currency IS 'Currency snapshot from product at order creation (BRL, USD, EUR)';