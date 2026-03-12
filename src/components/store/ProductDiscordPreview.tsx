import { Eye } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { type DiscordButtonStyle, getDiscordButtonStyles } from "@/components/discord/DiscordButtonStylePicker";

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
  button_style?: DiscordButtonStyle;
}

interface PreviewField {
  id: string;
  name: string;
  emoji: string | null;
  price_cents: number;
  compare_price_cents: number | null;
}

interface ProductDiscordPreviewProps {
  product: Product;
  storeName?: string;
  fields?: PreviewField[];
  embedColor?: string;
}

const formatPrice = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const typeLabels: Record<string, string> = {
  digital_auto: "Digital",
  service: "Serviço",
  hybrid: "Híbrido",
};

export const ProductDiscordPreview = ({ product, storeName, fields = [], embedColor }: ProductDiscordPreviewProps) => {
  const { tenant } = useTenant();
  const botName = storeName || tenant?.name || "Bot";
  const botAvatar = tenant?.logo_url;
  const sideColor = embedColor || "#5865F2";

  // Helper to render emoji - handles both unicode and discord custom format
  const renderEmoji = (emoji: string | null) => {
    if (!emoji) return null;
    const match = emoji.match(/^<a?:(\w+):(\d+)>$/);
    if (match) {
      const isAnimated = emoji.startsWith("<a:");
      return (
        <img
          src={`https://cdn.discordapp.com/emojis/${match[2]}.${isAnimated ? "gif" : "png"}`}
          alt={match[1]}
          className="h-4 w-4 inline-block"
        />
      );
    }
    return <span>{emoji}</span>;
  };
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
          {botAvatar ? (
            <img src={botAvatar} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <div className="h-6 w-6 rounded-full bg-[#5865F2] flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">{botName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <span className="text-[#dcddde] text-xs font-semibold">{botName}</span>
          <span className="bg-[#5865F2] text-white text-[9px] px-1 rounded font-medium">BOT</span>
        </div>

        {/* Embed */}
        <div className="flex rounded" style={{ borderLeft: `4px solid ${sideColor}` }}>
          <div className="flex-1 p-3 space-y-2">
            {/* Title */}
            <p className="text-white font-semibold text-sm">
              {product.icon_url ? "" : "🛒 "}
              {product.name || "Produto sem nome"}
            </p>

            {/* Delivery badge */}
            {product.auto_delivery ? (
              <p className="text-[#57F287] text-xs font-semibold">⚡ Entrega Automática!</p>
            ) : (
              <p className="text-[#FEE75C] text-xs font-semibold">📦 Entrega Manual</p>
            )}

            {/* Description */}
            {product.description && (
              <p className="text-[#dcddde] text-xs whitespace-pre-wrap line-clamp-4">
                {product.description}
              </p>
            )}

            {/* Fields */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
              <div>
                <p className="text-[#dcddde] text-[10px] font-semibold">**Valor à vista**</p>
                <p className="text-[#dcddde] text-xs">{formatPrice(product.price_cents)}</p>
              </div>
              <div>
                <p className="text-[#dcddde] text-[10px] font-semibold">Restam</p>
                <p className="text-[#dcddde] text-xs">{product.stock ?? 0}</p>
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

        {/* Fields / Variations */}
        {fields.length > 0 && (
          <div className="mt-2 space-y-1 px-1">
            {fields.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between bg-[#2b2d31] rounded px-2.5 py-1.5"
              >
                <div className="flex items-center gap-1.5">
                  {field.emoji && <span className="text-sm">{renderEmoji(field.emoji)}</span>}
                  <span className="text-[#dcddde] text-xs font-medium">{field.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {field.compare_price_cents && field.compare_price_cents > field.price_cents ? (
                    <>
                      <span className="text-[#57F287] text-xs font-semibold">{formatPrice(field.price_cents)}</span>
                      <span className="text-[#72767d] text-[10px] line-through">{formatPrice(field.compare_price_cents)}</span>
                    </>
                  ) : (
                    <span className="text-[#dcddde] text-xs">{formatPrice(field.price_cents)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Button row */}
        <div className="flex gap-2 mt-2">
          {(() => {
            const style = product.button_style || "success";
            const isGlass = style === "glass";
            const isLink = style === "link";
            const styleConfig = getDiscordButtonStyles(style);
            
            const buttonClasses = isGlass
              ? "bg-white/10 backdrop-blur-sm border border-white/20 text-white"
              : isLink
                ? "bg-transparent text-[#00AFF4] underline"
                : "";
            
            const buttonStyle = !isGlass && !isLink ? {
              backgroundColor: styleConfig.bgColor,
              color: styleConfig.textColor,
            } : undefined;
            
            return (
              <>
                <button
                  className={`text-xs font-medium px-3 py-1.5 rounded flex items-center gap-1 cursor-default ${buttonClasses}`}
                  style={buttonStyle}
                >
                  🛒 Comprar
                </button>
                <button className="bg-[#4f545c] text-white text-xs font-medium px-3 py-1.5 rounded flex items-center gap-1 cursor-default">
                  ℹ️ Detalhes
                </button>
              </>
            );
          })()}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        *Preview aproximado. A aparência pode variar conforme as configurações do bot.
      </p>
    </div>
  );
};
