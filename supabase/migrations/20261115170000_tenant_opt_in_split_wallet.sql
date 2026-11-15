ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS use_split_wallet BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenants.use_split_wallet IS
  'Permite que assinantes de planos pagos (Pro/Master) ativem opcionalmente o sistema de Carteira & Split Global (pagando as mesmas taxas padrão do plano Free em vez de usar gateways próprias).';
