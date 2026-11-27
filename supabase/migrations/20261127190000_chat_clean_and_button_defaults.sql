-- ============================================================================
-- 1. Product buttons: dark gray (secondary) default + migrate existing green defaults
-- 2. Channel auto-clean schedules table & /limpar default bot command seed
-- ============================================================================

ALTER TABLE public.products
  ALTER COLUMN button_style SET DEFAULT 'secondary';

UPDATE public.products
SET button_style = 'secondary'
WHERE button_style IS NULL OR button_style = 'success';

-- 2. Scheduled auto-clean table per Discord channel
CREATE TABLE IF NOT EXISTS public.channel_clean_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  discord_channel_id TEXT NOT NULL,
  channel_name TEXT,
  interval_minutes INT NOT NULL DEFAULT 60 CHECK (interval_minutes >= 5 AND interval_minutes <= 10080),
  keep_pinned BOOLEAN NOT NULL DEFAULT true,
  post_summary BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_cleaned_at TIMESTAMPTZ,
  last_deleted_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, discord_channel_id)
);

ALTER TABLE public.channel_clean_schedules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.channel_clean_schedules FROM anon;
REVOKE ALL ON TABLE public.channel_clean_schedules FROM authenticated;
GRANT ALL ON TABLE public.channel_clean_schedules TO service_role;

-- 3. Ensure existing tenants have /clear and /limpar registered with full options
UPDATE public.bot_commands
SET
  description = 'Limpa mensagens do canal (somente Admins)',
  category = 'Moderação',
  options = '[
    {"name": "quantidade", "description": "Quantidade de mensagens (1-100, deixe vazio para limpar tudo)", "type": 4, "required": false},
    {"name": "manter_fixadas", "description": "Manter mensagens fixadas (padrão: sim)", "type": 5, "required": false}
  ]'::jsonb,
  updated_at = now()
WHERE name = '/clear';

INSERT INTO public.bot_commands (tenant_id, name, description, category, enabled, is_default, options)
SELECT
  t.id,
  '/clear',
  'Limpa mensagens do canal (somente Admins)',
  'Moderação',
  true,
  true,
  '[
    {"name": "quantidade", "description": "Quantidade de mensagens (1-100, deixe vazio para limpar tudo)", "type": 4, "required": false},
    {"name": "manter_fixadas", "description": "Manter mensagens fixadas (padrão: sim)", "type": 5, "required": false}
  ]'::jsonb
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO public.bot_commands (tenant_id, name, description, category, enabled, is_default, options)
SELECT
  t.id,
  '/limpar',
  'Limpa mensagens do canal (somente Admins)',
  'Moderação',
  true,
  true,
  '[
    {"name": "quantidade", "description": "Quantidade de mensagens (1-100, deixe vazio para limpar tudo)", "type": 4, "required": false},
    {"name": "manter_fixadas", "description": "Manter mensagens fixadas (padrão: sim)", "type": 5, "required": false}
  ]'::jsonb
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;
