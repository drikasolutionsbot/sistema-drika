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
import { fetchAllRows } from "@/lib/supabasePagination";
import {
  computeAdminAnalytics,
  type AdminSubscriptionPaymentRecord,
  type AdminTenantRecord,
} from "@/lib/adminStats";

const AdminAnalyticsPage = () => {
  const [tenants, setTenants] = useState<AdminTenantRecord[]>([]);
  const [payments, setPayments] = useState<AdminSubscriptionPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [months] = useState(12);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [allTenants, allPayments] = await Promise.all([
          fetchAllRows<AdminTenantRecord>((from, to) =>
            (supabase as any)
              .from("tenants")
              .select("id, name, plan, plan_cycle, plan_expires_at, created_at")
              .order("created_at")
              .range(from, to)
          ),
          fetchAllRows<AdminSubscriptionPaymentRecord>((from, to) =>
            (supabase as any)
              .from("subscription_payments")
              .select("id, tenant_id, amount_cents, status, plan, paid_at, created_at, period_start, period_end, payer_name, payer_email, metadata")
              .eq("status", "paid")
              .order("created_at")
              .range(from, to)
          ),
        ]);
        setTenants(allTenants);
        setPayments(allPayments);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const { growthData, mrrData, churnData, planDist, kpis } = useMemo(
    () => computeAdminAnalytics({ tenants, payments, months }),
    [tenants, payments, months]
  );

  const {
    totalClients,
    paidActiveClients,
    currentMRR,
    mrrGrowth,
    currentChurn,
    currentChurnedCount,
    newThisMonth,
    avgTicketCents,
    paidPaymentsCount,
  } = kpis;

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
        <KpiCard
          title="Total de Clientes"
          value={totalClients.toString()}
          icon={Users}
          subtitle={`+${newThisMonth} este mês · ${paidActiveClients} pagos ativos`}
          trend="up"
        />
        <KpiCard
          title="MRR Atual"
          value={`R$ ${currentMRR.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          subtitle={`${mrrGrowth >= 0 ? "+" : ""}${mrrGrowth.toFixed(1)}% vs mês anterior`}
          trend={mrrGrowth >= 0 ? "up" : "down"}
        />
        <KpiCard
          title="Churn Rate"
          value={`${currentChurn}%`}
          icon={UserMinus}
          subtitle={currentChurnedCount > 0 ? `${currentChurnedCount} não renovado(s) no mês` : "Mês atual"}
          trend={currentChurn > 5 ? "down" : "up"}
        />
        <KpiCard
          title="Ticket Médio"
          value={`R$ ${(avgTicketCents / 100).toFixed(2)}`}
          icon={Activity}
          subtitle={`Média em ${paidPaymentsCount} pagamentos`}
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Receita Mensal Recorrente (MRR) vs Faturado</CardTitle>
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
                      formatter={(value: number, name: string) => [`R$ ${value.toFixed(2)}`, name]}
                    />
                    <Legend />
                    <Bar dataKey="mrr" name="MRR (Mensalizado)" fill="url(#gradMRR)" radius={[6, 6, 0, 0]} barSize={24} />
                    <Bar dataKey="revenue" name="Faturado no mês" fill="hsl(200, 80%, 60%)" radius={[6, 6, 0, 0]} barSize={24} />
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
                      formatter={(value: number, _name: string, props: any) => [
                        `${value}% (${props?.payload?.churned ?? 0}/${props?.payload?.base ?? 0})`,
                        "Churn",
                      ]}
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
            <CardContent className="space-y-4">
              <div className="h-72 flex items-center justify-center">
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
                      {planDist.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8, color: "#fff" }}
                      formatter={(value: number, name: string) => [`${value} clientes`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {planDist.map((p) => (
                  <div key={p.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <span className="text-sm">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.value} clientes ({totalClients > 0 ? Math.round((p.value / totalClients) * 100) : 0}%)
                      </p>
                    </div>
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  </div>
                ))}
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
