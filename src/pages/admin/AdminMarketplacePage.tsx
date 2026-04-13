import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Eye, EyeOff, Package, Search, Link, Send, CheckCircle2, Pencil, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface MarketplaceItem {
  id: string;
  lzt_item_id: number;
  title: string;
  description: string | null;
  category: string | null;
  cost_cents: number;
  resale_price_cents: number;
  status: string;
  bought_by_tenant_id: string | null;
  bought_at: string | null;
  created_at: string;
  image_url: string | null;
  delivered: boolean;
  delivered_at: string | null;
  delivery_content: string | null;
}

const LZT_CATEGORIES = [
  { id: "", label: "Todas" },
  { id: "steam", label: "Steam" },
  { id: "fortnite", label: "Fortnite" },
  { id: "epicgames", label: "Epic Games" },
  { id: "origin", label: "Origin / EA" },
  { id: "uplay", label: "Ubisoft" },
  { id: "socialclub", label: "Social Club" },
  { id: "battlenet", label: "Battle.net" },
  { id: "riot", label: "Riot Games" },
  { id: "spotify", label: "Spotify" },
  { id: "netflix", label: "Netflix" },
  { id: "gifts", label: "Gift Cards" },
];

interface LztItem {
  item_id: number;
  title?: string;
  title_en?: string;
  title_translated?: string;
  price?: number;
  description?: string;
  description_translated?: string;
  category_id?: number;
  extracted_image_url?: string;
}

const AdminMarketplacePage = () => {
  const queryClient = useQueryClient();
  const [deliverOpen, setDeliverOpen] = useState<MarketplaceItem | null>(null);
  const [deliveryContent, setDeliveryContent] = useState("");
  const [delivering, setDelivering] = useState(false);
  const [editOpen, setEditOpen] = useState<MarketplaceItem | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", category: "", resale_price: "" });
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MarketplaceItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [lztCategory, setLztCategory] = useState("");
  const [lztPage, setLztPage] = useState(1);
  const [searchTitle, setSearchTitle] = useState("");
  const [searchUrl, setSearchUrl] = useState("");
  const [searchMode, setSearchMode] = useState<"browse" | "url">("browse");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlItem, setUrlItem] = useState<LztItem | null>(null);

  // Marketplace items from DB
  const { data: items = [], isLoading } = useQuery<MarketplaceItem[]>({
    queryKey: ["admin-marketplace-items"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-marketplace", {
        body: { action: "list" },
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  // LZT search (only when import dialog open and browse mode)
  const { data: lztData, isLoading: lztLoading, refetch: lztRefetch } = useQuery({
    queryKey: ["lzt-search", lztCategory, lztPage, searchTitle],
    queryFn: async () => {
      const body: Record<string, unknown> = { action: "search", page: lztPage };
      if (lztCategory) body.category = lztCategory;
      if (searchTitle.trim()) body.title = searchTitle.trim();
      const { data, error } = await supabase.functions.invoke("lzt-market", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    enabled: importOpen && searchMode === "browse",
    staleTime: 60_000,
  });

  const lztItems: LztItem[] = lztData?.items ? Object.values(lztData.items) : [];

  const handleSearchByUrl = async () => {
    if (!searchUrl.trim()) return;
    setUrlLoading(true);
    setUrlItem(null);
    try {
      const { data, error } = await supabase.functions.invoke("lzt-market", {
        body: { action: "get_by_url", url: searchUrl.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.item) {
        setUrlItem(data.item);
      } else {
        toast({ title: "Item não encontrado", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro ao buscar", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setUrlLoading(false);
    }
  };

  const [importItem, setImportItem] = useState<{ item: LztItem; resalePrice: string } | null>(null);
  const [importing, setImporting] = useState(false);

  const getItemDisplayTitle = (item: LztItem) =>
    item.title_translated || item.title_en || item.title || `LZT #${item.item_id}`;

  const handleImport = async () => {
    if (!importItem) return;
    const priceCents = Math.round(Number(importItem.resalePrice) * 100);
    if (isNaN(priceCents) || priceCents <= 0) {
      toast({ title: "Preço inválido", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const { error } = await supabase.functions.invoke("manage-marketplace", {
        body: {
          action: "import",
          item: {
            lzt_item_id: importItem.item.item_id,
            title: getItemDisplayTitle(importItem.item),
            description: importItem.item.description_translated || importItem.item.description,
            category: lztCategory || null,
            cost_cents: Math.round((importItem.item.price || 0) * 100),
            resale_price_cents: priceCents,
            image_url: importItem.item.extracted_image_url || null,
            lzt_data: importItem.item,
          },
        },
      });
      if (error) throw error;
      toast({ title: "Item importado para o Marketplace!" });
      setImportItem(null);
      queryClient.invalidateQueries({ queryKey: ["admin-marketplace-items"] });
    } catch (err) {
      toast({ title: "Erro ao importar", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.functions.invoke("manage-marketplace", {
      body: { action: "delete", item_id: id },
    });
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Item removido!" });
      queryClient.invalidateQueries({ queryKey: ["admin-marketplace-items"] });
    }
  };

  const handleToggleVisibility = async (item: MarketplaceItem) => {
    const newStatus = item.status === "available" ? "hidden" : "available";
    const { error } = await supabase.functions.invoke("manage-marketplace", {
      body: { action: "update", item_id: item.id, item: { status: newStatus } },
    });
    if (error) {
      toast({ title: "Erro", variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin-marketplace-items"] });
    }
  };

  const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  const formatReais = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

  const handleDeliver = async () => {
    if (!deliverOpen || !deliveryContent.trim()) return;
    setDelivering(true);
    try {
      const { error } = await supabase.functions.invoke("manage-marketplace", {
        body: { action: "deliver", item_id: deliverOpen.id, item: { delivery_content: deliveryContent.trim() } },
      });
      if (error) throw error;
      toast({ title: "Item entregue com sucesso!" });
      setDeliverOpen(null);
      setDeliveryContent("");
      queryClient.invalidateQueries({ queryKey: ["admin-marketplace-items"] });
    } catch (err) {
      toast({ title: "Erro ao entregar", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setDelivering(false);
    }
  };

  const openEdit = (item: MarketplaceItem) => {
    setEditForm({
      title: item.title,
      description: item.description || "",
      category: item.category || "",
      resale_price: (item.resale_price_cents / 100).toFixed(2),
    });
    setEditOpen(item);
  };

  const handleEdit = async () => {
    if (!editOpen) return;
    const priceCents = Math.round(Number(editForm.resale_price) * 100);
    if (isNaN(priceCents) || priceCents <= 0) {
      toast({ title: "Preço inválido", variant: "destructive" });
      return;
    }
    setEditing(true);
    try {
      const { error } = await supabase.functions.invoke("manage-marketplace", {
        body: {
          action: "update",
          item_id: editOpen.id,
          item: {
            title: editForm.title.trim(),
            description: editForm.description.trim() || null,
            category: editForm.category.trim() || null,
            resale_price_cents: priceCents,
          },
        },
      });
      if (error) throw error;
      toast({ title: "Item atualizado!" });
      setEditOpen(null);
      queryClient.invalidateQueries({ queryKey: ["admin-marketplace-items"] });
    } catch (err) {
      toast({ title: "Erro ao atualizar", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setEditing(false);
    }
  };

  const available = items.filter((i) => i.status === "available");
  const sold = items.filter((i) => i.status === "sold");
  const hidden = items.filter((i) => i.status === "hidden");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Marketplace Atacadão</h1>
          <p className="text-muted-foreground">Gerencie o catálogo de contas para revenda aos lojistas</p>
        </div>
        <Button onClick={() => setImportOpen(true)} className="gradient-pink text-primary-foreground border-none">
          <Plus className="h-4 w-4 mr-2" />
          Importar do LZT
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Disponíveis</p>
          <p className="text-2xl font-bold">{available.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Vendidos</p>
          <p className="text-2xl font-bold text-green-500">{sold.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Ocultos</p>
          <p className="text-2xl font-bold text-muted-foreground">{hidden.length}</p>
        </div>
      </div>

      <Tabs defaultValue="available">
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="bg-muted w-max min-w-full sm:w-auto">
            <TabsTrigger value="available" className="text-xs sm:text-sm">Disponíveis ({available.length})</TabsTrigger>
            <TabsTrigger value="sold" className="text-xs sm:text-sm">Vendidos ({sold.length})</TabsTrigger>
            <TabsTrigger value="hidden" className="text-xs sm:text-sm">Ocultos ({hidden.length})</TabsTrigger>
          </TabsList>
        </div>

        {["available", "sold", "hidden"].map((tab) => {
          const tabItems = tab === "available" ? available : tab === "sold" ? sold : hidden;
          return (
            <TabsContent key={tab} value={tab} className="mt-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                </div>
              ) : tabItems.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center">
                  <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-20" />
                  <p className="text-muted-foreground">Nenhum item nesta categoria</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tabItems.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
                      {item.image_url && (
                        <img src={item.image_url} alt={item.title} className="h-12 w-12 rounded-lg object-cover shrink-0 border border-border" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                          {item.category && (
                            <Badge variant="outline" className="text-[10px] shrink-0">{item.category}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Custo: {formatReais(item.cost_cents)}</span>
                          <span className="font-semibold text-foreground">Revenda: {formatBRL(item.resale_price_cents)}</span>
                          <span>LZT #{item.lzt_item_id}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {tab === "sold" && (
                          item.delivered ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Entregue
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-500 border-yellow-500/20">Pendente</Badge>
                          )
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border">
                            <DropdownMenuItem onClick={() => openEdit(item)} className="gap-2">
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </DropdownMenuItem>
                            {tab === "sold" && !item.delivered && (
                              <DropdownMenuItem onClick={() => { setDeliverOpen(item); setDeliveryContent(""); }} className="gap-2">
                                <Send className="h-3.5 w-3.5" />
                                Entregar
                              </DropdownMenuItem>
                            )}
                            {item.status === "available" && (
                              <DropdownMenuItem onClick={() => handleToggleVisibility(item)} className="gap-2">
                                <EyeOff className="h-3.5 w-3.5" />
                                Ocultar
                              </DropdownMenuItem>
                            )}
                            {item.status === "hidden" && (
                              <DropdownMenuItem onClick={() => handleToggleVisibility(item)} className="gap-2">
                                <Eye className="h-3.5 w-3.5" />
                                Tornar visível
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(item)}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Import from LZT Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setUrlItem(null); setSearchUrl(""); } }}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar do LZT Market</DialogTitle>
            <DialogDescription>Busque contas no LZT Market para adicionar ao catálogo de revenda</DialogDescription>
          </DialogHeader>

          {/* Search mode tabs */}
          <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as "browse" | "url")} className="w-full">
            <TabsList className="bg-muted w-full">
              <TabsTrigger value="browse" className="flex-1 gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Buscar por Nome
              </TabsTrigger>
              <TabsTrigger value="url" className="flex-1 gap-1.5">
                <Link className="h-3.5 w-3.5" />
                Importar por URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="mt-4 space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Pesquisar por nome..."
                  value={searchTitle}
                  onChange={(e) => setSearchTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { setLztPage(1); lztRefetch(); } }}
                  className="bg-muted border-border flex-1"
                />
                <Select value={lztCategory || "all"} onValueChange={(v) => { setLztCategory(v === "all" ? "" : v); setLztPage(1); }}>
                  <SelectTrigger className="w-40 bg-muted border-border">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {LZT_CATEGORIES.map((c) => (
                      <SelectItem key={c.id || "all"} value={c.id || "all"}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => { setLztPage(1); lztRefetch(); }}>Buscar</Button>
              </div>

              {lztLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                </div>
              ) : lztItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum item encontrado</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {lztItems.map((item) => (
                    <div key={item.item_id} className="rounded-lg border border-border p-3 flex items-center gap-3 hover:border-primary/30 transition-colors">
                      {item.extracted_image_url && (
                        <img src={item.extracted_image_url} alt="" className="h-10 w-10 rounded-md object-cover shrink-0 border border-border" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{getItemDisplayTitle(item)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>R$ {(item.price || 0).toFixed(2).replace('.', ',')}</span>
                          {item.title && item.title !== item.title_translated && (
                            <span className="truncate opacity-50" title={item.title}>({item.title})</span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="text-xs shrink-0"
                        onClick={() => setImportItem({ item, resalePrice: "" })}
                      >
                        Importar
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-center gap-2 mt-2">
                <Button variant="outline" size="sm" disabled={lztPage <= 1} onClick={() => setLztPage((p) => p - 1)}>Anterior</Button>
                <span className="text-sm text-muted-foreground flex items-center">Página {lztPage}</span>
                <Button variant="outline" size="sm" onClick={() => setLztPage((p) => p + 1)}>Próxima</Button>
              </div>
            </TabsContent>

            <TabsContent value="url" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Cole a URL do produto no LZT Market</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://lzt.market/1234567/"
                    value={searchUrl}
                    onChange={(e) => setSearchUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSearchByUrl(); }}
                    className="bg-muted border-border flex-1"
                  />
                  <Button onClick={handleSearchByUrl} disabled={urlLoading || !searchUrl.trim()}>
                    {urlLoading ? "Buscando..." : "Buscar"}
                  </Button>
                </div>
              </div>

              {urlLoading && <Skeleton className="h-16 w-full rounded-lg" />}

              {urlItem && (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {urlItem.extracted_image_url && (
                      <img src={urlItem.extracted_image_url} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0 border border-border" />
                    )}
                    <div>
                      <p className="font-semibold">{getItemDisplayTitle(urlItem)}</p>
                      {urlItem.title && urlItem.title !== urlItem.title_translated && (
                        <p className="text-xs text-muted-foreground opacity-50">{urlItem.title}</p>
                      )}
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span>Preço: R$ {(urlItem.price || 0).toFixed(2).replace('.', ',')}</span>
                        <span>ID: #{urlItem.item_id}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full gradient-pink text-primary-foreground border-none"
                    onClick={() => setImportItem({ item: urlItem, resalePrice: "" })}
                  >
                    Importar este item
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Set resale price dialog */}
      <Dialog open={!!importItem} onOpenChange={(open) => !open && setImportItem(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Definir preço de revenda</DialogTitle>
            <DialogDescription>
              {importItem ? getItemDisplayTitle(importItem.item) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Custo (LZT)</span>
              <span className="font-semibold">R$ {(importItem?.item.price || 0).toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="space-y-2">
              <Label>Preço de revenda (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 49.90"
                value={importItem?.resalePrice || ""}
                onChange={(e) => setImportItem((s) => s ? { ...s, resalePrice: e.target.value } : null)}
                className="bg-muted border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportItem(null)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing} className="gradient-pink text-primary-foreground border-none">
              {importing ? "Importando..." : "Adicionar ao Catálogo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliver dialog */}
      <Dialog open={!!deliverOpen} onOpenChange={(open) => { if (!open) { setDeliverOpen(null); setDeliveryContent(""); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Entregar item</DialogTitle>
            <DialogDescription>
              Insira o conteúdo de entrega para <strong>{deliverOpen?.title}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Conteúdo da entrega</Label>
              <Textarea
                placeholder="Ex: Login: user@email.com&#10;Senha: 123456&#10;Link: https://..."
                value={deliveryContent}
                onChange={(e) => setDeliveryContent(e.target.value)}
                className="bg-muted border-border min-h-[120px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Este conteúdo será visível para o lojista na aba "Minhas Compras"
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeliverOpen(null); setDeliveryContent(""); }}>Cancelar</Button>
            <Button
              onClick={handleDeliver}
              disabled={delivering || !deliveryContent.trim()}
              className="gradient-pink text-primary-foreground border-none"
            >
              {delivering ? "Entregando..." : "Confirmar Entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editOpen} onOpenChange={(open) => { if (!open) setEditOpen(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Editar item</DialogTitle>
            <DialogDescription>Altere as informações do produto no marketplace</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                className="bg-muted border-border min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  value={editForm.category}
                  onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                  className="bg-muted border-border"
                  placeholder="Ex: steam"
                />
              </div>
              <div className="space-y-2">
                <Label>Preço de revenda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.resale_price}
                  onChange={(e) => setEditForm((f) => ({ ...f, resale_price: e.target.value }))}
                  className="bg-muted border-border"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={editing || !editForm.title.trim()} className="gradient-pink text-primary-foreground border-none">
              {editing ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.title}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) { handleDelete(deleteTarget.id); setDeleteTarget(null); } }}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
};

export default AdminMarketplacePage;
