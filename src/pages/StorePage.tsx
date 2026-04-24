import { useState, useEffect } from "react";
import { Package } from "lucide-react";
import StoreGeneralSettings from "@/components/store/StoreGeneralSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductList } from "@/components/store/ProductList";
import { ProductDetail } from "@/components/store/ProductDetail";
import { ProductSelectModal } from "@/components/store/ProductSelectModal";
import { CategoryManager, type Category } from "@/components/store/CategoryManager";
import CouponsPage from "@/pages/CouponsPage";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

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
  button_style?: import("@/components/discord/DiscordButtonStylePicker").DiscordButtonStyle;
  embed_config?: Record<string, unknown>;
}

const StorePage = () => {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const { tenantId, tenant } = useTenant();
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

  const { data: fieldCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["product-field-counts", tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      const { data, error } = await supabase.functions.invoke("manage-product-fields", {
        body: { action: "count_by_product", tenant_id: tenantId },
      });
      if (error || data?.error) return {};
      return data ?? {};
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (!tenantId) return;
    supabase.functions.invoke("manage-categories", {
      body: { action: "list", tenant_id: tenantId },
    }).then(({ data, error }) => {
      if (!error && !data?.error) setCategories(data || []);
    });
  }, [tenantId]);

  const handleSave = async (product: Product): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke("manage-products", {
      body: {
        action: "update",
        tenant_id: tenantId,
        product_id: product.id,
        product: {
          name: product.name,
          description: product.description,
          price_cents: product.price_cents,
          compare_price_cents: product.compare_price_cents,
          type: product.type,
          active: product.active,
          icon_url: product.icon_url,
          banner_url: product.banner_url,
          auto_delivery: product.auto_delivery,
          category_id: product.category_id,
          enable_credits: product.enable_credits,
          show_stock: product.show_stock,
          show_sold: product.show_sold,
          enable_instructions: product.enable_instructions,
          button_style: product.button_style,
          embed_config: product.embed_config,
          role_id: product.role_id,
        },
      },
    });

    if (error || data?.error) {
      toast({ title: "Erro ao salvar", description: error?.message || data?.error, variant: "destructive" });
      return false;
    }

    toast({ title: "Produto salvo com sucesso!" });
    setSelectedProduct(data as Product);
    await queryClient.invalidateQueries({ queryKey: ["products"] });
    return true;
  };

  const handleNewProduct = () => setSelectModalOpen(true);

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
        <p className="text-muted-foreground">
          Configure a loja da <strong>{tenant?.name || "..."}</strong>.
        </p>
      </div>

      <Tabs defaultValue="products">
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="bg-muted w-max min-w-full sm:w-auto">
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="coupons">Cupons</TabsTrigger>
            <TabsTrigger value="affiliates">Afiliados</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="products" className="mt-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] min-h-[400px] lg:min-h-[600px]">
              {/* Em mobile, esconde a lista quando um produto está selecionado */}
              <div className={selectedProduct ? "hidden lg:block" : "block"}>
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
                  fieldCounts={fieldCounts}
                />
              </div>

              <div className="flex-1 min-w-0">
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
                  <div className="hidden lg:flex flex-col items-center justify-center h-full text-muted-foreground p-12">
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
          <div className="rounded-xl border border-border bg-card p-6">
            <StoreGeneralSettings />
          </div>
        </TabsContent>

        <TabsContent value="coupons" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <CouponsPage />
          </div>
        </TabsContent>

        <TabsContent value="affiliates" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-muted-foreground text-sm">Programa de afiliados em breve.</p>
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
