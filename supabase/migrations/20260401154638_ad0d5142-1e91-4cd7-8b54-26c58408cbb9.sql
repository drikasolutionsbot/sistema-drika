SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'expire-pending-orders-every-5min'),
  '* * * * *'
);