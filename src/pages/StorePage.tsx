import { useState, useEffect } from "react";
import { Package } from "lucide-react";
import StoreGeneralSettings from "@/components/store/StoreGeneralSettings";
import StoreCheckoutSettings from "@/components/store/StoreCheckoutSettings";
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
          payment_provider_key: (product as any).payment_provider_key ?? null,
          language: (product as any).language ?? null,
          currency: (product as any).currency ?? "BRL",
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

  const handleDuplicateProduct = async (product: Product) => {
    if (!tenantId) return;
    toast({ title: "Duplicando produto..." });
    const { data, error } = await supabase.functions.invoke("manage-products", {
      body: { action: "duplicate", tenant_id: tenantId, product_id: product.id },
    });
    
    if (error || data?.error) {
      toast({ title: "Erro ao duplicar", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ title: "Produto duplicado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedProduct(data as Product);
    }
  };

  const handleMove = async (product: Product, direction: "up" | "down") => {
    if (!tenantId) return;
    // Usamos a lista completa para reordenar, ignorando filtros atuais de categoria/busca para evitar bagunça
    const currentIndex = products.findIndex((p) => p.id === product.id);
    if (currentIndex === -1) return;
    
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= products.length) return;

    const targetProduct = products[targetIndex];
    
    const newProducts = [...products];
    newProducts[currentIndex] = targetProduct;
    newProducts[targetIndex] = product;
    
    const updates = newProducts.map((p, idx) => ({ id: p.id, position: idx }));
    
    queryClient.setQueryData(["products", tenantId], newProducts);

    const { error, data } = await supabase.functions.invoke("manage-products", {
      body: { action: "reorder", tenant_id: tenantId, updates },
    });

    if (error || data?.error) {
      toast({ title: "Erro ao reordenar", description: error?.message || data?.error, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-100px)]">
      {/* Ambient background blobs to make glassmorphism visible */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] opacity-70" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] opacity-70" />
        <div className="absolute top-[30%] left-[60%] w-[30%] h-[30%] bg-blue-500/15 rounded-full blur-[120px] opacity-60" />
      </div>

      <div className="space-y-6 animate-fade-in relative z-0">
        <div className="relative rounded-[24px] overflow-hidden p-6 pb-5 border border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-emerald-500/10" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.15)]">
              <Package className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white/95">Loja</h1>
              <p className="text-sm text-muted-foreground/80 font-medium">
                Configure a loja da <strong>{tenant?.name || "..."}</strong>.
              </p>
            </div>
          </div>
        </div>

      <Tabs defaultValue="products">
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl w-max min-w-full sm:w-auto p-1.5 h-auto">
            <TabsTrigger value="products" className="rounded-xl px-4 py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_15px_rgba(var(--primary),0.2)]">Produtos</TabsTrigger>
            <TabsTrigger value="categories" className="rounded-xl px-4 py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_15px_rgba(var(--primary),0.2)]">Categorias</TabsTrigger>
            <TabsTrigger value="general" className="rounded-xl px-4 py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_15px_rgba(var(--primary),0.2)]">Geral</TabsTrigger>
            <TabsTrigger value="checkout" className="rounded-xl px-4 py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_15px_rgba(var(--primary),0.2)]">Checkout</TabsTrigger>
            <TabsTrigger value="coupons" className="rounded-xl px-4 py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_15px_rgba(var(--primary),0.2)]">Cupons</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="products" className="mt-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl overflow-hidden h-[calc(100vh-220px)] min-h-[500px] shadow-2xl relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3" />
            <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] h-full relative z-10">
              {/* Em mobile, esconde a lista quando um produto está selecionado */}
              <div className={selectedProduct ? "hidden lg:block h-full min-h-0" : "block h-full min-h-0"}>
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
                  onDuplicate={handleDuplicateProduct}
                  onMoveUp={(p) => handleMove(p, "up")}
                  onMoveDown={(p) => handleMove(p, "down")}
                />
              </div>

              <div className="flex-1 min-w-0 h-full min-h-0">
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
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3" />
            <div className="relative z-10">
              <CategoryManager
                categories={categories}
                onCategoriesChange={setCategories}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3" />
            <div className="relative z-10">
              <StoreGeneralSettings />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="checkout" className="mt-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3" />
            <div className="relative z-10">
              <StoreCheckoutSettings />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="coupons" className="mt-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3" />
            <div className="relative z-10">
              <CouponsPage />
            </div>
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
    </div>
  );
};

export default StorePage;
