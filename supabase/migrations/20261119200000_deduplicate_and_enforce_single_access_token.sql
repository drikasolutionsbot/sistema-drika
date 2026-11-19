-- Deduplica tokens de acesso antigos acumulados antes de 01/11/2026
-- Mantém apenas 1 token ativo por tenant (priorizando o que tem last_used_at mais recente, depois created_at mais recente)
-- e cria índice único parcial para impedir que um tenant acumule múltiplos tokens ativos no futuro.

-- 1. Se algum tenant só tiver tokens revogados, mantém apenas o mais recente;
--    se tiver tokens ativos, remove todos os revogados e mantém apenas o token ativo principal.
WITH ranked AS (
  SELECT
    id,
    tenant_id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id
      ORDER BY
        (CASE WHEN revoked = false THEN 0 ELSE 1 END) ASC,
        last_used_at DESC NULLS LAST,
        created_at DESC,
        id DESC
    ) AS rn
  FROM public.access_tokens
)
DELETE FROM public.access_tokens a
USING ranked r
WHERE a.id = r.id
  AND (r.rn > 1 OR a.revoked = true);

-- 2. Garante no banco que cada tenant só pode ter no máximo 1 token ativo (revoked = false)
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_tokens_one_active_per_tenant
  ON public.access_tokens (tenant_id)
  WHERE (revoked = false);
