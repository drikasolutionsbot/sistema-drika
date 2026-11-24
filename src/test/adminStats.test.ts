import { describe, it, expect } from "vitest";
import {
  computeAdminAnalytics,
  computeAdminDashboardStats,
  SENTINEL_NEW_SUBSCRIBER_TENANT_ID,
  type AdminSubscriptionPaymentRecord,
  type AdminTenantRecord,
} from "@/lib/adminStats";
import { fetchAllRows } from "@/lib/supabasePagination";

describe("fetchAllRows", () => {
  it("pagina resultados em blocos até esgotar todos os registros", async () => {
    const source = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
    const calls: Array<[number, number]> = [];

    const rows = await fetchAllRows<{ id: number }>(async (from, to) => {
      calls.push([from, to]);
      return { data: source.slice(from, to + 1), error: null };
    }, 2);

    expect(rows).toEqual(source);
    expect(calls).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it("interrompe quando página exata coincide com o fim sem loop extra", async () => {
    const source = [{ id: 1 }, { id: 2 }];
    const rows = await fetchAllRows<{ id: number }>(async (from, to) => {
      return { data: source.slice(from, to + 1), error: null };
    }, 2);
    expect(rows).toEqual(source);
  });

  it("propaga erro quando consulta falha", async () => {
    await expect(
      fetchAllRows(async () => ({ data: null, error: new Error("DB fail") }), 2)
    ).rejects.toThrow("DB fail");
  });
});

describe("computeAdminDashboardStats", () => {
  const now = new Date(2026, 10, 24, 15, 0, 0); // 24 Nov 2026 local

  const tenants: AdminTenantRecord[] = [
    {
      id: "t-pro-active",
      name: "Loja Básica",
      plan: "pro",
      plan_expires_at: new Date(2026, 11, 10, 12, 0, 0).toISOString(),
      discord_guild_id: "g-1",
      created_at: new Date(2026, 9, 10, 12, 0, 0).toISOString(),
    },
    {
      id: "t-master-active",
      name: "Loja Master",
      plan: "master",
      plan_expires_at: null,
      discord_guild_id: "g-2",
      created_at: new Date(2026, 10, 5, 12, 0, 0).toISOString(),
    },
    {
      id: "t-pro-expired",
      name: "Loja Vencida",
      plan: "pro",
      plan_expires_at: new Date(2026, 10, 15, 12, 0, 0).toISOString(),
      discord_guild_id: "g-3",
      created_at: new Date(2026, 8, 1, 12, 0, 0).toISOString(),
    },
    {
      id: "t-free-trial-ended",
      name: "Loja Free",
      plan: "free",
      plan_expires_at: new Date(2026, 8, 5, 12, 0, 0).toISOString(),
      discord_guild_id: null,
      created_at: new Date(2026, 8, 1, 12, 0, 0).toISOString(),
    },
  ];

  const subs: AdminSubscriptionPaymentRecord[] = [
    // Confirmado neste mês (com paid_at)
    {
      id: "p-1",
      tenant_id: "t-master-active",
      plan: "master",
      status: "paid",
      amount_cents: 2699,
      paid_at: new Date(2026, 10, 5, 14, 0, 0).toISOString(),
      created_at: new Date(2026, 10, 5, 13, 55, 0).toISOString(),
    },
    // Confirmado neste mês SEM paid_at (aprovação manual antiga / seed) — não deve ser perdido
    {
      id: "p-2",
      tenant_id: "t-pro-active",
      plan: "pro",
      status: "paid",
      amount_cents: 1299,
      paid_at: null,
      created_at: new Date(2026, 10, 24, 10, 0, 0).toISOString(), // hoje
    },
    // Tentativa pendente e cancelada no mês atual — NÃO devem entrar em subsThisMonth
    {
      id: "p-pending",
      tenant_id: "t-free-trial-ended",
      plan: "master",
      status: "pending",
      amount_cents: 2699,
      paid_at: null,
      created_at: new Date(2026, 10, 22, 10, 0, 0).toISOString(),
    },
    {
      id: "p-expired-pix",
      tenant_id: "t-free-trial-ended",
      plan: "pro",
      status: "expired",
      amount_cents: 1299,
      paid_at: null,
      created_at: new Date(2026, 10, 20, 10, 0, 0).toISOString(),
    },
    // Pago no mês anterior (Outubro)
    {
      id: "p-prev",
      tenant_id: "t-pro-active",
      plan: "pro",
      status: "paid",
      amount_cents: 1299,
      paid_at: new Date(2026, 9, 28, 18, 0, 0).toISOString(),
      created_at: new Date(2026, 9, 28, 17, 50, 0).toISOString(),
    },
    // Dois pagantes distintos ainda com tenant_id sentinela
    {
      id: "p-anon-1",
      tenant_id: SENTINEL_NEW_SUBSCRIBER_TENANT_ID,
      plan: "pro",
      status: "paid",
      amount_cents: 1500,
      paid_at: new Date(2026, 10, 2, 12, 0, 0).toISOString(),
      created_at: new Date(2026, 10, 2, 12, 0, 0).toISOString(),
      payer_name: "Alice",
      payer_email: "alice@example.com",
    },
    {
      id: "p-anon-2",
      tenant_id: SENTINEL_NEW_SUBSCRIBER_TENANT_ID,
      plan: "master",
      status: "paid",
      amount_cents: 2699,
      paid_at: new Date(2026, 10, 3, 12, 0, 0).toISOString(),
      created_at: new Date(2026, 10, 3, 12, 0, 0).toISOString(),
      payer_name: "Bruno",
      payer_email: "bruno@example.com",
    },
  ];

  it("calcula planos ativos/expirados, assinaturas pagas do mês e bots reais", () => {
    const res = computeAdminDashboardStats({
      tenants,
      subs,
      connectedGuildIds: new Set(["g-1", "g-2", "external-guild"]),
      now,
    });

    expect(res.stats.tenants).toBe(4);
    expect(res.stats.proActiveTenants).toBe(1);
    expect(res.stats.masterActiveTenants).toBe(1);
    expect(res.stats.paidActiveTenants).toBe(2);
    expect(res.stats.expiredPaidTenants).toBe(1);
    expect(res.stats.freeTenants).toBe(1);

    // Bots reais (2 de 3 clientes com discord_guild_id conectado)
    expect(res.stats.totalBots).toBe(3);
    expect(res.stats.activeBots).toBe(2);

    // Somente status === 'paid' conta para assinaturas do mês (4 pagamentos em nov: p-1, p-2, p-anon-1, p-anon-2)
    expect(res.stats.subsThisMonth).toBe(4);
    expect(res.stats.subsLastMonth).toBe(1);
    expect(res.stats.revenueThisMonth).toBe(2699 + 1299 + 1500 + 2699);
    expect(res.stats.revenueLastMonth).toBe(1299);
    expect(res.stats.paidSubs).toBe(5);
    expect(res.stats.pendingSubs).toBe(1);

    // Distribuição inclui Básico, Master, Free e Expirado com cores distintas
    expect(res.planDistribution.map((d) => ({ name: d.name, value: d.value }))).toEqual([
      { name: "Básico", value: 1 },
      { name: "Master", value: 1 },
      { name: "Free", value: 1 },
      { name: "Expirado", value: 1 },
    ]);
    const colors = new Set(res.planDistribution.map((d) => d.color));
    expect(colors.size).toBe(4);

    // Gráfico de 30 dias inclui hoje (p-2 = 12.99)
    expect(res.revenueChart).toHaveLength(30);
    expect(res.revenueChart[res.revenueChart.length - 1]).toEqual({
      date: "24/11",
      revenue: 12.99,
    });

    // Top tenants separa pagantes sentinela distintos (Alice e Bruno)
    expect(res.topTenants.some((t) => t.name === "Alice" && t.revenue === 1500)).toBe(true);
    expect(res.topTenants.some((t) => t.name === "Bruno" && t.revenue === 2699)).toBe(true);
  });

  it("retorna activeBots=null quando consulta ao Discord falha em vez de simular 80%", () => {
    const res = computeAdminDashboardStats({
      tenants,
      subs,
      connectedGuildIds: null,
      now,
    });
    expect(res.stats.activeBots).toBeNull();
  });
});

describe("computeAdminAnalytics", () => {
  const now = new Date(2026, 10, 24, 12, 0, 0); // 24 Nov 2026

  it("inicializa crescimento acumulado com clientes anteriores à janela de 12 meses", () => {
    const tenants: AdminTenantRecord[] = [
      { id: "old-1", name: "Antigo", plan: "free", created_at: new Date(2025, 0, 10).toISOString() },
      { id: "new-1", name: "Novo", plan: "pro", created_at: new Date(2026, 10, 5).toISOString() },
    ];

    const res = computeAdminAnalytics({ tenants, payments: [], months: 12, now });
    expect(res.growthData[0].total).toBe(1); // Janela começa já somando cliente de jan/2025
    expect(res.growthData[res.growthData.length - 1]).toMatchObject({ novos: 1, total: 2 });
  });

  it("normaliza MRR de ciclos trimestrais e não marca assinante trimestral ou mid-cycle como churned", () => {
    const tenants: AdminTenantRecord[] = [
      // Assinante trimestral ativo (pagou em Outubro por 90 dias -> ativo até Janeiro)
      {
        id: "t-quarterly",
        name: "Trimestral Ativo",
        plan: "pro",
        plan_cycle: "quarterly",
        plan_expires_at: new Date(2027, 0, 10, 12, 0, 0).toISOString(),
        created_at: new Date(2026, 9, 10, 12, 0, 0).toISOString(),
      },
      // Assinante mensal que pagou em Outubro, renovou em Novembro (ciclo atual vence em Dezembro)
      {
        id: "t-monthly-active",
        name: "Mensal Ativo",
        plan: "master",
        plan_cycle: "monthly",
        plan_expires_at: new Date(2026, 11, 20, 12, 0, 0).toISOString(),
        created_at: new Date(2026, 9, 20, 12, 0, 0).toISOString(),
      },
      // Assinante que pagou em Agosto (mensal) e expirou em Setembro sem renovar
      {
        id: "t-churned-sept",
        name: "Ex-Cliente",
        plan: "free",
        plan_expires_at: null,
        created_at: new Date(2026, 7, 10, 12, 0, 0).toISOString(),
      },
    ];

    const payments: AdminSubscriptionPaymentRecord[] = [
      // Trimestral: R$ 90,00 em Outubro cobrindo Out 10 .. Jan 08
      {
        id: "pq-1",
        tenant_id: "t-quarterly",
        plan: "pro",
        status: "paid",
        amount_cents: 9000,
        paid_at: new Date(2026, 9, 10, 12, 0, 0).toISOString(),
        created_at: new Date(2026, 9, 10, 12, 0, 0).toISOString(),
        period_start: new Date(2026, 9, 10, 12, 0, 0).toISOString(),
        period_end: new Date(2027, 0, 8, 12, 0, 0).toISOString(),
        metadata: { cycle: "quarterly", cycle_days: 90 },
      },
      // Mensal ativo: R$ 30,00 em Out 20..Nov 19 e renovou Nov 19..Dez 19
      {
        id: "pm-1",
        tenant_id: "t-monthly-active",
        plan: "master",
        status: "paid",
        amount_cents: 3000,
        paid_at: new Date(2026, 9, 20, 12, 0, 0).toISOString(),
        created_at: new Date(2026, 9, 20, 12, 0, 0).toISOString(),
        period_start: new Date(2026, 9, 20, 12, 0, 0).toISOString(),
        period_end: new Date(2026, 10, 19, 12, 0, 0).toISOString(),
        metadata: { cycle: "monthly", cycle_days: 30 },
      },
      {
        id: "pm-2",
        tenant_id: "t-monthly-active",
        plan: "master",
        status: "paid",
        amount_cents: 3000,
        paid_at: new Date(2026, 10, 19, 12, 0, 0).toISOString(),
        created_at: new Date(2026, 10, 19, 12, 0, 0).toISOString(),
        period_start: new Date(2026, 10, 19, 12, 0, 0).toISOString(),
        period_end: new Date(2026, 11, 19, 12, 0, 0).toISOString(),
        metadata: { cycle: "monthly", cycle_days: 30 },
      },
      // Ex-cliente: pagou R$ 20,00 em Ago 10..Set 09 e não renovou
      {
        id: "pc-1",
        tenant_id: "t-churned-sept",
        plan: "pro",
        status: "paid",
        amount_cents: 2000,
        paid_at: new Date(2026, 7, 10, 12, 0, 0).toISOString(),
        created_at: new Date(2026, 7, 10, 12, 0, 0).toISOString(),
        period_start: new Date(2026, 7, 10, 12, 0, 0).toISOString(),
        period_end: new Date(2026, 8, 9, 12, 0, 0).toISOString(),
        metadata: { cycle: "monthly", cycle_days: 30 },
      },
    ];

    const res = computeAdminAnalytics({ tenants, payments, months: 12, now });

    const augMrr = res.mrrData[res.mrrData.length - 4];
    const sepMrr = res.mrrData[res.mrrData.length - 3];
    const octMrr = res.mrrData[res.mrrData.length - 2];
    const novMrr = res.mrrData[res.mrrData.length - 1];

    expect(augMrr.mrr).toBe(20);
    expect(sepMrr.mrr).toBe(0); // Expirou em Setembro
    expect(octMrr.mrr).toBe(60); // R$ 30/mês trimestral + R$ 30 mensal
    expect(novMrr.mrr).toBe(60); // Trimestral segue ativo no MRR de Novembro mesmo sem cobrança nova
    expect(novMrr.revenue).toBe(30); // Faturado no mês foi apenas R$ 30

    const sepChurn = res.churnData[res.churnData.length - 3];
    const octChurn = res.churnData[res.churnData.length - 2];
    const novChurn = res.churnData[res.churnData.length - 1];

    expect(sepChurn).toMatchObject({ churn: 100, churned: 1, base: 1 });
    expect(octChurn).toMatchObject({ churn: 0, churned: 0, base: 0 }); // Ex-cliente não é recontado
    expect(novChurn).toMatchObject({ churn: 0, churned: 0, base: 2 }); // Nenhum dos 2 ativos deu churn
  });
});
