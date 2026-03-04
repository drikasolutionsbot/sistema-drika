import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, DollarSign, CreditCard, Crown, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { StatCard } from "@/components/dashboard/StatCard";

interface SubscriptionPayment {
  id: string;
  tenant_id: string;
  amount_cents: number;
  plan: string;
  status: string;
  payment_provider: string;
  payment_id: string | null;
  payer_name: string | null;
  payer_email: string | null;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  created_at: string;
  tenant_name?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  paid: { label: "Pago", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  pending: { label: "Pendente", icon: Clock, className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  expired: { label: "Expirado", icon: AlertCircle, className: "bg-muted text-muted-foreground border-border" },
  canceled: { label: "Cancelado", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  refunded: { label: "Reembolsado", icon: XCircle, className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "bg-muted text-muted-foreground" },
  starter: { label: "Starter", color: "bg-blue-500/10 text-blue-500" },
  pro: { label: "Pro", color: "bg-emerald-500/10 text-emerald-500" },
  business: { label: "Business", color: "bg-amber-500/10 text-amber-500" },
};

const SubscriptionPaymentsTab = () => {
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  useEffect(() => {
    const fetchPayments = async () => {
      const [paymentsRes, tenantsRes] = await Promise.all([
        supabase.from("subscription_payments").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("tenants").select("id, name"),
      ]);

      const tenantMap = new Map((tenantsRes.data || []).map((t: any) => [t.id, t.name]));
      const enriched = (paymentsRes.data || []).map((p: any) => ({
        ...p,
        tenant_name: tenantMap.get(p.tenant_id) || "Desconhecido",
      }));

      setPayments(enriched);
      setLoading(false);
    };
    fetchPayments();
  }, []);

  const filtered = useMemo(() => {
    let result = payments;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.tenant_name?.toLowerCase().includes(q) ||
          p.payer_name?.toLowerCase().includes(q) ||
          p.payer_email?.toLowerCase().includes(q) ||
          p.payment_id?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") result = result.filter((p) => p.status === statusFilter);
    if (planFilter !== "all") result = result.filter((p) => p.plan === planFilter);
    return result;
  }, [payments, search, statusFilter, planFilter]);

  const totalRevenue = filtered.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_cents, 0);
  const paidCount = filtered.filter((p) => p.status === "paid").length;
  const pendingCount = filtered.filter((p) => p.status === "pending").length;

  const renderStatus = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const renderPlan = (plan: string) => {
    const config = PLAN_LABELS[plan] || PLAN_LABELS.free;
    return (
      <Badge variant="secondary" className={`${config.color} border-none font-semibold`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard title="Total de Pagamentos" value={String(filtered.length)} icon={CreditCard} />
        <StatCard title="Pagos" value={String(paidCount)} icon={CheckCircle2} change={payments.length > 0 ? `${((paidCount / payments.length) * 100).toFixed(0)}%` : "0%"} changeType="positive" />
        <StatCard title="Pendentes" value={String(pendingCount)} icon={Clock} />
        <StatCard title="Receita Assinaturas" value={`R$ ${(totalRevenue / 100).toFixed(2)}`} icon={DollarSign} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, email, ID pagamento..." className="pl-9 bg-card border-border" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-card border-border">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
            <SelectItem value="canceled">Cancelado</SelectItem>
            <SelectItem value="refunded">Reembolsado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-card border-border">
            <Crown className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="business">Business</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Pagamentos de Assinatura
            {filtered.length !== payments.length && (
              <span className="text-sm font-normal text-muted-foreground">({filtered.length} de {payments.length})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum pagamento de assinatura encontrado.</p>
              <p className="text-xs text-muted-foreground mt-1">Os pagamentos aparecerão aqui quando os clientes assinarem um plano.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{payment.tenant_name}</p>
                          {payment.payer_email && <p className="text-xs text-muted-foreground">{payment.payer_email}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{renderPlan(payment.plan)}</TableCell>
                      <TableCell className="font-mono font-medium">R$ {(payment.amount_cents / 100).toFixed(2)}</TableCell>
                      <TableCell>{renderStatus(payment.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">{payment.payment_provider}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {payment.period_start && payment.period_end
                          ? `${format(new Date(payment.period_start), "dd/MM")} — ${format(new Date(payment.period_end), "dd/MM/yy")}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(payment.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionPaymentsTab;
