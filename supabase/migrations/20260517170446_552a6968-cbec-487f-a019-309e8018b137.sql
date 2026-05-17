ALTER TABLE public.landing_config
ADD COLUMN IF NOT EXISTS global_marketplace_embed_template jsonb NOT NULL DEFAULT jsonb_build_object(
  'title', '{product_name}',
  'description', '{product_description}',
  'color', '#FF1493',
  'footer', 'Marketplace Global • DRIKA HUB',
  'show_price', true,
  'show_seller', true,
  'show_category', true,
  'show_thumbnail', true,
  'show_banner', true,
  'button_label', 'Comprar',
  'button_emoji', '🛒',
  'button_style', 1
);