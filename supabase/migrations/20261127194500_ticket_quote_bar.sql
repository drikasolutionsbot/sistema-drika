ALTER TABLE public.store_configs
  ADD COLUMN IF NOT EXISTS ticket_embed_quote_bar boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ticket_embed_select_placeholder text DEFAULT '➡️ Clique aqui para ver as opções';
