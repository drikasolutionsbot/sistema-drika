import { useState, useEffect, useCallback } from "react";
import { Plus, Search, ChevronUp, ChevronDown, Package, Loader2, Copy, GripVertical } from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { EmojiPicker } from "./EmojiPicker";
import { AddStockModal } from "./AddStockModal";

interface ProductField {
  id: string;
  product_id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  icon_url: string | null;
  banner_url: string | null;
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
  delivery_quantity: number;
}

interface ProductDetailFieldsProps {
  productId: string;
  onFieldsChange?: (fields: ProductField[]) => void;
}

/* ── Field Geral sub-tab ── */
const FieldGeralTab = ({
  field,
  updateField,
}: {
  field: ProductField;
  updateField: (id: string, updates: Partial<ProductField>) => void;
}) => {
  const nameMaxLen = 256;
  const descMaxLen = 1024;
  const [priceDisplay, setPriceDisplay] = useState((field.price_cents / 100).toFixed(2).replace(".", ","));
  const [comparePriceDisplay, setComparePriceDisplay] = useState(
    field.compare_price_cents ? (field.compare_price_cents / 100).toFixed(2).replace(".", ",") : ""
  );

  useEffect(() => {
    setPriceDisplay((field.price_cents / 100).toFixed(2).replace(".", ","));
    setComparePriceDisplay(field.compare_price_cents ? (field.compare_price_cents / 100).toFixed(2).replace(".", ",") : "");
  }, [field.id]);

  return (
    <div className="space-y-5">
      {/* Name + Emoji */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-bold">
            Nome do Campo{" "}
            <span className="font-normal text-muted-foreground">
              ({(field.name || "").length}/{nameMaxLen})
            </span>
          </Label>
          <Input
            value={field.name}
            onChange={(e) => {
              if (e.target.value.length <= nameMaxLen) updateField(field.id, { name: e.target.value });
            }}
            className="bg-muted border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-bold">
            Emoji <span className="font-normal text-muted-foreground">(Opcional)</span>
          </Label>
          <EmojiPicker
            value={field.emoji}
            onChange={(val) => updateField(field.id, { emoji: val })}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label className="text-sm font-bold">
          Descrição{" "}
          <span className="font-normal text-muted-foreground">
            ({(field.description || "").length}/{descMaxLen})
          </span>
        </Label>
        <Textarea
          value={field.description || ""}
          onChange={(e) => {
            if (e.target.value.length <= descMaxLen) updateField(field.id, { description: e.target.value });
          }}
          placeholder="Descrição do campo..."
          className="bg-muted border-border min-h-[100px] resize-y"
        />
      </div>

      {/* Price */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-bold">Preço</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={priceDisplay}
            onChange={(e) => setPriceDisplay(e.target.value)}
            onBlur={() => {
              const raw = priceDisplay.replace(/[^0-9.,]/g, "").replace(",", ".");
              const num = parseFloat(raw);
              const cents = isNaN(num) ? 0 : Math.round(num * 100);
              updateField(field.id, { price_cents: cents });
              setPriceDisplay((cents / 100).toFixed(2).replace(".", ","));
            }}
            className="bg-muted border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-bold">
            Preço de Comparação <span className="font-normal text-muted-foreground">(Opcional)</span>
          </Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={comparePriceDisplay}
            onChange={(e) => setComparePriceDisplay(e.target.value)}
            onBlur={() => {
              const raw = comparePriceDisplay.replace(/[^0-9.,]/g, "").replace(",", ".");
              const num = parseFloat(raw);
              if (!raw || isNaN(num) || num <= 0) {
                updateField(field.id, { compare_price_cents: null });
                setComparePriceDisplay("");
              } else {
                const cents = Math.round(num * 100);
                updateField(field.id, { compare_price_cents: cents });
                setComparePriceDisplay((cents / 100).toFixed(2).replace(".", ","));
              }
            }}
            className="bg-muted border-border"
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Habilitar Créditos</p>
            <p className="text-xs text-muted-foreground">Permitir pagamento com créditos</p>
          </div>
          <Switch
            checked={field.enable_credits}
            onCheckedChange={(val) => updateField(field.id, { enable_credits: val })}
          />
        </div>
      </div>
    </div>
  );
};

/* ── Field Estoque sub-tab ── */
const FieldEstoqueTab = ({
  field,
  tenantId,
}: {
  field: ProductField;
  tenantId: string | null;
}) => {
  const [stockCount, setStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [stockItems, setStockItems] = useState<Array<{ id: string; content: string }>>([]);
  const [stockSearch, setStockSearch] = useState("");

  const fetchStock = useCallback(async () => {
    if (!tenantId || !field.product_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-product-fields", {
        body: { action: "get_stock", tenant_id: tenantId, product_id: field.product_id },
      });
      if (!error) {
        setStockCount(data?.stock || 0);
        setStockItems(data?.items || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [tenantId, field.product_id]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  return (
    <div className="space-y-5">
      {/* Controle de Estoque */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-5 bg-foreground rounded-full" />
          <h4 className="text-sm font-bold">Controle de Estoque</h4>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Estoque Fictício</p>
            <p className="text-xs text-muted-foreground">Ativar estoque fictício para este campo</p>
          </div>
          <Switch checked={false} />
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-2">
          <span className="text-muted-foreground mt-0.5">ℹ️</span>
          <p className="text-xs text-muted-foreground">
            O estoque fictício permite definir uma quantidade fixa para este campo, independente do estoque real.
          </p>
        </div>
      </div>

      {/* Estoque */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold">Estoque</h4>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={fetchStock}>
              <span className="mr-1">↻</span> Atualizar
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7">
              Modo Texto
            </Button>
          </div>
        </div>

        <Input
          placeholder="Pesquisar item no estoque..."
          value={stockSearch}
          onChange={(e) => setStockSearch(e.target.value)}
          className="bg-muted border-border"
        />

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="min-h-[100px]">
            {stockItems.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">Estoque vazio</p>
            )}
          </div>
        )}
      </div>

      {/* Adicionar Itens */}
      <button
        onClick={() => setAddModalOpen(true)}
        className="w-full rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" /> Adicionar Itens 📋
      </button>

      {tenantId && (
        <AddStockModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          productId={field.product_id}
          tenantId={tenantId}
          onAdded={() => {
            fetchStock();
            setAddModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

/* ── Field Mensagens Automáticas sub-tab ── */
const FieldMensagensTab = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-0.5 h-5 bg-foreground rounded-full" />
        <h4 className="text-sm font-bold">Mensagens Automáticas</h4>
      </div>

      {/* Antes da Compra */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-bold">Mensagens Antes da Compra</p>
          <p className="text-xs text-muted-foreground">
            Selecione as mensagens automáticas que serão enviadas antes da compra deste produto
          </p>
        </div>
        <Button variant="outline" size="sm" className="text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Adicionar Mensagens
        </Button>
      </div>

      {/* Depois da Compra */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-bold">Mensagens Depois da Compra</p>
          <p className="text-xs text-muted-foreground">
            Selecione as mensagens automáticas que serão enviadas depois da compra deste produto
          </p>
        </div>
        <Button variant="outline" size="sm" className="text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Adicionar Mensagens
        </Button>
      </div>
    </div>
  );
};

/* ── Expanded content for a single field ── */
const FieldExpandedContent = ({
  field,
  tenantId,
  saving,
  updateField,
  saveField,
  deleteField,
  stockCount,
}: {
  field: ProductField;
  tenantId: string | null;
  saving: boolean;
  updateField: (id: string, updates: Partial<ProductField>) => void;
  saveField: (field: ProductField) => void;
  deleteField: (id: string) => void;
  stockCount: number;
}) => {
  const [dirty, setDirty] = useState(false);

  const handleUpdate = (id: string, updates: Partial<ProductField>) => {
    updateField(id, updates);
    setDirty(true);
  };

  return (
    <div className="border-t border-border p-4">
      <Tabs defaultValue="geral">
        <TabsList className="bg-muted mb-4">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="estoque">Estoque ({stockCount})</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens Automáticas</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-5">
          <FieldGeralTab field={field} updateField={handleUpdate} />
        </TabsContent>

        <TabsContent value="estoque">
          <FieldEstoqueTab field={field} tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="mensagens">
          <FieldMensagensTab />
        </TabsContent>
      </Tabs>

      {/* Bottom bar */}
      <div className="flex items-center justify-end pt-4 mt-4 border-t border-border gap-3">
        <span className="text-sm text-muted-foreground mr-auto">
          {dirty ? "Alterações não salvas" : ""}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDirty(false)}
        >
          Limpar
        </Button>
        <Button
          size="sm"
          onClick={() => {
            saveField(field);
            setDirty(false);
          }}
          disabled={saving}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          Salvar
        </Button>
      </div>
    </div>
  );
};

/* ── Main component ── */
export const ProductDetailFields = ({ productId, onFieldsChange }: ProductDetailFieldsProps) => {
  const { tenantId } = useTenant();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fields, setFields] = useState<ProductField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchFields = useCallback(async () => {
    if (!tenantId || !productId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-product-fields", {
        body: { action: "list", tenant_id: tenantId, product_id: productId },
      });
      if (error) throw error;
      if (data?.fields) setFields(data.fields);
    } catch (e: any) {
      console.error(e);
    }
    setLoading(false);
  }, [tenantId, productId]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  useEffect(() => {
    onFieldsChange?.(fields);
  }, [fields]);

  const toggle = (id: string) => setExpandedId(expandedId === id ? null : id);

  const addField = async () => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-product-fields", {
        body: {
          action: "create",
          tenant_id: tenantId,
          product_id: productId,
          field: { name: "Novo", description: "Descrição do novo campo", price_cents: 0, sort_order: fields.length },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setFields([...fields, data]);
      setExpandedId(data.id);
    } catch (e: any) {
      toast({ title: "Erro ao criar campo", description: e.message, variant: "destructive" });
    }
  };

  const updateField = (id: string, updates: Partial<ProductField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const saveField = async (field: ProductField) => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-product-fields", {
        body: {
          action: "update",
          tenant_id: tenantId,
          field_id: field.id,
          field: {
            name: field.name,
            description: field.description,
            emoji: field.emoji,
            icon_url: field.icon_url,
            banner_url: field.banner_url,
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
            delivery_quantity: field.delivery_quantity || 1,
          },
        },
      });
      if (error) throw error;
      toast({ title: "Campo salvo! ✅" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const deleteField = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke("manage-product-fields", {
        body: { action: "delete", tenant_id: tenantId, field_id: id },
      });
      if (error) throw error;
      setFields(fields.filter((f) => f.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast({ title: "Campo removido" });
    } catch (e: any) {
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" });
    }
  };

  const duplicateField = async (field: ProductField) => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-product-fields", {
        body: {
          action: "create",
          tenant_id: tenantId,
          product_id: productId,
          field: {
            name: `${field.name} (cópia)`,
            description: field.description,
            emoji: field.emoji,
            price_cents: field.price_cents,
            compare_price_cents: field.compare_price_cents,
            sort_order: fields.length,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setFields([...fields, data]);
      toast({ title: "Campo duplicado!" });
    } catch (e: any) {
      toast({ title: "Erro ao duplicar", description: e.message, variant: "destructive" });
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
        className="w-full rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-colors flex items-center justify-center gap-2"
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
          {filtered.map((field) => {
            const isExpanded = expandedId === field.id;
            return (
              <div key={field.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header */}
                <div className="flex items-center">
                  <div className="px-2 text-muted-foreground/40">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  <button
                    onClick={() => toggle(field.id)}
                    className="flex-1 flex items-center gap-3 px-2 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0 text-lg overflow-hidden">
                      {field.icon_url ? (
                        <img src={field.icon_url} alt={field.name} className="h-8 w-8 object-cover rounded-lg" />
                      ) : field.emoji ? field.emoji : <Package className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-sm font-bold">{field.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{field.description}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-emerald-400">
                          R$ {(field.price_cents / 100).toFixed(2).replace(".", ",")}
                        </span>
                        {field.compare_price_cents && field.compare_price_cents > 0 && (
                          <span className="text-xs text-muted-foreground line-through">
                            R$ {(field.compare_price_cents / 100).toFixed(2).replace(".", ",")}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 px-3">
                    <button
                      onClick={() => toggle(field.id)}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => duplicateField(field)}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      title="Duplicar"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteField(field.id)}
                      className="p-1.5 text-destructive hover:text-destructive/80 transition-colors"
                      title="Excluir"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <FieldExpandedContent
                    field={field}
                    tenantId={tenantId}
                    saving={saving}
                    updateField={updateField}
                    saveField={saveField}
                    deleteField={deleteField}
                    stockCount={0}
                  />
                )}
              </div>
            );
          })}
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
    </div>
  );
};
