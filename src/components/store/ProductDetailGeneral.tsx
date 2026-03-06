import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductImageUpload } from "./ProductImageUpload";
import { useTenant } from "@/contexts/TenantContext";

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

        {/* Entrega Automática */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-bold">Entrega Automática</p>
            <p className="text-xs text-muted-foreground">Ativa a entrega automática do produto</p>
          </div>
          <Switch
            checked={product.auto_delivery ?? false}
            onCheckedChange={(val) => onChange({ auto_delivery: val })}
          />
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

        <div className="space-y-2">
          <Label className="text-sm font-bold">Tipo do Produto</Label>
          <Select value={product.type} onValueChange={(val) => onChange({ type: val })}>
            <SelectTrigger className="bg-muted border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="digital_auto">Digital (Entrega Automática)</SelectItem>
              <SelectItem value="service">Serviço</SelectItem>
              <SelectItem value="hybrid">Híbrido</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
    </div>
  );
};
