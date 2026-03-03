import { useState, useEffect } from "react";
import { Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductList } from "@/components/store/ProductList";
import { ProductDetail } from "@/components/store/ProductDetail";
import { ProductSelectModal } from "@/components/store/ProductSelectModal";
import { CategoryManager, type Category } from "@/components/store/CategoryManager";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
  category_id?: string | null;
}

const StorePage = () => {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.functions.invoke("manage-products", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Fetch categories
  useEffect(() => {
    if (!tenantId) return;
    supabase.functions.invoke("manage-categories", {
      body: { action: "list", tenant_id: tenantId },
    }).then(({ data, error }) => {
      if (!error && !data?.error) setCategories(data || []);
    });
  }, [tenantId]);

  const handleSave = async (product: Product) => {
    const { data, error } = await supabase.functions.invoke("manage-products", {
      body: {
        action: "update",
        tenant_id: tenantId,
        product_id: product.id,
        product: {
          name: product.name,
          description: product.description,
          price_cents: product.price_cents,
          type: product.type,
          active: product.active,
          icon_url: product.icon_url,
          banner_url: product.banner_url,
          auto_delivery: product.auto_delivery,
          category_id: product.category_id,
        },
      },
    });

    if (error || data?.error) {
      toast({ title: "Erro ao salvar", description: error?.message || data?.error, variant: "destructive" });
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
    const { data, error } = await supabase.functions.invoke("manage-products", {
      body: { action: "create", tenant_id: tenantId },
    });

    if (error || data?.error) {
      toast({ title: "Erro ao criar produto", description: error?.message || data?.error, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedProduct(data as Product);
      setSelectModalOpen(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!tenantId) return;
    const { data, error } = await supabase.functions.invoke("manage-products", {
      body: { action: "delete", tenant_id: tenantId, product_id: productId },
    });
    if (error || data?.error) {
      toast({ title: "Erro ao excluir produto", description: error?.message || data?.error, variant: "destructive" });
    } else {
      setSelectedProduct(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto excluído!" });
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
          <TabsTrigger value="categories">Categorias</TabsTrigger>
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
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onCategoryChange={setSelectedCategoryId}
              />

              {/* Right: Product detail */}
              <div className="flex-1">
                {selectedProduct ? (
                  <ProductDetail
                    key={selectedProduct.id}
                    product={selectedProduct}
                    onBack={() => setSelectedProduct(null)}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    categories={categories}
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

        <TabsContent value="categories" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <CategoryManager
              categories={categories}
              onCategoriesChange={setCategories}
            />
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
