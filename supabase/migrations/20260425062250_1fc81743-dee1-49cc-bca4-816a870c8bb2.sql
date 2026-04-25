ALTER TABLE public.products ADD COLUMN IF NOT EXISTS language text;
COMMENT ON COLUMN public.products.language IS 'Idioma do produto (pt-BR, en, de). NULL = usa o idioma do tenant.';