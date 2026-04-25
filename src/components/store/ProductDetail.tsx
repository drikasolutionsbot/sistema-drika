import { useState, useEffect, useRef, useCallback } from "react";
import { type DiscordButtonStyle } from "@/components/discord/DiscordButtonStylePicker";
import { ArrowLeft, RefreshCw, Send, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductDetailGeneral } from "./ProductDetailGeneral";
import { ProductDetailFields } from "./ProductDetailFields";

import { ProductDetailStock } from "./ProductDetailStock";
import { ProductDetailEmbed, type EmbedConfig } from "./ProductDetailEmbed";
import { ProductDetailCoupons } from "./ProductDetailCoupons";
import { PostMessageModal } from "./PostMessageModal";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  type: string;
  price_cents: number;
  compare_price_cents?: number | null;
  stock: number | null;
  active: boolean;
  description: string | null;
  icon_url?: string | null;
  banner_url?: string | null;
  auto_delivery?: boolean;
  category_id?: string | null;
  enable_credits?: boolean;
  show_stock?: boolean;
  show_sold?: boolean;
  enable_instructions?: boolean;
  role_id?: string | null;
  payment_provider_key?: string | null;
  button_style?: DiscordButtonStyle;
  embed_config?: EmbedConfig;
  language?: string | null;
}

interface ProductDetailProps {
  product: Product;
  onBack: () => void;
  onSave: (product: Product) => Promise<boolean>;
  onDelete: (productId: string) => void;
  categories?: Category[];
}

export const ProductDetail = ({ product, onBack, onSave, onDelete, categories = [] }: ProductDetailProps) => {
  const { tenantId } = useTenant();
  const [edited, setEdited] = useState<Product>({ ...product });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [embedColor, setEmbedColor] = useState("#2B2D31");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editedRef = useRef(edited);
  const dirtyRef = useRef(false);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    editedRef.current = edited;
  }, [edited]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (!tenantId) return;
    supabase.functions.invoke("manage-store-config", {
      body: { action: "get", tenant_id: tenantId },
    }).then(({ data }) => {
      if (data?.embed_color) setEmbedColor(data.embed_color);
    });
  }, [tenantId]);

  // Auto-save with 2s debounce
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const current = editedRef.current;
      try {
        const ok = await onSaveRef.current(current);
        if (ok) setDirty(false);
      } catch {
        // silent
      }
    }, 2000);
  }, []);

  // Cleanup timer on unmount & flush save
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        if (editedRef.current && dirtyRef.current) {
          onSaveRef.current(editedRef.current).catch(() => {});
        }
      }
    };
  }, []);

  const handleChange = (updates: Partial<Product>) => {
    setEdited((prev) => ({ ...prev, ...updates }));
    setDirty(true);
    scheduleAutoSave();
  };

  const handleSave = async () => {
    if (saving) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setSaving(true);
    try {
      const ok = await onSave(edited);
      if (ok) setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setEdited({ ...product });
    setDirty(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors lg:hidden shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold font-display truncate">Especificações do produto</h2>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Configure as informações deste produto
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 px-2 sm:px-3"
                aria-label="Excluir produto"
              >
                <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Excluir</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-destructive/20 bg-card/95 backdrop-blur-xl max-w-md">
              <AlertDialogHeader className="space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20">
                  <Trash2 className="h-6 w-6 text-destructive" />
                </div>
                <AlertDialogTitle className="text-center text-lg">Excluir produto</AlertDialogTitle>
                <AlertDialogDescription className="text-center text-sm leading-relaxed">
                  Tem certeza que deseja excluir <span className="font-semibold text-foreground">"{edited.name}"</span>?
                  <br />
                  Esta ação não pode ser desfeita. Todo o estoque e campos serão removidos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-2 flex gap-3 sm:justify-center">
                <AlertDialogCancel className="flex-1 sm:flex-none">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(product.id)}
                  className="flex-1 sm:flex-none bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir Produto
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="outline"
            size="sm"
            className="text-xs px-2 sm:px-3"
            disabled={syncing}
            aria-label="Sincronizar mensagens"
            onClick={async () => {
              if (!tenantId) return;
              setSyncing(true);
              try {
                const { data, error } = await supabase.functions.invoke("send-webhook-message", {
                  body: { action: "sync", tenant_id: tenantId, product_id: product.id },
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
                if (data?.synced === 0 && data?.total === 0) {
                  toast({ title: "Nenhuma mensagem encontrada", description: "Poste uma mensagem primeiro para poder sincronizar.", variant: "destructive" });
                } else {
                  toast({ title: `Mensagens sincronizadas! ✅`, description: `${data.synced}/${data.total} mensagens atualizadas.` });
                }
              } catch (err: any) {
                toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
              } finally {
                setSyncing(false);
              }
            }}
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 sm:mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Sincronizar Mensagens</span>
            <span className="sm:hidden">Sync</span>
          </Button>
          <Button
            size="sm"
            className="text-xs px-2 sm:px-3 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setPostModalOpen(true)}
            aria-label="Postar mensagem no servidor"
          >
            <Send className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Postar Mensagem</span>
            <span className="sm:hidden">Postar</span>
          </Button>
        </div>
      </div>

      {/* Tabs content */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="geral" className="h-full">
          <div className="px-4 sm:px-6 pt-4 overflow-x-auto scrollbar-none">
            <TabsList className="bg-muted w-max min-w-full sm:w-auto">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="embed">Embed</TabsTrigger>
              <TabsTrigger value="campos">Campos</TabsTrigger>
              <TabsTrigger value="estoque">Estoque</TabsTrigger>
              <TabsTrigger value="cupons">Cupons</TabsTrigger>
            </TabsList>
          </div>

          <div className="px-4 sm:px-6 py-4">
            <TabsContent value="geral" className="mt-0">
              <ProductDetailGeneral product={edited} onChange={handleChange} categories={categories} />
            </TabsContent>

            <TabsContent value="embed" className="mt-0">
              <ProductDetailEmbed product={edited} onChange={handleChange} storeEmbedColor={embedColor} />
            </TabsContent>

            <TabsContent value="campos" className="mt-0">
              <ProductDetailFields productId={product.id} />
            </TabsContent>

            <TabsContent value="estoque" className="mt-0">
              <ProductDetailStock productId={product.id} />
            </TabsContent>

            <TabsContent value="cupons" className="mt-0">
              <ProductDetailCoupons productId={product.id} />
            </TabsContent>

          </div>
        </Tabs>
      </div>

      {/* Unsaved changes bar */}
      {dirty && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end px-4 sm:px-6 py-3 border-t border-border bg-card animate-fade-in gap-2 sm:gap-3">
          <span className="text-sm text-muted-foreground sm:mr-auto">Alterações não salvas</span>
          <div className="flex items-center gap-2 sm:gap-3 justify-end">
            <Button variant="ghost" size="sm" onClick={handleDiscard}>
              Limpar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {/* Post message modal */}
      <PostMessageModal
        open={postModalOpen}
        onOpenChange={setPostModalOpen}
        product={edited}
        embedColor={embedColor}
      />
    </div>
  );
};
