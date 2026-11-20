-- Estende a validade de todos os tokens ativos para 10 anos
-- e altera o valor padrão da coluna expires_at para 10 anos,
-- garantindo que a sessão de token/Discord do cliente não expire sozinha.

UPDATE public.access_tokens
SET expires_at = now() + interval '10 years'
WHERE revoked = false;

ALTER TABLE public.access_tokens
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '10 years');
