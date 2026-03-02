import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Store, CreditCard, DollarSign } from "lucide-react";

const AdminDashboardPage = () => {
  const [stats, setStats] = useState({ tenants: 0, orders: 0, revenue: 0, products: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [tenantsRes, ordersRes, productsRes] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("total_cents"),
        supabase.from("products").select("id", { count: "exact", head: true }),
      ]);

      const revenue = ordersRes.data?.reduce((acc, o) => acc + (o.total_cents || 0), 0) || 0;

      setStats({
        tenants: tenantsRes.count || 0,
        orders: ordersRes.data?.length || 0,
        revenue,
        products: productsRes.count || 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "Clientes", value: stats.tenants, icon: Users, color: "text-primary" },
    { title: "Pedidos", value: stats.orders, icon: CreditCard, color: "text-secondary" },
    { title: "Receita Total", value: `R$ ${(stats.revenue / 100).toFixed(2)}`, icon: DollarSign, color: "text-emerald-400" },
    { title: "Produtos", value: stats.products, icon: Store, color: "text-blue-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Admin</h1>
        <p className="text-muted-foreground">Visão geral do sistema</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {loading ? "..." : card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboardPage;
