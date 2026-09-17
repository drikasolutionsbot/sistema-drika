import { useState, useEffect, useCallback } from "react";
import { Save, Loader2, ShoppingCart, Eye, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { Separator } from "@/components/ui/separator";

interface StoreConfig {
  embed_color: string;
  store_title: string;
  cart_embed_color: string | null;
  cart_embed_show_footer: boolean;
  cart_embed_title: string | null;
  cart_embed_footer: string | null;
}

const defaultConfig: StoreConfig = {
  embed_color: "#2B2D31",
  store_title: "",
  cart_embed_color: "",
  cart_embed_show_footer: true,
  cart_embed_title: "",
  cart_embed_footer: "",
};

const StoreCartSettings = () => {
  const { tenantId, tenant } = useTenant();
  const [serverConfig, setServerConfig] = useState<StoreConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { draft: config, setDraft: setConfig, clearDraft, hasDraft, discardDraft } = useLocalDraft<StoreConfig>(
    "store-cart-settings",
    tenantId,
    serverConfig,
    !loading
  );

  const fetchConfig = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-store-config", {
        body: { action: "get", tenant_id: tenantId },
      });
      if (error) throw error;
      if (data) {
        setServerConfig((prev) => ({ 
          ...prev, 
          embed_color: data.embed_color || prev.embed_color,
          store_title: data.store_title || prev.store_title,
          cart_embed_color: data.cart_embed_color || "",
          cart_embed_show_footer: data.cart_embed_show_footer !== false,
          cart_embed_title: data.cart_embed_title || "",
          cart_embed_footer: data.cart_embed_footer || "",
        }));
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-store-config", {
        body: { 
          action: "upsert", 
          tenant_id: tenantId, 
          config: {
            cart_embed_color: config.cart_embed_color || null,
            cart_embed_show_footer: config.cart_embed_show_footer,
            cart_embed_title: config.cart_embed_title || null,
            cart_embed_footer: config.cart_embed_footer || null,
          }
        },
      });
      if (error) throw error;
      setServerConfig(config);
      clearDraft();
      toast({ title: "Configurações do carrinho salvas!" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof StoreConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const effectiveColor = config.cart_embed_color || config.embed_color || "#FF69B4";
  const effectiveTitle = config.cart_embed_title || "Carrinho de Compras";
  const effectiveFooter = config.cart_embed_footer || `${config.store_title || tenant?.name || "Sua Loja"} • 17/09/2026 14:05`;
  const previewFooter = effectiveFooter.replace(/{user}/gi, "cleitonriandejesus").replace(/{date}/gi, "17/09/2026").replace(/{time}/gi, "14:05").replace(/{store}/gi, config.store_title || tenant?.name || "Sua Loja");

  return (
    <div className="space-y-6 max-w-4xl pb-24 relative">
      <Card className="border-white/5 bg-white/[0.02] backdrop-blur-sm shadow-xl rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Configurações do Carrinho
          </CardTitle>
          <CardDescription>
            Personalize o embed do carrinho de compras que é enviado no tópico quando um cliente clica em comprar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Cor do embed (Opcional)</Label>
            <div className="flex gap-2 mt-1">
              <input
                type="color"
                value={config.cart_embed_color || config.embed_color}
                onChange={(e) => update("cart_embed_color", e.target.value)}
                className="h-10 w-14 rounded border border-input cursor-pointer"
              />
              <Input
                value={config.cart_embed_color || ""}
                onChange={(e) => update("cart_embed_color", e.target.value)}
                className="font-mono"
                placeholder="Deixe vazio para usar a cor padrão da loja"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Se vazio, usará a cor padrão da loja.</p>
          </div>
          <div>
            <Label>Título (Autor)</Label>
            <Input
              value={config.cart_embed_title || ""}
              onChange={(e) => update("cart_embed_title", e.target.value)}
              placeholder="Carrinho de Compras"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Texto exibido no topo do embed do carrinho.</p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Footer (Rodapé)</Label>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={config.cart_embed_show_footer}
                  onCheckedChange={(v) => update("cart_embed_show_footer", v)}
                />
                <span className="text-sm text-muted-foreground">Mostrar rodapé</span>
              </div>
            </div>
            
            {config.cart_embed_show_footer && (
              <>
                <Input
                  value={config.cart_embed_footer || ""}
                  onChange={(e) => update("cart_embed_footer", e.target.value)}
                  placeholder="Ex: {user} • {date} {time}"
                  className="mt-3"
                />
                <p className="text-xs text-muted-foreground mt-1">Variáveis úteis: <code>{`{user}`}</code> (nome do cliente), <code>{`{date}`}</code> (data), <code>{`{time}`}</code> (hora).</p>
              </>
            )}
          </div>

          <Separator />

          <div>
            <Label className="flex items-center gap-1.5 mb-2"><Eye className="h-3.5 w-3.5" /> Preview</Label>
            <div className="bg-[#313338] rounded-lg p-3">
              <div className="flex rounded" style={{ borderLeft: `4px solid ${effectiveColor}` }}>
                <div className="bg-[#2B2D31] flex-1 p-3 rounded-r flex flex-col gap-3">
                  {/* Author */}
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-sm">{effectiveTitle}</span>
                  </div>
                  
                  {/* Body description (mock) */}
                  <div className="text-sm text-[#dcddde] whitespace-pre-wrap">
                    🛍️ **Produto Exemplo (x1)**<br/>
                    Preço unitário: `R$ 10,00`<br/>
                    Total: `R$ 10,00`<br/>
                    ---<br/>
                    **Subtotal:** `R$ 10,00`<br/>
                    **Total:** `R$ 10,00`<br/>
                    **Forma de Pagamento:** `PIX`
                  </div>

                  {/* Footer */}
                  {config.cart_embed_show_footer && effectiveFooter && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#dcddde] font-medium">{previewFooter} • Hoje às 14:05</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#dcddde] mt-4">Preview real.</p>
              <p className="text-[10px] text-[#72767d] mt-1 text-center">Este modelo reflete como o carrinho aparecerá no tópico para o cliente.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floating Save Bar */}
      {hasDraft && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50 flex justify-center animate-in slide-in-from-bottom-5">
          <div className="bg-background/95 backdrop-blur-md border shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 max-w-lg w-full justify-between">
            <span className="text-sm font-medium">Alterações não salvas</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={discardDraft} disabled={saving} className="rounded-full">
                <Undo2 className="h-4 w-4 mr-2" />
                Descartar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-full">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configurações
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreCartSettings;
