import { useMemo } from "react";
import {
  Users, Power, ShoppingCart, DollarSign, TrendingUp, Award, Percent,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { Affiliate, AffiliateOrder, AffiliatePayout, formatBRL } from "./types";

const COLORS = [
  "hsl(330, 100%, 50%)",
  "hsl(270, 80%, 60%)",
  "hsl(200, 90%, 55%)",
  "hsl(45, 95%, 55%)",
  "hsl(160, 70%, 45%)",
];

interface Props {
  affiliates: Affiliate[];
  orders: AffiliateOrder[];
  payouts: AffiliatePayout[];
  loading: boolean;
}

/* ── SVG filter definitions for surreal effects ── */
const SurrealFilters = () => (
  <svg width="0" height="0" style={{ position: "absolute" }}>
    <defs>
      {/* Glow / neon filter */}
      <filter id="surreal-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
        <feColorMatrix in="blur" type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="glow" />
        <feComposite in="SourceGraphic" in2="glow" operator="over" />
      </filter>

      {/* Turbulence texture for bar backgrounds */}
      <filter id="surreal-texture" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="2" result="noise" />
        <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
        <feBlend in="SourceGraphic" in2="mono" mode="overlay" result="textured" />
      </filter>

      {/* Dreamy displacement */}
      <filter id="surreal-warp">
        <feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="2" seed="5" result="warp" />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="6" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      {/* Gradient definitions for bars */}
      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="hsl(330, 100%, 60%)" stopOpacity={1} />
        <stop offset="50%" stopColor="hsl(270, 80%, 55%)" stopOpacity={0.9} />
        <stop offset="100%" stopColor="hsl(200, 90%, 50%)" stopOpacity={0.7} />
      </linearGradient>

      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="hsl(330, 100%, 55%)" stopOpacity={0.6} />
        <stop offset="100%" stopColor="hsl(270, 80%, 60%)" stopOpacity={0.05} />
      </linearGradient>

      <linearGradient id="areaStroke" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="hsl(330, 100%, 55%)" />
        <stop offset="50%" stopColor="hsl(270, 80%, 60%)" />
        <stop offset="100%" stopColor="hsl(200, 90%, 55%)" />
      </linearGradient>

      {/* Radial glow for pie */}
      <radialGradient id="pieGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="hsl(330, 100%, 60%)" stopOpacity={0.15} />
        <stop offset="100%" stopColor="transparent" stopOpacity={0} />
      </radialGradient>
    </defs>
  </svg>
);

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

  // Radar data for performance overview
  const radarData = useMemo(() => {
    const activeCount = affiliates.filter(a => a.active).length;
    const convRate = orders.length > 0
      ? (orders.filter(o => o.status === "delivered" || o.status === "paid").length / orders.length) * 100
      : 0;
    return [
      { metric: "Afiliados", value: Math.min(affiliates.length * 10, 100), fullMark: 100 },
      { metric: "Vendas", value: Math.min(totalSales * 5, 100), fullMark: 100 },
      { metric: "Receita", value: Math.min(totalRevenue / 1000, 100), fullMark: 100 },
      { metric: "Conversão", value: Math.min(convRate, 100), fullMark: 100 },
      { metric: "Ativos", value: activeCount > 0 ? Math.min(activeCount * 15, 100) : 0, fullMark: 100 },
      { metric: "Comissão", value: Math.min(totalCommissionEarned / 500, 100), fullMark: 100 },
    ];
  }, [affiliates, orders, totalSales, totalRevenue, totalCommissionEarned]);

  const stats = [
    { label: "Total Afiliados", value: affiliates.length, icon: Users, color: "text-primary" },
    { label: "Ativos", value: affiliates.filter((a) => a.active).length, icon: Power, color: "text-emerald-400" },
    { label: "Vendas via Afiliados", value: totalSales, icon: ShoppingCart, color: "text-amber-400" },
    { label: "Receita Gerada", value: formatBRL(totalRevenue), icon: DollarSign, color: "text-emerald-400" },
    { label: "Comissão Total", value: formatBRL(totalCommissionEarned), icon: Percent, color: "text-primary" },
    { label: "Comissão Paga", value: formatBRL(totalPaid), icon: Award, color: "text-emerald-400" },
    { label: "Comissão Pendente", value: formatBRL(pendingPayout), icon: TrendingUp, color: "text-amber-400" },
    { label: "Taxa Conversão", value: orders.length > 0 ? `${((orders.filter(o => o.status === "delivered" || o.status === "paid").length / orders.length) * 100).toFixed(1)}%` : "0%", icon: TrendingUp, color: "text-primary" },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SurrealFilters />

      {/* Summary cards with surreal hover glow */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s, idx) => (
          <div
            key={s.label}
            className="group relative rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4 space-y-1 overflow-hidden transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]"
          >
            {/* Surreal background orb */}
            <div
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.08] group-hover:opacity-[0.18] transition-opacity duration-700 blur-xl"
              style={{
                background: COLORS[idx % COLORS.length],
              }}
            />
            <div className="relative flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color} drop-shadow-[0_0_6px_currentColor]`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="relative text-xl font-bold font-display">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bar chart with gradient + texture filter */}
        <div className="relative rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5 overflow-hidden">
          {/* Surreal background texture */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(ellipse at 20% 50%, hsl(330, 100%, 50%) 0%, transparent 50%),
                                radial-gradient(ellipse at 80% 20%, hsl(270, 80%, 60%) 0%, transparent 50%)`,
            }}
          />
          <h3 className="relative text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary drop-shadow-[0_0_8px_hsl(var(--primary))]" />
            <span className="bg-gradient-to-r from-primary to-[hsl(270,80%,60%)] bg-clip-text text-transparent">
              Vendas por Mês
            </span>
          </h3>
          {monthlyData.length > 0 ? (
            <div style={{ filter: "url(#surreal-glow)" }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: "0 8px 32px -8px hsl(330 100% 50% / 0.3)",
                    }}
                  />
                  <Bar dataKey="vendas" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Sem dados ainda</p>
          )}
        </div>

        {/* Pie chart with glow effect */}
        <div className="relative rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 50% 50%, hsl(270, 80%, 55%) 0%, transparent 60%)`,
            }}
          />
          <h3 className="relative text-sm font-semibold mb-4 flex items-center gap-2">
            <Award className="h-4 w-4 text-primary drop-shadow-[0_0_8px_hsl(var(--primary))]" />
            <span className="bg-gradient-to-r from-[hsl(270,80%,60%)] to-[hsl(200,90%,55%)] bg-clip-text text-transparent">
              Top Afiliados
            </span>
          </h3>
          {topAffiliates.length > 0 ? (
            <div className="flex items-center gap-4">
              <div style={{ filter: "url(#surreal-glow)" }} className="w-1/2">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <circle cx="50%" cy="50%" r="90" fill="url(#pieGlow)" />
                    <Pie
                      data={topAffiliates}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={35}
                      strokeWidth={2}
                      stroke="hsl(var(--card))"
                    >
                      {topAffiliates.map((_, i) => (
                        <Cell
                          key={i}
                          fill={COLORS[i % COLORS.length]}
                          style={{ filter: "drop-shadow(0 0 6px " + COLORS[i % COLORS.length] + ")" }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                        boxShadow: "0 8px 32px -8px hsl(270 80% 55% / 0.3)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 flex-1">
                {topAffiliates.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-2 text-xs group/item">
                    <div
                      className="h-3 w-3 rounded-full shrink-0 shadow-[0_0_8px_var(--glow)]"
                      style={{
                        background: COLORS[i % COLORS.length],
                        ["--glow" as string]: COLORS[i % COLORS.length],
                      }}
                    />
                    <span className="truncate group-hover/item:text-foreground transition-colors">{a.name}</span>
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

      {/* Charts row 2 — Area + Radar */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue area chart */}
        <div className="relative rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(ellipse at 70% 80%, hsl(45, 95%, 55%) 0%, transparent 50%)`,
            }}
          />
          <h3 className="relative text-sm font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_8px_hsl(160,70%,45%)]" />
            <span className="bg-gradient-to-r from-[hsl(330,100%,55%)] to-[hsl(45,95%,55%)] bg-clip-text text-transparent">
              Receita por Mês
            </span>
          </h3>
          {monthlyData.length > 0 ? (
            <div style={{ filter: "url(#surreal-glow)" }}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatBRL(value), "Receita"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: "0 8px 32px -8px hsl(330 100% 50% / 0.3)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="receita"
                    stroke="url(#areaStroke)"
                    strokeWidth={3}
                    fill="url(#areaGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Sem dados ainda</p>
          )}
        </div>

        {/* Radar chart — performance */}
        <div className="relative rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 50% 50%, hsl(200, 90%, 55%) 0%, transparent 55%)`,
            }}
          />
          <h3 className="relative text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary drop-shadow-[0_0_8px_hsl(var(--primary))]" />
            <span className="bg-gradient-to-r from-[hsl(200,90%,55%)] to-[hsl(160,70%,45%)] bg-clip-text text-transparent">
              Performance Geral
            </span>
          </h3>
          <div style={{ filter: "url(#surreal-warp)" }}>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar
                  name="Performance"
                  dataKey="value"
                  stroke="hsl(330, 100%, 55%)"
                  fill="hsl(330, 100%, 55%)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Ranking */}
      {affiliates.length > 0 && (
        <div className="relative rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(ellipse at 10% 50%, hsl(330, 100%, 50%) 0%, transparent 40%),
                                radial-gradient(ellipse at 90% 50%, hsl(270, 80%, 60%) 0%, transparent 40%)`,
            }}
          />
          <h3 className="relative text-sm font-semibold mb-4 flex items-center gap-2">
            <Award className="h-4 w-4 text-primary drop-shadow-[0_0_8px_hsl(var(--primary))]" />
            <span className="bg-gradient-to-r from-primary to-[hsl(45,95%,55%)] bg-clip-text text-transparent">
              Ranking de Afiliados
            </span>
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
                    className="group flex items-center gap-3 rounded-lg bg-muted/20 border border-border/50 px-4 py-2.5 transition-all duration-300 hover:bg-muted/30 hover:shadow-[0_0_20px_-8px_hsl(var(--primary)/0.3)]"
                  >
                    <span className={`text-sm font-bold w-6 text-center ${i < 3 ? "text-primary drop-shadow-[0_0_6px_hsl(var(--primary))]" : "text-muted-foreground"}`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <span className="text-sm font-medium flex-1 truncate">{aff.name}</span>
                    <span className="text-xs text-muted-foreground">{aff.total_sales} vendas</span>
                    <span className="text-xs font-mono font-bold">{formatBRL(aff.total_revenue_cents)}</span>
                    <span className="text-xs text-primary font-bold drop-shadow-[0_0_4px_hsl(var(--primary)/0.5)]">
                      {formatBRL(commission)} com.
                    </span>
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
