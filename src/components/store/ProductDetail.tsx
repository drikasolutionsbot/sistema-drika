import { useState, useEffect } from "react";
import { type DiscordButtonStyle } from "@/components/discord/DiscordButtonStylePicker";
import { ArrowLeft, RefreshCw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductDetailGeneral } from "./ProductDetailGeneral";
import { ProductDetailFields } from "./ProductDetailFields";
import { ProductDetailHooks } from "./ProductDetailHooks";
import { ProductDetailStock } from "./ProductDetailStock";
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
  button_style?: DiscordButtonStyle;
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
  const [embedColor, setEmbedColor] = useState("#5865F2");

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

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await onSave(edited);
      if (ok) setDirty(false);
    } finally {
      setSaving(false);
    }
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
              <Button variant="outline" size="sm" className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Excluir
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
          <Button variant="outline" size="sm" className="text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Sincronizar Mensagens
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setPostModalOpen(true)}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Postar Mensagem
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
              <TabsTrigger value="hooks">Hooks</TabsTrigger>
            </TabsList>
          </div>

          <div className="px-6 py-4">
            <TabsContent value="geral" className="mt-0">
              <ProductDetailGeneral product={edited} onChange={handleChange} categories={categories} />
            </TabsContent>

            <TabsContent value="campos" className="mt-0">
              <ProductDetailFields productId={product.id} />
            </TabsContent>

            <TabsContent value="estoque" className="mt-0">
              <ProductDetailStock productId={product.id} />
            </TabsContent>

            <TabsContent value="hooks" className="mt-0">
              <ProductDetailHooks productId={product.id} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Unsaved changes bar */}
      {dirty && (
        <div className="flex items-center justify-end px-6 py-3 border-t border-border bg-card animate-fade-in gap-3">
          <span className="text-sm text-muted-foreground mr-auto">Alterações não salvas</span>
          <Button variant="ghost" size="sm" onClick={handleDiscard}>
            Limpar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            Salvar
          </Button>
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
