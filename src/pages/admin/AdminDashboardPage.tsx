import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Users, Store, CreditCard, DollarSign, TrendingUp, ShoppingCart, Crown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const PLAN_COLORS: Record<string, string> = {
  free: "#6b7280",
  pro: "#10b981",
};

const PLAN_ICONS: Record<string, string> = {
  free: "🆓",
  pro: "⚡",
};

const STATUS_MAP: Record<string, string> = {
  paid: "paid",
  pending: "pending_payment",
};

const AdminDashboardPage = () => {
  const [stats, setStats] = useState({
    tenants: 0,
    subscriptions: 0,
    subsThisMonth: 0,
    subsLastMonth: 0,
    revenue: 0,
    revenueThisMonth: 0,
    revenueLastMonth: 0,
    paidSubs: 0,
  });
  const [planDistribution, setPlanDistribution] = useState<{ name: string; value: number; color: string }[]>([]);
  const [revenueChart, setRevenueChart] = useState<{ date: string; revenue: number }[]>([]);
  const [recentSubs, setRecentSubs] = useState<any[]>([]);
  const [topTenants, setTopTenants] = useState<{ name: string; revenue: number; payments: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const lastMonthStart = startOfMonth(subDays(startOfMonth(now), 1)).toISOString();

      const [tenantsRes, subsRes, recentRes] = await Promise.all([
        supabase.from("tenants").select("id, name, plan"),
        supabase.from("subscription_payments").select("id, tenant_id, plan, status, amount_cents, paid_at, created_at"),
        supabase.from("subscription_payments")
          .select("id, tenant_id, plan, status, amount_cents, paid_at, created_at, tenants:tenant_id(name)")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const tenants = tenantsRes.data || [];
      const subs = subsRes.data || [];

      // Plan distribution
      const planCounts: Record<string, number> = {};
      tenants.forEach((t) => {
        const p = t.plan || "free";
        planCounts[p] = (planCounts[p] || 0) + 1;
      });
      setPlanDistribution(
        Object.entries(planCounts).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          color: PLAN_COLORS[name] || PLAN_COLORS.free,
        }))
      );

      // Revenue chart (last 30 days) - based on subscription_payments
      const last30 = subDays(now, 30);
      const dailyMap: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        const d = format(subDays(now, 29 - i), "dd/MM");
        dailyMap[d] = 0;
      }
      subs.forEach((s) => {
        if (s.status === "paid" && s.paid_at && new Date(s.paid_at) >= last30) {
          const d = format(new Date(s.paid_at), "dd/MM");
          if (dailyMap[d] !== undefined) dailyMap[d] += s.amount_cents / 100;
        }
      });
      setRevenueChart(Object.entries(dailyMap).map(([date, revenue]) => ({ date, revenue })));

      // Top tenants by subscription revenue
      const tenantRevMap: Record<string, { name: string; revenue: number; payments: number }> = {};
      subs.forEach((s) => {
        if (s.status === "paid") {
          if (!tenantRevMap[s.tenant_id]) {
            const t = tenants.find((t) => t.id === s.tenant_id);
            tenantRevMap[s.tenant_id] = { name: t?.name || "Desconhecido", revenue: 0, payments: 0 };
          }
          tenantRevMap[s.tenant_id].revenue += s.amount_cents;
          tenantRevMap[s.tenant_id].payments += 1;
        }
      });
      setTopTenants(
        Object.values(tenantRevMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
      );

      // Monthly stats
      const paidSubs = subs.filter((s) => s.status === "paid");
      const thisMonthSubs = subs.filter((s) => s.created_at >= monthStart);
      const lastMonthSubs = subs.filter((s) => s.created_at >= lastMonthStart && s.created_at < monthStart);
      const revenueThisMonth = thisMonthSubs.filter((s) => s.status === "paid").reduce((sum, s) => sum + s.amount_cents, 0);
      const revenueLastMonth = lastMonthSubs.filter((s) => s.status === "paid").reduce((sum, s) => sum + s.amount_cents, 0);

      setStats({
        tenants: tenants.length,
        subscriptions: subs.length,
        subsThisMonth: thisMonthSubs.length,
        subsLastMonth: lastMonthSubs.length,
        revenue: paidSubs.reduce((sum, s) => sum + s.amount_cents, 0),
        revenueThisMonth,
        revenueLastMonth,
        paidSubs: paidSubs.length,
      });

      setRecentSubs(recentRes.data || []);
      setLoading(false);
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
    { title: "Total de Clientes", value: stats.tenants, icon: Users, color: "text-primary", change: null },
    { title: "Assinaturas do Mês", value: stats.subsThisMonth, icon: ShoppingCart, color: "text-blue-400", change: `${Number(subsGrowth) >= 0 ? "+" : ""}${subsGrowth}%` },
    { title: "Receita do Mês", value: `R$ ${(stats.revenueThisMonth / 100).toFixed(2)}`, icon: DollarSign, color: "text-emerald-400", change: `${Number(revenueGrowth) >= 0 ? "+" : ""}${revenueGrowth}%` },
    { title: "Receita Total", value: `R$ ${(stats.revenue / 100).toFixed(2)}`, icon: TrendingUp, color: "text-amber-400", change: `${stats.paidSubs} pagos` },
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
                <div key={p.name} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <span className="text-sm">{PLAN_ICONS[p.name.toLowerCase()] || "📦"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.value} clientes</p>
                  </div>
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                </div>
              ))}
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
                  const tenantName = (s.tenants as any)?.name || "Cliente";
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">Plano {s.plan?.charAt(0).toUpperCase() + s.plan?.slice(1)}</p>
                        <p className="text-xs text-muted-foreground">{tenantName}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusBadge status={STATUS_MAP[s.status] || s.status} />
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
            <Users className="h-3.5 w-3.5" /> Clientes
          </div>
          <p className="text-xl font-bold">{loading ? "..." : stats.tenants}</p>
        </Card>
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <CreditCard className="h-3.5 w-3.5" /> Total Assinaturas
          </div>
          <p className="text-xl font-bold">{loading ? "..." : stats.subscriptions}</p>
        </Card>
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Crown className="h-3.5 w-3.5" /> Pagos
          </div>
          <p className="text-xl font-bold">{loading ? "..." : stats.paidSubs}</p>
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
