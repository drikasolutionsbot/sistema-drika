import { useState } from "react";
import { ArrowLeft, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductDetailGeneral } from "./ProductDetailGeneral";
import { ProductDetailFields } from "./ProductDetailFields";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  type: string;
  price_cents: number;
  stock: number | null;
  active: boolean;
  description: string | null;
}

interface ProductDetailProps {
  product: Product;
  onBack: () => void;
  onSave: (product: Product) => void;
}

export const ProductDetail = ({ product, onBack, onSave }: ProductDetailProps) => {
  const [edited, setEdited] = useState<Product>({ ...product });
  const [dirty, setDirty] = useState(false);

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
            <h2 className="text-lg font-bold font-display">{product.name}</h2>
            <p className="text-xs text-muted-foreground">
              R$ {(product.price_cents / 100).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Sincronizar Mensagens
          </Button>
          <Button variant="outline" size="sm" className="text-xs">
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
              <TabsTrigger value="cupons">Cupons</TabsTrigger>
              <TabsTrigger value="hooks">Hooks</TabsTrigger>
            </TabsList>
          </div>

          <div className="px-6 py-4">
            <TabsContent value="geral" className="mt-0">
              <ProductDetailGeneral product={edited} onChange={handleChange} />
            </TabsContent>

            <TabsContent value="campos" className="mt-0">
              <ProductDetailFields />
            </TabsContent>

            <TabsContent value="cupons" className="mt-0">
              <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                Cupons vinculados ao produto — em breve
              </div>
            </TabsContent>

            <TabsContent value="hooks" className="mt-0">
              <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                Hooks de automação — em breve
              </div>
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
    </div>
  );
};
