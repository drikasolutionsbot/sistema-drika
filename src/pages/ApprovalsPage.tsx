import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Check, X, Clock, Package, User, DollarSign, RefreshCw, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const statusLabels: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  paid: { label: "Pago", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  delivered: { label: "Entregue", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  canceled: { label: "Cancelado", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  refunded: { label: "Reembolsado", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending_payment");
  const [processing, setProcessing] = useState<string | null>(null);

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
    String(o.order_number).includes(search)
  );

  const handleApprove = async (orderId: string) => {
    setProcessing(orderId);
    try {
      // Update order status to paid
      const { error } = await supabase
        .from("orders")
        .update({ status: "paid" as any, payment_provider: "manual_approval" })
        .eq("id", orderId);

      if (error) throw error;

      // Trigger delivery
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

  const handleReject = async (orderId: string) => {
    setProcessing(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "canceled" as any })
        .eq("id", orderId);

      if (error) throw error;
      toast({ title: "❌ Pedido recusado", description: "O pedido foi cancelado." });
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao recusar", description: err.message, variant: "destructive" });
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
            placeholder="Buscar por produto, usuário ou número..."
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
            const status = statusLabels[order.status] || { label: order.status, color: "bg-muted text-muted-foreground" };
            const isPending = order.status === "pending_payment";
            const isProcessingThis = processing === order.id;

            return (
              <div
                key={order.id}
                className={`rounded-xl border p-4 transition-all duration-200 ${
                  isPending
                    ? "bg-card/80 border-yellow-500/20 hover:border-yellow-500/40"
                    : "bg-card/40 border-border/30"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Order info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-foreground/80">
                        #{order.order_number}
                      </span>
                      <Badge variant="outline" className={`text-[11px] ${status.color}`}>
                        {status.label}
                      </Badge>
                      {isPending && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getTimeSince(order.created_at)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm">
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

                  {/* Actions */}
                  {isPending && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(order.id)}
                        disabled={isProcessingThis}
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(order.id)}
                        disabled={isProcessingThis}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" />
                        Recusar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
