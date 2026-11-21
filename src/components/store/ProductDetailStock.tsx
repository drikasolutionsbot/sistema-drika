import { useState, useEffect, useCallback } from "react";
import { Package, Plus, Loader2, Trash2, Search, RefreshCw, Copy, Check, FileText, Infinity as InfinityIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { AddStockModal, parseTxtStockItem } from "./AddStockModal";

interface StockItem {
  id: string;
  content: string;
  created_at: string;
  is_infinite?: boolean;
}

interface ProductDetailStockProps {
  productId: string;
  productName?: string;
  infiniteStock?: boolean;
  onInfiniteStockChange?: (infinite: boolean) => void;
}

export const ProductDetailStock = ({ productId, productName, infiniteStock: propInfiniteStock, onInfiniteStockChange }: ProductDetailStockProps) => {
  const { tenantId } = useTenant();
  const [stockCount, setStockCount] = useState(0);
  const [infiniteStock, setInfiniteStock] = useState<boolean>(Boolean(propInfiniteStock));
  const [togglingInfinite, setTogglingInfinite] = useState(false);
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof propInfiniteStock === "boolean") {
      setInfiniteStock(propInfiniteStock);
    }
  }, [propInfiniteStock]);

  const handleToggleInfiniteStock = async (checked: boolean) => {
    if (!tenantId) return;
    setTogglingInfinite(true);
    setInfiniteStock(checked);
    onInfiniteStockChange?.(checked);
    try {
      const { data, error } = await supabase.functions.invoke("manage-product-fields", {
        body: {
          action: "set_infinite_stock",
          tenant_id: tenantId,
          product_id: productId,
          infinite_stock: checked,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: checked ? "Estoque Infinito (∞) ativado! ✅" : "Estoque Infinito desativado",
        description: checked
          ? "O estoque nunca se esgotará e os itens/arquivos TXT serão reenviados a cada venda."
          : "O produto voltou a consumir 1 unidade do estoque por venda.",
      });
    } catch (e: any) {
      setInfiniteStock(!checked);
      onInfiniteStockChange?.(!checked);
      toast({ title: "Erro ao alterar Estoque Infinito", description: e.message, variant: "destructive" });
    } finally {
      setTogglingInfinite(false);
    }
  };

  const handleCopyItem = (item: StockItem) => {
    const parsed = parseTxtStockItem(item.content);
    navigator.clipboard.writeText(parsed.content);
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
        if (typeof data.infinite_stock === "boolean") {
          setInfiniteStock(data.infinite_stock);
          onInfiniteStockChange?.(data.infinite_stock);
        }
      }
    } catch (e: any) {
      console.error("Erro ao buscar estoque:", e);
    }
    setLoading(false);
  }, [tenantId, productId]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const handleToggleItemInfinite = async (item: StockItem) => {
    if (!tenantId) return;
    const nextVal = !item.is_infinite;
    setTogglingItemId(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-product-fields", {
        body: {
          action: "toggle_item_infinite",
          tenant_id: tenantId,
          stock_item_id: item.id,
          infinite_stock: nextVal,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStockItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_infinite: nextVal } : i)));
      toast({
        title: nextVal ? "Item marcado como Estoque Infinito (∞)! ✅" : "Item voltou ao estoque normal",
        description: nextVal
          ? "Este item/arquivo específico será enviado em todas as vendas sem ser removido do estoque."
          : "Este item será consumido após ser entregue em uma venda.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar item", description: e.message, variant: "destructive" });
    } finally {
      setTogglingItemId(null);
    }
  };

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

  const hasAnyInfiniteItem = stockItems.some((i) => i.is_infinite);
  const isEffectiveInfinite = infiniteStock || hasAnyInfiniteItem;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold">
          Estoque do Produto{productName ? `: "${productName}"` : ""}
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure o estoque somente deste produto (ou marque itens específicos como infinitos na lista abaixo).
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Infinite Stock toggle card */}
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <InfinityIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-foreground">
                    Estoque Infinito (∞) neste produto{productName ? ` (${productName})` : ""}
                  </p>
                  {infiniteStock && (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                      Ativo só neste produto
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Afeta <strong>somente este produto</strong> (os demais produtos da loja continuam normais). Você também pode clicar no botão <strong>∞</strong> ao lado de um item específico abaixo.
                </p>
              </div>
            </div>
            <Switch
              checked={infiniteStock}
              disabled={togglingInfinite}
              onCheckedChange={handleToggleInfiniteStock}
            />
          </div>

          {/* Stock counter card */}
          <div className="flex items-center justify-between rounded-xl bg-muted p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                {isEffectiveInfinite ? (
                  <InfinityIcon className="h-6 w-6 text-emerald-400" />
                ) : (
                  <Package className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Estoque disponível deste produto</p>
                {isEffectiveInfinite ? (
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-emerald-400">∞</p>
                    <span className="text-xs font-normal text-muted-foreground">
                      Infinito ({stockCount} {stockCount === 1 ? "item/arquivo cadastrado" : "itens/arquivos cadastrados"})
                    </span>
                  </div>
                ) : (
                  <p className="text-3xl font-bold">{stockCount} <span className="text-sm font-normal text-muted-foreground">itens</span></p>
                )}
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
              {filteredItems.map((item) => {
                const parsed = parseTxtStockItem(item.content);
                return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0 mr-2 flex items-center gap-2">
                    {parsed.isTxtFile ? (
                      <>
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{parsed.filename}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          Arquivo TXT • {Math.max(1, Math.ceil(parsed.size / 1024))} KB
                        </Badge>
                      </>
                    ) : (
                      <p className="text-sm font-mono truncate">{item.content}</p>
                    )}
                    {(item.is_infinite || infiniteStock) && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                        ∞ Infinito
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant={item.is_infinite ? "default" : "outline"}
                      size="sm"
                      className={`h-7 px-2 text-[11px] gap-1 ${
                        item.is_infinite
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => handleToggleItemInfinite(item)}
                      disabled={togglingItemId === item.id}
                      title="Ativar/Desativar Estoque Infinito somente neste item"
                    >
                      {togglingItemId === item.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <InfinityIcon className="h-3.5 w-3.5" />
                      )}
                      <span>{item.is_infinite ? "Infinito" : "Tornar ∞"}</span>
                    </Button>
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
                );
              })}
            </div>
          )}

          {/* Info box */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="text-sm font-bold mb-2">Como funciona?</h4>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li>• O estoque é <strong>geral</strong> para o produto inteiro.</li>
              <li>• Cada arquivo .txt ou item adicionado entra no pool geral.</li>
              <li>• Nas variedades, configure a <strong>"Quantidade por Entrega"</strong> para definir quantos itens serão enviados por compra.</li>
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
          initialInfiniteStock={infiniteStock}
          onAdded={() => {
            fetchStock();
            setAddModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
