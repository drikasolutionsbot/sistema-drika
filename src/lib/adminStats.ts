import {
  addDays,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  format,
  differenceInCalendarDays,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { classifyTenantPlan, getCycleDays, PLAN_VISUALS, type PlanKey } from "@/lib/plans";

export const SENTINEL_NEW_SUBSCRIBER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export interface AdminTenantRecord {
  id: string;
  name?: string | null;
  plan?: string | null;
  plan_cycle?: string | null;
  plan_expires_at?: string | null;
  discord_guild_id?: string | null;
  created_at?: string | null;
}

export interface AdminSubscriptionPaymentRecord {
  id: string;
  tenant_id: string;
  plan?: string | null;
  status: string;
  amount_cents: number;
  paid_at?: string | null;
  created_at: string;
  period_start?: string | null;
  period_end?: string | null;
  payer_name?: string | null;
  payer_email?: string | null;
  metadata?: { cycle?: string | null; cycle_days?: number | null; plan?: string | null } | null;
}

export interface PlanDistributionItem {
  key: PlanKey;
  name: string;
  icon: string;
  value: number;
  color: string;
}

export interface AdminDashboardStatsSummary {
  tenants: number;
  paidActiveTenants: number;
  proActiveTenants: number;
  masterActiveTenants: number;
  freeTenants: number;
  expiredPaidTenants: number;
  subscriptions: number;
  paidSubs: number;
  pendingSubs: number;
  subsThisMonth: number;
  subsLastMonth: number;
  revenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  totalBots: number;
  activeBots: number | null;
}

export interface AdminDashboardComputation {
  stats: AdminDashboardStatsSummary;
  planDistribution: PlanDistributionItem[];
  revenueChart: { date: string; revenue: number }[];
  topTenants: { name: string; revenue: number; payments: number }[];
}

const PLAN_ORDER: PlanKey[] = ["pro", "master", "free", "expired"];

function parseValidDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Retorna a data efetiva do pagamento (paid_at para confirmados quando disponível, fallback created_at).
 */
export function getEffectivePaymentDate(
  payment: Pick<AdminSubscriptionPaymentRecord, "status" | "paid_at" | "created_at">
): Date | null {
  if (payment.status === "paid" && payment.paid_at) {
    return parseValidDate(payment.paid_at) ?? parseValidDate(payment.created_at);
  }
  return parseValidDate(payment.created_at);
}

/**
 * Infere a duração em dias do ciclo de uma cobrança de assinatura.
 */
export function getPaymentCycleDays(payment: AdminSubscriptionPaymentRecord): number {
  const metaDays = Number(payment.metadata?.cycle_days);
  if (Number.isFinite(metaDays) && metaDays > 0) {
    return metaDays;
  }
  if (payment.metadata?.cycle) {
    return getCycleDays(payment.metadata.cycle);
  }
  const start = parseValidDate(payment.period_start);
  const end = parseValidDate(payment.period_end);
  if (start && end && end > start) {
    const diffDays = differenceInCalendarDays(end, start);
    if (diffDays >= 150) return 180;
    if (diffDays >= 60) return 90;
    return 30;
  }
  return 30;
}

function getSubscriberKey(payment: AdminSubscriptionPaymentRecord): string {
  if (payment.tenant_id && payment.tenant_id !== SENTINEL_NEW_SUBSCRIBER_TENANT_ID) {
    return `tenant:${payment.tenant_id}`;
  }
  if (payment.payer_email) {
    return `payer:${payment.payer_email.toLowerCase().trim()}`;
  }
  if (payment.payer_name) {
    return `payer:${payment.payer_name.toLowerCase().trim()}`;
  }
  return `payment:${payment.id}`;
}

export function buildPlanDistribution(
  tenants: AdminTenantRecord[],
  nowMs = Date.now()
): { counts: Record<PlanKey, number>; distribution: PlanDistributionItem[] } {
  const counts: Record<PlanKey, number> = {
    pro: 0,
    master: 0,
    free: 0,
    expired: 0,
  };

  for (const tenant of tenants) {
    const { effectivePlan } = classifyTenantPlan(tenant, nowMs);
    counts[effectivePlan] += 1;
  }

  const distribution = PLAN_ORDER.filter((key) => counts[key] > 0).map((key) => ({
    key,
    name: PLAN_VISUALS[key].shortLabel,
    icon: PLAN_VISUALS[key].icon,
    value: counts[key],
    color: PLAN_VISUALS[key].hexColor,
  }));

  return { counts, distribution };
}

/**
 * Calcula métricas consolidadas do Dashboard Administrativo sem inflar assinaturas pagas
 * com tentativas pendentes/abandonadas e classificando planos expirados corretamente.
 */
export function computeAdminDashboardStats({
  tenants,
  subs,
  connectedGuildIds,
  now = new Date(),
}: {
  tenants: AdminTenantRecord[];
  subs: AdminSubscriptionPaymentRecord[];
  connectedGuildIds?: Set<string> | null;
  now?: Date;
}): AdminDashboardComputation {
  const nowMs = now.getTime();
  const { counts, distribution } = buildPlanDistribution(tenants, nowMs);

  const tenantNameById = new Map<string, string>();
  let totalBots = 0;
  let activeBotsCount = 0;

  for (const t of tenants) {
    if (t.name) tenantNameById.set(t.id, t.name);
    if (t.discord_guild_id) {
      totalBots += 1;
      if (connectedGuildIds && connectedGuildIds.has(t.discord_guild_id)) {
        activeBotsCount += 1;
      }
    }
  }

  const paidSubsList = subs.filter((s) => s.status === "paid");
  const pendingSubsList = subs.filter((s) => s.status === "pending");

  const thisMonthStart = startOfMonth(now);
  const nextMonthStart = startOfMonth(addDays(endOfMonth(now), 1));
  const lastMonthStart = startOfMonth(subMonths(now, 1));

  let subsThisMonth = 0;
  let subsLastMonth = 0;
  let revenue = 0;
  let revenueThisMonth = 0;
  let revenueLastMonth = 0;

  // Revenue chart covers 30 days inclusive ending today (29 days ago .. today)
  const chartWindowStart = startOfDay(subDays(now, 29));
  const chartWindowEnd = endOfDay(now);
  const dailyEntries: { key: string; date: string; revenue: number }[] = [];
  const dailyByKey = new Map<string, { key: string; date: string; revenue: number }>();

  for (let i = 0; i < 30; i++) {
    const day = subDays(now, 29 - i);
    const key = format(day, "yyyy-MM-dd");
    const entry = { key, date: format(day, "dd/MM"), revenue: 0 };
    dailyEntries.push(entry);
    dailyByKey.set(key, entry);
  }

  const tenantRevMap = new Map<string, { name: string; revenue: number; payments: number }>();

  for (const s of paidSubsList) {
    const amount = s.amount_cents || 0;
    revenue += amount;

    const effectiveDate = getEffectivePaymentDate(s);
    if (effectiveDate) {
      if (effectiveDate >= thisMonthStart && effectiveDate < nextMonthStart) {
        subsThisMonth += 1;
        revenueThisMonth += amount;
      } else if (effectiveDate >= lastMonthStart && effectiveDate < thisMonthStart) {
        subsLastMonth += 1;
        revenueLastMonth += amount;
      }

      if (effectiveDate >= chartWindowStart && effectiveDate <= chartWindowEnd) {
        const dayKey = format(effectiveDate, "yyyy-MM-dd");
        const bucket = dailyByKey.get(dayKey);
        if (bucket) {
          bucket.revenue += amount / 100;
        }
      }
    }

    const subKey = getSubscriberKey(s);
    const isRealTenant = s.tenant_id && s.tenant_id !== SENTINEL_NEW_SUBSCRIBER_TENANT_ID;
    const displayName =
      (isRealTenant ? tenantNameById.get(s.tenant_id) : undefined) ||
      s.payer_name ||
      s.payer_email ||
      (isRealTenant ? "Desconhecido" : "Novo Assinante");

    const existing = tenantRevMap.get(subKey);
    if (existing) {
      existing.revenue += amount;
      existing.payments += 1;
    } else {
      tenantRevMap.set(subKey, { name: displayName, revenue: amount, payments: 1 });
    }
  }

  const topTenants = Array.from(tenantRevMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    stats: {
      tenants: tenants.length,
      paidActiveTenants: counts.pro + counts.master,
      proActiveTenants: counts.pro,
      masterActiveTenants: counts.master,
      freeTenants: counts.free,
      expiredPaidTenants: counts.expired,
      subscriptions: subs.length,
      paidSubs: paidSubsList.length,
      pendingSubs: pendingSubsList.length,
      subsThisMonth,
      subsLastMonth,
      revenue,
      revenueThisMonth,
      revenueLastMonth,
      totalBots,
      activeBots: connectedGuildIds ? activeBotsCount : null,
    },
    planDistribution: distribution,
    revenueChart: dailyEntries.map(({ date, revenue: rev }) => ({ date, revenue: rev })),
    topTenants,
  };
}

export interface AnalyticsComputation {
  growthData: { month: string; novos: number; total: number }[];
  mrrData: { month: string; mrr: number; revenue: number; activeSubscribers: number; count: number }[];
  churnData: { month: string; churn: number; churned: number; base: number }[];
  planDist: PlanDistributionItem[];
  kpis: {
    totalClients: number;
    paidActiveClients: number;
    expiredPaidClients: number;
    currentMRR: number;
    prevMRR: number;
    mrrGrowth: number;
    currentChurn: number;
    currentChurnedCount: number;
    newThisMonth: number;
    avgTicketCents: number;
    paidPaymentsCount: number;
  };
}

interface PaymentCoverage {
  subscriberKey: string;
  tenantId: string | null;
  startMs: number;
  endMs: number;
  monthlyCents: number;
  paidAtMs: number;
}

function getActiveMonthlyBySubscriberAt(
  coverages: PaymentCoverage[],
  snapshotMs: number,
  options?: {
    checkCurrentTenantStatus?: boolean;
    tenantById?: Map<string, AdminTenantRecord>;
    nowMs?: number;
  }
): Map<string, number> {
  // Choose latest coverage active at snapshotMs for each subscriber
  const latestBySub = new Map<string, PaymentCoverage>();

  for (const c of coverages) {
    if (c.startMs <= snapshotMs && c.endMs >= snapshotMs) {
      const prev = latestBySub.get(c.subscriberKey);
      if (!prev || c.paidAtMs >= prev.paidAtMs) {
        latestBySub.set(c.subscriberKey, c);
      }
    }
  }

  const result = new Map<string, number>();
  const nowMs = options?.nowMs ?? snapshotMs;

  latestBySub.forEach((cov, subKey) => {
    if (options?.checkCurrentTenantStatus && cov.tenantId && options.tenantById) {
      const tenant = options.tenantById.get(cov.tenantId);
      if (tenant && !classifyTenantPlan(tenant, nowMs).isActivePaid) {
        return;
      }
    }
    result.set(subKey, cov.monthlyCents);
  });

  return result;
}

/**
 * Calcula métricas de analytics do SaaS: crescimento acumulado desde a base pré-janela,
 * MRR normalizado por ciclo de cobrança, churn mensal baseado na base ativa do mês anterior
 * (sem penalizar ciclos trimestrais/semestrais ou recontar ex-clientes) e distribuição de planos.
 */
export function computeAdminAnalytics({
  tenants,
  payments,
  months = 12,
  now = new Date(),
}: {
  tenants: AdminTenantRecord[];
  payments: AdminSubscriptionPaymentRecord[];
  months?: number;
  now?: Date;
}): AnalyticsComputation {
  const nowMs = now.getTime();
  const currentMonthKey = format(now, "yyyy-MM");
  const endMonth = startOfMonth(now);
  const startMonth = startOfMonth(subMonths(now, Math.max(1, months) - 1));
  const monthRange = eachMonthOfInterval({ start: startMonth, end: endMonth });

  const tenantById = new Map<string, AdminTenantRecord>();
  for (const t of tenants) {
    tenantById.set(t.id, t);
  }

  // Growth: initialize cumulative with tenants created BEFORE the first displayed month
  const windowStartMs = startMonth.getTime();
  let cumulative = tenants.filter((t) => {
    const created = parseValidDate(t.created_at);
    return created !== null && created.getTime() < windowStartMs;
  }).length;

  const newByMonth = new Map<string, number>();
  for (const t of tenants) {
    const created = parseValidDate(t.created_at);
    if (created) {
      const key = format(created, "yyyy-MM");
      newByMonth.set(key, (newByMonth.get(key) || 0) + 1);
    }
  }

  const growthData = monthRange.map((m) => {
    const key = format(m, "yyyy-MM");
    const novos = newByMonth.get(key) || 0;
    cumulative += novos;
    return {
      month: format(m, "MMM yy", { locale: ptBR }),
      novos,
      total: cumulative,
    };
  });

  // Paid payments & normalized recurring coverages
  const paidPayments = payments.filter((p) => p.status === "paid");
  const coverages: PaymentCoverage[] = [];
  const cashByMonth = new Map<string, { cents: number; count: number }>();

  let totalPaidCents = 0;
  for (const p of paidPayments) {
    const amountCents = p.amount_cents || 0;
    totalPaidCents += amountCents;

    const effectiveDate = getEffectivePaymentDate(p);
    if (effectiveDate) {
      const mKey = format(effectiveDate, "yyyy-MM");
      const entry = cashByMonth.get(mKey);
      if (entry) {
        entry.cents += amountCents;
        entry.count += 1;
      } else {
        cashByMonth.set(mKey, { cents: amountCents, count: 1 });
      }
    }

    const startDate = parseValidDate(p.period_start) || effectiveDate;
    if (!startDate) continue;

    const cycleDays = getPaymentCycleDays(p);
    const endDate = parseValidDate(p.period_end) || addDays(startDate, cycleDays);
    const cycleMonths = cycleDays >= 150 ? 6 : cycleDays >= 60 ? 3 : 1;
    const isRealTenant = Boolean(p.tenant_id && p.tenant_id !== SENTINEL_NEW_SUBSCRIBER_TENANT_ID);

    coverages.push({
      subscriberKey: getSubscriberKey(p),
      tenantId: isRealTenant ? p.tenant_id : null,
      startMs: startDate.getTime(),
      endMs: endDate.getTime(),
      monthlyCents: Math.round(amountCents / cycleMonths),
      paidAtMs: (effectiveDate || startDate).getTime(),
    });
  }

  const mrrData = monthRange.map((m) => {
    const key = format(m, "yyyy-MM");
    const isCurrentMonth = key === currentMonthKey;
    const snapshotMs = isCurrentMonth ? nowMs : endOfMonth(m).getTime();
    const activeMap = getActiveMonthlyBySubscriberAt(coverages, snapshotMs, {
      checkCurrentTenantStatus: isCurrentMonth,
      tenantById,
      nowMs,
    });

    let mrrCents = 0;
    activeMap.forEach((cents) => {
      mrrCents += cents;
    });

    const cash = cashByMonth.get(key) || { cents: 0, count: 0 };
    return {
      month: format(m, "MMM yy", { locale: ptBR }),
      mrr: Math.round(mrrCents) / 100,
      revenue: Math.round(cash.cents) / 100,
      activeSubscribers: activeMap.size,
      count: cash.count,
    };
  });

  const churnData = monthRange.map((m) => {
    const key = format(m, "yyyy-MM");
    const isCurrentMonth = key === currentMonthKey;
    const prevSnapshotMs = endOfMonth(subMonths(m, 1)).getTime();
    const currSnapshotMs = isCurrentMonth ? nowMs : endOfMonth(m).getTime();

    const prevActive = getActiveMonthlyBySubscriberAt(coverages, prevSnapshotMs);
    const currActive = getActiveMonthlyBySubscriberAt(coverages, currSnapshotMs, {
      checkCurrentTenantStatus: isCurrentMonth,
      tenantById,
      nowMs,
    });

    let churned = 0;
    prevActive.forEach((_, subKey) => {
      if (!currActive.has(subKey)) {
        if (isCurrentMonth && subKey.startsWith("tenant:")) {
          const tenant = tenantById.get(subKey.slice("tenant:".length));
          if (tenant && classifyTenantPlan(tenant, nowMs).isActivePaid) {
            return;
          }
        }
        churned += 1;
      }
    });

    const rate = prevActive.size > 0 ? Math.round((churned / prevActive.size) * 1000) / 10 : 0;

    return {
      month: format(m, "MMM yy", { locale: ptBR }),
      churn: rate,
      churned,
      base: prevActive.size,
    };
  });

  const { counts, distribution } = buildPlanDistribution(tenants, nowMs);

  const currentMRR = mrrData.length > 0 ? mrrData[mrrData.length - 1].mrr : 0;
  const prevMRR = mrrData.length > 1 ? mrrData[mrrData.length - 2].mrr : 0;
  const mrrGrowth = prevMRR > 0 ? ((currentMRR - prevMRR) / prevMRR) * 100 : currentMRR > 0 ? 100 : 0;
  const currentChurn = churnData.length > 0 ? churnData[churnData.length - 1].churn : 0;
  const currentChurnedCount = churnData.length > 0 ? churnData[churnData.length - 1].churned : 0;
  const newThisMonth = growthData.length > 0 ? growthData[growthData.length - 1].novos : 0;
  const avgTicketCents = paidPayments.length > 0 ? Math.round(totalPaidCents / paidPayments.length) : 0;

  return {
    growthData,
    mrrData,
    churnData,
    planDist: distribution,
    kpis: {
      totalClients: tenants.length,
      paidActiveClients: counts.pro + counts.master,
      expiredPaidClients: counts.expired,
      currentMRR,
      prevMRR,
      mrrGrowth,
      currentChurn,
      currentChurnedCount,
      newThisMonth,
      avgTicketCents,
      paidPaymentsCount: paidPayments.length,
    },
  };
}
