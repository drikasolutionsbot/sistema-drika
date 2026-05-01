UPDATE access_tokens
SET expires_at = now() + interval '90 days'
WHERE revoked = false
  AND expires_at IS NOT NULL
  AND expires_at < now()
  AND tenant_id IN (
    SELECT id FROM tenants WHERE plan_expires_at < now()
  );