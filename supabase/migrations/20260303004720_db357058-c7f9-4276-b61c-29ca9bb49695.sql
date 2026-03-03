-- Add bot_token column for each tenant's own Discord bot
ALTER TABLE public.tenants ADD COLUMN bot_token_encrypted text;

-- Add bot_client_id for the Discord application client ID
ALTER TABLE public.tenants ADD COLUMN bot_client_id text;