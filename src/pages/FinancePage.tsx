import { useState } from "react";
import { Download, Search, Filter, DollarSign, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockOrders = [
  { id: "#1042", user: "Player123", total: 2990, status: "paid", date: "2026-03-01" },
  { id: "#1041", user: "Gamer456", total: 4990, status: "delivered", date: "2026-03-01" },
  { id: "#1040", user: "User789", total: 1500, status: "pending_payment", date: "2026-02-28" },
  { id: "#1039", user: "Fan321", total: 12000, status: "delivering", date: "2026-02-28" },
  { id: "#1038", user: "Member55", total: 2990, status: "canceled", date: "2026-02-27" },
  { id: "#1037", user: "Pro888", total: 7500, status: "paid", date: "2026-02-27" },
];

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Finanças</h1>
          <p className="text-muted-foreground">Pedidos e pagamentos</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="text-2xl font-bold font-display text-gradient-pink">R$ 31.870</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pedidos</p>
          <p className="text-2xl font-bold font-display">156</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ticket Médio</p>
          <p className="text-2xl font-bold font-display">R$ 204</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar pedidos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-muted border-none" />
        </div>
        <Select>
          <SelectTrigger className="w-40 bg-muted border-none">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
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
            {mockOrders.filter(o => o.id.includes(search) || o.user.toLowerCase().includes(search.toLowerCase())).map((order) => (
              <tr key={order.id} className="hover:bg-muted/50 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-sm font-mono">{order.id}</td>
                <td className="px-4 py-3 text-sm">{order.user}</td>
                <td className="px-4 py-3 text-sm font-semibold">R$ {(order.total / 100).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[order.status]}`}>
                    {statusLabels[order.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{order.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FinancePage;
