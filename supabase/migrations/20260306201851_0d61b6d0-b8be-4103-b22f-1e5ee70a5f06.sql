ALTER TABLE public.payment_providers
  ADD COLUMN IF NOT EXISTS efi_cert_pem text,
  ADD COLUMN IF NOT EXISTS efi_key_pem text,
  ADD COLUMN IF NOT EXISTS efi_pix_key text;