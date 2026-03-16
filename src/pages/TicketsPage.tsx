import { useState, useEffect } from "react";
import { Ticket, Clock, CheckCircle, MessageSquare, AlertCircle, Eye, RefreshCw, Search, Settings, Hash } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TicketEmbedConfig from "@/components/tickets/TicketEmbedConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TicketItem {
  id: string;
  order_id: string | null;
  discord_user_id: string;
  discord_username: string | null;
  discord_channel_id: string | null;
  product_name: string | null;
  status: "open" | "in_progress" | "delivered" | "closed";
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; icon: any; cls: string; badgeCls: string }> = {
  open: { label: "Aberto", icon: AlertCircle, cls: "text-yellow-400 bg-yellow-500/10", badgeCls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  in_progress: { label: "Em Andamento", icon: Clock, cls: "text-blue-400 bg-blue-500/10", badgeCls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  delivered: { label: "Entregue", icon: CheckCircle, cls: "text-emerald-400 bg-emerald-500/10", badgeCls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  closed: { label: "Fechado", icon: MessageSquare, cls: "text-muted-foreground bg-muted", badgeCls: "bg-muted text-muted-foreground border-border" },
};

const TicketsPage = () => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const { data: tickets = [], isLoading, refetch } = useTenantQuery<TicketItem>("tickets", "tickets", {
    orderBy: "created_at",
    ascending: false,
  });

  // Realtime subscription for tickets
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`tickets-realtime-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as any;
            toast.info("🎫 Novo Ticket", {
              description: `${row.discord_username || "Usuário"} — ${row.product_name || "Suporte"}`,
            });
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as any;
            if (row.status === "closed") {
              toast.info("🔒 Ticket Fechado", {
                description: `${row.discord_username || "Usuário"} — fechado por ${row.closed_by || "sistema"}`,
              });
            }
          }
          queryClient.invalidateQueries({ queryKey: ["tickets", tenantId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);

  // Realtime subscription for store_configs (ticket config changes)
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`store-configs-realtime-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "store_configs", filter: `tenant_id=eq.${tenantId}` },
        () => {
          // Config changed - components using store_configs will auto-refresh
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const updatePayload: any = { 
        status: newStatus, 
        updated_at: new Date().toISOString() 
      };
      
      if (newStatus === "closed") {
        updatePayload.closed_at = new Date().toISOString();
        updatePayload.closed_by = "painel";
      }

      const { error } = await (supabase as any)
        .from("tickets")
        .update(updatePayload)
        .eq("id", ticketId)
        .eq("tenant_id", tenantId!);
      if (error) throw error;

      // If closing, send log to Discord via edge function
      if (newStatus === "closed" && selectedTicket?.discord_channel_id) {
        try {
          await supabase.functions.invoke("send-ticket-log", {
            body: {
              tenant_id: tenantId,
              ticket_id: ticketId,
              action: "closed",
              closed_by: "painel",
              discord_channel_id: selectedTicket.discord_channel_id,
            },
          });
        } catch {
          // Non-critical
        }
      }

      toast.success("Status atualizado", { description: `Ticket alterado para ${statusConfig[newStatus]?.label}` });
      queryClient.invalidateQueries({ queryKey: ["tickets", tenantId] });
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus as any });
      }
    } catch (err: any) {
      toast.error("Erro ao atualizar status", { description: err.message });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    return (
      (t.discord_username || "").toLowerCase().includes(q) ||
      (t.product_name || "").toLowerCase().includes(q) ||
      t.discord_user_id.includes(q)
    );
  });

  const counts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    delivered: tickets.filter((t) => t.status === "delivered").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  const openDetail = (ticket: TicketItem) => {
    setSelectedTicket(ticket);
    setDetailOpen(true);
  };

  const renderTickets = (list: TicketItem[]) => {
    if (isLoading)
      return (
        <div className="space-y-3 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))}
        </div>
      );
    if (list.length === 0)
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Ticket className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum ticket encontrado</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Tickets aparecerão aqui quando forem criados pelo bot
          </p>
        </div>
      );
    return (
      <div className="space-y-2 mt-4">
        {list.map((ticket) => {
          const sc = statusConfig[ticket.status] || statusConfig.open;
          const Icon = sc.icon;
          return (
            <div
              key={ticket.id}
              onClick={() => openDetail(ticket)}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className={`rounded-lg p-2.5 ${sc.cls} transition-transform group-hover:scale-110`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {ticket.product_name || "Suporte Geral"}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground truncate">
                      {ticket.discord_username || ticket.discord_user_id}
                    </p>
                    {ticket.discord_channel_id && (
                      <span className="text-xs text-muted-foreground/50 flex items-center gap-0.5">
                        <Hash className="h-3 w-3" />
                        {ticket.discord_channel_id.slice(-6)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`${sc.badgeCls} text-xs`}>
                  {sc.label}
                </Badge>
                <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                  {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
                </span>
                <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6 text-primary" />
            Tickets
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie tickets de suporte e serviço</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Top-level Tabs: Tickets | Configuração */}
      <Tabs defaultValue="tickets">
        <TabsList className="bg-muted">
          <TabsTrigger value="tickets" className="gap-1.5">
            <Ticket className="h-3.5 w-3.5" />
            Tickets
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Configuração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-6 mt-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["open", "in_progress", "delivered", "closed"] as const).map((status) => {
              const sc = statusConfig[status];
              const Icon = sc.icon;
              return (
                <div key={status} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${sc.cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{counts[status]}</p>
                    <p className="text-xs text-muted-foreground">{sc.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Tabs */}
          <Tabs defaultValue="all">
            <TabsList className="bg-muted">
              <TabsTrigger value="all">Todos ({counts.all})</TabsTrigger>
              <TabsTrigger value="open">Abertos ({counts.open})</TabsTrigger>
              <TabsTrigger value="in_progress">Em Andamento ({counts.in_progress})</TabsTrigger>
              <TabsTrigger value="delivered">Entregues ({counts.delivered})</TabsTrigger>
              <TabsTrigger value="closed">Fechados ({counts.closed})</TabsTrigger>
            </TabsList>

            <TabsContent value="all">{renderTickets(filtered)}</TabsContent>
            {(["open", "in_progress", "delivered", "closed"] as const).map((status) => (
              <TabsContent key={status} value={status}>
                {renderTickets(filtered.filter((t) => t.status === status))}
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <TicketEmbedConfig />
        </TabsContent>
      </Tabs>

      {/* Ticket Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              Detalhes do Ticket
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (() => {
            const sc = statusConfig[selectedTicket.status] || statusConfig.open;
            return (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge variant="outline" className={sc.badgeCls}>{sc.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Usuário</Label>
                    <span className="text-sm font-medium">{selectedTicket.discord_username || selectedTicket.discord_user_id}</span>
                  </div>
                  {selectedTicket.discord_channel_id && (
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground">Canal Discord</Label>
                      <span className="text-sm font-mono text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3.5 w-3.5" />
                        {selectedTicket.discord_channel_id}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Produto</Label>
                    <span className="text-sm font-medium">{selectedTicket.product_name || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Pedido</Label>
                    <span className="text-sm font-mono text-muted-foreground">{selectedTicket.order_id ? selectedTicket.order_id.slice(0, 8) + "..." : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Criado em</Label>
                    <span className="text-sm">{new Date(selectedTicket.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  {selectedTicket.closed_at && (
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground">Fechado em</Label>
                      <span className="text-sm">{new Date(selectedTicket.closed_at).toLocaleString("pt-BR")}</span>
                    </div>
                  )}
                  {selectedTicket.closed_by && (
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground">Fechado por</Label>
                      <span className="text-sm font-medium">{selectedTicket.closed_by}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Alterar Status</Label>
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(val) => handleStatusChange(selectedTicket.id, val)}
                    disabled={updatingStatus}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">🟡 Aberto</SelectItem>
                      <SelectItem value="in_progress">🔵 Em Andamento</SelectItem>
                      <SelectItem value="delivered">🟢 Entregue</SelectItem>
                      <SelectItem value="closed">⚫ Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedTicket.discord_channel_id && (
                  <div className="space-y-2">
                    <Label>✏️ Renomear Ticket</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Novo nome do ticket..."
                        id="ticket-rename-input"
                        defaultValue=""
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingStatus}
                        onClick={async () => {
                          const input = document.getElementById("ticket-rename-input") as HTMLInputElement;
                          const newName = input?.value?.trim();
                          if (!newName) { toast.error("Digite um nome"); return; }
                          setUpdatingStatus(true);
                          try {
                            const { error } = await supabase.functions.invoke("send-ticket-log", {
                              body: {
                                tenant_id: tenantId,
                                action: "rename",
                                discord_channel_id: selectedTicket.discord_channel_id,
                                new_name: newName,
                              },
                            });
                            if (error) throw error;
                            toast.success("Ticket renomeado!");
                            input.value = "";
                          } catch (err: any) {
                            toast.error("Erro ao renomear: " + err.message);
                          } finally {
                            setUpdatingStatus(false);
                          }
                        }}
                      >
                        Renomear
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TicketsPage;
