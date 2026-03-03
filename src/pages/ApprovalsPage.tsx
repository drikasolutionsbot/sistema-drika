import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Check, X, Clock, Package, User, DollarSign, RefreshCw, Search, Filter, Trash2, ChevronDown, ChevronUp, Hash, CreditCard, Calendar, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(date));

// Status labels kept for pending count badge only
const statusLabels: Record<string, string> = {
  pending_payment: "Pendente",
  paid: "Pago",
  delivering: "Entregando",
  delivered: "Entregue",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

async function invokeWithRetry(fnName: string, body: any, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (!error) return data;
      if (i < retries) await new Promise(r => setTimeout(r, 1500));
      else throw error;
    } catch (err) {
      if (i < retries) await new Promise(r => setTimeout(r, 1500));
      else throw err;
    }
  }
}

export default function ApprovalsPage() {
  const { tenantId } = useTenant();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending_payment");
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["approval-orders", tenantId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filteredOrders = (orders || []).filter(o =>
    !search ||
    o.product_name.toLowerCase().includes(search.toLowerCase()) ||
    o.discord_username?.toLowerCase().includes(search.toLowerCase()) ||
    String(o.order_number).includes(search) ||
    o.discord_user_id.includes(search)
  );

  const handleApprove = async (orderId: string) => {
    setProcessing(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "paid" as any, payment_provider: "manual_approval" })
        .eq("id", orderId);
      if (error) throw error;

      try {
        await invokeWithRetry("deliver-order", { order_id: orderId });
      } catch (e) {
        console.error("Auto-deliver error:", e);
      }

      toast({ title: "✅ Pedido aprovado!", description: "Pagamento confirmado e entrega iniciada." });
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao aprovar", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    setProcessing(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "canceled" as any })
        .eq("id", orderId);
      if (error) throw error;
      toast({ title: "❌ Pedido cancelado" });
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao cancelar", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (orderId: string) => {
    setProcessing(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);
      if (error) throw error;
      toast({ title: "🗑️ Pedido excluído" });
      if (expandedId === orderId) setExpandedId(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = orders?.filter(o => o.status === "pending_payment").length || 0;

  const getTimeSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Aprovações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie pedidos pendentes de confirmação de pagamento
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-sm px-3 py-1.5 self-start">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por produto, usuário, ID ou número..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-card/50 border-border/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-card/50 border-border/50">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending_payment">Pendentes</SelectItem>
            <SelectItem value="paid">Pagos</SelectItem>
            <SelectItem value="delivered">Entregues</SelectItem>
            <SelectItem value="canceled">Cancelados</SelectItem>
            <SelectItem value="refunded">Reembolsados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()} className="shrink-0">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-lg font-medium">Nenhum pedido encontrado</p>
          <p className="text-sm mt-1">
            {statusFilter === "pending_payment"
              ? "Não há pedidos aguardando aprovação"
              : "Nenhum resultado para os filtros selecionados"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const isPending = order.status === "pending_payment";
            const isProcessingThis = processing === order.id;
            const isExpanded = expandedId === order.id;

            return (
              <div
                key={order.id}
                className={`rounded-xl border transition-all duration-200 ${
                  isPending
                    ? "bg-card/80 border-yellow-500/20 hover:border-yellow-500/40"
                    : "bg-card/40 border-border/30"
                }`}
              >
                {/* Main row */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-foreground/80">
                        #{order.order_number}
                      </span>
                      <StatusBadge status={order.status} />
                      {isPending && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getTimeSince(order.created_at)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <span className="flex items-center gap-1.5 text-foreground">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        {order.product_name}
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        {order.discord_username || order.discord_user_id}
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        <DollarSign className="h-3.5 w-3.5 text-green-400" />
                        {formatBRL(order.total_cents)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Actions */}
                    {isPending && (
                      <>
                        <Button
                          size="sm"
                          onClick={e => { e.stopPropagation(); handleApprove(order.id); }}
                          disabled={isProcessingThis}
                          className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={e => { e.stopPropagation(); handleCancel(order.id); }}
                          disabled={isProcessingThis}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </Button>
                      </>
                    )}

                    {!isPending && order.status !== "canceled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={e => { e.stopPropagation(); handleCancel(order.id); }}
                        disabled={isProcessingThis}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancelar
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => e.stopPropagation()}
                          disabled={isProcessingThis}
                          className="text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={e => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-400" />
                            Excluir pedido #{order.order_number}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação é irreversível. O pedido será removido permanentemente do banco de dados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Voltar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(order.id)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-border/30 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm bg-muted/10">
                    <DetailItem icon={Hash} label="ID do Pedido" value={order.id} mono />
                    <DetailItem icon={Hash} label="Número" value={`#${order.order_number}`} />
                    <DetailItem icon={User} label="Discord ID" value={order.discord_user_id} mono />
                    <DetailItem icon={User} label="Username" value={order.discord_username || "—"} />
                    <DetailItem icon={Package} label="Produto" value={order.product_name} />
                    <DetailItem icon={Hash} label="Produto ID" value={order.product_id || "—"} mono />
                    <DetailItem icon={DollarSign} label="Total" value={formatBRL(order.total_cents)} highlight />
                    <DetailItem icon={CreditCard} label="Provedor" value={order.payment_provider || "—"} />
                    <DetailItem icon={Hash} label="Payment ID" value={order.payment_id || "—"} mono />
                    <DetailItem icon={Calendar} label="Criado em" value={formatDate(order.created_at)} />
                    <DetailItem icon={Calendar} label="Atualizado em" value={formatDate(order.updated_at)} />
                    <DetailItem icon={Hash} label="Cupom ID" value={order.coupon_id || "—"} mono />
                    <DetailItem icon={Hash} label="Afiliado ID" value={order.affiliate_id || "—"} mono />
                    <DetailItem icon={Hash} label="Field ID" value={order.field_id || "—"} mono />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, mono, highlight }: {
  icon: any;
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`truncate ${mono ? "font-mono text-xs" : "text-sm"} ${highlight ? "text-green-400 font-semibold" : "text-foreground"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
