ALTER TABLE public.store_configs
  ADD COLUMN IF NOT EXISTS ticket_embed_how_it_works_title text DEFAULT 'Como funciona?';
