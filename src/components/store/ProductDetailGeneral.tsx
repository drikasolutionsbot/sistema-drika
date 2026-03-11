import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductImageUpload } from "./ProductImageUpload";
import { useTenant } from "@/contexts/TenantContext";
import { DiscordButtonStylePicker, type DiscordButtonStyle } from "@/components/discord/DiscordButtonStylePicker";

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
  icon_url?: string | null;
  banner_url?: string | null;
  auto_delivery?: boolean;
  category_id?: string | null;
  enable_credits?: boolean;
  show_stock?: boolean;
  show_sold?: boolean;
  enable_instructions?: boolean;
  button_style?: DiscordButtonStyle;
}

interface ProductDetailGeneralProps {
  product: Product;
  onChange: (updates: Partial<Product>) => void;
  categories?: Category[];
}

export const ProductDetailGeneral = ({ product, onChange, categories = [] }: ProductDetailGeneralProps) => {
  const { tenantId } = useTenant();
  const [priceDisplay, setPriceDisplay] = useState((product.price_cents / 100).toFixed(2));
  const [comparePriceDisplay, setComparePriceDisplay] = useState(
    product.compare_price_cents ? (product.compare_price_cents / 100).toFixed(2) : ""
  );

  useEffect(() => {
    setPriceDisplay((product.price_cents / 100).toFixed(2));
    setComparePriceDisplay(product.compare_price_cents ? (product.compare_price_cents / 100).toFixed(2) : "");
  }, [product.id]);

  return (
    <div className="space-y-8">
      {/* Section: Informações Básicas */}
      <section className="space-y-5">
        <h3 className="text-base font-bold text-foreground">Informações Básicas</h3>

        <div className="space-y-2">
          <Label className="text-sm font-bold">Nome do Produto</Label>
          <Input
            value={product.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="bg-muted border-border"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-bold">Descrição</Label>
          <Textarea
            value={product.description || ""}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Descreva o produto..."
            className="bg-muted border-border min-h-[100px] resize-none"
          />
        </div>

        {/* Categoria */}
        {categories.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-bold">Categoria</Label>
            <Select
              value={product.category_id ?? "none"}
              onValueChange={(val) => onChange({ category_id: val === "none" ? null : val })}
            >
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Tipo de Entrega */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-bold">Tipo de Entrega</p>
            <p className="text-xs text-muted-foreground">Escolha como o produto será entregue ao comprador</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Automática */}
            <button
              type="button"
              onClick={() => onChange({ auto_delivery: true })}
              className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 transition-all text-left ${
                product.auto_delivery
                  ? "border-emerald-500 bg-emerald-500/5 shadow-[0_0_12px_-3px_rgba(16,185,129,0.3)]"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <span className="text-sm font-bold text-foreground">Automática</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                O produto é entregue instantaneamente após o pagamento via arquivo .txt do estoque.
              </p>
              {product.auto_delivery && (
                <div className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>

            {/* Manual */}
            <button
              type="button"
              onClick={() => onChange({ auto_delivery: false })}
              className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 transition-all text-left ${
                !product.auto_delivery
                  ? "border-amber-500 bg-amber-500/5 shadow-[0_0_12px_-3px_rgba(245,158,11,0.3)]"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📦</span>
                <span className="text-sm font-bold text-foreground">Manual</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A equipe recebe uma notificação e realiza a entrega manualmente pelo ticket.
              </p>
              {!product.auto_delivery && (
                <div className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Section: Imagens */}
      <section className="space-y-5">
        <h3 className="text-base font-bold text-foreground">Imagens</h3>

        {tenantId && (
          <div className="space-y-6">
            <ProductImageUpload
              label="Ícone do Produto"
              hint="Suporta PNG, JPG e GIF · Máximo 10MB · Proporção: 1:1"
              currentUrl={product.icon_url || null}
              onUploaded={(url) => onChange({ icon_url: url })}
              onRemoved={() => onChange({ icon_url: null })}
              tenantId={tenantId}
              productId={product.id}
              aspect="square"
            />

            <ProductImageUpload
              label="Banner do Produto"
              hint="Suporta PNG, JPG e GIF · Máximo 10MB · Proporção: Banner (16:9)"
              currentUrl={product.banner_url || null}
              onUploaded={(url) => onChange({ banner_url: url })}
              onRemoved={() => onChange({ banner_url: null })}
              tenantId={tenantId}
              productId={product.id}
              aspect="banner"
            />
          </div>
        )}
      </section>

      {/* Section: Preço */}
      <section className="space-y-5">
        <h3 className="text-base font-bold text-foreground">Preço</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-bold">Preço (R$)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={priceDisplay}
              onChange={(e) => setPriceDisplay(e.target.value)}
              onBlur={() => {
                const raw = priceDisplay.replace(/[^0-9.,]/g, "").replace(",", ".");
                const num = parseFloat(raw);
                const cents = isNaN(num) ? 0 : Math.round(num * 100);
                onChange({ price_cents: cents });
                setPriceDisplay((cents / 100).toFixed(2));
              }}
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-bold">
              Preço Original <span className="font-normal text-muted-foreground">(Opcional — aparece riscado)</span>
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Ex: 49.90"
              value={comparePriceDisplay}
              onChange={(e) => setComparePriceDisplay(e.target.value)}
              onBlur={() => {
                const raw = comparePriceDisplay.replace(/[^0-9.,]/g, "").replace(",", ".");
                const num = parseFloat(raw);
                if (!raw || isNaN(num) || num <= 0) {
                  onChange({ compare_price_cents: null });
                  setComparePriceDisplay("");
                } else {
                  const cents = Math.round(num * 100);
                  onChange({ compare_price_cents: cents });
                  setComparePriceDisplay((cents / 100).toFixed(2));
                }
              }}
              className="bg-muted border-border"
            />
            <p className="text-[11px] text-muted-foreground">Se preenchido, o preço acima será exibido como promocional e este aparecerá riscado.</p>
          </div>
        </div>
      </section>

      {/* Section: Tipo */}
      <section className="space-y-5">
        <h3 className="text-base font-bold text-foreground">Configurações</h3>

        {/* Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Produto Ativo</p>
              <p className="text-xs text-muted-foreground">Exibir produto na loja</p>
            </div>
            <Switch
              checked={product.active}
              onCheckedChange={(val) => onChange({ active: val })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Habilitar Créditos</p>
              <p className="text-xs text-muted-foreground">Permitir pagamento com créditos</p>
            </div>
            <Switch
              checked={product.enable_credits ?? false}
              onCheckedChange={(val) => onChange({ enable_credits: val })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Mostrar Estoque</p>
              <p className="text-xs text-muted-foreground">Mostrar o estoque do produto</p>
            </div>
            <Switch
              checked={product.show_stock ?? false}
              onCheckedChange={(val) => onChange({ show_stock: val })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Mostrar Vendidos</p>
              <p className="text-xs text-muted-foreground">Mostrar o número de vendidos do produto</p>
            </div>
            <Switch
              checked={product.show_sold ?? false}
              onCheckedChange={(val) => onChange({ show_sold: val })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Habilitar Instruções</p>
              <p className="text-xs text-muted-foreground">Habilitar instruções do produto</p>
            </div>
            <Switch
              checked={product.enable_instructions ?? false}
              onCheckedChange={(val) => onChange({ enable_instructions: val })}
            />
          </div>
        </div>
      </section>

      {/* Section: Aparência do Botão */}
      <section className="space-y-5">
        <h3 className="text-base font-bold text-foreground">Aparência do Embed</h3>
        <DiscordButtonStylePicker
          value={product.button_style || "success"}
          onChange={(style) => onChange({ button_style: style })}
          label="Estilo do Botão de Comprar"
        />
      </section>
    </div>
  );
};
