CREATE TABLE public.support_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Online',
  status_color text NOT NULL DEFAULT '#6aff6a',
  action_text text NOT NULL DEFAULT '+ Contatar',
  secondary_action_text text DEFAULT '',
  about text NOT NULL DEFAULT '',
  bottom_text text NOT NULL DEFAULT '',
  bottom_color text NOT NULL DEFAULT 'pink',
  url text NOT NULL DEFAULT '',
  initial text NOT NULL DEFAULT 'S',
  sort_order integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage support channels"
ON public.support_channels FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can view active support channels"
ON public.support_channels FOR SELECT TO authenticated
USING (active = true);

INSERT INTO public.support_channels (name, role, status, status_color, action_text, secondary_action_text, about, bottom_text, bottom_color, url, initial, sort_order) VALUES
('Suporte Discord', 'Atendimento', 'Online', '#6aff6a', '+ Abrir Ticket', 'Chamar', 'Atendimento rápido via Discord. Tire suas dúvidas e resolva problemas em tempo real.', 'Disponível 24/7', 'pink', 'https://discord.com/users/868872675110551592', 'D', 0),
('Suporte Técnico', 'Especialista', 'Disponível', '#6aff6a', '+ Contatar', 'E-mail', 'Suporte técnico especializado para configurações avançadas e integrações.', 'Resposta em até 1h', 'gold', 'https://discord.com/users/868872675110551592', 'T', 1),
('Vendas & Parcerias', 'Comercial', 'Horário comercial', '#ffb86a', '+ Falar', 'Proposta', 'Interessado em planos especiais, parcerias ou revenda? Fale com nosso comercial.', 'Seg-Sex 9h-18h', 'blue', 'https://discord.com/users/868872675110551592', 'V', 2);