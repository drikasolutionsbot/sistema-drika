-- Habilita a deleção de pedidos pelo dono do tenant (Lojista)
CREATE POLICY "Tenants can delete their own orders"
ON "public"."orders"
FOR DELETE
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_roles 
    WHERE user_id = auth.uid()
  )
);
