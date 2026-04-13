import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DollarSign, ShoppingCart, TrendingUp, TrendingDown,
  Users, Clock, CalendarIcon,
} from "lucide-react";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { format, parseISO, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR as ptBRLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

interface Order {
  id: string;
  order_number: number;
  discord_user_id: string;
  discord_username: string | null;
  product_name: string;
  total_cents: number;
  status: string;
  created_at: string;
}

type PeriodKey = "today" | "7d" | "30d" | "custom";

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const statusColors: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  delivered: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  pending_payment: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  canceled: "bg-destructive/15 text-destructive border-destructive/20",
  refunded: "bg-muted text-muted-foreground border-border",
};

const PAID_STATUSES = ["paid", "delivered", "delivering"];

export const DashboardOverview = () => {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  const fetchOrders = async () => {
    if (!tenantId) return;
    const { data, error } = await supabase.functions.invoke("query-tenant-data", {
      body: {
        tenant_id: tenantId,
        table: "orders",
        select: "id, order_number, discord_user_id, discord_username, product_name, total_cents, status, created_at",
        order_by: "created_at",
        ascending: false,
        limit: 1000,
      },
    });
    setOrders((data as Order[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [tenantId]);

  // Realtime: auto-refresh when orders change
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("dashboard-orders-realtime")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` },
        () => { fetchOrders(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  // Compute date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    switch (period) {
      case "today":
        return { start: todayStart, end: now };
      case "7d":
        return { start: startOfDay(subDays(now, 6)), end: now };
      case "30d":
        return { start: startOfDay(subDays(now, 29)), end: now };
      case "custom":
        return { start: startOfDay(customRange.from), end: new Date(startOfDay(customRange.to).getTime() + 86400000 - 1) };
    }
  }, [period, customRange]);

  // Previous period for comparison
  const prevRange = useMemo(() => {
    const duration = dateRange.end.getTime() - dateRange.start.getTime();
    return {
      start: new Date(dateRange.start.getTime() - duration),
      end: new Date(dateRange.start.getTime() - 1),
    };
  }, [dateRange]);

  // Filter orders by period
  const filteredOrders = useMemo(() =>
    orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= dateRange.start && d <= dateRange.end;
    }), [orders, dateRange]);

  const prevOrders = useMemo(() =>
    orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= prevRange.start && d <= prevRange.end;
    }), [orders, prevRange]);

  // Stats
  const stats = useMemo(() => {
    const currentPaid = filteredOrders.filter(o => PAID_STATUSES.includes(o.status));
    const previousPaid = prevOrders.filter(o => PAID_STATUSES.includes(o.status));

    const revenue = currentPaid.reduce((s, o) => s + o.total_cents, 0);
    const prevRevenue = previousPaid.reduce((s, o) => s + o.total_cents, 0);
    const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : revenue > 0 ? 100 : 0;

    const ordersCount = currentPaid.length;
    const prevOrdersCount = previousPaid.length;
    const ordersChange = prevOrdersCount > 0 ? ((ordersCount - prevOrdersCount) / prevOrdersCount) * 100 : ordersCount > 0 ? 100 : 0;

    const avgTicket = ordersCount > 0 ? revenue / ordersCount : 0;
    const prevAvgTicket = prevOrdersCount > 0 ? prevRevenue / prevOrdersCount : 0;
    const avgChange = prevAvgTicket > 0 ? ((avgTicket - prevAvgTicket) / prevAvgTicket) * 100 : avgTicket > 0 ? 100 : 0;

    return { revenue, revenueChange, ordersCount, ordersChange, avgTicket, avgChange };
  }, [filteredOrders, prevOrders]);

  // Chart data based on selected period
  const chartData = useMemo(() => {
    if (period === "today") {
      // Hourly chart for today
      const hours: { date: string; revenue: number; orders: number }[] = [];
      const today = startOfDay(new Date());
      for (let h = 0; h < 24; h++) {
        const hourStart = new Date(today.getTime() + h * 3600000);
        const hourEnd = new Date(today.getTime() + (h + 1) * 3600000);
        const hourOrders = filteredOrders.filter(o => {
          if (!PAID_STATUSES.includes(o.status)) return false;
          const d = new Date(o.created_at);
          return d >= hourStart && d < hourEnd;
        });
        hours.push({
          date: `${String(h).padStart(2, "0")}:00`,
          revenue: hourOrders.reduce((s, o) => s + o.total_cents, 0) / 100,
          orders: hourOrders.length,
        });
      }
      return hours;
    }

    // Daily chart
    const days = eachDayOfInterval({ start: dateRange.start, end: startOfDay(dateRange.end) });
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayOrders = filteredOrders.filter(o => {
        if (!PAID_STATUSES.includes(o.status)) return false;
        return format(parseISO(o.created_at), "yyyy-MM-dd") === dayStr;
      });
      return {
        date: format(day, days.length > 14 ? "dd/MM" : "dd/MM", { locale: ptBRLocale }),
        revenue: dayOrders.reduce((s, o) => s + o.total_cents, 0) / 100,
        orders: dayOrders.length,
      };
    });
  }, [filteredOrders, period, dateRange]);

  // Top clients
  const topClients = useMemo(() => {
    const map = new Map<string, { username: string; total: number; count: number }>();
    filteredOrders
      .filter(o => PAID_STATUSES.includes(o.status))
      .forEach(o => {
        const key = o.discord_user_id;
        const existing = map.get(key);
        if (existing) {
          existing.total += o.total_cents;
          existing.count++;
        } else {
          map.set(key, { username: o.discord_username || o.discord_user_id, total: o.total_cents, count: 1 });
        }
      });
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filteredOrders]);

  // Recent sales (from filtered period)
  const recentSales = useMemo(() => filteredOrders.slice(0, 6), [filteredOrders]);

  const periodLabel = useMemo(() => {
    switch (period) {
      case "today": return t.dashboardOverview.today;
      case "7d": return t.dashboardOverview.days7;
      case "30d": return t.dashboardOverview.days30;
      case "custom": return `${format(customRange.from, "dd/MM")} — ${format(customRange.to, "dd/MM")}`;
    }
  }, [period, customRange, t]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[320px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    paid: t.dashboardOverview.statusPaid,
    delivered: t.dashboardOverview.statusDelivered,
    delivering: t.dashboardOverview.statusDelivering,
    pending_payment: t.dashboardOverview.statusPending,
    canceled: t.dashboardOverview.statusCanceled,
    refunded: t.dashboardOverview.statusRefunded,
  };

  const periodButtons: { key: PeriodKey; label: string }[] = [
    { key: "today", label: t.dashboardOverview.today },
    { key: "7d", label: t.dashboardOverview.days7 },
    { key: "30d", label: t.dashboardOverview.days30 },
    { key: "custom", label: t.dashboardOverview.custom },
  ];

  const chartConfig = {
    revenue: { label: t.dashboardOverview.revenue, color: "hsl(var(--primary))" },
    orders: { label: t.dashboardOverview.orders, color: "hsl(var(--secondary))" },
  };

  const statCards = [
    {
      title: `${t.dashboardOverview.revenue} (${periodLabel})`,
      value: formatCurrency(stats.revenue),
      change: stats.revenueChange,
      icon: DollarSign,
      gradient: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/15 text-primary",
    },
    {
      title: `${t.dashboardOverview.orders} (${periodLabel})`,
      value: stats.ordersCount.toString(),
      change: stats.ordersChange,
      icon: ShoppingCart,
      gradient: "from-secondary/20 to-secondary/5",
      iconBg: "bg-secondary/15 text-secondary",
    },
    {
      title: t.dashboardOverview.avgTicket,
      value: formatCurrency(stats.avgTicket),
      change: stats.avgChange,
      icon: TrendingUp,
      gradient: "from-emerald-500/20 to-emerald-500/5",
      iconBg: "bg-emerald-500/15 text-emerald-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {periodButtons.map(btn => (
          btn.key === "custom" ? (
            <Popover key={btn.key} open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={period === "custom" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "gap-2 rounded-full text-xs font-medium",
                    period === "custom" && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setPeriod("custom")}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {period === "custom"
                    ? `${format(customRange.from, "dd/MM")} — ${format(customRange.to, "dd/MM")}`
                    : "Personalizado"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: customRange.from, to: customRange.to }}
                  onSelect={(range: any) => {
                    if (range?.from) {
                      setCustomRange({ from: range.from, to: range.to || range.from });
                      setPeriod("custom");
                      if (range.to) setCalendarOpen(false);
                    }
                  }}
                  numberOfMonths={1}
                  disabled={(date) => date > new Date()}
                  className={cn("p-3 pointer-events-auto")}
                  locale={ptBRLocale}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <Button
              key={btn.key}
              variant={period === btn.key ? "default" : "outline"}
              size="sm"
              className={cn(
                "rounded-full text-xs font-medium",
                period === btn.key && "bg-primary text-primary-foreground"
              )}
              onClick={() => setPeriod(btn.key)}
            >
              {btn.label}
            </Button>
          )
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.title}
            className={`relative overflow-hidden rounded-xl border border-border bg-gradient-to-br ${card.gradient} p-5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold font-display tracking-tight">{card.value}</p>
                {card.change !== 0 && (
                  <div className={`inline-flex items-center gap-1 text-xs font-semibold ${card.change > 0 ? "text-emerald-400" : "text-destructive"}`}>
                    {card.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {card.change > 0 ? "+" : ""}{card.change.toFixed(1)}% {t.dashboardOverview.vsPrevPeriod}
                  </div>
                )}
              </div>
              <div className={`rounded-xl p-2.5 ${card.iconBg}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-primary/5 blur-xl" />
          </div>
        ))}
      </div>

      {/* Charts + Top Clients */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 border-border bg-card overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {t.dashboardOverview.revenue} — {period === "today" ? t.dashboardOverview.perHour : periodLabel}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{t.dashboardOverview.valuesInCurrency}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" /> {t.dashboardOverview.revenue}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-secondary" /> {t.dashboardOverview.orders}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="20%">
                <defs>
                  <linearGradient id="revBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => `R$${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="url(#revBarGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">{t.dashboardOverview.topClients}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">{t.dashboardOverview.inSelectedPeriod}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t.dashboardOverview.noDataPeriod}</p>
            ) : (
              topClients.map((client, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                        {client.username[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    {i < 3 && (
                      <span className={`absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        i === 0 ? "bg-amber-400 text-amber-900" : i === 1 ? "bg-slate-300 text-slate-700" : "bg-orange-400 text-orange-900"
                      }`}>
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{client.username}</p>
                    <p className="text-xs text-muted-foreground">{client.count} {client.count > 1 ? t.dashboardOverview.orders_plural : t.dashboardOverview.order}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(client.total)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales + Orders Bar Chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Sales */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">{t.dashboardOverview.recentSales}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t.dashboardOverview.noSalesPeriod}</p>
            ) : (
              recentSales.map(sale => (
                <div key={sale.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/60">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">#{sale.order_number}</span>
                      <span className="text-sm font-medium truncate">{sale.product_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sale.discord_username || sale.discord_user_id} · {format(parseISO(sale.created_at), "dd/MM HH:mm")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={`text-[10px] border ${statusColors[sale.status] || "bg-muted text-muted-foreground"}`}>
                      {statusLabels[sale.status] || sale.status}
                    </Badge>
                    <span className="text-sm font-bold tabular-nums min-w-[72px] text-right">{formatCurrency(sale.total_cents)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Orders Bar Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t.dashboardOverview.orderVolume} — {period === "today" ? t.dashboardOverview.perHour : periodLabel}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t.dashboardOverview.orderQty} {period === "today" ? t.dashboardOverview.perHour.toLowerCase() : t.dashboardOverview.perDay}</p>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
