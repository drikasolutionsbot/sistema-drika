-- SECURITY LOCKDOWN (parte 2): remove policies "USING (true)" abertas ao role PUBLIC.
-- Cada tabela mantém suas policies corretas por loja (owner/admin/membro).
-- Escritas internas continuam funcionando via service_role (ignora RLS).

DROP POLICY IF EXISTS "Service role can manage webhook logs" ON public.webhook_logs;
DROP POLICY IF EXISTS "Service role can insert logs" ON public.webhook_logs;
DROP POLICY IF EXISTS "Service role can manage tenant audit logs" ON public.tenant_audit_logs;
DROP POLICY IF EXISTS "Service role can manage verified members" ON public.verified_members;
DROP POLICY IF EXISTS "Service role can manage welcome configs" ON public.welcome_configs;
DROP POLICY IF EXISTS "Permitir acesso total ticket_categories" ON public.ticket_categories;

-- anon nunca precisa tocar nessas tabelas
REVOKE ALL ON public.webhook_logs FROM anon;
REVOKE ALL ON public.tenant_audit_logs FROM anon;
REVOKE ALL ON public.verified_members FROM anon;
REVOKE ALL ON public.welcome_configs FROM anon;
REVOKE ALL ON public.ticket_categories FROM anon;

-- webhook_logs: lojista só lê; quem escreve é o backend
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.webhook_logs FROM authenticated;
