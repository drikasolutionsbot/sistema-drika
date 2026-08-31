import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useQueryClient } from "@tanstack/react-query";
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
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subDays, startOfDay, endOfDay, parseISO, isWithinInterval, eachDayOfInterval } from "date-fns";
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
  { value: "1d", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
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
  const [displayLimit, setDisplayLimit] = useState(15);
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading, refetch } = useTenantQuery<Order>(
    "finance-orders", "orders",
    { select: "id,order_number,discord_username,product_name,total_cents,status,payment_provider,created_at", orderBy: "created_at", ascending: false }
  );

  // Realtime: auto-refresh when orders are inserted or updated
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("finance-orders-realtime")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["finance-orders", tenantId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);

  // Period range
  const periodRange = useMemo(() => {
    if (period === "custom" && dateFrom && dateTo) {
      return { from: startOfDay(dateFrom), to: endOfDay(dateTo) };
    }
    const days = period === "1d" ? 0 : period === "7d" ? 7 : 30;
    return { from: startOfDay(subDays(new Date(), days)), to: endOfDay(new Date()) };
  }, [period, dateFrom, dateTo]);

  // Period filtering
  const periodFiltered = useMemo(() => {
    return orders.filter(o => {
      const d = parseISO(o.created_at);
      return isWithinInterval(d, { start: periodRange.from, end: periodRange.to });
    });
  }, [orders, periodRange]);

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
    const duration = periodRange.to.getTime() - periodRange.from.getTime();
    const prevFrom = new Date(periodRange.from.getTime() - duration);
    const prevTo = new Date(periodRange.from.getTime() - 1);
    return orders.filter(o => {
      const d = parseISO(o.created_at);
      return isWithinInterval(d, { start: startOfDay(prevFrom), end: endOfDay(prevTo) });
    });
  }, [orders, periodRange]);

  const prevPaidOrders = prevPeriodOrders.filter(o => o.status === "paid" || o.status === "delivered");
  const prevRevenue = prevPaidOrders.reduce((s, o) => s + o.total_cents, 0);
  const revenueTrend = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : totalRevenue > 0 ? 100 : 0;
  const ordersTrend = prevPeriodOrders.length > 0 ? Math.round(((totalOrders - prevPeriodOrders.length) / prevPeriodOrders.length) * 100) : totalOrders > 0 ? 100 : 0;

  // All days in the period
  const allDays = useMemo(() => {
    return eachDayOfInterval({ start: periodRange.from, end: periodRange.to }).map(d => format(d, "dd/MM"));
  }, [periodRange]);

  // Chart data - Revenue over time
  const revenueChartData = useMemo(() => {
    const map = new Map<string, number>();
    paidOrders.forEach(o => {
      const day = format(parseISO(o.created_at), "dd/MM");
      map.set(day, (map.get(day) || 0) + o.total_cents);
    });
    return allDays.map(date => ({ date, value: (map.get(date) || 0) / 100 }));
  }, [paidOrders, allDays]);

  // Chart data - Orders per day
  const ordersChartData = useMemo(() => {
    const map = new Map<string, number>();
    periodFiltered.forEach(o => {
      const day = format(parseISO(o.created_at), "dd/MM");
      map.set(day, (map.get(day) || 0) + 1);
    });
    return allDays.map(date => ({ date, count: map.get(date) || 0 }));
  }, [periodFiltered, allDays]);

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
      const days = val === "1d" ? 0 : val === "7d" ? 7 : 30;
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
    <div className="relative min-h-[calc(100vh-100px)]">
      {/* Ambient background blobs to make glassmorphism visible */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] opacity-70" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] opacity-70" />
        <div className="absolute top-[30%] left-[60%] w-[30%] h-[30%] bg-blue-500/15 rounded-full blur-[120px] opacity-60" />
      </div>

      <div className="space-y-6 animate-fade-in relative z-0">
        {/* Header - Glassmorphic pill */}
        <div className="relative rounded-[24px] overflow-hidden p-6 pb-5 border border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-primary/10" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <DollarSign className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white/95">Finanças</h1>
              <p className="text-sm text-muted-foreground/80 font-medium">Acompanhe receitas, pedidos e métricas de vendas</p>
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
          <div key={card.label} className="group relative rounded-[20px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl overflow-hidden transition-all duration-300 hover:border-white/20 hover:bg-white/[0.05] hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10">
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[13px] font-semibold text-muted-foreground/80 uppercase tracking-wider">{card.label}</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${card.iconBg} ring-1 ring-white/5 transition-transform group-hover:scale-110`}>
                  <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-3xl font-display font-bold text-white/95 tracking-tight">{card.value}</p>
              
              <div className="mt-3 flex items-center gap-1.5">
                <div className={`flex items-center justify-center rounded-full px-1.5 py-0.5 ${card.trendUp ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                  {card.trendUp ? <ArrowUpRight className={`h-3 w-3 ${card.trendUp ? "text-emerald-400" : "text-red-400"}`} /> : <ArrowDownRight className={`h-3 w-3 ${card.trendUp ? "text-emerald-400" : "text-red-400"}`} />}
                </div>
                <span className={`text-xs font-semibold ${card.trendUp ? "text-emerald-400" : "text-red-400"}`}>
                  {card.trend}
                </span>
                <span className="text-xs text-muted-foreground/60">vs último período</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Revenue chart - Area chart like reference */}
        <div className="lg:col-span-2 rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
              <h3 className="font-display text-lg font-bold text-white/95">Receita ao longo do tempo</h3>
              <p className="text-xs font-medium text-muted-foreground/80 mt-1 uppercase tracking-wider">Valores em R$ por dia</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-background/50 border border-white/5 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
          </div>
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(330 100% 71%)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(330 100% 71%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} tickFormatter={(v) => `R$${v}`} axisLine={false} tickLine={false} dx={-10} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "rgba(10,10,15,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: 13, backdropFilter: "blur(10px)" }}
                  itemStyle={{ color: "hsl(330 100% 71%)", fontWeight: "bold" }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Receita"]}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(330 100% 71%)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm font-medium">
              Sem dados para exibir
            </div>
          )}
        </div>

        {/* Status distribution - Donut with center label */}
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 shadow-xl relative overflow-hidden flex flex-col">
          <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -z-10 -translate-x-1/2 -translate-y-1/2" />
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div>
              <h3 className="font-display text-lg font-bold text-white/95">Status dos Pedidos</h3>
              <p className="text-xs font-medium text-muted-foreground/80 mt-1 uppercase tracking-wider">Distribuição por status</p>
            </div>
          </div>
          {pieData.length > 0 ? (
            <div className="relative flex-1 flex flex-col justify-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={5}
                    dataKey="value"
                    strokeWidth={0}
                    cornerRadius={8}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} style={{ filter: "drop-shadow(0px 4px 6px rgba(0,0,0,0.3))" }} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: "20px" }}
                    formatter={(val) => <span className="text-xs font-semibold text-muted-foreground/90 ml-1">{val}</span>}
                  />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "rgba(10,10,15,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: 13, backdropFilter: "blur(10px)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                <div className="text-center">
                  <p className="text-3xl font-bold font-display text-white">{totalOrders}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">Total</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm font-medium">
              Sem dados
            </div>
          )}
        </div>
      </div>

      {/* Orders per day + Top products */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Orders bar chart */}
        <div className="lg:col-span-2 rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
              <h3 className="font-display text-lg font-bold text-white/95">Pedidos por dia</h3>
              <p className="text-xs font-medium text-muted-foreground/80 mt-1 uppercase tracking-wider">Volume de vendas diário</p>
            </div>
          </div>
          {ordersChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ordersChartData} barCategoryGap="25%">
                <defs>
                  <linearGradient id="ordersBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(330 100% 71%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(280 80% 55%)" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} allowDecimals={false} axisLine={false} tickLine={false} dx={-10} />
                <RechartsTooltip
                  cursor={{ fill: "rgba(255,255,255,0.05)", radius: 8 }}
                  contentStyle={{ backgroundColor: "rgba(10,10,15,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: 13, backdropFilter: "blur(10px)" }}
                  itemStyle={{ color: "hsl(330 100% 71%)", fontWeight: "bold" }}
                  formatter={(value: number) => [value, "Pedidos"]}
                />
                <Bar dataKey="count" fill="url(#ordersBarGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm font-medium">
              Sem dados
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -z-10 -translate-x-1/2 -translate-y-1/2" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
              <h3 className="font-display text-lg font-bold text-white/95">Top Produtos</h3>
              <p className="text-xs font-medium text-muted-foreground/80 mt-1 uppercase tracking-wider">Mais vendidos no período</p>
            </div>
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-4">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-4 group">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-sm font-bold text-primary shadow-[0_0_10px_rgba(var(--primary),0.1)] group-hover:scale-110 transition-transform">
                    {i + 1}º
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/95 truncate">{p.name}</p>
                    <p className="text-xs font-medium text-muted-foreground/80">{p.count} vendas</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-400 shrink-0">
                    {formatCurrency(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm font-medium">
              Sem vendas no período
            </div>
          )}
        </div>
      </div>

      {/* Filters + Table - Card list style */}
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl overflow-hidden shadow-2xl">
        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-4 p-5 border-b border-white/5 bg-background/40">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por pedido, usuário ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-background/50 border-white/10 h-10 rounded-xl focus-visible:ring-primary/30"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-background/50 border-white/10 h-10 rounded-xl focus:ring-primary/30">
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
          <div className="flex items-center gap-2 px-4 rounded-xl bg-background/30 border border-white/5 text-sm font-semibold text-white/90 shrink-0">
            <Receipt className="h-4 w-4 text-primary" />
            {filtered.length} pedido{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Table/List */}
        <div className="p-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-xl bg-white/5" />)}
            </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum pedido encontrado</p>
            <p className="text-xs mt-1">Tente ajustar os filtros ou o período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest w-[100px]">Pedido</th>
                  <th className="px-4 py-2 text-left text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest w-[200px]">Usuário</th>
                  <th className="px-4 py-2 text-left text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest hidden sm:table-cell">Produto</th>
                  <th className="px-4 py-2 text-left text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest w-[120px]">Total</th>
                  <th className="px-4 py-2 text-left text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest w-[100px] hidden md:table-cell">Gateway</th>
                  <th className="px-4 py-2 text-left text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest w-[130px]">Status</th>
                  <th className="px-4 py-2 text-left text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest w-[140px] hidden sm:table-cell">Data</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, displayLimit).map((order) => (
                  <tr key={order.id} className="group bg-background/40 hover:bg-white/5 transition-all duration-300 rounded-xl overflow-hidden shadow-sm hover:shadow-md">
                    <td className="px-4 py-3.5 rounded-l-xl border-y border-l border-transparent group-hover:border-white/5">
                      <span className="text-sm font-mono font-bold text-primary drop-shadow-sm">#{order.order_number}</span>
                    </td>
                    <td className="px-4 py-3.5 border-y border-transparent group-hover:border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-xs font-bold text-primary shadow-inner border border-primary/10 shrink-0">
                          {(order.discord_username || "?")[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-white/90 truncate max-w-[120px]">{order.discord_username || "-"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell border-y border-transparent group-hover:border-white/5">
                      <span className="text-sm font-medium text-muted-foreground truncate max-w-[180px] block">{order.product_name || "-"}</span>
                    </td>
                    <td className="px-4 py-3.5 border-y border-transparent group-hover:border-white/5">
                      <span className="text-sm font-bold text-emerald-400 drop-shadow-sm">{formatCurrency(order.total_cents)}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell border-y border-transparent group-hover:border-white/5">
                      <span className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider bg-white/5 px-2 py-1 rounded-md">{order.payment_provider || "—"}</span>
                    </td>
                    <td className="px-4 py-3.5 border-y border-transparent group-hover:border-white/5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell rounded-r-xl border-y border-r border-transparent group-hover:border-white/5">
                      <div className="text-sm font-medium text-muted-foreground">
                        <span>{format(parseISO(order.created_at), "dd/MM/yyyy")}</span>
                        <span className="text-xs opacity-50 ml-2">{format(parseISO(order.created_at), "HH:mm")}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > displayLimit && (
              <div className="flex justify-center p-4 border-t border-border/50 bg-card/40">
                <Button 
                  variant="outline" 
                  onClick={() => setDisplayLimit(filtered.length)}
                  className="w-full sm:w-auto gap-2 bg-muted/30 border-white/5 hover:bg-primary/10 hover:text-primary transition-all duration-300"
                >
                  Ver todos ({filtered.length - displayLimit} restantes)
                </Button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default FinancePage;
