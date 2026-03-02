import { Search, Plus, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

interface ProductListProps {
  products: Product[];
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selectedId: string | null;
  onSelect: (product: Product) => void;
  onNewProduct: () => void;
}

const typeLabels: Record<string, string> = {
  digital_auto: "Digital",
  service: "Serviço",
  hybrid: "Híbrido",
};

export const ProductList = ({
  products,
  isLoading,
  search,
  onSearchChange,
  selectedId,
  onSelect,
  onNewProduct,
}: ProductListProps) => {
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Lista de produtos</h3>
          <Button
            size="sm"
            onClick={onNewProduct}
            className="gradient-pink text-primary-foreground border-none hover:opacity-90 h-8 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar produtos..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 bg-muted border-none text-sm"
          />
        </div>
      </div>

      {/* Product list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
            <Package className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {filtered.map((product) => (
              <button
                key={product.id}
                onClick={() => onSelect(product)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-all duration-150",
                  selectedId === product.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted/60 border border-transparent"
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.stock !== null ? `${product.stock} variações` : typeLabels[product.type] || product.type}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
