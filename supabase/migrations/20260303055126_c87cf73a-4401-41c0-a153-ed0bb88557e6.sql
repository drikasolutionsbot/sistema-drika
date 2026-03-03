
-- Table to store verified members with OAuth2 tokens and role backup
CREATE TABLE public.verified_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  discord_user_id text NOT NULL,
  discord_username text,
  discord_avatar text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamp with time zone,
  roles_backup jsonb DEFAULT '[]'::jsonb,
  nickname text,
  verified_at timestamp with time zone NOT NULL DEFAULT now(),
  last_restore_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, discord_user_id)
);

-- Enable RLS
ALTER TABLE public.verified_members ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view verified members"
ON public.verified_members FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage verified members"
ON public.verified_members FOR ALL
USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Service role can manage verified members"
ON public.verified_members FOR ALL
USING (true)
WITH CHECK (true);

-- Add verification settings to tenants
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS verify_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verify_redirect_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verify_role_id text DEFAULT NULL;

-- Index for fast lookups
CREATE INDEX idx_verified_members_tenant_discord ON public.verified_members(tenant_id, discord_user_id);
