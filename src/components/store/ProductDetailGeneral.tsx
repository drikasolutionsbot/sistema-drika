import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ProductImageUpload } from "./ProductImageUpload";
import { useTenant } from "@/contexts/TenantContext";
import { List, Zap } from "lucide-react";

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
  button_style?: import("@/components/discord/DiscordButtonStylePicker").DiscordButtonStyle;
}

interface ProductDetailGeneralProps {
  product: Product;
  onChange: (updates: Partial<Product>) => void;
  categories?: Category[];
}

export const ProductDetailGeneral = ({ product, onChange, categories = [] }: ProductDetailGeneralProps) => {
  const { tenantId } = useTenant();
  const nameMaxLen = 256;
  const descMaxLen = 4096;

  return (
    <div className="space-y-8">
      {/* Section: Informações Básicas */}
      <section className="space-y-5">
        <h3 className="text-base font-bold text-foreground">Informações Básicas</h3>

        <div className="space-y-2">
          <Label className="text-sm font-bold">
            Nome do Produto{" "}
            <span className="font-normal text-muted-foreground">
              ({(product.name || "").length}/{nameMaxLen})
            </span>
          </Label>
          <Input
            value={product.name}
            onChange={(e) => {
              if (e.target.value.length <= nameMaxLen) onChange({ name: e.target.value });
            }}
            className="bg-muted border-border"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-bold">
            Descrição{" "}
            <span className="font-normal text-muted-foreground">
              ({(product.description || "").length}/{descMaxLen})
            </span>
          </Label>
          <Textarea
            value={product.description || ""}
            onChange={(e) => {
              if (e.target.value.length <= descMaxLen) onChange({ description: e.target.value });
            }}
            placeholder="Digite a descrição do produto..."
            className="bg-muted border-border min-h-[140px] resize-y"
          />
        </div>
      </section>

      {/* Section: Tipo de Entrega */}
      <section className="space-y-3">
        <div>
          <p className="text-sm font-bold">Tipo de Entrega</p>
          <p className="text-xs text-muted-foreground">Escolha entre entrega manual ou automática</p>
        </div>
        <div className="flex gap-2">
          {/* Manual */}
          <button
            type="button"
            onClick={() => onChange({ auto_delivery: false })}
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-6 py-4 transition-all ${
              !product.auto_delivery
                ? "border-foreground bg-foreground/5"
                : "border-border hover:border-muted-foreground/40"
            }`}
          >
            <List className="h-5 w-5 text-foreground" />
            <span className="text-xs font-semibold text-foreground">Manual</span>
          </button>

          {/* Automática */}
          <button
            type="button"
            onClick={() => onChange({ auto_delivery: true })}
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-6 py-4 transition-all ${
              product.auto_delivery
                ? "border-foreground bg-foreground/5"
                : "border-border hover:border-muted-foreground/40"
            }`}
          >
            <Zap className="h-5 w-5 text-foreground" />
            <span className="text-xs font-semibold text-foreground">Automática</span>
          </button>
        </div>
      </section>

      {/* Section: Imagens */}
      <section className="space-y-5">
        <h3 className="text-base font-bold text-foreground">Imagens</h3>

        {tenantId && (
          <div className="space-y-6">
            <ProductImageUpload
              label="Ícone do Produto"
              hint=""
              currentUrl={product.icon_url || null}
              onUploaded={(url) => onChange({ icon_url: url })}
              onRemoved={() => onChange({ icon_url: null })}
              tenantId={tenantId}
              productId={product.id}
              aspect="square"
            />

            <ProductImageUpload
              label="Banner do Produto"
              hint=""
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
    </div>
  );
};
