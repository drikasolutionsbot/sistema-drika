import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { type DiscordButtonStyle, getDiscordButtonStyles } from "@/components/discord/DiscordButtonStylePicker";
import { type EmbedConfig, DEFAULT_EMBED } from "./ProductDetailEmbed";
import { parseEmojiFromLabel } from "@/components/discord/ButtonLabelWithEmoji";

const DISCORD_LABELS: Record<string, Record<string, string>> = {
  "pt-BR": { buy: "🛒 Comprar", buy_plain: "comprar", price: "Valor à vista", stock: "Restam", auto: "⚡ Entrega Automática!", manual: "📦 Entrega Manual", available: "✅ Disponível • Compre agora!", unavailable: "❌ Indisponível" },
  en: { buy: "🛒 Buy", buy_plain: "buy", price: "Price", stock: "In stock", auto: "⚡ Instant Delivery!", manual: "📦 Manual Delivery", available: "✅ Available • Buy now!", unavailable: "❌ Unavailable" },
  de: { buy: "🛒 Kaufen", buy_plain: "kaufen", price: "Preis", stock: "Verfügbar", auto: "⚡ Sofortige Lieferung!", manual: "📦 Manuelle Lieferung", available: "✅ Verfügbar • Jetzt kaufen!", unavailable: "❌ Nicht verfügbar" },
};

const DEFAULT_DISCORD_TEXTS = new Set([
  "comprar", "🛒 comprar", "buy", "🛒 buy", "kaufen", "🛒 kaufen",
  "valor à vista", "valor a vista", "price", "preis",
  "restam", "in stock", "verfügbar",
  "⚡ entrega automática!", "⚡ entrega automatica!", "⚡ instant delivery!", "⚡ sofortige lieferung!",
  "<:zap:1521562668992037004> entrega automática!", "<:zap:1521562668992037004> entrega automatica!", "<:zap:1521562668992037004> instant delivery!", "<:zap:1521562668992037004> sofortige lieferung!",
  "📦 entrega manual", "🛠️ entrega manual", "📦 manual delivery", "🛠️ manual delivery", "📦 manuelle lieferung", "🛠️ manuelle lieferung",
  "✅ disponível • compre agora!", "✅ disponivel • compre agora!", "✅ available • buy now!", "✅ verfügbar • jetzt kaufen!",
  "❌ indisponível", "❌ indisponivel", "❌ unavailable", "❌ nicht verfügbar",
]);

const localizedOrCustom = (value: string | undefined, fallback: string) => {
  const normalized = value?.trim().toLowerCase();
  return !normalized || DEFAULT_DISCORD_TEXTS.has(normalized) ? fallback : value!;
};

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
  infinite_stock?: boolean;
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
  embedConfig?: EmbedConfig;
}

const formatPrice = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const typeLabels: Record<string, string> = {
  digital_auto: "Digital",
  service: "Serviço",
  hybrid: "Híbrido",
};

export const ProductDiscordPreview = ({ product, storeName, fields = [], embedColor, embedConfig }: ProductDiscordPreviewProps) => {
  const { tenant, tenantId } = useTenant();
  const { language } = useLanguage();
  const L = DISCORD_LABELS[language] || DISCORD_LABELS["pt-BR"];
  const botName = storeName || tenant?.name || "Bot";
  const botAvatar = tenant?.logo_url;
  const cfg: EmbedConfig = { ...DEFAULT_EMBED, ...embedConfig };
  const sideColor = embedColor || cfg.color || "#2B2D31";
  const bgStyle = cfg.bg_style || "default";

  const { data: stockQueryData } = useQuery({
    queryKey: ["product-discord-preview-stock", tenantId, product.id],
    enabled: Boolean(tenantId && product.id),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-product-fields", {
        body: {
          action: "get_stock",
          tenant_id: tenantId,
          product_id: product.id,
        },
      });

      if (error) throw error;
      return {
        stock: Number(data?.stock ?? 0),
        infinite_stock: Boolean(data?.infinite_stock),
      };
    },
  });

  const isInfiniteStock = Boolean(product.infinite_stock ?? stockQueryData?.infinite_stock);
  const realStockCount = isInfiniteStock ? "∞" : (stockQueryData?.stock ?? product.stock ?? 0);

  const embedBgMap: Record<string, string> = {
    default: "#2f3136",
    clean: "rgba(0,0,0,0.08)",
    transparent: "transparent",
  };

  const resolveTemplate = (tpl: string, fallback: string) => {
    if (!tpl) return fallback;
    return tpl.replace(/\{nome\}/g, product.name || "Produto sem nome");
  };

  const title = resolveTemplate(cfg.title || "", `${product.icon_url ? "" : "🛒 "}${product.name || "Produto sem nome"}`);
  const description = cfg.description ? resolveTemplate(cfg.description, "") : product.description;

  const renderTextWithEmojis = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(<a?:\w+:\d+>)/g);
    return parts.map((part, i) => {
      const match = part.match(/^<a?:(\w+):(\d+)>$/);
      if (match) {
        const isAnimated = part.startsWith("<a:");
        return (
          <img
            key={i}
            src={`https://cdn.discordapp.com/emojis/${match[2]}.${isAnimated ? "gif" : "png"}`}
            alt={match[1]}
            className="h-4 w-4 inline-block align-text-bottom mr-1"
          />
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

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
        <div
          className="flex rounded"
          style={{
            borderLeft: `4px solid ${sideColor}`,
            backgroundColor: embedBgMap[bgStyle],
          }}
        >
          <div className="flex-1 p-3 space-y-2">
            {/* Title */}
            <p className="text-white font-semibold text-sm">{title}</p>

            {/* Delivery badge */}
            {cfg.show_delivery_badge !== false && (() => {
              const rawText = localizedOrCustom(
                product.auto_delivery ? cfg.delivery_auto_text : cfg.delivery_manual_text,
                product.auto_delivery ? L.auto : L.manual
              );
              
              const customEmojiMatch = rawText.match(/^(<a?:\w+:\d+>)\s*(.*)/);
              const unicodeMatch = !customEmojiMatch ? rawText.match(/^(\p{Emoji}|\u26A1|\uD83D[\uDE00-\uDE4F])\s*(.*)/u) : null;
              
              const emojiPart = customEmojiMatch ? customEmojiMatch[1] : (unicodeMatch ? unicodeMatch[1] : null);
              const textPart = customEmojiMatch ? customEmojiMatch[2] : (unicodeMatch ? unicodeMatch[2] : rawText);
              
              return (
                <div className="flex items-center gap-1.5 mt-2">
                  {emojiPart && <span className="text-sm leading-none">{renderTextWithEmojis(emojiPart)}</span>}
                  <span className="text-[#dcddde] text-xs font-bold leading-none">
                    {renderTextWithEmojis(textPart)}
                  </span>
                </div>
              );
            })()}

            {/* Description */}
            {description && (
              <p className="text-[#dcddde] text-xs whitespace-pre-wrap line-clamp-4">
                {renderTextWithEmojis(description)}
              </p>
            )}

            {/* Fields */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
              {cfg.show_price !== false && (
                <div>
                  <p className="text-[#dcddde] text-[10px] font-semibold">**{localizedOrCustom(cfg.price_label, L.price)}**</p>
                  <p className="text-[#dcddde] text-xs">{formatPrice(product.price_cents)}</p>
                </div>
              )}
              {cfg.show_stock_field !== false && (
                <div>
                  <p className="text-[#dcddde] text-[10px] font-semibold">{localizedOrCustom(cfg.stock_label, L.stock)}</p>
                  <p className="text-[#dcddde] text-xs">{realStockCount}</p>
                </div>
              )}
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
            {cfg.show_footer !== false && (
              <div className="flex items-center gap-1 mt-2 pt-1 border-t border-[#3f4147]">
                <p className="text-[#72767d] text-[10px]">
                  {product.active
                    ? localizedOrCustom(cfg.footer_available_text, L.available)
                    : localizedOrCustom(cfg.footer_unavailable_text, L.unavailable)}
                </p>
              </div>
            )}
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
        <div className="flex flex-wrap gap-2 mt-2">
          {(() => {
            const style = product.button_style || "secondary";
            const isGlass = style === "glass";
            const isLink = style === "link";
            const isSecondary = style === "secondary";
            const styleConfig = getDiscordButtonStyles(style);

            const buttonClasses = isGlass
              ? "bg-white/10 backdrop-blur-sm border border-white/20 text-white"
              : isLink
                ? "bg-transparent text-[#00AFF4] underline"
                : isSecondary
                  ? "bg-[#2b2d31] hover:bg-[#35373c] border border-white/10 text-white rounded-md"
                  : "rounded";

            const buttonStyle = !isGlass && !isLink && !isSecondary ? {
              backgroundColor: styleConfig.bgColor,
              color: styleConfig.textColor,
            } : undefined;

            const rawLabel = embedConfig?.buy_button_label?.trim() || "";
            const normalizedLabel = rawLabel.toLowerCase();
            const isDefaultBuy =
              !normalizedLabel ||
              DEFAULT_DISCORD_TEXTS.has(normalizedLabel) ||
              normalizedLabel === "<:car:1521242918290194493> comprar";
            const cleanBuyText = isDefaultBuy ? L.buy.replace(/^🛒\s*/, "") : rawLabel;
            const parsed = isDefaultBuy ? null : parseEmojiFromLabel(cleanBuyText);

            return (
              <>
                <button
                  className={`text-xs font-medium px-3 py-1.5 flex items-center gap-1.5 cursor-default ${buttonClasses}`}
                  style={buttonStyle}
                >
                  {isDefaultBuy ? (
                    <span className="flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white shrink-0" aria-hidden="true">
                        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zM7.16 14.26l.03-.01L18.55 13c.72 0 1.35-.41 1.66-1.05l2.7-5.44A1 1 0 0 0 22 5H5.21l-.94-2H1v2h2l3.6 7.59-1.35 2.44C4.52 16.37 5.48 18 7 18h12v-2H7.42c-.14 0-.25-.11-.26-.25z" />
                      </svg>
                      <span>{cleanBuyText}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      {parsed?.emoji && (
                        parsed.isCustom && parsed.customId ? (
                          <img
                            src={`https://cdn.discordapp.com/emojis/${parsed.customId}.${parsed.animated ? "gif" : "png"}`}
                            alt="emoji"
                            className="h-4 w-4 object-contain shrink-0"
                          />
                        ) : (
                          <span className="text-sm leading-none mr-0.5">{parsed.emoji}</span>
                        )
                      )}
                      <span>{parsed?.cleanLabel}</span>
                    </span>
                  )}
                </button>

                <button
                  className="text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1.5 cursor-default bg-[#2b2d31] border border-white/10 text-white"
                  title="Exibido automaticamente se o canal de Feedbacks estiver configurado na loja"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white shrink-0" aria-hidden="true">
                    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
                  </svg>
                  <span>Feedbacks</span>
                  <svg viewBox="0 0 24 24" className="h-3 w-3 stroke-white/80 fill-none shrink-0" strokeWidth="2" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
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