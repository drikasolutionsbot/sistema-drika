
-- Giveaways table
CREATE TABLE public.giveaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  prize text NOT NULL,
  winners_count integer NOT NULL DEFAULT 1,
  ends_at timestamptz NOT NULL,
  channel_id text,
  message_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'canceled')),
  winners jsonb NOT NULL DEFAULT '[]'::jsonb,
  require_role_id text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage giveaways"
  ON public.giveaways FOR ALL
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view giveaways"
  ON public.giveaways FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

-- Giveaway entries table
CREATE TABLE public.giveaway_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id uuid NOT NULL REFERENCES public.giveaways(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  discord_user_id text NOT NULL,
  discord_username text,
  discord_avatar text,
  entered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(giveaway_id, discord_user_id)
);

ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage giveaway entries"
  ON public.giveaway_entries FOR ALL
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view giveaway entries"
  ON public.giveaway_entries FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE INDEX idx_giveaway_entries_giveaway ON public.giveaway_entries(giveaway_id);
CREATE INDEX idx_giveaways_tenant_status ON public.giveaways(tenant_id, status);
