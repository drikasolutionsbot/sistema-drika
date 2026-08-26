import { useState } from "react";
import { User, Mail, Phone, Calendar, ShoppingBag, CreditCard, Clock, Package, ChevronDown, CheckCircle2, XCircle, AlertCircle, Hash, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  tenant: any;
  tenantId: string | null;
}

const statusMap: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  paid: { label: "Pago", icon: CheckCircle2, className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  pending: { label: "Pendente", icon: Clock, className: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  error: { label: "Erro", icon: XCircle, className: "text-destructive bg-destructive/10 border-destructive/20" },
  expired: { label: "Expirado", icon: AlertCircle, className: "text-muted-foreground bg-muted/50 border-border" },
};

const orderStatusMap: Record<string, { label: string; className: string }> = {
  pending_payment: { label: "Aguardando", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  paid: { label: "Pago", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  delivered: { label: "Entregue", className: "bg-primary/10 text-primary border-primary/20" },
  cancelled: { label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/20" },
  refunded: { label: "Reembolsado", className: "bg-muted/50 text-muted-foreground border-border" },
};

const SettingsProfileTab = ({ tenant, tenantId }: Props) => {
  const [showAllSubs, setShowAllSubs] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [isDeletingOrders, setIsDeletingOrders] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleClearOrders = async () => {
    if (!tenantId) return;
    if (!window.confirm("Tem certeza que deseja apagar TODO o histórico de pedidos? Esta ação não pode ser desfeita e excluirá todas as vendas do banco de dados.")) return;
    
    setIsDeletingOrders(true);
    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("tenant_id", tenantId);
        
      if (error) throw error;
      
      toast({ title: "Histórico de pedidos limpo com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["profile-orders", tenantId] });
    } catch (err: any) {
      toast({ title: "Erro ao limpar pedidos", description: err.message, variant: "destructive" });
    } finally {
      setIsDeletingOrders(false);
    }
  };

  // Fetch subscription payments
  const { data: subscriptions = [], isLoading: subsLoading } = useQuery({
    queryKey: ["profile-subscriptions", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["profile-orders", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), "dd MMM yyyy, HH:mm", { locale: ptBR });
    } catch {
      return date;
    }
  };

  const formatCurrency = (cents: number) => {
    return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
  };

  const visibleSubs = showAllSubs ? subscriptions : subscriptions.slice(0, 5);
  const visibleOrders = showAllOrders ? orders : orders.slice(0, 10);

  // Stats
  const totalPaidSubs = subscriptions.filter(s => s.status === "paid").length;
  const totalRevenue = orders.filter(o => o.status === "paid" || o.status === "delivered").reduce((sum, o) => sum + (o.total_cents || 0), 0);
  const totalOrders = orders.length;

  return (
    <div className="space-y-6">
      {/* Profile Info */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-6 group">
        {/* Decorative Background Glow */}
        <div className="absolute -top-16 -left-16 w-64 h-64 bg-gradient-to-br from-primary/20 to-pink-500/20 rounded-full blur-[80px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl shadow-inner border bg-primary/10 border-primary/20 text-primary shrink-0">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">Dados do Perfil</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Informações da sua conta e loja</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 rounded-xl bg-background/50 border border-border/50 px-5 py-4 shadow-sm hover:bg-background/80 transition-colors">
              <div className="p-2.5 rounded-full bg-muted/50 shrink-0">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome da Loja</p>
                <p className="text-sm font-medium text-foreground truncate mt-0.5">{tenant.name || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl bg-background/50 border border-border/50 px-5 py-4 shadow-sm hover:bg-background/80 transition-colors">
              <div className="p-2.5 rounded-full bg-muted/50 shrink-0">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="text-sm font-medium text-foreground truncate mt-0.5">{tenant.email || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl bg-background/50 border border-border/50 px-5 py-4 shadow-sm hover:bg-background/80 transition-colors">
              <div className="p-2.5 rounded-full bg-muted/50 shrink-0">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">WhatsApp</p>
                <p className="text-sm font-medium text-foreground truncate mt-0.5">{tenant.whatsapp || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl bg-background/50 border border-border/50 px-5 py-4 shadow-sm hover:bg-background/80 transition-colors">
              <div className="p-2.5 rounded-full bg-muted/50 shrink-0">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Membro desde</p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {tenant.created_at ? format(new Date(tenant.created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4 text-center group/stat hover:bg-primary/10 transition-colors shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-0 group-hover/stat:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <p className="text-2xl font-black text-foreground">{totalPaidSubs}</p>
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mt-1">Assinaturas</p>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center group/stat hover:bg-emerald-500/10 transition-colors shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent opacity-0 group-hover/stat:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <p className="text-2xl font-black text-foreground">{totalOrders}</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mt-1">Pedidos</p>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center group/stat hover:bg-amber-500/10 transition-colors shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent opacity-0 group-hover/stat:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <p className="text-2xl font-black text-foreground">{formatCurrency(totalRevenue)}</p>
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mt-1">Receita</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription History */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-6 group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-[80px] pointer-events-none opacity-50 transition-opacity duration-700 group-hover:opacity-100" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-xl shadow-inner border bg-primary/10 border-primary/20 text-primary shrink-0">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  Histórico de Assinaturas
                  {subscriptions.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 border-0">{subscriptions.length}</Badge>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Pagamentos do plano Pro ou Master</p>
              </div>
            </div>
          </div>

          {subsLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl bg-muted/50" />)}</div>
          ) : subscriptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-background/30 p-8 text-center shadow-inner">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 mx-auto mb-3">
                <CreditCard className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma assinatura encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSubs.map((sub) => {
                const st = statusMap[sub.status] || statusMap.pending;
                const StatusIcon = st.icon;
                return (
                  <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl bg-background/40 border border-white/5 hover:border-white/10 hover:bg-background/60 px-5 py-4 transition-all shadow-sm hover:shadow">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 shadow-sm ${st.className}`}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-bold text-foreground capitalize">{sub.plan}</p>
                          <Badge variant="outline" className="text-[9px] h-4.5 px-1.5 uppercase tracking-wider bg-background/50">{sub.payment_provider}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-medium">{formatDate(sub.created_at)}</p>
                      </div>
                    </div>
                    <div className="sm:text-right shrink-0 pl-14 sm:pl-0">
                      <p className="text-sm font-black text-foreground">{formatCurrency(sub.amount_cents)}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${sub.status === "paid" ? "text-emerald-400" : sub.status === "pending" ? "text-amber-400" : "text-muted-foreground"}`}>
                        {st.label}
                      </p>
                    </div>
                  </div>
                );
              })}
              {subscriptions.length > 5 && (
                <button
                  onClick={() => setShowAllSubs(!showAllSubs)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-background/30 hover:bg-background/50 hover:border-white/10 transition-all px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer mt-2 shadow-sm"
                >
                  {showAllSubs ? "Mostrar menos" : `Ver todas as ${subscriptions.length} assinaturas`}
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAllSubs ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Orders History */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-6 group">
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-emerald-500/10 to-transparent rounded-full blur-[80px] pointer-events-none opacity-50 transition-opacity duration-700 group-hover:opacity-100" />
        
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-xl shadow-inner border bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shrink-0">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  Histórico de Pedidos
                  {orders.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-0">{orders.length}</Badge>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Vendas realizadas na sua loja</p>
              </div>
            </div>
            
            {orders.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearOrders}
                disabled={isDeletingOrders}
                className="h-9 sm:h-8 text-xs bg-background/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 border-white/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {isDeletingOrders ? "Limpando..." : "Limpar Histórico"}
              </Button>
            )}
          </div>

          {ordersLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl bg-muted/50" />)}</div>
          ) : orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-background/30 p-8 text-center shadow-inner">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 mx-auto mb-3">
                <Package className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleOrders.map((order) => {
                const st = orderStatusMap[order.status] || orderStatusMap.pending_payment;
                return (
                  <div key={order.id} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl bg-background/40 border border-white/5 hover:border-white/10 hover:bg-background/60 px-5 py-4 transition-all shadow-sm hover:shadow">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background border border-white/5 shadow-sm shrink-0">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-bold text-foreground truncate">{order.product_name}</p>
                          <span className="text-[10px] font-mono text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded uppercase tracking-wider">#{order.order_number}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[11px] font-medium text-muted-foreground">{order.discord_username || order.discord_user_id}</p>
                          <span className="text-muted-foreground/30 text-[10px]">•</span>
                          <p className="text-[11px] font-medium text-muted-foreground">{formatDate(order.created_at)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="sm:text-right shrink-0 pl-14 sm:pl-0 flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1">
                      <p className="text-sm font-black text-foreground">{formatCurrency(order.total_cents)}</p>
                      <Badge variant="outline" className={`text-[9px] uppercase tracking-wider px-2 py-0.5 border ${st.className} shadow-sm`}>
                        {st.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {orders.length > 10 && (
                <button
                  onClick={() => setShowAllOrders(!showAllOrders)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-background/30 hover:bg-background/50 hover:border-white/10 transition-all px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer mt-2 shadow-sm"
                >
                  {showAllOrders ? "Mostrar menos" : `Ver todos os ${orders.length} pedidos`}
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAllOrders ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsProfileTab;
