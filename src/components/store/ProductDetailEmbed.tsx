import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProductDiscordPreview } from "./ProductDiscordPreview";
import { DiscordButtonStylePicker, type DiscordButtonStyle } from "@/components/discord/DiscordButtonStylePicker";

export type EmbedBgStyle = "default" | "clean" | "transparent";

export interface EmbedConfig {
  title?: string;
  description?: string;
  footer?: string;
  color?: string;
  bg_style?: EmbedBgStyle;
  price_label?: string;
  stock_label?: string;
  delivery_auto_text?: string;
  delivery_manual_text?: string;
  show_delivery_badge?: boolean;
  show_price?: boolean;
  show_stock_field?: boolean;
  show_footer?: boolean;
  footer_available_text?: string;
  footer_unavailable_text?: string;
}

const DEFAULT_EMBED: EmbedConfig = {
  title: "",
  description: "",
  footer: "",
  color: "",
  bg_style: "default",
  price_label: "Valor à vista",
  stock_label: "Restam",
  delivery_auto_text: "⚡ Entrega Automática!",
  delivery_manual_text: "📦 Entrega Manual",
  show_delivery_badge: true,
  show_price: true,
  show_stock_field: true,
  show_footer: true,
  footer_available_text: "✅ Disponível • Compre agora!",
  footer_unavailable_text: "❌ Indisponível",
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
  category_id?: string | null;
  button_style?: DiscordButtonStyle;
  embed_config?: EmbedConfig;
}

interface ProductDetailEmbedProps {
  product: Product;
  onChange: (updates: Partial<Product>) => void;
  storeEmbedColor?: string;
}

const bgOptions: { value: EmbedBgStyle; label: string; desc: string; preview: string }[] = [
  { value: "default", label: "Padrão", desc: "Fundo escuro do Discord", preview: "#2f3136" },
  { value: "clean", label: "Clean", desc: "Transparente sutil", preview: "rgba(0,0,0,0.15)" },
  { value: "transparent", label: "Invisível", desc: "Sem fundo visível", preview: "transparent" },
];

export const ProductDetailEmbed = ({ product, onChange, storeEmbedColor }: ProductDetailEmbedProps) => {
  const config: EmbedConfig = { ...DEFAULT_EMBED, ...(product.embed_config || {}) };

  const update = (key: keyof EmbedConfig, value: unknown) => {
    onChange({ embed_config: { ...config, [key]: value } });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form */}
      <div className="space-y-6">
        {/* Estilo do Botão */}
        <section>
          <DiscordButtonStylePicker
            value={product.button_style || "success"}
            onChange={(style) => onChange({ button_style: style })}
            label="Estilo do Botão de Compra"
          />
        </section>

        {/* Fundo do Embed */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-foreground">Fundo do Embed</h3>
          <p className="text-xs text-muted-foreground">Estilo do fundo da embed no Discord</p>
          <div className="flex gap-2">
            {bgOptions.map((opt) => {
              const selected = (config.bg_style || "default") === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("bg_style", opt.value)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 px-5 py-3 transition-all ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  {/* Mini preview */}
                  <div className="w-12 h-8 rounded border border-white/10 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[#313338]" />
                    <div
                      className="absolute inset-[2px] rounded-sm"
                      style={{
                        backgroundColor: opt.preview,
                        borderLeft: `3px solid ${config.color || "#5865F2"}`,
                      }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                  </div>
                  {selected && (
                    <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Cor do Embed */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-foreground">Cor do Embed</h3>
          <p className="text-xs text-muted-foreground">Cor da barra lateral do embed. Deixe vazio para usar a cor global da loja.</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={config.color || "#5865F2"}
              onChange={(e) => update("color", e.target.value)}
              className="h-10 w-14 rounded-lg border border-border cursor-pointer bg-transparent"
            />
            <Input
              value={config.color || ""}
              onChange={(e) => update("color", e.target.value)}
              placeholder="#5865F2 (padrão da loja)"
              className="bg-muted border-border max-w-[200px]"
            />
            {config.color && (
              <button
                onClick={() => update("color", "")}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Resetar
              </button>
            )}
          </div>
        </section>

        {/* Título e Descrição */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-foreground">Título e Descrição</h3>
          <p className="text-xs text-muted-foreground">
            Deixe vazio para usar o nome/descrição padrão do produto. Use <code className="bg-muted px-1 rounded">{"{nome}"}</code> para incluir o nome do produto.
          </p>

          <div className="space-y-2">
            <Label className="text-sm font-bold">Título do Embed</Label>
            <Input
              value={config.title || ""}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Ex: 🛒 {nome}"
              className="bg-muted border-border"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-bold">Descrição do Embed</Label>
            <Textarea
              value={config.description || ""}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Deixe vazio para usar a descrição do produto"
              className="bg-muted border-border min-h-[80px] resize-y"
            />
          </div>
        </section>

        {/* Badge de Entrega */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Badge de Entrega</h3>
              <p className="text-xs text-muted-foreground">Texto exibido abaixo do título</p>
            </div>
            <Switch
              checked={config.show_delivery_badge !== false}
              onCheckedChange={(v) => update("show_delivery_badge", v)}
            />
          </div>
          {config.show_delivery_badge !== false && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-bold">Automática</Label>
                <Input
                  value={config.delivery_auto_text || ""}
                  onChange={(e) => update("delivery_auto_text", e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold">Manual</Label>
                <Input
                  value={config.delivery_manual_text || ""}
                  onChange={(e) => update("delivery_manual_text", e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
            </div>
          )}
        </section>

        {/* Campos inline */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-foreground">Campos do Embed</h3>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold">Exibir Preço</Label>
            <Switch
              checked={config.show_price !== false}
              onCheckedChange={(v) => update("show_price", v)}
            />
          </div>
          {config.show_price !== false && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Label do Preço</Label>
              <Input
                value={config.price_label || ""}
                onChange={(e) => update("price_label", e.target.value)}
                placeholder="Valor à vista"
                className="bg-muted border-border"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold">Exibir Estoque</Label>
            <Switch
              checked={config.show_stock_field !== false}
              onCheckedChange={(v) => update("show_stock_field", v)}
            />
          </div>
          {config.show_stock_field !== false && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Label do Estoque</Label>
              <Input
                value={config.stock_label || ""}
                onChange={(e) => update("stock_label", e.target.value)}
                placeholder="Restam"
                className="bg-muted border-border"
              />
            </div>
          )}
        </section>

        {/* Footer */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Rodapé</h3>
              <p className="text-xs text-muted-foreground">Texto exibido na parte inferior do embed</p>
            </div>
            <Switch
              checked={config.show_footer !== false}
              onCheckedChange={(v) => update("show_footer", v)}
            />
          </div>
          {config.show_footer !== false && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-bold">Disponível</Label>
                <Input
                  value={config.footer_available_text || ""}
                  onChange={(e) => update("footer_available_text", e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold">Indisponível</Label>
                <Input
                  value={config.footer_unavailable_text || ""}
                  onChange={(e) => update("footer_unavailable_text", e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Live Preview */}
      <div className="sticky top-4">
        <ProductDiscordPreview
          product={product}
          embedColor={config.color || undefined}
          embedConfig={config}
        />
      </div>
    </div>
  );
};

export { DEFAULT_EMBED };
