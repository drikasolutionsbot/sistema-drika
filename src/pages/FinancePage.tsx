import { useState } from "react";
import { Download, Search, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantQuery } from "@/hooks/useSupabaseQuery";

interface Order {
  id: string;
  order_number: number;
  discord_username: string;
  total_cents: number;
  status: string;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  paid: "Pago", delivered: "Entregue", pending_payment: "Pendente",
  delivering: "Entregando", canceled: "Cancelado", refunded: "Reembolsado",
};
const statusColors: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-400",
  delivered: "bg-primary/10 text-primary",
  pending_payment: "bg-yellow-500/10 text-yellow-400",
  delivering: "bg-blue-500/10 text-blue-400",
  canceled: "bg-destructive/10 text-destructive",
  refunded: "bg-muted text-muted-foreground",
};

const FinancePage = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: orders = [], isLoading } = useTenantQuery<Order>("finance-orders", "orders", { orderBy: "created_at", ascending: false });

  const filtered = orders.filter(o => {
    const matchesSearch = String(o.order_number).includes(search) || (o.discord_username || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = orders.filter(o => o.status === "paid" || o.status === "delivered").reduce((s, o) => s + o.total_cents, 0);
  const avgTicket = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Finanças</h1>
          <p className="text-muted-foreground">Pedidos e pagamentos</p>
        </div>
        <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Exportar CSV</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="text-2xl font-bold font-display text-gradient-pink">R$ {(totalRevenue / 100).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pedidos</p>
          <p className="text-2xl font-bold font-display">{orders.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ticket Médio</p>
          <p className="text-2xl font-bold font-display">R$ {(avgTicket / 100).toFixed(2)}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar pedidos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-muted border-none" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-muted border-none"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">Nenhum pedido encontrado</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Pedido</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Usuário</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Total</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-sm font-mono">#{order.order_number}</td>
                  <td className="px-4 py-3 text-sm">{order.discord_username}</td>
                  <td className="px-4 py-3 text-sm font-semibold">R$ {(order.total_cents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[order.status] || ""}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FinancePage;
