import { useMemo } from "react";
import {
  Users, Power, ShoppingCart, DollarSign, TrendingUp, Award, Percent, Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { Affiliate, AffiliateOrder, AffiliatePayout, formatBRL } from "./types";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(270, 80%, 60%)",
  "hsl(200, 85%, 55%)",
  "hsl(45, 90%, 55%)",
  "hsl(160, 65%, 45%)",
];

interface Props {
  affiliates: Affiliate[];
  orders: AffiliateOrder[];
  payouts: AffiliatePayout[];
  loading: boolean;
}

const AffiliateOverview = ({ affiliates, orders, payouts, loading }: Props) => {
  const totalSales = affiliates.reduce((s, a) => s + a.total_sales, 0);
  const totalRevenue = affiliates.reduce((s, a) => s + a.total_revenue_cents, 0);

  const totalCommissionEarned = useMemo(() => {
    return affiliates.reduce((sum, aff) => {
      return sum + Math.round(aff.total_revenue_cents * aff.commission_percent / 100);
    }, 0);
  }, [affiliates]);

  const totalPaid = useMemo(() => {
    return payouts.filter(p => p.status === "paid").reduce((s, p) => s + p.amount_cents, 0);
  }, [payouts]);

  const pendingPayout = totalCommissionEarned - totalPaid;

  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; vendas: number; receita: number }> = {};
    orders.forEach((o) => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      if (!months[key]) months[key] = { month: label, vendas: 0, receita: 0 };
      months[key].vendas += 1;
      months[key].receita += o.total_cents;
    });
    return Object.values(months).slice(-6);
  }, [orders]);

  const topAffiliates = useMemo(() => {
    return [...affiliates]
      .sort((a, b) => b.total_sales - a.total_sales)
      .slice(0, 5)
      .map((a) => ({ name: a.name, value: a.total_sales }));
  }, [affiliates]);

  const radarData = useMemo(() => {
    const activeCount = affiliates.filter(a => a.active).length;
    const convRate = orders.length > 0
      ? (orders.filter(o => o.status === "delivered" || o.status === "paid").length / orders.length) * 100
      : 0;
    return [
      { metric: "Afiliados", value: Math.min(affiliates.length * 10, 100) },
      { metric: "Vendas", value: Math.min(totalSales * 5, 100) },
      { metric: "Receita", value: Math.min(totalRevenue / 1000, 100) },
      { metric: "Conversão", value: Math.min(convRate, 100) },
      { metric: "Ativos", value: activeCount > 0 ? Math.min(activeCount * 15, 100) : 0 },
      { metric: "Comissão", value: Math.min(totalCommissionEarned / 500, 100) },
    ];
  }, [affiliates, orders, totalSales, totalRevenue, totalCommissionEarned]);

  const stats = [
    { label: "Total Afiliados", value: affiliates.length, icon: Users, accent: "from-pink-500 to-rose-600" },
    { label: "Ativos", value: affiliates.filter((a) => a.active).length, icon: Power, accent: "from-emerald-400 to-teal-500" },
    { label: "Vendas via Afiliados", value: totalSales, icon: ShoppingCart, accent: "from-amber-400 to-orange-500" },
    { label: "Receita Gerada", value: formatBRL(totalRevenue), icon: DollarSign, accent: "from-emerald-400 to-cyan-500" },
    { label: "Comissão Total", value: formatBRL(totalCommissionEarned), icon: Percent, accent: "from-violet-500 to-purple-600" },
    { label: "Comissão Paga", value: formatBRL(totalPaid), icon: Award, accent: "from-emerald-400 to-green-500" },
    { label: "Comissão Pendente", value: formatBRL(pendingPayout), icon: TrendingUp, accent: "from-amber-400 to-yellow-500" },
    { label: "Taxa Conversão", value: orders.length > 0 ? `${((orders.filter(o => o.status === "delivered" || o.status === "paid").length / orders.length) * 100).toFixed(1)}%` : "0%", icon: Sparkles, accent: "from-pink-500 to-violet-500" },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted/20 animate-pulse border border-border/30" />
        ))}
      </div>
    );
  }

  const tooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
    boxShadow: "0 20px 60px -15px hsl(var(--primary) / 0.2)",
    backdropFilter: "blur(12px)",
  };

  return (
    <div className="space-y-6">
      {/* ── SVG Gradients for charts ── */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="aff-bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="aff-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="aff-area-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="50%" stopColor="hsl(270, 80%, 60%)" />
            <stop offset="100%" stopColor="hsl(200, 85%, 55%)" />
          </linearGradient>
          <filter id="aff-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
      </svg>

      {/* ── Stat Cards ── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="group relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-4 space-y-1.5 overflow-hidden transition-all duration-500 hover:border-primary/30 hover:shadow-[0_0_40px_-12px_hsl(var(--primary)/0.25)]"
          >
            {/* Glowing accent line */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${s.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />
            {/* Soft orb */}
            <div className={`absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${s.accent} opacity-[0.06] group-hover:opacity-[0.12] blur-2xl transition-opacity duration-700`} />

            <div className="relative flex items-center gap-2">
              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${s.accent} bg-opacity-10`}>
                <s.icon className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="relative text-xl font-bold font-display tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Charts Row 1: Bar + Pie ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Vendas por Mês */}
        <div className="relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-violet-500/[0.02] pointer-events-none" />
          <h3 className="relative text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="p-1 rounded-md bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            Vendas por Mês
          </h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--primary) / 0.06)" }} />
                <Bar dataKey="vendas" fill="url(#aff-bar-grad)" radius={[8, 8, 0, 0]} filter="url(#aff-glow)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Sem dados ainda</p>
          )}
        </div>

        {/* Top Afiliados */}
        <div className="relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-bl from-violet-500/[0.03] via-transparent to-primary/[0.02] pointer-events-none" />
          <h3 className="relative text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="p-1 rounded-md bg-primary/10">
              <Award className="h-4 w-4 text-primary" />
            </div>
            Top Afiliados
          </h3>
          {topAffiliates.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={topAffiliates}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={78}
                    innerRadius={40}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                  >
                    {topAffiliates.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5 flex-1">
                {topAffiliates.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-2.5 text-xs group/item">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-card"
                      style={{ background: COLORS[i % COLORS.length], ringColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="truncate text-muted-foreground group-hover/item:text-foreground transition-colors">{a.name}</span>
                    <span className="ml-auto font-bold font-mono">{a.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Sem dados ainda</p>
          )}
        </div>
      </div>

      {/* ── Charts Row 2: Area + Radar ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Receita por Mês */}
        <div className="relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/[0.03] via-transparent to-primary/[0.02] pointer-events-none" />
          <h3 className="relative text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="p-1 rounded-md bg-emerald-500/10">
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            Receita por Mês
          </h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => [formatBRL(value), "Receita"]} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="receita" stroke="url(#aff-area-stroke)" strokeWidth={2.5} fill="url(#aff-area-fill)" filter="url(#aff-glow)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Sem dados ainda</p>
          )}
        </div>

        {/* Performance Radar */}
        <div className="relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-violet-500/[0.03] pointer-events-none" />
          <h3 className="relative text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="p-1 rounded-md bg-violet-500/10">
              <Sparkles className="h-4 w-4 text-violet-400" />
            </div>
            Performance Geral
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
              <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar
                name="Performance"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.15}
                strokeWidth={2}
                filter="url(#aff-glow)"
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Ranking ── */}
      {affiliates.length > 0 && (
        <div className="relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-amber-500/[0.02] pointer-events-none" />
          <h3 className="relative text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="p-1 rounded-md bg-amber-500/10">
              <Award className="h-4 w-4 text-amber-400" />
            </div>
            Ranking de Afiliados
          </h3>
          <div className="space-y-2">
            {[...affiliates]
              .sort((a, b) => b.total_revenue_cents - a.total_revenue_cents)
              .slice(0, 10)
              .map((aff, i) => {
                const commission = Math.round(aff.total_revenue_cents * aff.commission_percent / 100);
                return (
                  <div
                    key={aff.id}
                    className="group flex items-center gap-3 rounded-xl bg-muted/10 border border-border/30 px-4 py-2.5 transition-all duration-300 hover:bg-muted/20 hover:border-primary/20 hover:shadow-[0_0_24px_-8px_hsl(var(--primary)/0.15)]"
                  >
                    <span className={`text-sm font-bold w-7 text-center ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <span className="text-sm font-medium flex-1 truncate">{aff.name}</span>
                    <span className="text-xs text-muted-foreground">{aff.total_sales} vendas</span>
                    <span className="text-xs font-mono font-bold">{formatBRL(aff.total_revenue_cents)}</span>
                    <span className="text-xs text-primary font-semibold">{formatBRL(commission)} com.</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliateOverview;
