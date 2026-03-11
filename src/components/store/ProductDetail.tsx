import { useState, useEffect } from "react";
import { type DiscordButtonStyle } from "@/components/discord/DiscordButtonStylePicker";
import { ArrowLeft, RefreshCw, Send, Eye } from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductDetailGeneral } from "./ProductDetailGeneral";
import { ProductDetailFields } from "./ProductDetailFields";
import { ProductDetailCoupons } from "./ProductDetailCoupons";
import { ProductDetailHooks } from "./ProductDetailHooks";
import { ProductDetailStock } from "./ProductDetailStock";
import { PostMessageModal } from "./PostMessageModal";
import { ProductDiscordPreview } from "./ProductDiscordPreview";
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
  button_style?: DiscordButtonStyle;
}

interface ProductDetailProps {
  product: Product;
  onBack: () => void;
  onSave: (product: Product) => void;
  onDelete: (productId: string) => void;
  categories?: Category[];
}

export const ProductDetail = ({ product, onBack, onSave, onDelete, categories = [] }: ProductDetailProps) => {
  const { tenantId } = useTenant();
  const [edited, setEdited] = useState<Product>({ ...product });
  const [dirty, setDirty] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [embedColor, setEmbedColor] = useState("#5865F2");
  const [previewFields, setPreviewFields] = useState<Array<{ id: string; name: string; emoji: string | null; price_cents: number; compare_price_cents: number | null }>>([]);

  useEffect(() => {
    if (!tenantId) return;
    supabase.functions.invoke("manage-store-config", {
      body: { action: "get", tenant_id: tenantId },
    }).then(({ data }) => {
      if (data?.embed_color) setEmbedColor(data.embed_color);
    });
  }, [tenantId]);

  const handleChange = (updates: Partial<Product>) => {
    setEdited((prev) => ({ ...prev, ...updates }));
    setDirty(true);
  };

  const handleSave = () => {
    onSave(edited);
    setDirty(false);
  };

  const handleDiscard = () => {
    setEdited({ ...product });
    setDirty(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors md:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold font-display">Especificações do produto</h2>
            <p className="text-xs text-muted-foreground">
              Configure as informações deste produto
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30">
                <TrashIcon className="h-3.5 w-3.5 mr-1.5" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir produto</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir <strong>{product.name}</strong>? Esta ação não pode ser desfeita. Todos os campos, estoque, cupons e hooks vinculados serão removidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(product.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" className="text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Sincronizar
          </Button>
          <Button
            variant={showPreview ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setShowPreview((p) => !p)}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Preview
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setPostModalOpen(true)}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Postar
          </Button>
        </div>
      </div>

      {/* Tabs content */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="geral" className="h-full">
          <div className="px-6 pt-4">
            <TabsList className="bg-muted">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="campos">Campos</TabsTrigger>
              <TabsTrigger value="estoque">Estoque</TabsTrigger>
              <TabsTrigger value="cupons">Cupons</TabsTrigger>
              <TabsTrigger value="hooks">Hooks</TabsTrigger>
            </TabsList>
          </div>

          <div className="px-6 py-4">
            <TabsContent value="geral" className="mt-0">
              <div className={showPreview ? "grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6" : ""}>
                <ProductDetailGeneral product={edited} onChange={handleChange} categories={categories} />
                {showPreview && (
                  <div className="sticky top-4 space-y-3">
                    <ProductDiscordPreview product={edited} embedColor={embedColor} />
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Cor lateral do embed</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={embedColor}
                          onChange={(e) => setEmbedColor(e.target.value)}
                          className="h-9 w-12 rounded border border-border cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={embedColor}
                          onChange={(e) => setEmbedColor(e.target.value)}
                          className="flex-1 h-9 px-3 rounded-md border border-border bg-muted text-sm font-mono text-foreground"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Salve em Loja &gt; Geral &gt; Aparência para aplicar globalmente</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="campos" className="mt-0">
              <div className={showPreview ? "grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6" : ""}>
                <ProductDetailFields productId={product.id} onFieldsChange={setPreviewFields} />
                {showPreview && (
                  <div className="sticky top-4 space-y-3">
                    <ProductDiscordPreview product={edited} fields={previewFields} embedColor={embedColor} />
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Cor lateral do embed</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={embedColor}
                          onChange={(e) => setEmbedColor(e.target.value)}
                          className="h-9 w-12 rounded border border-border cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={embedColor}
                          onChange={(e) => setEmbedColor(e.target.value)}
                          className="flex-1 h-9 px-3 rounded-md border border-border bg-muted text-sm font-mono text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="estoque" className="mt-0">
              <ProductDetailStock productId={product.id} />
            </TabsContent>

            <TabsContent value="cupons" className="mt-0">
              <ProductDetailCoupons productId={product.id} />
            </TabsContent>

            <TabsContent value="hooks" className="mt-0">
              <ProductDetailHooks productId={product.id} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Unsaved changes bar */}
      {dirty && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">Alterações não salvas</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleDiscard}>
              Limpar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="gradient-pink text-primary-foreground border-none hover:opacity-90"
            >
              Salvar
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
