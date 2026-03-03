-- Add icon_url, banner_url and auto_delivery columns to products
ALTER TABLE public.products
ADD COLUMN icon_url text,
ADD COLUMN banner_url text,
ADD COLUMN auto_delivery boolean NOT NULL DEFAULT false;