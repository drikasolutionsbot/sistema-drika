import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Save, FolderOpen, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProductDiscordPreview } from "./ProductDiscordPreview";
import { DiscordButtonStylePicker, type DiscordButtonStyle } from "@/components/discord/DiscordButtonStylePicker";
import ButtonLabelWithEmoji from "@/components/discord/ButtonLabelWithEmoji";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

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
  buy_button_label?: string;
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
  const { tenantId } = useTenant();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<{ id: string; name: string; embed_data: any; created_at: string }[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const fetchTemplates = async () => {
    if (!tenantId) return;
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-saved-embeds", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error) throw error;
      // Filter only product embed templates (type === "product_embed")
      const all = (data?.embeds || []) as any[];
      setSavedTemplates(all.filter((e: any) => e.embed_data?.type === "product_embed"));
    } catch {
      setSavedTemplates([]);
    }
    setLoadingTemplates(false);
  };

  const handleSaveTemplate = async () => {
    if (!tenantId || !templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const { error } = await supabase.functions.invoke("manage-saved-embeds", {
        body: {
          action: "save",
          tenant_id: tenantId,
          name: templateName.trim(),
          embed_data: {
            type: "product_embed",
            embed_config: config,
            button_style: product.button_style || "success",
            general: {
              name: product.name,
              description: product.description,
              price_cents: product.price_cents,
              compare_price_cents: product.compare_price_cents,
              type: product.type,
              auto_delivery: product.auto_delivery,
              active: product.active,
              icon_url: product.icon_url,
              banner_url: product.banner_url,
            },
          },
        },
      });
      if (error) throw error;
      toast.success(`Template "${templateName}" salvo!`);
      setTemplateName("");
      setSaveDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar template");
    }
    setSavingTemplate(false);
  };

  const handleLoadTemplate = (tpl: any) => {
    const data = tpl.embed_data;
    if (data?.embed_config) {
      const updates: Partial<Product> = {
        embed_config: { ...DEFAULT_EMBED, ...data.embed_config },
        button_style: data.button_style || product.button_style,
      };
      if (data.general) {
        if (data.general.name) updates.name = data.general.name;
        if (data.general.description !== undefined) updates.description = data.general.description;
        if (data.general.price_cents !== undefined) updates.price_cents = data.general.price_cents;
        if (data.general.compare_price_cents !== undefined) updates.compare_price_cents = data.general.compare_price_cents;
        if (data.general.type) updates.type = data.general.type;
        if (data.general.auto_delivery !== undefined) updates.auto_delivery = data.general.auto_delivery;
        if (data.general.icon_url !== undefined) updates.icon_url = data.general.icon_url;
        if (data.general.banner_url !== undefined) updates.banner_url = data.general.banner_url;
      }
      onChange(updates);
      toast.success(`Template "${tpl.name}" aplicado!`);
      setLoadDialogOpen(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!tenantId) return;
    try {
      await supabase.functions.invoke("manage-saved-embeds", {
        body: { action: "delete", tenant_id: tenantId, id },
      });
      setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template excluído");
    } catch {
      toast.error("Erro ao excluir template");
    }
  };

  const update = (key: keyof EmbedConfig, value: unknown) => {
    onChange({ embed_config: { ...config, [key]: value } });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form */}
      <div className="space-y-6">
        {/* Template Actions */}
        <section className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setSaveDialogOpen(true)}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Salvar Template
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              fetchTemplates();
              setLoadDialogOpen(true);
            }}
          >
            <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
            Carregar Template
          </Button>
        </section>

        {/* Estilo do Botão */}
        <section className="space-y-3">
          <DiscordButtonStylePicker
            value={product.button_style || "success"}
            onChange={(style) => onChange({ button_style: style })}
            label="Estilo do Botão de Compra"
          />
          <div className="space-y-2">
            <Label className="text-sm font-bold">Texto do Botão</Label>
            <ButtonLabelWithEmoji
              value={config.buy_button_label || "Comprar"}
              onChange={(val) => update("buy_button_label", val)}
              placeholder="Comprar"
            />
          </div>
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
                <ButtonLabelWithEmoji
                  value={config.delivery_auto_text || ""}
                  onChange={(val) => update("delivery_auto_text", val)}
                  placeholder="Entrega Automática!"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold">Manual</Label>
                <ButtonLabelWithEmoji
                  value={config.delivery_manual_text || ""}
                  onChange={(val) => update("delivery_manual_text", val)}
                  placeholder="Entrega Manual"
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
            <div className="space-y-4">
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
            </div>
          )}
        </section>
      </div>

      {/* Live Preview */}
      <div className="sticky top-4">
        <ProductDiscordPreview
          product={product}
          embedColor={config.color || storeEmbedColor || undefined}
          embedConfig={config}
        />
      </div>

      {/* Save Template Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Salvar Template de Embed</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do template</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Ex: Embed padrão da loja"
                className="bg-muted border-border"
              />
            </div>
            <Button
              onClick={handleSaveTemplate}
              disabled={savingTemplate || !templateName.trim()}
              className="w-full"
            >
              {savingTemplate ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Template Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Carregar Template de Embed</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : savedTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum template salvo ainda.
              </p>
            ) : (
              savedTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => handleLoadTemplate(tpl)}
                  >
                    <p className="text-sm font-medium">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tpl.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteTemplate(tpl.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { DEFAULT_EMBED };
