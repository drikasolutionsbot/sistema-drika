-- Migration to add allow_customization_on_trial column to landing_config
ALTER TABLE public.landing_config ADD COLUMN IF NOT EXISTS allow_customization_on_trial boolean DEFAULT false NOT NULL;
