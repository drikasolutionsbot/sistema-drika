-- Adiciona colunas para controle de lembretes D-1 e D-0 de assinatura nos tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS reminder_d1_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_d0_sent_at timestamptz;

-- Adiciona configurações de lembrete e URL do sistema na tabela landing_config
ALTER TABLE public.landing_config
  ADD COLUMN IF NOT EXISTS subscription_reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS system_url text NOT NULL DEFAULT 'https://www.drikahub.com';

-- Agenda job diário/horário no pg_cron para checar e enviar lembretes D-1 e D-0
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove agendamento antigo se existir
    PERFORM cron.unschedule('send-subscription-reminders-hourly');
    
    -- Agenda execução de hora em hora
    PERFORM cron.schedule(
      'send-subscription-reminders-hourly',
      '0 * * * *',
      $cron$
      SELECT net.http_post(
        url:='https://iwotvdfxppjwasywrbmw.supabase.co/functions/v1/send-subscription-reminder',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3b3R2ZGZ4cHBqd2FzeXdyYm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MDg3NjAsImV4cCI6MjEwNDI4NDc2MH0.KijtuLNUpF8zWaBdHDaP6C0G6e-UWjo7Hqr-hgDC-d4"}'::jsonb,
        body:='{"action": "run_all"}'::jsonb
      ) AS request_id;
      $cron$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Se a extensão pg_cron ou net não estiver disponível ou erro na schedule, não impede a migration
    RAISE NOTICE 'pg_cron schedule warning: %', SQLERRM;
END $$;
