/**
 * Configuração centralizada dos planos do SaaS Drika Hub.
 * Single source of truth — usar SEMPRE este helper em vez de comparar strings soltas.
 */

export type PlanKey = "free" | "pro" | "master" | "expired";
export type BillingCycle = "monthly" | "quarterly" | "semiannual";

export interface PlanInfo {
  value: PlanKey;
  label: string;
  shortLabel: string;
  /** Ícone representativo do plano */
  icon: string;
  /** Tailwind classes p/ badge */
  color: string;
  /** Mensalidade default em centavos (admin pode sobrescrever) */
  defaultPriceCents: number;
}

export const PLANS: PlanInfo[] = [
  {
    value: "free",
    label: "Drika Solutions Free",
    shortLabel: "Free",
    icon: "🎁",
    color: "text-muted-foreground bg-muted/50 border-border",
    defaultPriceCents: 0,
  },
  {
    value: "pro",
    label: "Drika Solutions Básico",
    shortLabel: "Básico",
    icon: "💎",
    color: "text-cyan-400 bg-cyan-500/15 border-cyan-500/35 shadow-[0_0_12px_rgba(6,182,212,0.12)]",
    defaultPriceCents: 1299,
  },
  {
    value: "master",
    label: "Drika Solutions Master",
    shortLabel: "Master",
    icon: "👑",
    color: "text-amber-400 bg-amber-500/15 border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.12)]",
    defaultPriceCents: 2699,
  },
];

export function getPlanInfo(plan?: string | null): PlanInfo {
  return PLANS.find((p) => p.value === plan) || PLANS[0];
}

export function isMaster(plan?: string | null): boolean {
  return plan === "master";
}

export function isPaidPlan(plan?: string | null): boolean {
  return plan === "pro" || plan === "master";
}

export function getCycleName(cycle?: string | null): string {
  if (!cycle) return "Mensal";
  const c = cycle.toLowerCase().trim();
  if (c === "quarterly" || c === "trimestral") return "Trimestral";
  if (c === "semiannual" || c === "semestral") return "Semestral";
  return "Mensal";
}

export function getCycleDays(cycle?: string | null): number {
  if (!cycle) return 30;
  const c = cycle.toLowerCase().trim();
  if (c === "quarterly" || c === "trimestral") return 90;
  if (c === "semiannual" || c === "semestral") return 180;
  return 30;
}

/**
 * Formata o plano e o ciclo no padrão solicitado:
 * Ex: "Básico (Mensal)", "Básico (Trimestral)", "Master (Semestral)", "Free"
 */
export function formatPlanLabel(plan?: string | null, cycle?: string | null): string {
  const info = getPlanInfo(plan);
  if (info.value === "free" || !isPaidPlan(info.value)) {
    return info.shortLabel;
  }
  const cycleName = getCycleName(cycle);
  return `${info.shortLabel} (${cycleName})`;
}

/**
 * Retorna o nome formatado com o ícone do plano:
 * Ex: "💎 Básico (Mensal)", "👑 Master (Trimestral)"
 */
export function formatPlanLabelWithIcon(plan?: string | null, cycle?: string | null): string {
  const info = getPlanInfo(plan);
  if (info.value === "free" || !isPaidPlan(info.value)) {
    return `${info.icon} ${info.shortLabel}`;
  }
  const cycleName = getCycleName(cycle);
  return `${info.icon} ${info.shortLabel} (${cycleName})`;
}

/** Recursos exclusivos do Master */
export const MASTER_FEATURES = {
  /** Capa pessoal do bot por loja */
  customBotBanner: true,
  /** Limite diário de créditos IA removido */
  unlimitedAiCredits: true,
} as const;
