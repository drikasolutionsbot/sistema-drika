-- Add PIX key fields to tenants table
ALTER TABLE public.tenants
ADD COLUMN pix_key TEXT DEFAULT NULL,
ADD COLUMN pix_key_type TEXT DEFAULT NULL;

-- pix_key_type: 'cpf', 'cnpj', 'email', 'telefone', 'aleatoria'

COMMENT ON COLUMN public.tenants.pix_key IS 'Static PIX key for QR code generation';
COMMENT ON COLUMN public.tenants.pix_key_type IS 'Type of PIX key: cpf, cnpj, email, telefone, aleatoria';