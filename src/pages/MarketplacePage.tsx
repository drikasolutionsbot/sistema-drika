import { useState } from "react";
import { ShoppingBag, Search, Filter, Star, Download, Eye, Tag, TrendingUp, Package, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price_cents: number;
  rating: number;
  downloads: number;
  author: string;
  tags: string[];
  featured: boolean;
  image_url?: string;
}

// Mock data for initial UI
const mockItems: MarketplaceItem[] = [
  {
    id: "1",
    name: "Pack de Contas Minecraft",
    description: "Contas Full Acesso com capa migrator e ranks em servidores populares.",
    category: "games",
    price_cents: 4999,
    rating: 4.8,
    downloads: 342,
    author: "DrikaStore",
    tags: ["minecraft", "full acesso", "java"],
    featured: true,
  },
  {
    id: "2",
    name: "Spotify Premium 1 Mês",
    description: "Conta Spotify Premium individual com garantia de 30 dias.",
    category: "streaming",
    price_cents: 999,
    rating: 4.5,
    downloads: 1203,
    author: "StreamShop",
    tags: ["spotify", "premium", "música"],
    featured: true,
  },
  {
    id: "3",
    name: "Netflix Premium 4 Telas",
    description: "Acesso completo com 4 telas simultâneas, entrega automática.",
    category: "streaming",
    price_cents: 1999,
    rating: 4.2,
    downloads: 876,
    author: "StreamShop",
    tags: ["netflix", "premium", "4k"],
    featured: false,
  },
  {
    id: "4",
    name: "Crunchyroll Premium",
    description: "Conta Crunchyroll Mega Fan com acesso a todos os animes.",
    category: "streaming",
    price_cents: 799,
    rating: 4.6,
    downloads: 654,
    author: "AnimeStore",
    tags: ["crunchyroll", "anime", "streaming"],
    featured: false,
  },
  {
    id: "5",
    name: "Discord Nitro 1 Mês",
    description: "Código de Discord Nitro com boost de servidor incluso.",
    category: "social",
    price_cents: 2499,
    rating: 4.9,
    downloads: 2100,
    author: "NitroShop",
    tags: ["discord", "nitro", "boost"],
    featured: true,
  },
  {
    id: "6",
    name: "Windows 11 Pro Key",
    description: "Chave de ativação original Windows 11 Pro, ativação vitalícia.",
    category: "software",
    price_cents: 3999,
    rating: 4.7,
    downloads: 1580,
    author: "KeyStore",
    tags: ["windows", "key", "original"],
    featured: false,
  },
];

const categories = [
  { value: "all", label: "Todos" },
  { value: "games", label: "🎮 Games" },
  { value: "streaming", label: "📺 Streaming" },
  { value: "social", label: "💬 Social" },
  { value: "software", label: "💻 Software" },
];

const formatPrice = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const MarketplaceCard = ({ item }: { item: MarketplaceItem }) => (
  <div className="group relative rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_24px_hsl(var(--primary)/0.08)]">
    {/* Image / gradient header */}
    <div className="relative h-32 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent flex items-center justify-center overflow-hidden">
      {item.featured && (
        <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground text-[10px] gap-1">
          <Sparkles className="h-3 w-3" /> Destaque
        </Badge>
      )}
      <Package className="h-12 w-12 text-primary/30" />
    </div>

    <div className="p-4 space-y-3">
      {/* Title + author */}
      <div>
        <h3 className="font-semibold text-sm text-foreground truncate">{item.name}</h3>
        <p className="text-[11px] text-muted-foreground">por {item.author}</p>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{item.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {item.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
          {item.rating}
        </span>
        <span className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          {item.downloads}
        </span>
      </div>

      {/* Price + action */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-sm font-bold text-primary">{formatPrice(item.price_cents)}</span>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
          <Eye className="h-3 w-3" />
          Ver mais
        </Button>
      </div>
    </div>
  </div>
);

const MarketplacePage = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("popular");

  const filtered = mockItems
    .filter((item) => {
      const matchSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchCategory = category === "all" || item.category === category;
      return matchSearch && matchCategory;
    })
    .sort((a, b) => {
      if (sortBy === "popular") return b.downloads - a.downloads;
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "price_asc") return a.price_cents - b.price_cents;
      if (sortBy === "price_desc") return b.price_cents - a.price_cents;
      return 0;
    });

  const featured = mockItems.filter((i) => i.featured);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            Marketplace
          </h1>
          <p className="text-muted-foreground text-sm">
            Explore e adquira produtos digitais de outros vendedores
          </p>
        </div>
      </div>

      {/* Featured banner */}
      {featured.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Em Destaque</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {featured.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg bg-card/60 border border-border p-3"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Tag className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-primary font-semibold">{formatPrice(item.price_cents)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted border-border"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-[160px] bg-muted border-border">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[160px] bg-muted border-border">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Mais populares</SelectItem>
            <SelectItem value="rating">Melhor avaliados</SelectItem>
            <SelectItem value="price_asc">Menor preço</SelectItem>
            <SelectItem value="price_desc">Maior preço</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <MarketplaceCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ShoppingBag className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">Nenhum produto encontrado</p>
          <p className="text-sm mt-1">Tente ajustar os filtros ou busca</p>
        </div>
      )}
    </div>
  );
};

export default MarketplacePage;
