export interface Affiliate {
  id: string;
  name: string;
  code: string;
  commission_type: "percent" | "fixed";
  commission_percent: number;
  commission_fixed_cents: number;
  total_sales: number;
  total_revenue_cents: number;
  active: boolean;
  created_at: string;
  discord_username: string | null;
  email: string | null;
  whatsapp: string | null;
}

export interface AffiliateOrder {
  id: string;
  order_number: number;
  product_name: string;
  total_cents: number;
  status: string;
  discord_username: string | null;
  created_at: string;
  affiliate_id?: string;
}

export interface AffiliatePayout {
  id: string;
  affiliate_id: string;
  amount_cents: number;
  status: string;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

export const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const getCommissionLabel = (aff: Affiliate) =>
  aff.commission_type === "fixed"
    ? formatBRL(aff.commission_fixed_cents)
    : `${aff.commission_percent}%`;

export const calcCommission = (aff: Affiliate, totalCents: number) =>
  aff.commission_type === "fixed"
    ? aff.commission_fixed_cents
    : Math.round(totalCents * aff.commission_percent / 100);

export const statusLabels: Record<string, string> = {
  pending_payment: "Pendente",
  paid: "Pago",
  delivering: "Entregando",
  delivered: "Entregue",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

export const payoutStatusLabels: Record<string, string> = {
  pending: "Aguardando liberação da proprietária",
  paid: "Pago",
  canceled: "Cancelado",
};
