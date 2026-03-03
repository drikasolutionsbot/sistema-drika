import { useState } from "react";
import { Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenantQuery } from "@/hooks/useSupabaseQuery";
import { ProductList } from "@/components/store/ProductList";
import { ProductDetail } from "@/components/store/ProductDetail";
import { ProductSelectModal } from "@/components/store/ProductSelectModal";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  type: string;
  price_cents: number;
  stock: number | null;
  active: boolean;
  description: string | null;
  icon_url?: string | null;
  banner_url?: string | null;
  auto_delivery?: boolean;
}

const StorePage = () => {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useTenantQuery<Product>("products", "products", {
    orderBy: "created_at",
    ascending: false,
  });

  const handleSave = async (product: Product) => {
    const { error } = await (supabase as any)
      .from("products")
      .update({
        name: product.name,
        description: product.description,
        price_cents: product.price_cents,
        type: product.type,
        active: product.active,
        icon_url: product.icon_url,
        banner_url: product.banner_url,
        auto_delivery: product.auto_delivery,
      })
      .eq("id", product.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Produto salvo com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    }
  };

  const handleNewProduct = () => {
    setSelectModalOpen(true);
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectModalOpen(false);
  };

  const handleCreateNew = async () => {
    if (!tenantId) return;
    const { data, error } = await (supabase as any)
      .from("products")
      .insert({ name: "Novo Produto", tenant_id: tenantId, price_cents: 0 })
      .select()
      .single();

    if (error) {
      toast({ title: "Erro ao criar produto", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedProduct(data as Product);
      setSelectModalOpen(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Loja</h1>
        <p className="text-muted-foreground">Configure a loja do seu servidor</p>
      </div>

      <Tabs defaultValue="products">
        <TabsList className="bg-muted">
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="general">Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] min-h-[600px]">
              {/* Left: Product list */}
              <ProductList
                products={products}
                isLoading={isLoading}
                search={search}
                onSearchChange={setSearch}
                selectedId={selectedProduct?.id ?? null}
                onSelect={setSelectedProduct}
                onNewProduct={handleNewProduct}
              />

              {/* Right: Product detail */}
              <div className="flex-1">
                {selectedProduct ? (
                  <ProductDetail
                    key={selectedProduct.id}
                    product={selectedProduct}
                    onBack={() => setSelectedProduct(null)}
                    onSave={handleSave}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12">
                    <Package className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">Selecione um produto</p>
                    <p className="text-sm mt-1">Escolha um produto da lista para editar</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            Configurações gerais da loja — em breve
          </div>
        </TabsContent>
      </Tabs>

      <ProductSelectModal
        open={selectModalOpen}
        onOpenChange={setSelectModalOpen}
        products={products}
        onSelect={handleSelectProduct}
        onCreateNew={handleCreateNew}
      />
    </div>
  );
};

export default StorePage;
