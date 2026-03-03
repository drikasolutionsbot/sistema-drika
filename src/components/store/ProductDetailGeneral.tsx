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
  stock: number | null;
  active: boolean;
  description: string | null;
  icon_url?: string | null;
  banner_url?: string | null;
  auto_delivery?: boolean;
  category_id?: string | null;
}

interface ProductDetailGeneralProps {
  product: Product;
  onChange: (updates: Partial<Product>) => void;
  categories?: Category[];
}

export const ProductDetailGeneral = ({ product, onChange, categories = [] }: ProductDetailGeneralProps) => {
  const { tenantId } = useTenant();

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-bold">Preço (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={(product.price_cents / 100).toFixed(2)}
              onChange={(e) => onChange({ price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-bold">Preço de Comparação <span className="font-normal text-muted-foreground">(Opcional)</span></Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              className="bg-muted border-border"
            />
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
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Mostrar Estoque</p>
              <p className="text-xs text-muted-foreground">Mostrar o estoque do produto</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Mostrar Vendidos</p>
              <p className="text-xs text-muted-foreground">Mostrar o número de vendidos do produto</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Habilitar Instruções</p>
              <p className="text-xs text-muted-foreground">Habilitar instruções do produto</p>
            </div>
            <Switch />
          </div>
        </div>
      </section>
    </div>
  );
};
