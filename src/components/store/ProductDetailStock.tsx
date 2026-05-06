import { useState, useEffect, useCallback } from "react";
import { Package, Plus, Loader2, Trash2, Search, RefreshCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { AddStockModal } from "./AddStockModal";

interface StockItem {
  id: string;
  content: string;
  created_at: string;
}

interface ProductDetailStockProps {
  productId: string;
}

export const ProductDetailStock = ({ productId }: ProductDetailStockProps) => {
  const { tenantId } = useTenant();
  const [stockCount, setStockCount] = useState(0);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyItem = (item: StockItem) => {
    navigator.clipboard.writeText(item.content);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const fetchStock = useCallback(async () => {
    if (!tenantId || !productId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-product-fields", {
        body: { action: "get_stock", tenant_id: tenantId, product_id: productId },
      });
      if (error) throw error;
      if (data && !data.error) {
        setStockCount(data.stock || 0);
        setStockItems(data.items || []);
      }
    } catch (e: any) {
      console.error("Erro ao buscar estoque:", e);
    }
    setLoading(false);
  }, [tenantId, productId]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const handleDeleteItem = async (itemId: string) => {
    if (!tenantId) return;
    setDeletingId(itemId);
    try {
      const { error } = await supabase.functions.invoke("manage-product-fields", {
        body: { action: "delete_stock_item", tenant_id: tenantId, stock_item_id: itemId },
      });
      if (!error) {
        setStockItems((prev) => prev.filter((i) => i.id !== itemId));
        setStockCount((prev) => prev - 1);
        toast({ title: "Item removido!" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
    setDeletingId(null);
  };

  const handleClearStock = async () => {
    if (!tenantId) return;
    setClearing(true);
    try {
      const { error } = await supabase.functions.invoke("manage-product-fields", {
        body: { action: "clear_stock", tenant_id: tenantId, product_id: productId },
      });
      if (error) throw error;
      toast({ title: "Estoque limpo! ✅" });
      setStockCount(0);
      setStockItems([]);
    } catch (e: any) {
      toast({ title: "Erro ao limpar estoque", description: e.message, variant: "destructive" });
    }
    setClearing(false);
  };

  const filteredItems = search
    ? stockItems.filter((i) => i.content.toLowerCase().includes(search.toLowerCase()))
    : stockItems;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold">Estoque Geral</h3>
        <p className="text-sm text-muted-foreground">
          Gerencie o estoque do produto. Os campos (variações) configuram apenas a quantidade enviada por entrega.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stock counter card */}
          <div className="flex items-center justify-between rounded-xl bg-muted p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Estoque disponível</p>
                <p className="text-3xl font-bold">{stockCount} <span className="text-sm font-normal text-muted-foreground">itens</span></p>
              </div>
            </div>
            <div className="flex gap-2">
              {stockCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearStock}
                  disabled={clearing}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                  Limpar Tudo
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStock}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
              </Button>
              <Button
                size="sm"
                onClick={() => setAddModalOpen(true)}
                className="bg-foreground text-background hover:bg-foreground/90"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Estoque
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar item no estoque..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted border-border"
            />
          </div>

          {/* Stock items list */}
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm font-medium">{search ? "Nenhum item encontrado" : "Estoque vazio"}</p>
              <p className="text-xs mt-1">{search ? "Tente outro termo de busca" : "Adicione itens usando o botão acima"}</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-sm font-mono truncate">{item.content}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                      onClick={() => handleCopyItem(item)}
                    >
                      {copiedId === item.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info box */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="text-sm font-bold mb-2">Como funciona?</h4>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li>• O estoque é <strong>geral</strong> para o produto inteiro.</li>
              <li>• Cada arquivo .txt ou item adicionado entra no pool geral.</li>
              <li>• Nas variações (campos), configure a <strong>"Quantidade por Entrega"</strong> para definir quantos itens serão enviados por compra.</li>
              <li>• Na entrega automática, o sistema puxa a quantidade configurada do estoque geral.</li>
            </ul>
          </div>
        </>
      )}

      {tenantId && (
        <AddStockModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          productId={productId}
          tenantId={tenantId}
          onAdded={() => {
            fetchStock();
            setAddModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
