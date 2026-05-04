ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_thread_archive_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_thread_archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_thread_archive_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkout_thread_archive_error TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_checkout_thread_archive_due
ON public.orders (checkout_thread_archive_at)
WHERE checkout_thread_id IS NOT NULL
  AND checkout_thread_archive_at IS NOT NULL
  AND checkout_thread_archived_at IS NULL;

SELECT cron.unschedule('archive-checkout-threads-every-minute')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'archive-checkout-threads-every-minute'
);

SELECT cron.schedule(
  'archive-checkout-threads-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://krudxivcuygykoswjbbx.supabase.co/functions/v1/archive-checkout-threads',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
