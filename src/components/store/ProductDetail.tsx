import { useState, useEffect } from "react";
import { type DiscordButtonStyle } from "@/components/discord/DiscordButtonStylePicker";
import { ArrowLeft, RefreshCw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductDetailGeneral } from "./ProductDetailGeneral";
import { ProductDetailFields } from "./ProductDetailFields";
import { ProductDetailHooks } from "./ProductDetailHooks";
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
  onSave: (product: Product) => void;
  onDelete: (productId: string) => void;
  categories?: Category[];
}

export const ProductDetail = ({ product, onBack, onSave, onDelete, categories = [] }: ProductDetailProps) => {
  const { tenantId } = useTenant();
  const [edited, setEdited] = useState<Product>({ ...product });
  const [dirty, setDirty] = useState(false);
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
