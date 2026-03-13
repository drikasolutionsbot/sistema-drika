
SELECT cron.schedule(
  'ecloud-daily-backup',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url:='https://krudxivcuygykoswjbbx.supabase.co/functions/v1/run-backup',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtydWR4aXZjdXlneWtvc3dqYmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTM4OTgsImV4cCI6MjA4Nzk4OTg5OH0.k5b8jP-_hHoDAlTmeOX_M8genpiQ_i9f1Tr8XVCSPhg"}'::jsonb,
    body:='{"action": "run_all"}'::jsonb
  ) as request_id;
  $$
);
