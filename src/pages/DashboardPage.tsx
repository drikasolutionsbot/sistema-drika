import { StatCard } from "@/components/dashboard/StatCard";
import { ShoppingCart, DollarSign, TrendingUp, Package, ArrowUpRight } from "lucide-react";

const DashboardPage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da sua loja</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pedidos Hoje"
          value="24"
          change="+12% vs ontem"
          changeType="positive"
          icon={ShoppingCart}
        />
        <StatCard
          title="Receita (Mês)"
          value="R$ 4.230"
          change="+8% vs mês anterior"
          changeType="positive"
          icon={DollarSign}
        />
        <StatCard
          title="Taxa de Conversão"
          value="68%"
          change="-2% vs ontem"
          changeType="negative"
          icon={TrendingUp}
        />
        <StatCard
          title="Estoque Baixo"
          value="3"
          change="produtos precisam reposição"
          changeType="neutral"
          icon={Package}
        />
      </div>

      {/* Recent Orders */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="font-display text-lg font-semibold">Pedidos Recentes</h2>
          <button className="flex items-center gap-1 text-sm text-primary hover:underline">
            Ver todos <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="divide-y divide-border">
          {[
            { id: "#1042", user: "Player123", product: "VIP Mensal", amount: "R$ 29,90", status: "paid" },
            { id: "#1041", user: "Gamer456", product: "Rank Premium", amount: "R$ 49,90", status: "delivered" },
            { id: "#1040", user: "User789", product: "Key Steam", amount: "R$ 15,00", status: "pending_payment" },
            { id: "#1039", user: "Fan321", product: "Design Logo", amount: "R$ 120,00", status: "delivering" },
          ].map((order) => (
            <div key={order.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono text-muted-foreground">{order.id}</span>
                <div>
                  <p className="text-sm font-medium">{order.user}</p>
                  <p className="text-xs text-muted-foreground">{order.product}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold">{order.amount}</span>
                <StatusBadge status={order.status} />
              </div>
            </div>
          ))}
        </div>
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
  };
  const c = config[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
};

export default DashboardPage;
