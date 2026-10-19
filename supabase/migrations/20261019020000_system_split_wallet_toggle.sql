-- Migration: Add system_split_wallet row to platform_gateway_settings
-- Enables/disables the central split & wallet system across the platform and external bot

INSERT INTO public.platform_gateway_settings (gateway_key, enabled, visible, updated_at)
VALUES ('system_split_wallet', true, true, now())
ON CONFLICT (gateway_key) DO NOTHING;
