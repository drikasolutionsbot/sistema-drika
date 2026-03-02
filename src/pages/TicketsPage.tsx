import { Ticket, Clock, CheckCircle, MessageSquare, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockTickets = [
  { id: "1", orderId: "#1039", user: "Fan321", product: "Design Logo", status: "open", createdAt: "2026-03-01 14:30" },
  { id: "2", orderId: "#1035", user: "Client99", product: "Setup Bot", status: "in_progress", createdAt: "2026-02-28 10:15" },
  { id: "3", orderId: "#1030", user: "Buyer42", product: "Consultoria", status: "delivered", createdAt: "2026-02-27 09:00" },
  { id: "4", orderId: "#1025", user: "Member77", product: "Design Banner", status: "closed", createdAt: "2026-02-25 16:45" },
];

const statusConfig: Record<string, { label: string; icon: any; cls: string }> = {
  open: { label: "Aberto", icon: AlertCircle, cls: "text-yellow-400 bg-yellow-500/10" },
  in_progress: { label: "Em Andamento", icon: Clock, cls: "text-blue-400 bg-blue-500/10" },
  delivered: { label: "Entregue", icon: CheckCircle, cls: "text-emerald-400 bg-emerald-500/10" },
  closed: { label: "Fechado", icon: MessageSquare, cls: "text-muted-foreground bg-muted" },
};

const TicketsPage = () => {
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

        <TabsContent value="all" className="space-y-3 mt-4">
          {mockTickets.map((ticket) => {
            const sc = statusConfig[ticket.status];
            const Icon = sc.icon;
            return (
              <div key={ticket.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className={`rounded-lg p-2 ${sc.cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ticket.product}</p>
                    <p className="text-xs text-muted-foreground">{ticket.user} · Pedido {ticket.orderId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                  <p className="text-xs text-muted-foreground mt-1">{ticket.createdAt}</p>
                </div>
              </div>
            );
          })}
        </TabsContent>

        {["open", "in_progress", "delivered"].map(status => (
          <TabsContent key={status} value={status} className="space-y-3 mt-4">
            {mockTickets.filter(t => t.status === status).map((ticket) => {
              const sc = statusConfig[ticket.status];
              const Icon = sc.icon;
              return (
                <div key={ticket.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`rounded-lg p-2 ${sc.cls}`}><Icon className="h-4 w-4" /></div>
                    <div>
                      <p className="text-sm font-medium">{ticket.product}</p>
                      <p className="text-xs text-muted-foreground">{ticket.user} · Pedido {ticket.orderId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                    <p className="text-xs text-muted-foreground mt-1">{ticket.createdAt}</p>
                  </div>
                </div>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default TicketsPage;
