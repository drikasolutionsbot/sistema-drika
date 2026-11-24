import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Store, CreditCard, DollarSign, TrendingUp, ShoppingCart, Crown, ArrowUpRight, ArrowDownRight, Server, Bot } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { fetchAllRows } from "@/lib/supabasePagination";
import { formatPlanLabel } from "@/lib/plans";
import {
  computeAdminDashboardStats,
  type AdminDashboardStatsSummary,
  type AdminSubscriptionPaymentRecord,
  type AdminTenantRecord,
  type PlanDistributionItem,
} from "@/lib/adminStats";

const SUB_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  paid: { label: "Pago", className: "text-emerald-500 bg-emerald-500/10 border-emerald-500" },
  pending: { label: "Pendente", className: "text-yellow-500 bg-yellow-500/10 border-yellow-500" },
  expired: { label: "Expirado", className: "text-muted-foreground bg-muted/50 border-border" },
  canceled: { label: "Cancelado", className: "text-red-500 bg-red-500/10 border-red-500" },
  refunded: { label: "Reembolsado", className: "text-purple-500 bg-purple-500/10 border-purple-500" },
  error: { label: "Erro", className: "text-red-500 bg-red-500/10 border-red-500" },
};

const AdminDashboardPage = () => {
  const [stats, setStats] = useState<AdminDashboardStatsSummary>({
    tenants: 0,
    paidActiveTenants: 0,
    proActiveTenants: 0,
    masterActiveTenants: 0,
    freeTenants: 0,
    expiredPaidTenants: 0,
    subscriptions: 0,
    paidSubs: 0,
    pendingSubs: 0,
    subsThisMonth: 0,
    subsLastMonth: 0,
    revenue: 0,
    revenueThisMonth: 0,
    revenueLastMonth: 0,
    totalBots: 0,
    activeBots: null,
  });
  const [planDistribution, setPlanDistribution] = useState<PlanDistributionItem[]>([]);
  const [revenueChart, setRevenueChart] = useState<{ date: string; revenue: number }[]>([]);
  const [recentSubs, setRecentSubs] = useState<any[]>([]);
  const [topTenants, setTopTenants] = useState<{ name: string; revenue: number; payments: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [tenants, subs, recentRes, guildRes] = await Promise.all([
          fetchAllRows<AdminTenantRecord>((from, to) =>
            supabase
              .from("tenants")
              .select("id, name, plan, plan_expires_at, discord_guild_id")
              .range(from, to)
          ),
          fetchAllRows<AdminSubscriptionPaymentRecord>((from, to) =>
            supabase
              .from("subscription_payments")
              .select("id, tenant_id, plan, status, amount_cents, paid_at, created_at, payer_name, payer_email, metadata")
              .range(from, to)
          ),
          supabase
            .from("subscription_payments")
            .select("id, tenant_id, plan, status, amount_cents, paid_at, created_at, payer_name, metadata, tenants:tenant_id(name)")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase.functions
            .invoke("discord-guild-info", { body: { action: "list_bot_guilds" } })
            .catch(() => ({ data: null, error: true })),
        ]);

        const connectedGuildIds = guildRes?.data?.guilds
          ? new Set<string>(Object.keys(guildRes.data.guilds))
          : null;

        const computed = computeAdminDashboardStats({
          tenants,
          subs,
          connectedGuildIds,
          now: new Date(),
        });

        setStats(computed.stats);
        setPlanDistribution(computed.planDistribution);
        setRevenueChart(computed.revenueChart);
        setTopTenants(computed.topTenants);
        setRecentSubs(recentRes.data || []);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const revenueGrowth = stats.revenueLastMonth > 0
    ? ((stats.revenueThisMonth - stats.revenueLastMonth) / stats.revenueLastMonth * 100).toFixed(1)
    : stats.revenueThisMonth > 0 ? "100" : "0";
  const subsGrowth = stats.subsLastMonth > 0
    ? ((stats.subsThisMonth - stats.subsLastMonth) / stats.subsLastMonth * 100).toFixed(1)
    : stats.subsThisMonth > 0 ? "100" : "0";

  const cards = [
    {
      title: "Total de Clientes",
      value: stats.tenants,
      icon: Users,
      color: "text-primary",
      change: null,
      subtitle: `${stats.paidActiveTenants} em planos pagos ativos`,
    },
    {
      title: "Assinaturas Pagas (Mês)",
      value: stats.subsThisMonth,
      icon: ShoppingCart,
      color: "text-blue-400",
      change: `${Number(subsGrowth) >= 0 ? "+" : ""}${subsGrowth}%`,
      subtitle: null,
    },
    {
      title: "Receita do Mês",
      value: `R$ ${(stats.revenueThisMonth / 100).toFixed(2)}`,
      icon: DollarSign,
      color: "text-emerald-400",
      change: `${Number(revenueGrowth) >= 0 ? "+" : ""}${revenueGrowth}%`,
      subtitle: null,
    },
    {
      title: "Receita Total",
      value: `R$ ${(stats.revenue / 100).toFixed(2)}`,
      icon: TrendingUp,
      color: "text-amber-400",
      change: null,
      subtitle: `${stats.paidSubs} pagamentos confirmados`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Admin</h1>
        <p className="text-muted-foreground">Visão geral das assinaturas do SaaS</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {loading ? "..." : card.value}
              </p>
              {card.change && !loading && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${
                  card.change.startsWith("+") ? "text-emerald-500" : card.change.startsWith("-") ? "text-destructive" : "text-muted-foreground"
                }`}>
                  {card.change.startsWith("+") ? <ArrowUpRight className="h-3 w-3" /> : card.change.startsWith("-") ? <ArrowDownRight className="h-3 w-3" /> : null}
                  {card.change} vs mês anterior
                </p>
              )}
              {card.subtitle && !loading && (
                <p className="text-xs mt-1 text-muted-foreground">{card.subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Receita de Assinaturas (últimos 30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChart}>
                  <defs>
                    <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} width={60} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Receita"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#adminRevGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution - Donut */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" />
              Distribuição de Planos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {planDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [`${value} clientes`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-foreground">{stats.tenants}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {planDistribution.map((p) => (
                <div key={p.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <span className="text-sm">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.value} clientes ({stats.tenants > 0 ? Math.round((p.value / stats.tenants) * 100) : 0}%)
                    </p>
                  </div>
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Servidor de Operações */}
      <div className="mt-8 mb-6">
        <h2 className="text-xl font-bold text-foreground mb-1">Servidor de Operações</h2>
        <p className="text-muted-foreground text-sm mb-4">Servidor onde Drikastor3 está operando.</p>
        
        <Card className="bg-gradient-to-br from-[#1c121e] to-[#120a13] border-[#311f32] overflow-hidden">
          <CardContent className="p-6 relative">
            {/* Glow effect */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <div className="absolute top-[-50px] left-[-50px] w-[200px] h-[200px] bg-pink-500/10 rounded-full blur-[80px]" />
              <div className="absolute bottom-[-50px] right-[-50px] w-[200px] h-[200px] bg-purple-500/10 rounded-full blur-[80px]" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20 shadow-[0_0_15px_rgba(236,72,153,0.15)]">
                  <Server className="h-5 w-5 text-pink-500" />
                </div>
                <h3 className="text-lg font-bold text-white">Servidor Principal</h3>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="relative">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-pink-500 to-amber-400 p-[2px] shadow-[0_0_20px_rgba(236,72,153,0.2)]">
                    <div className="h-full w-full rounded-full bg-[#120a13] flex items-center justify-center overflow-hidden">
                      <img src="/logo.png" alt="DrikaHub" className="h-full w-full object-contain p-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-emerald-500 border-2 border-[#120a13] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">DrikaHub</h4>
                  <div className="inline-flex mt-1 items-center rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-xs font-mono text-white/50">
                    ID: 1481280930000666787
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between h-[90px] w-32 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                  <div className="flex items-center gap-2 text-white/70">
                    <Users className="h-4 w-4 text-pink-400" />
                    <span className="text-sm font-medium">Bots</span>
                  </div>
                  <p className="text-2xl font-bold text-white tracking-tight">{loading ? "..." : stats.totalBots}</p>
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between h-[90px] w-32 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                  <div className="flex items-center gap-2 text-white/70">
                    <Bot className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium">Bots ativos</span>
                  </div>
                  <p className="text-2xl font-bold text-white tracking-tight">
                    {loading ? "..." : stats.activeBots !== null ? stats.activeBots : "—"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Subscriptions */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-400" />
              Assinaturas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSubs.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma assinatura registrada.</p>
            ) : (
              <div className="space-y-2">
                {recentSubs.map((s) => {
                  const tenantName = (s.tenants as any)?.name || s.payer_name || "Novo Assinante";
                  const statusMeta = SUB_STATUS_BADGE[s.status] || {
                    label: s.status,
                    className: "text-muted-foreground bg-muted/50 border-border",
                  };
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">Plano {formatPlanLabel(s.plan, s.metadata?.cycle)}</p>
                        <p className="text-xs text-muted-foreground">{tenantName}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-[2px] text-xs font-medium cursor-default ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                        <span className="text-sm font-mono font-medium">R$ {(s.amount_cents / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Tenants */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              Top Clientes por Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topTenants.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem dados.</p>
            ) : (
              <div className="space-y-3">
                {topTenants.map((t, i) => (
                  <div key={t.name} className="flex items-center gap-3">
                    <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.payments} pagamentos</p>
                    </div>
                    <span className="text-sm font-mono font-semibold text-emerald-500">
                      R$ {(t.revenue / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Extra Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Crown className="h-3.5 w-3.5" /> Planos Pagos Ativos
          </div>
          <p className="text-xl font-bold">{loading ? "..." : stats.paidActiveTenants}</p>
          {!loading && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.proActiveTenants} Básico · {stats.masterActiveTenants} Master
            </p>
          )}
        </Card>
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Users className="h-3.5 w-3.5" /> Planos Expirados
          </div>
          <p className="text-xl font-bold">{loading ? "..." : stats.expiredPaidTenants}</p>
          {!loading && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.freeTenants} no Free
            </p>
          )}
        </Card>
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <CreditCard className="h-3.5 w-3.5" /> Pagamentos Confirmados
          </div>
          <p className="text-xl font-bold">{loading ? "..." : stats.paidSubs}</p>
          {!loading && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.pendingSubs} pendentes · {stats.subscriptions} total
            </p>
          )}
        </Card>
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <DollarSign className="h-3.5 w-3.5" /> Ticket Médio
          </div>
          <p className="text-xl font-bold">
            {loading ? "..." : stats.paidSubs > 0 ? `R$ ${(stats.revenue / stats.paidSubs / 100).toFixed(2)}` : "R$ 0,00"}
          </p>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
