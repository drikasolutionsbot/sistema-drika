-- Add pix_brcode column to orders table to store PIX copy-paste code
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pix_brcode TEXT;
