import { Eye } from "lucide-react";

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
}

interface ProductDiscordPreviewProps {
  product: Product;
  storeName?: string;
}

const formatPrice = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const typeLabels: Record<string, string> = {
  digital_auto: "Digital",
  service: "Serviço",
  hybrid: "Híbrido",
};

export const ProductDiscordPreview = ({ product, storeName }: ProductDiscordPreviewProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Eye className="h-4 w-4" />
        Preview no Discord
      </div>

      {/* Discord embed */}
      <div className="bg-[#313338] rounded-lg p-4 max-w-sm">
        {/* Bot header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="h-6 w-6 rounded-full bg-[#5865F2] flex items-center justify-center">
            <span className="text-[10px] text-white font-bold">B</span>
          </div>
          <span className="text-[#dcddde] text-xs font-semibold">{storeName || "Bot"}</span>
          <span className="bg-[#5865F2] text-white text-[9px] px-1 rounded font-medium">BOT</span>
        </div>

        {/* Embed */}
        <div className="flex rounded" style={{ borderLeft: "4px solid #5865F2" }}>
          <div className="flex-1 p-3 space-y-2">
            {/* Title */}
            <p className="text-white font-semibold text-sm">
              {product.icon_url ? "" : "🛒 "}
              {product.name || "Produto sem nome"}
            </p>

            {/* Description */}
            {product.description && (
              <p className="text-[#dcddde] text-xs whitespace-pre-wrap line-clamp-4">
                {product.description}
              </p>
            )}

            {/* Fields */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
              <div>
                <p className="text-[#00b0f4] text-[10px] font-semibold">💰 Preço</p>
                <div className="flex items-center gap-1.5">
                  {product.compare_price_cents && product.compare_price_cents > product.price_cents ? (
                    <>
                      <p className="text-[#57F287] text-xs font-semibold">{formatPrice(product.price_cents)}</p>
                      <p className="text-[#72767d] text-[10px] line-through">{formatPrice(product.compare_price_cents)}</p>
                    </>
                  ) : (
                    <p className="text-[#dcddde] text-xs">{formatPrice(product.price_cents)}</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[#00b0f4] text-[10px] font-semibold">📦 Tipo</p>
                <p className="text-[#dcddde] text-xs">{typeLabels[product.type] || product.type}</p>
              </div>
              {product.stock !== null && (
                <div>
                  <p className="text-[#00b0f4] text-[10px] font-semibold">📊 Estoque</p>
                  <p className="text-[#dcddde] text-xs">{product.stock} disponíveis</p>
                </div>
              )}
              <div>
                <p className="text-[#00b0f4] text-[10px] font-semibold">🔄 Entrega</p>
                <p className="text-[#dcddde] text-xs">{product.auto_delivery ? "Automática" : "Manual"}</p>
              </div>
            </div>

            {/* Banner */}
            {product.banner_url && (
              <img
                src={product.banner_url}
                alt=""
                className="mt-2 rounded max-h-36 w-full object-cover"
              />
            )}

            {/* Footer */}
            <div className="flex items-center gap-1 mt-2 pt-1 border-t border-[#3f4147]">
              <p className="text-[#72767d] text-[10px]">
                {product.active ? "✅ Disponível" : "❌ Indisponível"} • Compre agora!
              </p>
            </div>
          </div>

          {/* Thumbnail */}
          {product.icon_url && (
            <img
              src={product.icon_url}
              alt=""
              className="h-16 w-16 rounded m-3 object-cover shrink-0"
            />
          )}
        </div>

        {/* Button row */}
        <div className="flex gap-2 mt-2">
          <button className="bg-[#5865F2] text-white text-xs font-medium px-3 py-1.5 rounded flex items-center gap-1 cursor-default">
            🛒 Comprar
          </button>
          <button className="bg-[#4f545c] text-white text-xs font-medium px-3 py-1.5 rounded flex items-center gap-1 cursor-default">
            ℹ️ Detalhes
          </button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        *Preview aproximado. A aparência pode variar conforme as configurações do bot.
      </p>
    </div>
  );
};
