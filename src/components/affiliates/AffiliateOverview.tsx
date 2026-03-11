import { useMemo } from "react";
import {
  Users, Power, ShoppingCart, DollarSign, TrendingUp, Award, Percent,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Affiliate, AffiliateOrder, AffiliatePayout, formatBRL } from "./types";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

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

  // Monthly sales chart data
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

  // Top affiliates pie chart
  const topAffiliates = useMemo(() => {
    return [...affiliates]
      .sort((a, b) => b.total_sales - a.total_sales)
      .slice(0, 5)
      .map((a) => ({ name: a.name, value: a.total_sales }));
  }, [affiliates]);

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
      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4 space-y-1">
            <div className="flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-xl font-bold font-display">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly sales chart */}
        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Vendas por Mês
          </h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Sem dados ainda</p>
          )}
        </div>

        {/* Top affiliates pie */}
        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> Top Afiliados
          </h3>
          {topAffiliates.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={topAffiliates} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {topAffiliates.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {topAffiliates.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-2 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="truncate">{a.name}</span>
                    <span className="ml-auto font-bold">{a.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Sem dados ainda</p>
          )}
        </div>
      </div>

      {/* Ranking */}
      {affiliates.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> Ranking de Afiliados
          </h3>
          <div className="space-y-2">
            {[...affiliates]
              .sort((a, b) => b.total_revenue_cents - a.total_revenue_cents)
              .slice(0, 10)
              .map((aff, i) => {
                const commission = Math.round(aff.total_revenue_cents * aff.commission_percent / 100);
                return (
                  <div key={aff.id} className="flex items-center gap-3 rounded-lg bg-muted/20 border border-border/50 px-4 py-2.5">
                    <span className={`text-sm font-bold w-6 text-center ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <span className="text-sm font-medium flex-1 truncate">{aff.name}</span>
                    <span className="text-xs text-muted-foreground">{aff.total_sales} vendas</span>
                    <span className="text-xs font-mono font-bold">{formatBRL(aff.total_revenue_cents)}</span>
                    <span className="text-xs text-primary font-bold">{formatBRL(commission)} com.</span>
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
