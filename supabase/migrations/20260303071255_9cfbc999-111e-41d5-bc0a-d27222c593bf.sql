
-- Welcome message configurations per tenant
CREATE TABLE public.welcome_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  
  -- Channel welcome
  channel_enabled boolean NOT NULL DEFAULT true,
  channel_id text,
  
  -- DM welcome
  dm_enabled boolean NOT NULL DEFAULT false,
  
  -- Welcome embed data
  embed_data jsonb NOT NULL DEFAULT '{
    "color": "#57F287",
    "title": "Bem-vindo(a)! 🎉",
    "description": "Ficamos felizes em ter você aqui!",
    "thumbnail_url": "",
    "image_url": "",
    "footer_text": "Aproveite sua estadia!",
    "footer_icon_url": "",
    "timestamp": true,
    "fields": []
  }'::jsonb,
  
  -- DM embed data (separate config)
  dm_embed_data jsonb NOT NULL DEFAULT '{
    "color": "#5865F2",
    "title": "Bem-vindo(a) ao servidor! 💬",
    "description": "Obrigado por entrar! Confira nossos canais.",
    "thumbnail_url": "",
    "image_url": "",
    "footer_text": "",
    "footer_icon_url": "",
    "timestamp": false,
    "fields": []
  }'::jsonb,
  
  -- Auto role
  auto_role_enabled boolean NOT NULL DEFAULT false,
  auto_role_id text,
  
  -- Welcome message content (plain text above embed)
  content text DEFAULT '',
  dm_content text DEFAULT '',
  
  -- Goodbye
  goodbye_enabled boolean NOT NULL DEFAULT false,
  goodbye_channel_id text,
  goodbye_embed_data jsonb NOT NULL DEFAULT '{
    "color": "#ED4245",
    "title": "Até logo! 👋",
    "description": "{user} saiu do servidor.",
    "thumbnail_url": "",
    "image_url": "",
    "footer_text": "",
    "footer_icon_url": "",
    "timestamp": true,
    "fields": []
  }'::jsonb,
  goodbye_content text DEFAULT '',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id)
);

ALTER TABLE public.welcome_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage welcome configs"
  ON public.welcome_configs FOR ALL
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Members can view welcome configs"
  ON public.welcome_configs FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));
