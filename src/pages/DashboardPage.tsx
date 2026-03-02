import { StatCard } from "@/components/dashboard/StatCard";
import { ShoppingCart, DollarSign, TrendingUp, Package, ArrowUpRight } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useTenantQuery } from "@/hooks/useSupabaseQuery";
import { Skeleton } from "@/components/ui/skeleton";

interface Order {
  id: string;
  order_number: number;
  discord_username: string;
  product_name: string;
  total_cents: number;
  status: string;
  created_at: string;
}

const DashboardPage = () => {
  const { tenant, loading: tenantLoading } = useTenant();
  const { data: orders = [], isLoading } = useTenantQuery<Order>("dashboard-orders", "orders", { orderBy: "created_at", ascending: false });

  const recentOrders = orders.slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => o.created_at.startsWith(today));
  const totalRevenue = orders.filter(o => o.status === "paid" || o.status === "delivered").reduce((s, o) => s + o.total_cents, 0);
  const lowStock = 0; // Would need products query

  if (tenantLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}</div></div>;
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in">
        <Package className="h-16 w-16 text-muted-foreground" />
        <h2 className="font-display text-xl font-bold">Nenhuma loja encontrada</h2>
        <p className="text-muted-foreground text-center max-w-md">Você ainda não está vinculado a nenhuma loja. Peça ao proprietário para te adicionar ou crie uma nova loja.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da sua loja — {tenant.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Pedidos Hoje" value={String(todayOrders.length)} change="pedidos hoje" changeType="neutral" icon={ShoppingCart} />
        <StatCard title="Receita Total" value={`R$ ${(totalRevenue / 100).toFixed(2)}`} change="todos os pedidos pagos" changeType="positive" icon={DollarSign} />
        <StatCard title="Total Pedidos" value={String(orders.length)} change="pedidos registrados" changeType="neutral" icon={TrendingUp} />
        <StatCard title="Estoque Baixo" value={String(lowStock)} change="produtos precisam reposição" changeType="neutral" icon={Package} />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="font-display text-lg font-semibold">Pedidos Recentes</h2>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : recentOrders.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">Nenhum pedido ainda</p>
        ) : (
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-muted-foreground">#{order.order_number}</span>
                  <div>
                    <p className="text-sm font-medium">{order.discord_username}</p>
                    <p className="text-xs text-muted-foreground">{order.product_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold">R$ {(order.total_cents / 100).toFixed(2)}</span>
                  <StatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; className: string }> = {
    paid: { label: "Pago", className: "bg-emerald-500/10 text-emerald-400" },
    delivered: { label: "Entregue", className: "bg-primary/10 text-primary" },
    pending_payment: { label: "Pendente", className: "bg-yellow-500/10 text-yellow-400" },
    delivering: { label: "Entregando", className: "bg-blue-500/10 text-blue-400" },
    canceled: { label: "Cancelado", className: "bg-destructive/10 text-destructive" },
    refunded: { label: "Reembolsado", className: "bg-muted text-muted-foreground" },
  };
  const c = config[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.className}`}>{c.label}</span>;
};

export default DashboardPage;
