import { Ticket, Clock, CheckCircle, MessageSquare, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantQuery } from "@/hooks/useSupabaseQuery";

interface TicketItem {
  id: string;
  order_id: string | null;
  discord_username: string;
  product_name: string;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; icon: any; cls: string }> = {
  open: { label: "Aberto", icon: AlertCircle, cls: "text-yellow-400 bg-yellow-500/10" },
  in_progress: { label: "Em Andamento", icon: Clock, cls: "text-blue-400 bg-blue-500/10" },
  delivered: { label: "Entregue", icon: CheckCircle, cls: "text-emerald-400 bg-emerald-500/10" },
  closed: { label: "Fechado", icon: MessageSquare, cls: "text-muted-foreground bg-muted" },
};

const TicketsPage = () => {
  const { data: tickets = [], isLoading } = useTenantQuery<TicketItem>("tickets", "tickets", { orderBy: "created_at", ascending: false });

  const renderTickets = (list: TicketItem[]) => {
    if (isLoading) return <div className="space-y-3 mt-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;
    if (list.length === 0) return <p className="text-center text-muted-foreground py-8">Nenhum ticket encontrado</p>;
    return (
      <div className="space-y-3 mt-4">
        {list.map((ticket) => {
          const sc = statusConfig[ticket.status] || statusConfig.open;
          const Icon = sc.icon;
          return (
            <div key={ticket.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className={`rounded-lg p-2 ${sc.cls}`}><Icon className="h-4 w-4" /></div>
                <div>
                  <p className="text-sm font-medium">{ticket.product_name}</p>
                  <p className="text-xs text-muted-foreground">{ticket.discord_username}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                <p className="text-xs text-muted-foreground mt-1">{new Date(ticket.created_at).toLocaleString("pt-BR")}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Tickets</h1>
        <p className="text-muted-foreground">Gerencie tickets de serviço</p>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="bg-muted">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="open">Abertos</TabsTrigger>
          <TabsTrigger value="in_progress">Em Andamento</TabsTrigger>
          <TabsTrigger value="delivered">Entregues</TabsTrigger>
        </TabsList>

        <TabsContent value="all">{renderTickets(tickets)}</TabsContent>
        {["open", "in_progress", "delivered"].map(status => (
          <TabsContent key={status} value={status}>{renderTickets(tickets.filter(t => t.status === status))}</TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default TicketsPage;
