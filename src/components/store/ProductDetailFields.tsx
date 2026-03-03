import { useState, useEffect, useCallback } from "react";
import { Plus, Search, GripVertical, ChevronDown, ChevronUp, Package, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { AddStockModal } from "./AddStockModal";

interface ProductField {
  id: string;
  product_id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  price_cents: number;
  compare_price_cents: number | null;
  sort_order: number;
  enable_credits: boolean;
  is_subscription: boolean;
  show_stock: boolean;
  show_sold: boolean;
  enable_instructions: boolean;
  require_role_id: string | null;
  min_quantity: number;
  max_quantity: number | null;
}

interface ProductDetailFieldsProps {
  productId: string;
}

export const ProductDetailFields = ({ productId }: ProductDetailFieldsProps) => {
  const { tenantId } = useTenant();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fields, setFields] = useState<ProductField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stockCounts, setStockCounts] = useState<Record<string, number>>({});
  const [stockModalFieldId, setStockModalFieldId] = useState<string | null>(null);

  const fetchFields = useCallback(async () => {
    if (!tenantId || !productId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("product_fields")
      .select("*")
      .eq("product_id", productId)
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true });

    if (!error && data) {
      setFields(data);
      // Fetch stock counts
      const ids = data.map((f: any) => f.id);
      if (ids.length > 0) {
        const { data: stockData } = await (supabase as any)
          .from("product_stock_items")
          .select("field_id")
          .in("field_id", ids)
          .eq("delivered", false);
        
        const counts: Record<string, number> = {};
        (stockData || []).forEach((s: any) => {
          counts[s.field_id] = (counts[s.field_id] || 0) + 1;
        });
        setStockCounts(counts);
      }
    }
    setLoading(false);
  }, [tenantId, productId]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const toggle = (id: string) => setExpandedId(expandedId === id ? null : id);

  const addField = async () => {
    if (!tenantId) return;
    const { data, error } = await (supabase as any)
      .from("product_fields")
      .insert({
        product_id: productId,
        tenant_id: tenantId,
        name: "Novo",
        description: "Novo produto",
        price_cents: 0,
        sort_order: fields.length,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Erro ao criar campo", description: error.message, variant: "destructive" });
    } else {
      setFields([...fields, data]);
      setExpandedId(data.id);
    }
  };

  const updateField = (id: string, updates: Partial<ProductField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const saveField = async (field: ProductField) => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("product_fields")
      .update({
        name: field.name,
        description: field.description,
        emoji: field.emoji,
        price_cents: field.price_cents,
        compare_price_cents: field.compare_price_cents,
        enable_credits: field.enable_credits,
        is_subscription: field.is_subscription,
        show_stock: field.show_stock,
        show_sold: field.show_sold,
        enable_instructions: field.enable_instructions,
        require_role_id: field.require_role_id,
        min_quantity: field.min_quantity,
        max_quantity: field.max_quantity,
      })
      .eq("id", field.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Campo salvo! ✅" });
    }
    setSaving(false);
  };

  const deleteField = async (id: string) => {
    const { error } = await (supabase as any).from("product_fields").delete().eq("id", id);
    if (!error) {
      setFields(fields.filter((f) => f.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast({ title: "Campo removido" });
    }
  };

  const filtered = fields.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar campos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-muted border-border"
        />
      </div>

      {/* Add button */}
      <button
        onClick={addField}
        className="w-full rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors flex items-center justify-center gap-2"
      >
        Adicionar Campo <Plus className="h-4 w-4" />
      </button>

      {/* Fields list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-bold">Campos</h4>
          {filtered.map((field) => (
            <div key={field.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Header */}
              <button
                onClick={() => toggle(field.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0 text-lg">
                  {field.emoji || <Package className="h-4 w-4 text-primary" />}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <p className="text-sm font-bold">{field.name}</p>
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                  <p className="text-xs font-bold text-emerald-400">
                    R$ {(field.price_cents / 100).toFixed(2).replace(".", ",")}
                  </p>
                </div>
                {expandedId === field.id ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {/* Expanded content */}
              {expandedId === field.id && (
                <div className="border-t border-border p-4">
                  <Tabs defaultValue="geral">
                    <TabsList className="bg-muted mb-4">
                      <TabsTrigger value="geral">Geral</TabsTrigger>
                      <TabsTrigger value="estoque">Estoque</TabsTrigger>
                    </TabsList>

                    <TabsContent value="geral" className="space-y-5">
                      {/* Name + Emoji */}
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-bold">Nome do Campo</Label>
                          <Input
                            value={field.name}
                            onChange={(e) => updateField(field.id, { name: e.target.value })}
                            className="bg-muted border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-bold">
                            Emoji <span className="font-normal text-muted-foreground">(Opcional)</span>
                          </Label>
                          <Input
                            value={field.emoji || ""}
                            onChange={(e) => updateField(field.id, { emoji: e.target.value })}
                            placeholder="😀"
                            className="bg-muted border-border"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label className="text-sm font-bold">Descrição</Label>
                        <Textarea
                          value={field.description || ""}
                          onChange={(e) => updateField(field.id, { description: e.target.value })}
                          placeholder="Descrição do campo..."
                          className="bg-muted border-border min-h-[80px] resize-none"
                        />
                      </div>

                      {/* Price */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-bold">Preço</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={(field.price_cents / 100).toFixed(2)}
                            onChange={(e) => updateField(field.id, { price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                            className="bg-muted border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-bold">
                            Preço de Comparação <span className="font-normal text-muted-foreground">(Opcional)</span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={field.compare_price_cents ? (field.compare_price_cents / 100).toFixed(2) : ""}
                            onChange={(e) => updateField(field.id, { compare_price_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
                            className="bg-muted border-border"
                          />
                        </div>
                      </div>

                      {/* Toggles */}
                      <div className="space-y-3">
                        {[
                          { key: "enable_credits" as const, label: "Habilitar Créditos", desc: "Permitir pagamento com créditos" },
                          { key: "is_subscription" as const, label: "Tornar Assinatura", desc: "Tornar o produto de assinatura recorrente" },
                          { key: "show_stock" as const, label: "Mostrar Estoque", desc: "Mostrar o estoque do produto" },
                          { key: "show_sold" as const, label: "Mostrar Vendidos", desc: "Mostrar o número de vendidos do produto" },
                          { key: "enable_instructions" as const, label: "Habilitar Instruções", desc: "Habilitar instruções do produto" },
                        ].map((toggle) => (
                          <div key={toggle.key} className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold">{toggle.label}</p>
                              <p className="text-xs text-muted-foreground">{toggle.desc}</p>
                            </div>
                            <Switch
                              checked={field[toggle.key]}
                              onCheckedChange={(val) => updateField(field.id, { [toggle.key]: val })}
                            />
                          </div>
                        ))}
                      </div>

                      {field.enable_instructions && (
                        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                          <p className="text-xs text-yellow-400">
                            ⚠️ <strong>Atenção:</strong> Se você habilitar as instruções, a instrução padrão <strong>NÃO</strong> será exibida para esse produto.
                          </p>
                        </div>
                      )}

                      {/* Conditions */}
                      <div className="space-y-4">
                        <h4 className="text-base font-bold">Condições</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-bold">Requer Cargo</Label>
                            <Input
                              value={field.require_role_id || ""}
                              onChange={(e) => updateField(field.id, { require_role_id: e.target.value || null })}
                              placeholder="ID do cargo"
                              className="bg-muted border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-bold">Quantidade Mínima</Label>
                            <Input
                              type="number"
                              value={field.min_quantity}
                              onChange={(e) => updateField(field.id, { min_quantity: parseInt(e.target.value) || 1 })}
                              className="bg-muted border-border"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteField(field.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Remover
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveField(field)}
                          disabled={saving}
                          className="gradient-pink text-primary-foreground border-none hover:opacity-90"
                        >
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                          Salvar Campo
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="estoque" className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                        <div>
                          <p className="text-sm font-medium">Estoque disponível</p>
                          <p className="text-2xl font-bold">{stockCounts[field.id] || 0} itens</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStockModalFieldId(field.id)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Estoque
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : fields.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Nenhum campo adicionado ainda</p>
          <p className="text-xs mt-1">Campos são variações do produto (ex: 30 dias, 90 dias)</p>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Nenhum campo encontrado</p>
        </div>
      )}

      {/* Stock modal */}
      {stockModalFieldId && tenantId && (
        <AddStockModal
          open={!!stockModalFieldId}
          onOpenChange={(open) => !open && setStockModalFieldId(null)}
          fieldId={stockModalFieldId}
          tenantId={tenantId}
          onAdded={() => {
            fetchFields();
            setStockModalFieldId(null);
          }}
        />
      )}
    </div>
  );
};
