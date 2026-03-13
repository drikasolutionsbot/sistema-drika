import { Search, Plus, Package, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  category_id?: string | null;
}

interface ProductListProps {
  products: Product[];
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selectedId: string | null;
  onSelect: (product: Product) => void;
  onNewProduct: () => void;
  categories?: Category[];
  selectedCategoryId?: string | null;
  onCategoryChange?: (id: string | null) => void;
}

export const ProductList = ({
  products,
  isLoading,
  search,
  onSearchChange,
  selectedId,
  onSelect,
  onNewProduct,
  categories = [],
  selectedCategoryId,
  onCategoryChange,
}: ProductListProps) => {
  const filtered = products
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => !selectedCategoryId || p.category_id === selectedCategoryId);

  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-5 bg-foreground rounded-full" />
            <h3 className="text-sm font-semibold text-foreground">Lista de produtos</h3>
          </div>
          <button
            onClick={onNewProduct}
            className="flex items-center justify-center h-7 w-7 rounded-full border border-border hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
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
        {categories.length > 0 && onCategoryChange && (
          <Select
            value={selectedCategoryId ?? "all"}
            onValueChange={(val) => onCategoryChange(val === "all" ? null : val)}
          >
            <SelectTrigger className="h-8 bg-muted border-none text-xs">
              <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Todas categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
            {filtered.map((product) => {
              const hasStock = product.stock !== null && product.stock > 0;
              const variationCount = product.stock ?? 0;

              return (
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {product.active ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-red-500/40 text-red-400 bg-red-500/10">
                          Postado
                        </Badge>
                      ) : null}
                      {hasStock ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                          Em estoque
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {variationCount} variações
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
