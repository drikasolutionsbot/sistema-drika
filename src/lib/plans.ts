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

export interface PlanAccessStatus {
  /** Se está no plano Free */
  isFree: boolean;
  /** Se possui plano pago (Master ou Pro) */
  isPaid: boolean;
  /** Se o plano pago já passou da data de vencimento */
  isExpired: boolean;
  /** Se está dentro do período de tolerância de 2 dias (48 horas) após vencer */
  isInGracePeriod: boolean;
  /** Se a tolerância de 2 dias já expirou */
  isGraceExpired: boolean;
  /**
   * Se a loja pode usar gateways próprias (Mercado Pago, Efí, PushinPay, etc.) com 0% taxa:
   * Permitido para plano pago ativo OU durante os 2 dias de tolerância após vencer.
   */
  canUseOwnGateways: boolean;
  /**
   * Se a loja opera no modo Split da plataforma (taxa fixa + % split e saldo na carteira):
   * Ativo para Plano Free OU quando o plano pago expirou há mais de 2 dias.
   */
  usesSplitWallet: boolean;
  /** Horas restantes dentro da tolerância de 2 dias (se aplicável) */
  graceHoursRemaining: number;
  /** Dias corridos desde a expiração (se aplicável) */
  daysExpired: number;
  /** Data final exata da tolerância de 2 dias */
  graceEnd: Date | null;
}

export const GRACE_PERIOD_DAYS = 2;
export const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000; // 48h

export function evaluatePlanAccess(
  tenant?: { plan?: string | null; plan_expires_at?: string | null } | null,
  isSystemFree = false
): PlanAccessStatus {
  if (isSystemFree) {
    return {
      isFree: false,
      isPaid: true,
      isExpired: false,
      isInGracePeriod: false,
      isGraceExpired: false,
      canUseOwnGateways: true,
      usesSplitWallet: false,
      graceHoursRemaining: 0,
      daysExpired: 0,
      graceEnd: null,
    };
  }

  if (!tenant) {
    return {
      isFree: true,
      isPaid: false,
      isExpired: false,
      isInGracePeriod: false,
      isGraceExpired: false,
      canUseOwnGateways: false,
      usesSplitWallet: true,
      graceHoursRemaining: 0,
      daysExpired: 0,
      graceEnd: null,
    };
  }

  const planKey = (tenant.plan || "free").toLowerCase().trim();
  const isFree = planKey === "free";
  const isPaid = isPaidPlan(planKey);

  if (isFree || !isPaid) {
    return {
      isFree: true,
      isPaid: false,
      isExpired: false,
      isInGracePeriod: false,
      isGraceExpired: false,
      canUseOwnGateways: false,
      usesSplitWallet: true,
      graceHoursRemaining: 0,
      daysExpired: 0,
      graceEnd: null,
    };
  }

  // Plano pago sem data de término = vitalício
  if (!tenant.plan_expires_at) {
    return {
      isFree: false,
      isPaid: true,
      isExpired: false,
      isInGracePeriod: false,
      isGraceExpired: false,
      canUseOwnGateways: true,
      usesSplitWallet: false,
      graceHoursRemaining: 0,
      daysExpired: 0,
      graceEnd: null,
    };
  }

  const now = Date.now();
  const expiryTime = new Date(tenant.plan_expires_at).getTime();
  const isExpired = now > expiryTime || planKey === "expired";

  if (!isExpired) {
    return {
      isFree: false,
      isPaid: true,
      isExpired: false,
      isInGracePeriod: false,
      isGraceExpired: false,
      canUseOwnGateways: true,
      usesSplitWallet: false,
      graceHoursRemaining: 0,
      daysExpired: 0,
      graceEnd: null,
    };
  }

  // Plano expirado: cálculo da janela de tolerância de 2 dias (48h)
  const graceEndTime = expiryTime + GRACE_PERIOD_MS;
  const isInGracePeriod = now <= graceEndTime;
  const isGraceExpired = now > graceEndTime;

  const msUntilGraceEnd = Math.max(0, graceEndTime - now);
  const graceHoursRemaining = Math.ceil(msUntilGraceEnd / (1000 * 60 * 60));
  const daysExpired = Math.max(1, Math.floor((now - expiryTime) / (1000 * 60 * 60 * 24)));

  return {
    isFree: false,
    isPaid: true,
    isExpired: true,
    isInGracePeriod,
    isGraceExpired,
    // Permite usar gateways próprias até 2 dias de tolerância
    canUseOwnGateways: isInGracePeriod,
    // Se passou de 2 dias sem renovar, opera em Split + Carteira igual ao Free
    usesSplitWallet: isGraceExpired,
    graceHoursRemaining,
    daysExpired,
    graceEnd: new Date(graceEndTime),
  };
}
