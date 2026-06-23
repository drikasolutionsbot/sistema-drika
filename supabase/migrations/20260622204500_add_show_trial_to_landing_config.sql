-- Migration to add show_trial column to landing_config
ALTER TABLE public.landing_config ADD COLUMN IF NOT EXISTS show_trial boolean DEFAULT true NOT NULL;
