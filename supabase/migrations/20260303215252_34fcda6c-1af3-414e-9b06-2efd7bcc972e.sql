-- Drop the restrictive SELECT policy and replace with one that allows anon access
DROP POLICY IF EXISTS "Authenticated users can view active support channels" ON public.support_channels;

CREATE POLICY "Anyone can view active support channels"
ON public.support_channels FOR SELECT
USING (active = true);