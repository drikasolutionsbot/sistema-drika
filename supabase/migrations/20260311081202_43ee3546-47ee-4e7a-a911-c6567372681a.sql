-- Fix: vincular tenant "irmaodojoreu" ao afiliado P-CON
UPDATE public.tenants 
SET referred_by_tenant_id = '9f15242b-1d3f-4154-903c-514d736570a2'
WHERE id = '62581903-c1ed-4c01-899d-21a4e6e5e581' 
AND referred_by_tenant_id IS NULL;

-- Criar payout pendente para o afiliado P-CON
INSERT INTO public.affiliate_payouts (tenant_id, affiliate_id, amount_cents, status, notes)
SELECT 
  '9f15242b-1d3f-4154-903c-514d736570a2',
  'aac90952-2a94-4425-b2ee-4615edde1c7f',
  (SELECT referral_bonus_credits_cents FROM public.landing_config LIMIT 1),
  'pending',
  'Indicação Pro: irmaodojoreu | +' || (SELECT referral_bonus_days FROM public.landing_config LIMIT 1) || ' dias bônus | Correção manual'
WHERE NOT EXISTS (
  SELECT 1 FROM public.affiliate_payouts 
  WHERE affiliate_id = 'aac90952-2a94-4425-b2ee-4615edde1c7f'
  AND notes LIKE '%irmaodojoreu%'
);

-- Incrementar total_sales do afiliado
UPDATE public.affiliates 
SET total_sales = total_sales + 1
WHERE id = 'aac90952-2a94-4425-b2ee-4615edde1c7f';