import { useState } from "react";
import { Plus, Search, Package, MoreVertical, Edit, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockProducts = [
  { id: "1", name: "VIP Mensal", type: "DIGITAL_AUTO", price: 2990, stock: 45, active: true },
  { id: "2", name: "Rank Premium", type: "DIGITAL_AUTO", price: 4990, stock: 12, active: true },
  { id: "3", name: "Design Logo", type: "SERVICE", price: 12000, stock: null, active: true },
  { id: "4", name: "Key Steam Aleatória", type: "DIGITAL_AUTO", price: 1500, stock: 3, active: false },
  { id: "5", name: "Setup Bot Discord", type: "HYBRID", price: 25000, stock: null, active: true },
];

const StorePage = () => {
  const [search, setSearch] = useState("");
  
  const filtered = mockProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Loja</h1>
          <p className="text-muted-foreground">Gerencie seus produtos e categorias</p>
        </div>
        <Button className="gradient-pink text-primary-foreground border-none hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" /> Novo Produto
        </Button>
      </div>

      <Tabs defaultValue="products">
        <TabsList className="bg-muted">
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="general">Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted border-none"
            />
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Produto</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Tipo</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Preço</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Estoque</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={product.type} />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      R$ {(product.price / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {product.stock !== null ? (
                        <span className={product.stock < 5 ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {product.stock} itens
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        product.active ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"
                      }`}>
                        {product.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="categories">
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            Categorias — em breve
          </div>
        </TabsContent>
        <TabsContent value="general">
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            Configurações gerais da loja — em breve
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const TypeBadge = ({ type }: { type: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    DIGITAL_AUTO: { label: "Digital", cls: "bg-primary/10 text-primary" },
    SERVICE: { label: "Serviço", cls: "bg-blue-500/10 text-blue-400" },
    HYBRID: { label: "Híbrido", cls: "bg-purple-500/10 text-purple-400" },
  };
  const c = map[type] || { label: type, cls: "bg-muted text-muted-foreground" };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.cls}`}>{c.label}</span>;
};

export default StorePage;
