import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ProductImageUpload } from "./ProductImageUpload";
import { useTenant } from "@/contexts/TenantContext";
import { List, Zap, Shield, Wallet, Languages } from "lucide-react";
import { useDiscordRoles } from "@/hooks/useDiscordRoles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

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
  language?: string | null;
  currency?: string | null;
}

interface ProductDetailGeneralProps {
  product: Product;
  onChange: (updates: Partial<Product>) => void;
  categories?: Category[];
}

const CURRENCY_SYMBOLS: Record<string, string> = { BRL: "R$", USD: "$", EUR: "€" };

const PriceSection = ({ product, onChange }: { product: Product; onChange: (u: Partial<Product>) => void }) => {
  const { t } = useLanguage();
  const symbol = CURRENCY_SYMBOLS[product.currency || "BRL"] || product.currency || "R$";
  const centsToStr = (c?: number | null) =>
    c == null || c === 0 ? "" : (c / 100).toString().replace(".", ",");

  const [priceStr, setPriceStr] = useState<string>(
    product.price_cents ? (product.price_cents / 100).toString().replace(".", ",") : ""
  );
  const [comparePriceStr, setComparePriceStr] = useState<string>(centsToStr(product.compare_price_cents));

  // Sync when product changes externally (different product selected)
  useEffect(() => {
    setPriceStr(product.price_cents ? (product.price_cents / 100).toString().replace(".", ",") : "");
    setComparePriceStr(centsToStr(product.compare_price_cents));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const parseToCents = (s: string): number | null => {
    const cleaned = s.replace(/[^\d.,]/g, "").replace(",", ".");
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    if (isNaN(n)) return null;
    return Math.round(n * 100);
  };

  return (
    <section className="space-y-5">
      <h3 className="text-base font-bold text-foreground">{t.productGeneral.price}</h3>
      <p className="text-xs text-muted-foreground">{t.productGeneral.priceDesc}</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-bold">{t.productGeneral.priceLabel.replace("{symbol}", symbol)}</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={priceStr}
            onChange={(e) => {
              const v = e.target.value;
              setPriceStr(v);
              const cents = parseToCents(v);
              onChange({ price_cents: cents ?? 0 });
            }}
            placeholder="0,00"
            className="bg-muted border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-bold">{t.productGeneral.comparePrice.replace("{symbol}", symbol)}</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={comparePriceStr}
            onChange={(e) => {
              const v = e.target.value;
              setComparePriceStr(v);
              const cents = parseToCents(v);
              onChange({ compare_price_cents: cents });
            }}
            placeholder={t.productGeneral.comparePricePlaceholder}
            className="bg-muted border-border"
          />
        </div>
      </div>
    </section>
  );
};

export const ProductDetailGeneral = ({ product, onChange, categories = [] }: ProductDetailGeneralProps) => {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const { roles, loading: rolesLoading } = useDiscordRoles();
  const [activeProviders, setActiveProviders] = useState<string[]>([]);

  const PROVIDER_LABELS: Record<string, string> = {
    pushinpay: t.gatewayNames.pushinpay,
    efi: t.gatewayNames.efi,
    abacatepay: t.gatewayNames.abacatepay,
    mercadopago: t.gatewayNames.mercadopago,
    misticpay: t.gatewayNames.misticpay,
    stripe: t.gatewayNames.stripe,
  };
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
      {/* Section: Basic Info */}
      <section className="space-y-5">
        <h3 className="text-base font-bold text-foreground">{t.productGeneral.basicInfo}</h3>

        <div className="space-y-2">
          <Label className="text-sm font-bold">
            {t.productGeneral.productName}{" "}
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
            {t.productGeneral.description}{" "}
            <span className="font-normal text-muted-foreground">
              ({(product.description || "").length}/{descMaxLen})
            </span>
          </Label>
          <Textarea
            value={product.description || ""}
            onChange={(e) => {
              if (e.target.value.length <= descMaxLen) onChange({ description: e.target.value });
            }}
            placeholder={t.productGeneral.descriptionPlaceholder}
            className="bg-muted border-border min-h-[140px] resize-y"
          />
        </div>
      </section>

      {/* Section: Price */}
      <PriceSection product={product} onChange={onChange} />

      {/* Section: Delivery Type */}
      <section className="space-y-3">
        <div>
          <p className="text-sm font-bold">{t.productGeneral.deliveryType}</p>
          <p className="text-xs text-muted-foreground">{t.productGeneral.deliveryTypeDesc}</p>
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
            <span className="text-xs font-semibold text-foreground">{t.productGeneral.manual}</span>
          </button>

          {/* Automatic */}
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
            <span className="text-xs font-semibold text-foreground">{t.productGeneral.automatic}</span>
          </button>
        </div>
      </section>

      {/* Section: Role on Purchase */}
      <section className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-foreground" />
            <p className="text-sm font-bold">{t.productGeneral.roleOnPurchase}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t.productGeneral.roleOnPurchaseDesc}</p>
        </div>
        <Select
          value={product.role_id || "none"}
          onValueChange={(val) => onChange({ role_id: val === "none" ? null : val })}
        >
          <SelectTrigger className="bg-muted border-border w-full max-w-sm">
            <SelectValue placeholder={t.productGeneral.noRole} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t.productGeneral.noRole}</SelectItem>
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

      {/* Section: Payment Gateway */}
      <section className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-foreground" />
            <p className="text-sm font-bold">{t.productGeneral.paymentGateway}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.productGeneral.paymentGatewayDesc}
          </p>
        </div>
        <Select
          value={product.payment_provider_key || "default"}
          onValueChange={(val) => onChange({ payment_provider_key: val === "default" ? null : val })}
        >
          <SelectTrigger className="bg-muted border-border w-full max-w-sm">
            <SelectValue placeholder={t.productGeneral.storeDefault} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t.productGeneral.storeDefault}</SelectItem>
            {activeProviders.map((key) => (
              <SelectItem key={key} value={key}>
                {PROVIDER_LABELS[key] || key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeProviders.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            {t.productGeneral.noActiveGateway}
          </p>
        )}
      </section>

      {/* Section: Currency */}
      <section className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-foreground" />
            <p className="text-sm font-bold">{t.productGeneral.currency}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.productGeneral.currencyDesc}
          </p>
        </div>
        <Select
          value={product.currency || "BRL"}
          onValueChange={(val) => onChange({ currency: val })}
        >
          <SelectTrigger className="bg-muted border-border w-full max-w-sm">
            <SelectValue placeholder={t.productGeneral.currencyBRL} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BRL">{t.productGeneral.currencyBRL}</SelectItem>
            <SelectItem value="USD">{t.productGeneral.currencyUSD}</SelectItem>
            <SelectItem value="EUR">{t.productGeneral.currencyEUR}</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {/* Section: Product Language */}
      <section className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-foreground" />
            <p className="text-sm font-bold">{t.productGeneral.productLanguage}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.productGeneral.productLanguageDesc}
          </p>
        </div>
        <Select
          value={product.language || "default"}
          onValueChange={(val) => onChange({ language: val === "default" ? null : val })}
        >
          <SelectTrigger className="bg-muted border-border w-full max-w-sm">
            <SelectValue placeholder={t.productGeneral.langDefault} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t.productGeneral.langDefault}</SelectItem>
            <SelectItem value="pt-BR">{t.productGeneral.langPtBR}</SelectItem>
            <SelectItem value="en">{t.productGeneral.langEn}</SelectItem>
            <SelectItem value="de">{t.productGeneral.langDe}</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {/* Section: Images */}
      <section className="space-y-5">
        <h3 className="text-base font-bold text-foreground">{t.productGeneral.images}</h3>

        {tenantId && (
          <div className="space-y-6">
            <ProductImageUpload
              label={t.productGeneral.productIcon}
              hint=""
              currentUrl={product.icon_url || null}
              onUploaded={(url) => onChange({ icon_url: url })}
              onRemoved={() => onChange({ icon_url: null })}
              tenantId={tenantId}
              productId={product.id}
              aspect="square"
            />

            <ProductImageUpload
              label={t.productGeneral.productBanner}
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
