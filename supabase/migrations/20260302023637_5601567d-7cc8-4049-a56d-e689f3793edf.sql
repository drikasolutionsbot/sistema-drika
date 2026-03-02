
-- Fix permissive INSERT policy on tenants
DROP POLICY "Authenticated can create tenant" ON public.tenants;
CREATE POLICY "Authenticated can create tenant" ON public.tenants FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
