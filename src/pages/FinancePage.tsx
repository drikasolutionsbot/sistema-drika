import { useState, useMemo } from "react";
import {
  Download, Search, DollarSign, TrendingUp, TrendingDown, ShoppingCart,
  Users, FileSpreadsheet, FileText, Calendar, Filter, ArrowUpRight,
  ArrowDownRight, BarChart3, Eye, ChevronDown, RefreshCw, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTenantQuery } from "@/hooks/useSupabaseQuery";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subDays, startOfDay, endOfDay, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";

interface Order {
  id: string;
  order_number: number;
  discord_username: string;
  product_name: string;
  total_cents: number;
  status: string;
  payment_provider: string | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  paid: "Pago", delivered: "Entregue", pending_payment: "Pendente",
  delivering: "Entregando", canceled: "Cancelado", refunded: "Reembolsado",
};
const statusColors: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
  delivered: "bg-primary/15 text-primary border border-primary/20",
  pending_payment: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
  delivering: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  canceled: "bg-destructive/15 text-destructive border border-destructive/20",
  refunded: "bg-muted text-muted-foreground border border-border",
};
const statusPieColors: Record<string, string> = {
  paid: "#10b981", delivered: "#ec4899", pending_payment: "#eab308",
  delivering: "#3b82f6", canceled: "#ef4444", refunded: "#6b7280",
};

const PERIOD_OPTIONS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "custom", label: "Personalizado" },
];

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const FinancePage = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState("30d");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);

  const { data: orders = [], isLoading, refetch } = useTenantQuery<Order>(
    "finance-orders", "orders",
    { select: "id,order_number,discord_username,product_name,total_cents,status,payment_provider,created_at", orderBy: "created_at", ascending: false }
  );

  // Period filtering
  const periodFiltered = useMemo(() => {
    let from: Date, to: Date;
    if (period === "custom" && dateFrom && dateTo) {
      from = startOfDay(dateFrom);
      to = endOfDay(dateTo);
    } else {
      const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
      from = startOfDay(subDays(new Date(), days));
      to = endOfDay(new Date());
    }
    return orders.filter(o => {
      const d = parseISO(o.created_at);
      return isWithinInterval(d, { start: from, end: to });
    });
  }, [orders, period, dateFrom, dateTo]);

  // Search + status filter
  const filtered = useMemo(() => {
    return periodFiltered.filter(o => {
      const matchesSearch = !search ||
        String(o.order_number).includes(search) ||
        (o.discord_username || "").toLowerCase().includes(search.toLowerCase()) ||
        (o.product_name || "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [periodFiltered, search, statusFilter]);

  // Stats
  const paidOrders = periodFiltered.filter(o => o.status === "paid" || o.status === "delivered");
  const totalRevenue = paidOrders.reduce((s, o) => s + o.total_cents, 0);
  const totalOrders = periodFiltered.length;
  const avgTicket = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;
  const canceledCount = periodFiltered.filter(o => o.status === "canceled" || o.status === "refunded").length;
  const conversionRate = totalOrders > 0 ? Math.round((paidOrders.length / totalOrders) * 100) : 0;

  // Compare with previous period for trend
  const prevPeriodOrders = useMemo(() => {
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const currentFrom = period === "custom" && dateFrom ? dateFrom : subDays(new Date(), days);
    const currentTo = period === "custom" && dateTo ? dateTo : new Date();
    const duration = currentTo.getTime() - currentFrom.getTime();
    const prevFrom = new Date(currentFrom.getTime() - duration);
    const prevTo = new Date(currentFrom.getTime() - 1);
    return orders.filter(o => {
      const d = parseISO(o.created_at);
      return isWithinInterval(d, { start: startOfDay(prevFrom), end: endOfDay(prevTo) });
    });
  }, [orders, period, dateFrom, dateTo]);

  const prevPaidOrders = prevPeriodOrders.filter(o => o.status === "paid" || o.status === "delivered");
  const prevRevenue = prevPaidOrders.reduce((s, o) => s + o.total_cents, 0);
  const revenueTrend = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : totalRevenue > 0 ? 100 : 0;
  const ordersTrend = prevPeriodOrders.length > 0 ? Math.round(((totalOrders - prevPeriodOrders.length) / prevPeriodOrders.length) * 100) : totalOrders > 0 ? 100 : 0;

  // Chart data - Revenue over time
  const revenueChartData = useMemo(() => {
    const map = new Map<string, number>();
    paidOrders.forEach(o => {
      const day = format(parseISO(o.created_at), "dd/MM");
      map.set(day, (map.get(day) || 0) + o.total_cents);
    });
    return Array.from(map.entries()).map(([date, value]) => ({ date, value: value / 100 })).reverse();
  }, [paidOrders]);

  // Chart data - Orders per day
  const ordersChartData = useMemo(() => {
    const map = new Map<string, number>();
    periodFiltered.forEach(o => {
      const day = format(parseISO(o.created_at), "dd/MM");
      map.set(day, (map.get(day) || 0) + 1);
    });
    return Array.from(map.entries()).map(([date, count]) => ({ date, count })).reverse();
  }, [periodFiltered]);

  // Pie chart data - Status distribution
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    periodFiltered.forEach(o => map.set(o.status, (map.get(o.status) || 0) + 1));
    return Array.from(map.entries()).map(([status, value]) => ({
      name: statusLabels[status] || status, value, fill: statusPieColors[status] || "#6b7280",
    }));
  }, [periodFiltered]);

  // Top products
  const topProducts = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    paidOrders.forEach(o => {
      const name = o.product_name || "Sem nome";
      const prev = map.get(name) || { count: 0, revenue: 0 };
      map.set(name, { count: prev.count + 1, revenue: prev.revenue + o.total_cents });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [paidOrders]);

  // Export Excel
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = filtered.map(o => ({
      Pedido: `#${o.order_number}`,
      Usuário: o.discord_username || "-",
      Produto: o.product_name || "-",
      Total: (o.total_cents / 100).toFixed(2),
      Status: statusLabels[o.status] || o.status,
      Gateway: o.payment_provider || "-",
      Data: format(parseISO(o.created_at), "dd/MM/yyyy HH:mm"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    XLSX.writeFile(wb, `financas_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Excel exportado com sucesso!" });
  };

  // Export PDF
  const exportPdf = async () => {
    const jsPDF = (await import("jspdf")).default;
    await import("jspdf-autotable");
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Relatório Financeiro", 14, 22);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 30);
    doc.text(`Receita Total: ${formatCurrency(totalRevenue)}`, 14, 37);
    doc.text(`Total de Pedidos: ${totalOrders}`, 14, 44);

    const rows = filtered.map(o => [
      `#${o.order_number}`,
      o.discord_username || "-",
      o.product_name || "-",
      formatCurrency(o.total_cents),
      statusLabels[o.status] || o.status,
      format(parseISO(o.created_at), "dd/MM/yyyy"),
    ]);

    (doc as any).autoTable({
      startY: 52,
      head: [["Pedido", "Usuário", "Produto", "Total", "Status", "Data"]],
      body: rows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [236, 72, 153] },
    });

    doc.save(`financas_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF exportado com sucesso!" });
  };

  const handlePeriodChange = (val: string) => {
    setPeriod(val);
    if (val !== "custom") {
      const days = val === "7d" ? 7 : val === "90d" ? 90 : 30;
      setDateFrom(subDays(new Date(), days));
      setDateTo(new Date());
    } else {
      setShowCalendar(true);
    }
  };

  const statCards = [
    {
      label: "Receita Total",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      trend: `${revenueTrend >= 0 ? "+" : ""}${revenueTrend}%`,
      trendUp: revenueTrend >= 0,
      gradient: "from-emerald-500/20 to-emerald-500/5",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-400",
    },
    {
      label: "Total de Pedidos",
      value: totalOrders.toString(),
      icon: ShoppingCart,
      trend: `${ordersTrend >= 0 ? "+" : ""}${ordersTrend}%`,
      trendUp: ordersTrend >= 0,
      gradient: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
    },
    {
      label: "Ticket Médio",
      value: formatCurrency(avgTicket),
      icon: TrendingUp,
      trend: `${conversionRate}% conversão`,
      trendUp: conversionRate > 50,
      gradient: "from-blue-500/20 to-blue-500/5",
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-400",
    },
    {
      label: "Cancelados / Reembolsos",
      value: canceledCount.toString(),
      icon: TrendingDown,
      trend: `${totalOrders > 0 ? Math.round((canceledCount / totalOrders) * 100) : 0}% do total`,
      trendUp: false,
      gradient: "from-red-500/20 to-red-500/5",
      iconBg: "bg-red-500/15",
      iconColor: "text-red-400",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden p-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 via-transparent to-primary/5" />
        <div className="absolute inset-0 border border-emerald-500/10 rounded-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/15">
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Finanças</h1>
              <p className="text-sm text-muted-foreground">Acompanhe receitas, pedidos e métricas de vendas</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period selector */}
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[180px] bg-card border-border/50 h-9 text-sm">
                <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom date range */}
            {period === "custom" && (
              <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-xs border-border/50">
                    {dateFrom ? format(dateFrom, "dd/MM") : "?"} — {dateTo ? format(dateTo, "dd/MM") : "?"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="flex gap-2 p-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 px-2">De</p>
                      <CalendarComponent mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 px-2">Até</p>
                      <CalendarComponent mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>

            {/* Export dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-9 gap-2 gradient-pink text-primary-foreground border-none hover:opacity-90">
                  <Download className="h-3.5 w-3.5" /> Exportar <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportExcel} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Exportar Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPdf} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-red-400" /> Exportar PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="group relative rounded-2xl border border-border/50 bg-card overflow-hidden transition-all hover:border-border hover:shadow-lg hover:shadow-black/5">
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="relative p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg} transition-transform group-hover:scale-110`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${card.trendUp ? "text-emerald-400" : "text-red-400"}`}>
                  {card.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {card.trend}
                </div>
              </div>
              <p className="text-2xl font-bold font-display tracking-tight">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue chart */}
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-sm">Receita ao longo do tempo</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Valores em R$ por dia</p>
            </div>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenueChartData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(330 100% 71%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(330 100% 71%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225 15% 18%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(220 15% 55%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(220 15% 55%)" }} tickFormatter={(v) => `R$${v}`} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "hsl(225 25% 11%)", border: "1px solid hsl(225 15% 18%)", borderRadius: "12px", fontSize: 12 }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Receita"]}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(330 100% 71%)" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
              Sem dados para exibir
            </div>
          )}
        </div>

        {/* Status distribution */}
        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-sm">Status dos Pedidos</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Distribuição por status</p>
            </div>
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(val) => <span className="text-xs text-muted-foreground ml-1">{val}</span>}
                />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "hsl(225 25% 11%)", border: "1px solid hsl(225 15% 18%)", borderRadius: "12px", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
              Sem dados
            </div>
          )}
        </div>
      </div>

      {/* Orders per day + Top products */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Orders bar chart */}
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-sm">Pedidos por dia</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Volume de vendas diário</p>
            </div>
          </div>
          {ordersChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ordersChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225 15% 18%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(220 15% 55%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(220 15% 55%)" }} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "hsl(225 25% 11%)", border: "1px solid hsl(225 15% 18%)", borderRadius: "12px", fontSize: 12 }}
                  formatter={(value: number) => [value, "Pedidos"]}
                />
                <Bar dataKey="count" fill="hsl(330 100% 71%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              Sem dados
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-sm">Top Produtos</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Mais vendidos no período</p>
            </div>
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary shrink-0">
                    {i + 1}º
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.count} vendas</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400 shrink-0">
                    {formatCurrency(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              Sem vendas no período
            </div>
          )}
        </div>
      </div>

      {/* Filters + Table */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border/50 bg-muted/20">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por pedido, usuário ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/50 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44 bg-card border-border/50 h-9">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {Object.entries(statusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <Receipt className="h-3.5 w-3.5" />
            {filtered.length} pedido{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum pedido encontrado</p>
            <p className="text-xs mt-1">Tente ajustar os filtros ou o período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Pedido</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Usuário</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Produto</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Total</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Gateway</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((order) => (
                  <tr key={order.id} className="group hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-mono font-semibold text-primary">#{order.order_number}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                          {(order.discord_username || "?")[0].toUpperCase()}
                        </div>
                        <span className="text-sm truncate max-w-[120px]">{order.discord_username || "-"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-muted-foreground truncate max-w-[150px] block">{order.product_name || "-"}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-semibold">{formatCurrency(order.total_cents)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-muted-foreground capitalize">{order.payment_provider || "—"}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-muted-foreground">
                        <p>{format(parseISO(order.created_at), "dd/MM/yyyy")}</p>
                        <p className="text-[10px] opacity-60">{format(parseISO(order.created_at), "HH:mm")}</p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancePage;
