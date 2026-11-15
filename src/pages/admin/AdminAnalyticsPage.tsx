import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, DollarSign, UserMinus, Activity,
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Tenant {
  id: string;
  name: string;
  plan: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  tenant_id: string;
  amount_cents: number;
  status: string;
  plan: string;
  paid_at: string | null;
  created_at: string;
}

const COLORS = ["hsl(330, 100%, 71%)", "hsl(270, 80%, 65%)", "hsl(200, 80%, 60%)", "hsl(45, 90%, 60%)", "hsl(150, 60%, 50%)"];

const AdminAnalyticsPage = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [months] = useState(12);

  useEffect(() => {
    const fetch = async () => {
      const [t, p] = await Promise.all([
        (supabase as any).from("tenants").select("id, name, plan, created_at").order("created_at"),
        (supabase as any).from("subscription_payments").select("id, tenant_id, amount_cents, status, plan, paid_at, created_at").eq("status", "paid").order("paid_at"),
      ]);
      setTenants(t.data || []);
      setPayments(p.data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const monthRange = useMemo(() => {
    const end = endOfMonth(new Date());
    const start = startOfMonth(subMonths(end, months - 1));
    return eachMonthOfInterval({ start, end });
  }, [months]);

  // — Client growth (cumulative)
  const growthData = useMemo(() => {
    let cumulative = 0;
    return monthRange.map((m) => {
      const key = format(m, "yyyy-MM");
      const newInMonth = tenants.filter((t) => format(parseISO(t.created_at), "yyyy-MM") === key).length;
      cumulative += newInMonth;
      return {
        month: format(m, "MMM yy", { locale: ptBR }),
        novos: newInMonth,
        total: cumulative,
      };
    });
  }, [tenants, monthRange]);

  // — MRR (Monthly Recurring Revenue)
  const mrrData = useMemo(() => {
    return monthRange.map((m) => {
      const key = format(m, "yyyy-MM");
      const monthPayments = payments.filter(
        (p) => p.paid_at && format(parseISO(p.paid_at), "yyyy-MM") === key
      );
      const totalCents = monthPayments.reduce((sum, p) => sum + p.amount_cents, 0);
      return {
        month: format(m, "MMM yy", { locale: ptBR }),
        mrr: totalCents / 100,
        count: monthPayments.length,
      };
    });
  }, [payments, monthRange]);

  // — Churn rate estimate (tenants that downgraded to free or have no recent payment)
  const churnData = useMemo(() => {
    return monthRange.map((m) => {
      const key = format(m, "yyyy-MM");
      const monthEnd = endOfMonth(m);

      // Tenants that existed before this month
      const existingBefore = tenants.filter(
        (t) => parseISO(t.created_at) < startOfMonth(m)
      ).length;

      if (existingBefore === 0) return { month: format(m, "MMM yy", { locale: ptBR }), churn: 0 };

      // "Churned" = tenants created before this month that have no payment in this month
      // and had at least one payment before
      const tenantsWithPaymentBefore = new Set(
        payments
          .filter((p) => p.paid_at && parseISO(p.paid_at) < startOfMonth(m))
          .map((p) => p.tenant_id)
      );

      const tenantsWithPaymentThisMonth = new Set(
        payments
          .filter((p) => p.paid_at && format(parseISO(p.paid_at), "yyyy-MM") === key)
          .map((p) => p.tenant_id)
      );

      let churned = 0;
      tenantsWithPaymentBefore.forEach((tid) => {
        if (!tenantsWithPaymentThisMonth.has(tid)) churned++;
      });

      const rate = tenantsWithPaymentBefore.size > 0 ? (churned / tenantsWithPaymentBefore.size) * 100 : 0;

      return {
        month: format(m, "MMM yy", { locale: ptBR }),
        churn: Math.round(rate * 10) / 10,
        churned,
      };
    });
  }, [tenants, payments, monthRange]);

  // — Plan distribution
  const planDist = useMemo(() => {
    const map: Record<string, number> = {};
    tenants.forEach((t) => {
      const plan = t.plan || "free";
      map[plan] = (map[plan] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [tenants]);

  // — KPI cards
  const totalClients = tenants.length;
  const currentMRR = mrrData.length > 0 ? mrrData[mrrData.length - 1].mrr : 0;
  const prevMRR = mrrData.length > 1 ? mrrData[mrrData.length - 2].mrr : 0;
  const mrrGrowth = prevMRR > 0 ? ((currentMRR - prevMRR) / prevMRR) * 100 : 0;
  const currentChurn = churnData.length > 0 ? churnData[churnData.length - 1].churn : 0;
  const newThisMonth = growthData.length > 0 ? growthData[growthData.length - 1].novos : 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios & Analytics</h1>
        <p className="text-muted-foreground">Métricas de crescimento, receita e retenção do SaaS</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total de Clientes" value={totalClients.toString()} icon={Users} subtitle={`+${newThisMonth} este mês`} trend="up" />
        <KpiCard
          title="MRR Atual"
          value={`R$ ${currentMRR.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          subtitle={`${mrrGrowth >= 0 ? "+" : ""}${mrrGrowth.toFixed(1)}% vs mês anterior`}
          trend={mrrGrowth >= 0 ? "up" : "down"}
        />
        <KpiCard title="Churn Rate" value={`${currentChurn}%`} icon={UserMinus} subtitle="Mês atual" trend={currentChurn > 5 ? "down" : "up"} />
        <KpiCard
          title="Ticket Médio"
          value={`R$ ${payments.length > 0 ? (payments.reduce((s, p) => s + p.amount_cents, 0) / payments.length / 100).toFixed(2) : "0.00"}`}
          icon={Activity}
          subtitle="Média por pagamento"
          trend="up"
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList className="bg-card border border-border flex flex-wrap sm:inline-flex gap-1 w-full sm:w-auto justify-start h-auto p-1">
          <TabsTrigger value="growth">Crescimento</TabsTrigger>
          <TabsTrigger value="mrr">MRR</TabsTrigger>
          <TabsTrigger value="churn">Churn</TabsTrigger>
          <TabsTrigger value="plans">Planos</TabsTrigger>
        </TabsList>

        <TabsContent value="growth">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Crescimento de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthData}>
                    <defs>
                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(330, 100%, 71%)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(330, 100%, 71%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }} />
                    <RechartsTooltip contentStyle={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8, color: "#fff" }} />
                    <Legend />
                    <Area type="monotone" dataKey="total" name="Total acumulado" stroke="hsl(330, 100%, 71%)" fill="url(#gradTotal)" strokeWidth={2} />
                    <Bar dataKey="novos" name="Novos no mês" fill="hsl(270, 80%, 65%)" radius={[4, 4, 0, 0]} barSize={20} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mrr">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Receita Mensal Recorrente (MRR)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mrrData}>
                    <defs>
                      <linearGradient id="gradMRR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(150, 60%, 50%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(150, 60%, 50%)" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                    <RechartsTooltip
                      contentStyle={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8, color: "#fff" }}
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "MRR"]}
                    />
                    <Bar dataKey="mrr" name="MRR" fill="url(#gradMRR)" radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="churn">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Churn Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={churnData}>
                    <defs>
                      <linearGradient id="gradChurn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(0, 80%, 60%)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(0, 80%, 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                    <RechartsTooltip
                      contentStyle={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8, color: "#fff" }}
                      formatter={(value: number) => [`${value}%`, "Churn"]}
                    />
                    <Area type="monotone" dataKey="churn" name="Churn %" stroke="hsl(0, 80%, 60%)" fill="url(#gradChurn)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Distribuição de Planos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {planDist.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8, color: "#fff" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  subtitle: string;
  trend: "up" | "down";
}

const KpiCard = ({ title, value, icon: Icon, subtitle, trend }: KpiCardProps) => (
  <Card className="bg-card border-border">
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <div className="flex items-center gap-1">
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3 text-emerald-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-400" />
            )}
            <span className={`text-xs ${trend === "up" ? "text-emerald-400" : "text-red-400"}`}>{subtitle}</span>
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default AdminAnalyticsPage;
