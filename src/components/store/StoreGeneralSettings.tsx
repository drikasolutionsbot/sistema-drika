import { useState, useEffect, useCallback } from "react";
import { Save, Loader2, Hash, Palette, Truck, ShoppingBag, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import ImageUploadField from "@/components/customization/ImageUploadField";
import ChannelSelectWithCreate from "@/components/channels/ChannelSelectWithCreate";

interface StoreConfig {
  sales_channel_id: string;
  logs_channel_id: string;
  payment_timeout_minutes: number;
  auto_delivery_global: boolean;
  delivery_instructions: string;
  embed_color: string;
  store_title: string;
  store_description: string;
  store_banner_url: string;
  store_logo_url: string;
  purchase_embed_title: string;
  purchase_embed_description: string;
  purchase_embed_color: string;
  purchase_embed_footer: string;
  purchase_embed_image_url: string;
  purchase_embed_thumbnail_url: string;
}

const defaultConfig: StoreConfig = {
  sales_channel_id: "",
  logs_channel_id: "",
  payment_timeout_minutes: 30,
  auto_delivery_global: true,
  delivery_instructions: "",
  embed_color: "#5865F2",
  store_title: "",
  store_description: "",
  store_banner_url: "",
  store_logo_url: "",
  purchase_embed_title: "Compra realizada! ✅",
  purchase_embed_description: "Obrigado pela sua compra, {user}!",
  purchase_embed_color: "#57F287",
  purchase_embed_footer: "",
  purchase_embed_image_url: "",
  purchase_embed_thumbnail_url: "",
};

const StoreGeneralSettings = () => {
  const { tenantId } = useTenant();
  const [config, setConfig] = useState<StoreConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const fetchChannels = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data } = await supabase.functions.invoke("discord-channels", {
        body: { tenant_id: tenantId },
      });
      const ch = Array.isArray(data?.channels) ? data.channels : Array.isArray(data) ? data.filter((c: any) => c.type === 0) : [];
      const cats = Array.isArray(data?.categories) ? data.categories : [];
      setChannels(ch.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)));
      setCategories(cats.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)));
    } catch {}
  }, [tenantId]);

  const fetchConfig = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-store-config", {
        body: { action: "get", tenant_id: tenantId },
      });
      if (error) throw error;
      if (data) {
        setConfig((prev) => ({ ...prev, ...data }));
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchConfig();
    fetchChannels();
  }, [fetchConfig, fetchChannels]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-store-config", {
        body: { action: "upsert", tenant_id: tenantId, config },
      });
      if (error) throw error;
      toast({ title: "Configurações da loja salvas! ✅" });
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
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Configure as opções gerais da sua loja</p>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Canais */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              Canais
            </CardTitle>
            <CardDescription>Canais para notificações de vendas e logs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Canal de Vendas</Label>
              <ChannelSelectWithCreate
                value={config.sales_channel_id}
                onChange={(v) => update("sales_channel_id", v)}
                channels={channels}
                categories={categories}
                onChannelCreated={fetchChannels}
                tenantId={tenantId}
                placeholder="Selecione o canal de vendas"
                defaultNewName="vendas"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Mensagens de compra serão enviadas aqui</p>
            </div>
            <div>
              <Label>Canal de Logs</Label>
              <ChannelSelectWithCreate
                value={config.logs_channel_id}
                onChange={(v) => update("logs_channel_id", v)}
                channels={channels}
                categories={categories}
                onChannelCreated={fetchChannels}
                tenantId={tenantId}
                placeholder="Selecione o canal de logs"
                defaultNewName="logs-vendas"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Logs detalhados de transações</p>
            </div>
          </CardContent>
        </Card>

        {/* Entrega */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              Entrega
            </CardTitle>
            <CardDescription>Configurações de pagamento e entrega</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tempo limite de pagamento (minutos)</Label>
              <Input
                type="number"
                min={5}
                max={1440}
                value={config.payment_timeout_minutes}
                onChange={(e) => update("payment_timeout_minutes", parseInt(e.target.value) || 30)}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Pedido será cancelado automaticamente após este tempo</p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Entrega Automática Global</p>
                <p className="text-[11px] text-muted-foreground">Entregar itens do estoque automaticamente após pagamento</p>
              </div>
              <Switch checked={config.auto_delivery_global} onCheckedChange={(v) => update("auto_delivery_global", v)} />
            </div>
            <div>
              <Label>Instruções de entrega</Label>
              <Textarea
                value={config.delivery_instructions}
                onChange={(e) => update("delivery_instructions", e.target.value)}
                placeholder="Instruções enviadas ao comprador junto com o produto..."
                rows={3}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Aparência */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              Aparência da Loja
            </CardTitle>
            <CardDescription>Personalize a identidade visual da loja no Discord</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Cor padrão dos embeds</Label>
              <div className="flex gap-2 mt-1">
                <input
                  type="color"
                  value={config.embed_color}
                  onChange={(e) => update("embed_color", e.target.value)}
                  className="h-10 w-14 rounded border border-input cursor-pointer"
                />
                <Input
                  value={config.embed_color}
                  onChange={(e) => update("embed_color", e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label>Título da loja</Label>
              <Input
                value={config.store_title}
                onChange={(e) => update("store_title", e.target.value)}
                placeholder="Nome exibido nos embeds da loja"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descrição da loja</Label>
              <Textarea
                value={config.store_description}
                onChange={(e) => update("store_description", e.target.value)}
                placeholder="Descrição curta exibida nos embeds..."
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ImageUploadField label="Logo da Loja" value={config.store_logo_url} onChange={(v) => update("store_logo_url", v)} folder="store/logo" />
              <ImageUploadField label="Banner da Loja" value={config.store_banner_url} onChange={(v) => update("store_banner_url", v)} folder="store/banner" />
            </div>
          </CardContent>
        </Card>

        {/* Embed de Compra */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Embed de Compra
            </CardTitle>
            <CardDescription>Mensagem enviada ao comprador após o pagamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Cor do embed</Label>
              <div className="flex gap-2 mt-1">
                <input
                  type="color"
                  value={config.purchase_embed_color}
                  onChange={(e) => update("purchase_embed_color", e.target.value)}
                  className="h-10 w-14 rounded border border-input cursor-pointer"
                />
                <Input
                  value={config.purchase_embed_color}
                  onChange={(e) => update("purchase_embed_color", e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label>Título</Label>
              <Input
                value={config.purchase_embed_title}
                onChange={(e) => update("purchase_embed_title", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={config.purchase_embed_description}
                onChange={(e) => update("purchase_embed_description", e.target.value)}
                rows={3}
                className="mt-1"
                placeholder="Use {user}, {product}, {price}..."
              />
            </div>
            <div>
              <Label>Footer</Label>
              <Input
                value={config.purchase_embed_footer}
                onChange={(e) => update("purchase_embed_footer", e.target.value)}
                placeholder="Texto do rodapé"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ImageUploadField label="Thumbnail" value={config.purchase_embed_thumbnail_url} onChange={(v) => update("purchase_embed_thumbnail_url", v)} folder="store/purchase-thumb" />
              <ImageUploadField label="Imagem" value={config.purchase_embed_image_url} onChange={(v) => update("purchase_embed_image_url", v)} folder="store/purchase-img" />
            </div>

            <Separator />

            {/* Mini preview */}
            <div>
              <Label className="flex items-center gap-1.5 mb-2"><Eye className="h-3.5 w-3.5" /> Preview</Label>
              <div className="bg-[#313338] rounded-lg p-3">
                <div className="flex rounded" style={{ borderLeft: `4px solid ${config.purchase_embed_color}` }}>
                  <div className="flex-1 p-3">
                    {config.purchase_embed_title && (
                      <p className="text-white font-semibold text-sm mb-1">{config.purchase_embed_title}</p>
                    )}
                    {config.purchase_embed_description && (
                      <p className="text-[#dcddde] text-xs whitespace-pre-wrap">
                        {config.purchase_embed_description
                          .replace(/\{user\}/g, "@Comprador")
                          .replace(/\{product\}/g, "Produto Exemplo")
                          .replace(/\{price\}/g, "R$ 29,90")}
                      </p>
                    )}
                    {config.purchase_embed_image_url && (
                      <img src={config.purchase_embed_image_url} alt="" className="mt-2 rounded max-h-32 w-full object-cover" />
                    )}
                    {config.purchase_embed_footer && (
                      <p className="text-[#72767d] text-[10px] mt-2">{config.purchase_embed_footer}</p>
                    )}
                  </div>
                  {config.purchase_embed_thumbnail_url && (
                    <img src={config.purchase_embed_thumbnail_url} alt="" className="h-14 w-14 rounded m-3 object-cover" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StoreGeneralSettings;
