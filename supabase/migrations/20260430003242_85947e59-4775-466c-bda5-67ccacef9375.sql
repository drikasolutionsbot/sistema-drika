
-- Adicionar moeda nos produtos (BRL padrão; aceita USD, EUR)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL';

-- Adicionar webhook secret da Stripe na tabela de provedores
ALTER TABLE public.payment_providers
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret text;
