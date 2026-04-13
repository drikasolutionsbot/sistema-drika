import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { ShoppingCart, Tag, CreditCard, Package, History, Eye, Lock, Crown, CheckCircle2, Clock, XCircle, Trash2, MoreVertical, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PixGeneratorDialog from "@/components/pix/PixGeneratorDialog";
import { MarketplaceItemDetail } from "@/components/marketplace/MarketplaceItemDetail";
import { useNavigate } from "react-router-dom";

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
  image_url: string | null;
  lzt_data: Record<string, unknown> | null;
  delivered: boolean;
  delivered_at: string | null;
  delivery_content: string | null;
}

const MarketplacePage = () => {
  const { tenantId, tenant } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [detailItem, setDetailItem] = useState<MarketplaceItem | null>(null);
  const [pixOpen, setPixOpen] = useState(false);
  const [purchaseFilter, setPurchaseFilter] = useState<"all" | "pending" | "delivered" | "cancelled">("all");
  const [deleteTarget, setDeleteTarget] = useState<MarketplaceItem | null>(null);

  const isPro = tenant?.plan === "pro" || tenant?.plan === "business";

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

  const formatBRL = (cents: number) =>
    cents === 0 ? "Grátis" : `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  const [claiming, setClaiming] = useState(false);

  const handleBuy = (item: MarketplaceItem) => {
    setSelectedItem(item);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedItem) return;
    if (selectedItem.resale_price_cents === 0) {
      // Free item — claim directly
      setClaiming(true);
      try {
        const { error } = await supabase.functions.invoke("manage-marketplace", {
          body: { action: "purchase", item_id: selectedItem.id, tenant_id: tenantId },
        });
        if (error) throw error;
        toast({ title: "Item resgatado!", description: "O item gratuito foi adicionado às suas compras." });
        queryClient.invalidateQueries({ queryKey: ["marketplace-items"] });
        queryClient.invalidateQueries({ queryKey: ["marketplace-purchases"] });
        setSelectedItem(null);
      } catch (err: any) {
        toast({ title: "Erro", description: err.message || "Não foi possível resgatar o item.", variant: "destructive" });
      } finally {
        setClaiming(false);
      }
      return;
    }
    setPixOpen(true);
  };

  // Group items by category
  const categories = [...new Set(items.map((i) => i.category || "Outros"))];

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Lock overlay for non-Pro users */}
      {!isPro && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-md rounded-xl" />
          <div className="relative z-10 text-center p-8 max-w-md">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Acesso Exclusivo Pro</h2>
            <p className="text-sm text-muted-foreground mb-6">
              O Marketplace Atacadão está disponível apenas para clientes com plano Pro.
              Faça upgrade para desbloquear contas digitais com preços de atacado.
            </p>
            <Button
              onClick={() => {
                sessionStorage.setItem("open_upgrade_modal", "true");
                navigate("/settings");
              }}
              className="gradient-pink text-primary-foreground border-none gap-2"
            >
              <Crown className="h-4 w-4" />
              Desbloquear Acesso
            </Button>
          </div>
        </div>
      )}

      <div className={!isPro ? "pointer-events-none select-none" : ""}>
      <div>
        <h1 className="font-display text-2xl font-bold">Marketplace Atacadão</h1>
        <p className="text-muted-foreground">
          Compre contas digitais com preços de atacado para revender na sua loja
        </p>
      </div>

      <Tabs defaultValue="catalog">
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="bg-muted w-max min-w-full sm:w-auto">
            <TabsTrigger value="catalog" className="text-xs sm:text-sm">
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              Catálogo
            </TabsTrigger>
            <TabsTrigger value="purchases" className="text-xs sm:text-sm">
              <History className="h-3.5 w-3.5 mr-1.5" />
              Compras ({purchases.length})
            </TabsTrigger>
          </TabsList>
        </div>

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
                          className="rounded-xl border border-border bg-card hover:border-primary/40 transition-colors flex flex-col overflow-hidden cursor-pointer"
                          onClick={() => setDetailItem(item)}
                        >
                          {item.image_url && (
                            <div className="flex items-center justify-center bg-muted/30 border-b border-border py-3">
                              <img
                                src={item.image_url}
                                alt={item.title}
                                className="h-36 w-auto object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                              />
                            </div>
                          )}
                          <div className="p-4 flex flex-col flex-1">
                            <h3 className="text-sm font-semibold line-clamp-2 mb-1">{item.title}</h3>
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">{item.description}</p>
                            )}
                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                              <span className="text-lg font-bold text-primary">
                                {formatBRL(item.resale_price_cents)}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-8 w-8 p-0"
                                  onClick={(e) => { e.stopPropagation(); setDetailItem(item); }}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  className="text-xs gradient-pink text-primary-foreground border-none hover:opacity-90"
                                  onClick={(e) => { e.stopPropagation(); handleBuy(item); }}
                                >
                                  {item.resale_price_cents === 0 ? (
                                    <><Package className="h-3 w-3 mr-1" />Resgatar</>
                                  ) : (
                                    <><CreditCard className="h-3 w-3 mr-1" />Comprar</>
                                  )}
                                </Button>
                              </div>
                            </div>
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

        <TabsContent value="purchases" className="mt-4 space-y-4">
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
          ) : (() => {
            const delivered = purchases.filter(p => p.delivered);
            const pending = purchases.filter(p => !p.delivered && p.status === "sold");
            const cancelled = purchases.filter(p => p.status === "cancelled");
            const filtered = purchaseFilter === "all" ? purchases
              : purchaseFilter === "delivered" ? delivered
              : purchaseFilter === "pending" ? pending
              : cancelled;

            return (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button onClick={() => setPurchaseFilter("all")} className={`rounded-xl border p-3 text-left transition-colors ${purchaseFilter === "all" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{purchases.length}</p>
                  </button>
                  <button onClick={() => setPurchaseFilter("pending")} className={`rounded-xl border p-3 text-left transition-colors ${purchaseFilter === "pending" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                    <p className="text-xs text-muted-foreground">Aguardando</p>
                    <p className="text-xl font-bold text-yellow-500">{pending.length}</p>
                  </button>
                  <button onClick={() => setPurchaseFilter("delivered")} className={`rounded-xl border p-3 text-left transition-colors ${purchaseFilter === "delivered" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                    <p className="text-xs text-muted-foreground">Entregues</p>
                    <p className="text-xl font-bold text-green-500">{delivered.length}</p>
                  </button>
                  <button onClick={() => setPurchaseFilter("cancelled")} className={`rounded-xl border p-3 text-left transition-colors ${purchaseFilter === "cancelled" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                    <p className="text-xs text-muted-foreground">Cancelados</p>
                    <p className="text-xl font-bold text-destructive">{cancelled.length}</p>
                  </button>
                </div>

                {filtered.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <Filter className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-20" />
                    <p className="text-sm text-muted-foreground">Nenhum pedido nesta categoria</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((item) => {
                      const isCancelled = item.status === "cancelled";
                      return (
                        <div key={item.id} className={`rounded-xl border bg-card overflow-hidden ${isCancelled ? "border-destructive/20 opacity-70" : "border-border"}`}>
                          <div className="p-4 flex items-center gap-4">
                            {item.image_url && (
                              <img src={item.image_url} alt={item.title} className="h-10 w-10 rounded-lg object-cover shrink-0 border border-border" />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                                {item.category && <Badge variant="outline" className="text-[10px]">{item.category}</Badge>}
                                <span>{formatBRL(item.resale_price_cents)}</span>
                                {item.bought_at && (
                                  <span>{new Date(item.bought_at).toLocaleDateString("pt-BR")}</span>
                                )}
                              </div>
                            </div>
                            {isCancelled ? (
                              <Badge variant="destructive" className="gap-1 shrink-0">
                                <XCircle className="h-3 w-3" />
                                Cancelado
                              </Badge>
                            ) : item.delivered ? (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1 shrink-0">
                                <CheckCircle2 className="h-3 w-3" />
                                Entregue
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-500 border-yellow-500/20 gap-1 shrink-0">
                                <Clock className="h-3 w-3" />
                                Aguardando
                              </Badge>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {item.delivered && item.delivery_content && (
                                  <DropdownMenuItem onClick={() => {
                                    navigator.clipboard.writeText(item.delivery_content!);
                                    toast({ title: "Copiado!", description: "Conteúdo copiado para a área de transferência." });
                                  }}>
                                    <Package className="h-4 w-4 mr-2" />
                                    Copiar conteúdo
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir pedido
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {item.delivered && item.delivery_content && !isCancelled && (
                            <div className="border-t border-border bg-muted/30 p-4">
                              <p className="text-xs text-muted-foreground mb-2 font-medium">📦 Conteúdo da entrega:</p>
                              <pre className="text-sm font-mono bg-background rounded-lg p-3 border border-border whitespace-pre-wrap break-all select-all">
                                {item.delivery_content}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailItem?.title}</DialogTitle>
            <DialogDescription>Detalhes do produto</DialogDescription>
          </DialogHeader>
          {detailItem && (
            <MarketplaceItemDetail
              title={detailItem.title}
              description={detailItem.description}
              imageUrl={detailItem.image_url}
              lztData={detailItem.lzt_data as Record<string, unknown> | null}
              priceCents={detailItem.resale_price_cents}
            />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetailItem(null)}>Fechar</Button>
            <Button
              onClick={() => { handleBuy(detailItem!); setDetailItem(null); }}
              className="gradient-pink text-primary-foreground border-none"
            >
              {detailItem?.resale_price_cents === 0 ? (
                <><Package className="h-4 w-4 mr-2" />Resgatar Grátis</>
              ) : (
                <><CreditCard className="h-4 w-4 mr-2" />Comprar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buy confirmation dialog */}
      <Dialog open={!!selectedItem && !pixOpen} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{selectedItem?.resale_price_cents === 0 ? "Resgatar item" : "Confirmar compra"}</DialogTitle>
            <DialogDescription>
              {selectedItem?.resale_price_cents === 0
                ? <>Você está prestes a resgatar <strong>{selectedItem?.title}</strong> gratuitamente</>
                : <>Você está prestes a comprar <strong>{selectedItem?.title}</strong></>
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Valor</p>
              <p className="text-2xl font-bold text-primary">
                {selectedItem && formatBRL(selectedItem.resale_price_cents)}
              </p>
            </div>
            {selectedItem?.resale_price_cents === 0 ? (
              <p className="text-xs text-muted-foreground text-center">
                Este item é gratuito. Clique para resgatar e ele será adicionado às suas compras.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                Após o pagamento via PIX, a conta será entregue automaticamente.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedItem(null)}>Cancelar</Button>
            <Button onClick={handleConfirmPurchase} disabled={claiming} className="gradient-pink text-primary-foreground border-none">
              {selectedItem?.resale_price_cents === 0 ? (
                <><Package className="h-4 w-4 mr-2" />{claiming ? "Resgatando..." : "Resgatar Grátis"}</>
              ) : (
                <><CreditCard className="h-4 w-4 mr-2" />Pagar via PIX</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pedido de <strong>{deleteTarget?.title}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  const { error } = await supabase.functions.invoke("manage-marketplace", {
                    body: { action: "delete_purchase", item_id: deleteTarget.id, tenant_id: tenantId },
                  });
                  if (error) throw error;
                  toast({ title: "Excluído", description: "Pedido removido com sucesso." });
                  queryClient.invalidateQueries({ queryKey: ["marketplace-purchases"] });
                } catch (err: any) {
                  toast({ title: "Erro", description: err.message || "Falha ao excluir.", variant: "destructive" });
                }
                setDeleteTarget(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
};

export default MarketplacePage;
