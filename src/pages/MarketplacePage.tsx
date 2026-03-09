import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Search, ShoppingCart, ExternalLink, Filter, RefreshCw, Tag, Import } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface LztItem {
  item_id: number;
  title?: string;
  title_en?: string;
  category_id?: number;
  price?: number;
  description?: string;
  item_state?: string;
  login?: string;
  update_stat_data?: { username?: string };
}

interface ImportDialogState {
  open: boolean;
  item: LztItem | null;
  resalePrice: string;
}

const CATEGORIES = [
  { id: "", label: "Todas" },
  { id: "steam", label: "Steam" },
  { id: "fortnite", label: "Fortnite" },
  { id: "epicgames", label: "Epic Games" },
  { id: "origin", label: "Origin / EA" },
  { id: "uplay", label: "Ubisoft" },
  { id: "socialclub", label: "Social Club" },
  { id: "battlenet", label: "Battle.net" },
  { id: "riot", label: "Riot Games" },
  { id: "telegram", label: "Telegram" },
  { id: "spotify", label: "Spotify" },
  { id: "netflix", label: "Netflix" },
  { id: "gifts", label: "Gift Cards" },
];

const MarketplacePage = () => {
  const { tenantId } = useTenant();
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [pmin, setPmin] = useState("");
  const [pmax, setPmax] = useState("");
  const [importDialog, setImportDialog] = useState<ImportDialogState>({
    open: false,
    item: null,
    resalePrice: "",
  });
  const [importing, setImporting] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["lzt-market", category, page, pmin, pmax],
    queryFn: async () => {
      const body: Record<string, unknown> = { action: "search", page };
      if (category) body.category = category;
      if (pmin) body.pmin = Number(pmin);
      if (pmax) body.pmax = Number(pmax);

      const { data, error } = await supabase.functions.invoke("lzt-market", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    staleTime: 60_000,
  });

  const items: LztItem[] = data?.items ? Object.values(data.items) : [];

  const openImportDialog = (item: LztItem) => {
    setImportDialog({
      open: true,
      item,
      resalePrice: item.price ? String(item.price) : "",
    });
  };

  const handleImport = async () => {
    if (!importDialog.item || !tenantId) return;
    const priceCents = Math.round(Number(importDialog.resalePrice) * 100);
    if (isNaN(priceCents) || priceCents <= 0) {
      toast({ title: "Preço inválido", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const item = importDialog.item;
      const { error } = await supabase.functions.invoke("manage-products", {
        body: {
          action: "create",
          tenant_id: tenantId,
          product: {
            name: item.title || item.title_en || `LZT #${item.item_id}`,
            price_cents: priceCents,
          },
        },
      });

      if (error) throw error;
      toast({ title: "Produto importado com sucesso!" });
      setImportDialog({ open: false, item: null, resalePrice: "" });
    } catch (err) {
      toast({
        title: "Erro ao importar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return "—";
    return `$${price.toFixed(2)}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Marketplace Atacadão</h1>
        <p className="text-muted-foreground">
          Importe contas digitais do LZT Market para revender na sua loja
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Categoria</label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id || "all"}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Preço mín ($)</label>
            <Input
              type="number"
              placeholder="0"
              value={pmin}
              onChange={(e) => setPmin(e.target.value)}
              className="bg-muted border-border"
            />
          </div>
          <div className="w-28">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Preço máx ($)</label>
            <Input
              type="number"
              placeholder="999"
              value={pmax}
              onChange={(e) => setPmax(e.target.value)}
              className="bg-muted border-border"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setPage(1); refetch(); }}
            disabled={isFetching}
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filtrar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Items grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum item encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Tente alterar os filtros de busca</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => (
              <div
                key={item.item_id}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold line-clamp-2 flex-1">
                    {item.title || item.title_en || `Item #${item.item_id}`}
                  </h3>
                  <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    {formatPrice(item.price)}
                  </Badge>
                </div>

                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {item.description}
                  </p>
                )}

                <div className="flex gap-2 mt-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => window.open(`https://lzt.market/${item.item_id}`, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Ver
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs gradient-pink text-primary-foreground border-none hover:opacity-90"
                    onClick={() => openImportDialog(item)}
                  >
                    <Import className="h-3 w-3 mr-1" />
                    Importar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="flex items-center px-3 text-sm text-muted-foreground">
              Página {page}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={items.length === 0}
            >
              Próxima
            </Button>
          </div>
        </>
      )}

      {/* Import dialog */}
      <Dialog
        open={importDialog.open}
        onOpenChange={(open) => !open && setImportDialog({ open: false, item: null, resalePrice: "" })}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Importar produto</DialogTitle>
            <DialogDescription>
              Defina o preço de revenda para{" "}
              <strong>{importDialog.item?.title || importDialog.item?.title_en || "este item"}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Preço de custo (LZT)</span>
              <span className="font-semibold">{formatPrice(importDialog.item?.price)}</span>
            </div>
            <div className="space-y-2">
              <Label>Preço de revenda (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 29.90"
                value={importDialog.resalePrice}
                onChange={(e) => setImportDialog((s) => ({ ...s, resalePrice: e.target.value }))}
                className="bg-muted border-border"
              />
              <p className="text-[10px] text-muted-foreground">
                Este será o preço exibido na sua loja do Discord
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setImportDialog({ open: false, item: null, resalePrice: "" })}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing}
              className="gradient-pink text-primary-foreground border-none hover:opacity-90"
            >
              {importing ? "Importando..." : "Importar para Loja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketplacePage;
