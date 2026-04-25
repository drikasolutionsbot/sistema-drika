import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ProductImageUpload } from "./ProductImageUpload";
import { useTenant } from "@/contexts/TenantContext";
import { List, Zap, Shield, Wallet } from "lucide-react";
import { useDiscordRoles } from "@/hooks/useDiscordRoles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const PROVIDER_LABELS: Record<string, string> = {
  pushinpay: "PushinPay",
  efi: "Efí (Gerencianet)",
  abacatepay: "AbacatePay",
  mercadopago: "Mercado Pago",
  misticpay: "MisticPay",
};

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
  role_id?: string | null;
  payment_provider_key?: string | null;
  button_style?: import("@/components/discord/DiscordButtonStylePicker").DiscordButtonStyle;
}

interface ProductDetailGeneralProps {
  product: Product;
  onChange: (updates: Partial<Product>) => void;
  categories?: Category[];
}

export const ProductDetailGeneral = ({ product, onChange, categories = [] }: ProductDetailGeneralProps) => {
  const { tenantId } = useTenant();
  const { roles, loading: rolesLoading } = useDiscordRoles();
  const [activeProviders, setActiveProviders] = useState<string[]>([]);
  const nameMaxLen = 256;
  const descMaxLen = 4096;

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("manage-payment-providers", {
          body: { action: "list", tenant_id: tenantId },
        });
        if (error) throw error;
        const list = Array.isArray(data) ? data : (data?.providers || data?.data || []);
        const active = (list || [])
          .filter((p: any) => p.active && (p.has_credentials ?? p.api_key_encrypted ?? true))
          .map((p: any) => p.provider_key);
        setActiveProviders(active);
      } catch (e) {
        console.error("[ProductDetailGeneral] failed to load providers", e);
        setActiveProviders([]);
      }
    })();
  }, [tenantId]);

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

      {/* Section: Preço */}
      <section className="space-y-5">
        <h3 className="text-base font-bold text-foreground">Preço</h3>
        <p className="text-xs text-muted-foreground">Valor exibido no embed do produto. Não afeta variações.</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-bold">Preço (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={(product.price_cents / 100).toFixed(2)}
              onChange={(e) => onChange({ price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
              placeholder="0.00"
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-bold">Preço Comparativo (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={product.compare_price_cents ? (product.compare_price_cents / 100).toFixed(2) : ""}
              onChange={(e) => {
                const val = e.target.value;
                onChange({ compare_price_cents: val ? Math.round(parseFloat(val) * 100) : null });
              }}
              placeholder="Opcional"
              className="bg-muted border-border"
            />
          </div>
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

      {/* Section: Cargo ao Comprar */}
      <section className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-foreground" />
            <p className="text-sm font-bold">Cargo ao Comprar</p>
          </div>
          <p className="text-xs text-muted-foreground">Cargo do Discord que o cliente recebe automaticamente ao comprar este produto</p>
        </div>
        <Select
          value={product.role_id || "none"}
          onValueChange={(val) => onChange({ role_id: val === "none" ? null : val })}
        >
          <SelectTrigger className="bg-muted border-border w-full max-w-sm">
            <SelectValue placeholder="Nenhum cargo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum cargo</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: typeof role.color === "string" ? role.color : `#${role.color.toString(16).padStart(6, "0")}` }}
                  />
                  {role.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Section: Gateway de Pagamento */}
      <section className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-foreground" />
            <p className="text-sm font-bold">Gateway de Pagamento</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Escolha por qual gateway este produto será cobrado. Deixe em "Padrão" para usar o gateway principal da loja.
          </p>
        </div>
        <Select
          value={product.payment_provider_key || "default"}
          onValueChange={(val) => onChange({ payment_provider_key: val === "default" ? null : val })}
        >
          <SelectTrigger className="bg-muted border-border w-full max-w-sm">
            <SelectValue placeholder="Padrão da loja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Padrão da loja</SelectItem>
            {activeProviders.map((key) => (
              <SelectItem key={key} value={key}>
                {PROVIDER_LABELS[key] || key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeProviders.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Nenhum gateway ativo. Configure em Pagamentos.
          </p>
        )}
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
