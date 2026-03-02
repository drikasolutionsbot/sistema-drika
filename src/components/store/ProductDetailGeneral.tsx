import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  type: string;
  price_cents: number;
  stock: number | null;
  active: boolean;
  description: string | null;
}

interface ProductDetailGeneralProps {
  product: Product;
  onChange: (updates: Partial<Product>) => void;
}

export const ProductDetailGeneral = ({ product, onChange }: ProductDetailGeneralProps) => {
  return (
    <div className="space-y-6">
      {/* Nome e Emoji */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Nome do Produto</Label>
          <Input
            value={product.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="bg-muted border-none"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Emoji (Opcional)</Label>
          <Input
            placeholder="🎮"
            className="bg-muted border-none"
          />
        </div>
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Descrição</Label>
        <Textarea
          value={product.description || ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Descreva o produto..."
          className="bg-muted border-none min-h-[100px] resize-none"
        />
      </div>

      {/* Preço e Tipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preço (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={(product.price_cents / 100).toFixed(2)}
            onChange={(e) => onChange({ price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
            className="bg-muted border-none"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preço de Comparação (Opcional)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            className="bg-muted border-none"
          />
        </div>
      </div>

      {/* Tipo */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Tipo do Produto</Label>
        <Select value={product.type} onValueChange={(val) => onChange({ type: val })}>
          <SelectTrigger className="bg-muted border-none">
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
      <div className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Produto Ativo</p>
            <p className="text-xs text-muted-foreground">Exibir produto na loja</p>
          </div>
          <Switch
            checked={product.active}
            onCheckedChange={(val) => onChange({ active: val })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Mostrar Estoque</p>
            <p className="text-xs text-muted-foreground">Mostrar o estoque do produto</p>
          </div>
          <Switch />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Habilitar Créditos</p>
            <p className="text-xs text-muted-foreground">Permitir pagamento com créditos</p>
          </div>
          <Switch />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Mostrar Vendidos</p>
            <p className="text-xs text-muted-foreground">Mostrar o número de vendidos do produto</p>
          </div>
          <Switch />
        </div>
      </div>
    </div>
  );
};
