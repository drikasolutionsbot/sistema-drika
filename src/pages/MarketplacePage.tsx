import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { ShoppingCart, Tag, CreditCard, Package, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import PixGeneratorDialog from "@/components/pix/PixGeneratorDialog";

interface MarketplaceItem {
  id: string;
  lzt_item_id: number;
  title: string;
  description: string | null;
  category: string | null;
  resale_price_cents: number;
  status: string;
  bought_at: string | null;
  created_at: string;
}

const MarketplacePage = () => {
  const { tenantId, tenant } = useTenant();
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [pixOpen, setPixOpen] = useState(false);

  // Available items
  const { data: items = [], isLoading } = useQuery<MarketplaceItem[]>({
    queryKey: ["marketplace-items", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-marketplace", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // My purchases
  const { data: purchases = [], isLoading: purchasesLoading } = useQuery<MarketplaceItem[]>({
    queryKey: ["marketplace-purchases", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-marketplace", {
        body: { action: "my_purchases", tenant_id: tenantId },
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  const handleBuy = (item: MarketplaceItem) => {
    setSelectedItem(item);
  };

  const handleConfirmPurchase = () => {
    if (!selectedItem) return;
    // Open PIX payment
    setPixOpen(true);
  };

  // Group items by category
  const categories = [...new Set(items.map((i) => i.category || "Outros"))];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Marketplace Atacadão</h1>
        <p className="text-muted-foreground">
          Compre contas digitais com preços de atacado para revender na sua loja
        </p>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList className="bg-muted">
          <TabsTrigger value="catalog">
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="purchases">
            <History className="h-3.5 w-3.5 mr-1.5" />
            Minhas Compras ({purchases.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
              <p className="text-lg font-medium text-muted-foreground">Nenhum produto disponível</p>
              <p className="text-sm text-muted-foreground mt-1">Novos produtos serão adicionados em breve!</p>
            </div>
          ) : (
            <div className="space-y-8">
              {categories.map((cat) => {
                const catItems = items.filter((i) => (i.category || "Outros") === cat);
                return (
                  <div key={cat}>
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      {cat}
                      <Badge variant="secondary" className="text-xs">{catItems.length}</Badge>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {catItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors flex flex-col"
                        >
                          <h3 className="text-sm font-semibold line-clamp-2 mb-1">{item.title}</h3>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">{item.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                            <span className="text-lg font-bold text-primary">
                              {formatBRL(item.resale_price_cents)}
                            </span>
                            <Button
                              size="sm"
                              className="text-xs gradient-pink text-primary-foreground border-none hover:opacity-90"
                              onClick={() => handleBuy(item)}
                            >
                              <CreditCard className="h-3 w-3 mr-1" />
                              Comprar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          {purchasesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : purchases.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
              <p className="text-lg font-medium text-muted-foreground">Nenhuma compra ainda</p>
              <p className="text-sm text-muted-foreground mt-1">Explore o catálogo e compre sua primeira conta!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {purchases.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {item.category && <Badge variant="outline" className="text-[10px]">{item.category}</Badge>}
                      <span>{formatBRL(item.resale_price_cents)}</span>
                      {item.bought_at && (
                        <span>Comprado em {new Date(item.bought_at).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Adquirido</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Buy confirmation dialog */}
      <Dialog open={!!selectedItem && !pixOpen} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Confirmar compra</DialogTitle>
            <DialogDescription>
              Você está prestes a comprar <strong>{selectedItem?.title}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedItem?.description && (
              <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
            )}
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Valor</p>
              <p className="text-2xl font-bold text-primary">
                {selectedItem && formatBRL(selectedItem.resale_price_cents)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Após o pagamento via PIX, a conta será entregue automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedItem(null)}>Cancelar</Button>
            <Button onClick={handleConfirmPurchase} className="gradient-pink text-primary-foreground border-none">
              <CreditCard className="h-4 w-4 mr-2" />
              Pagar via PIX
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketplacePage;
