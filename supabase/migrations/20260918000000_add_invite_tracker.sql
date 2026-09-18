CREATE TABLE IF NOT EXISTS public.invite_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    regular INT DEFAULT 0,
    "left" INT DEFAULT 0,
    fake INT DEFAULT 0,
    bonus INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.invite_joins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    invited_id TEXT NOT NULL,
    inviter_id TEXT,
    invite_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, invited_id)
);

-- Enable RLS
ALTER TABLE public.invite_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_joins ENABLE ROW LEVEL SECURITY;

-- Create policies for invite_counts
CREATE POLICY "Enable all for authenticated users on invite_counts"
ON public.invite_counts FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable read for public on invite_counts"
ON public.invite_counts FOR SELECT
TO anon
USING (true);

-- Create policies for invite_joins
CREATE POLICY "Enable all for authenticated users on invite_joins"
ON public.invite_joins FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
