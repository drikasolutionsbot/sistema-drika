import { useState, useEffect, useCallback } from "react";
import { Save, Loader2, Hash, Palette, Truck, ShoppingBag, Eye, Shield, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import DrikaLockedFields from "@/components/customization/DrikaLockedFields";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageUploadField from "@/components/customization/ImageUploadField";
import ChannelSelectWithCreate from "@/components/channels/ChannelSelectWithCreate";
import { useLocalDraft } from "@/hooks/useLocalDraft";

interface StoreConfig {
  sales_channel_id: string;
  logs_channel_id: string;
  feedback_channel_id: string;
  payment_timeout_minutes: number;
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
  customer_role_id: string;
  qr_code_logo_url: string;
  qr_code_style: string;
}

const defaultConfig: StoreConfig = {
  sales_channel_id: "",
  logs_channel_id: "",
  feedback_channel_id: "",
  payment_timeout_minutes: 30,
  embed_color: "#2B2D31",
  store_title: "",
  store_description: "",
  store_banner_url: "",
  store_logo_url: "",
  purchase_embed_title: "Compra realizada! ✅",
  purchase_embed_description: "Obrigado pela sua compra, {user}!",
  purchase_embed_color: "#2B2D31",
  purchase_embed_footer: "",
  purchase_embed_image_url: "",
  purchase_embed_thumbnail_url: "",
  customer_role_id: "",
  qr_code_logo_url: "",
  qr_code_style: "classic",
};

const StoreCheckoutSettings = () => {
  const { tenantId } = useTenant();
  const [serverConfig, setServerConfig] = useState<StoreConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [discordRoles, setDiscordRoles] = useState<any[]>([]);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  const { draft: config, setDraft: setConfig, clearDraft, hasDraft, discardDraft } = useLocalDraft<StoreConfig>(
    "store-settings",
    tenantId,
    serverConfig,
    !loading
  );

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

  const fetchDiscordRoles = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data } = await supabase.functions.invoke("discord-guild-info", {
        body: { tenant_id: tenantId },
      });
      if (data?.roles) {
        setDiscordRoles(data.roles.filter((r: any) => !r.managed && r.name !== "@everyone").sort((a: any, b: any) => b.position - a.position));
      }
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
        setServerConfig((prev) => ({ ...prev, ...data }));
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
    fetchDiscordRoles();
  }, [fetchConfig, fetchChannels, fetchDiscordRoles]);

  useEffect(() => {
    let active = true;
    const fetchQr = async () => {
      setLoadingQr(true);
      try {
        let configObj: any = {};
        if (config.qr_code_style === "rounded") {
          configObj = { body: "circle-zell", eye: "frame13", eyeBall: "ball14" };
        } else if (config.qr_code_style === "dots") {
          configObj = { body: "dot", eye: "frame12", eyeBall: "ball15" };
        } else {
          configObj = { body: "square", eye: "frame0", eyeBall: "ball0" };
        }

        if (config.qr_code_logo_url) {
          configObj.logo = config.qr_code_logo_url;
        }

        const res = await fetch("https://api.qrcode-monkey.com/qr/custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: "https://drikahub.com",
            config: configObj,
            size: 300,
            download: false,
            file: "png"
          })
        });
        
        if (res.ok) {
          const blob = await res.blob();
          const objUrl = URL.createObjectURL(blob);
          if (active) setQrPreviewUrl(objUrl);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoadingQr(false);
      }
    };

    const t = setTimeout(() => {
      fetchQr();
    }, 800);

    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [config.qr_code_style, config.qr_code_logo_url]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-store-config", {
        body: { action: "upsert", tenant_id: tenantId, config },
      });
      if (error) throw error;
      setServerConfig(config);
      clearDraft();
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
      {hasDraft && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-2.5">
          <p className="text-sm text-yellow-400">📝 Você tem alterações não salvas (rascunho local).</p>
          <Button variant="ghost" size="sm" onClick={discardDraft} className="text-yellow-400 hover:text-yellow-300 gap-1.5">
            <Undo2 className="h-3.5 w-3.5" />
            Descartar
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Configure as opções gerais da sua loja</p>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Canais (placeholder to maintain grid) */}
        <Card className="border-white/5 bg-white/[0.02] backdrop-blur-sm shadow-xl rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              Pagamento
            </CardTitle>
            <CardDescription>Configurações de tempo limite de pagamento</CardDescription>
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
            <Separator />
            <div>
              <Label>Logo do QR Code PIX</Label>
              <ImageUploadField
                label=""
                value={config.qr_code_logo_url}
                onChange={(url) => update("qr_code_logo_url", url)}
                folder="qr-logo"
                maxSizeKB={500}
              />
              <p className="text-[11px] text-muted-foreground mt-2">Esta logo aparecerá no centro do QR Code gerado nos pagamentos via PIX.</p>
            </div>
            
            <Separator />
            <div>
              <Label>Modelo de QR Code</Label>
              <Select
                value={config.qr_code_style || "classic"}
                onValueChange={(v) => update("qr_code_style", v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione um estilo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Clássico (Quadrado)</SelectItem>
                  <SelectItem value="rounded">Bordas Arredondadas</SelectItem>
                  <SelectItem value="dots">Estilo Bolinhas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />
            <div>
              <Label className="flex items-center gap-1.5 mb-2"><Eye className="h-3.5 w-3.5" /> Preview</Label>
              <div className="bg-[#313338] rounded-lg p-6 flex flex-col items-center justify-center relative min-h-[200px]">
                {loadingQr && (
                  <div className="absolute inset-0 bg-[#313338]/80 z-10 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-xs text-white/70">Gerando preview...</p>
                  </div>
                )}
                <div className="bg-white p-2 rounded-lg flex items-center justify-center">
                  <img 
                    src={qrPreviewUrl || `https://quickchart.io/qr?size=200&text=preview&ecLevel=H`}
                    alt="QR Code Preview" 
                    className="w-40 h-40"
                  />
                </div>
                <p className="text-xs text-[#dcddde] mt-4">Preview real.</p>
                <p className="text-[10px] text-[#72767d] mt-1 text-center">Este modelo reflete exatamente o que será gerado pelo bot no Discord.</p>
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Embed de Compra */}
        <Card className="border-white/5 bg-white/[0.02] backdrop-blur-sm shadow-xl rounded-2xl">
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
            <DrikaLockedFields
              title={config.purchase_embed_title}
              description={config.purchase_embed_description}
              rows={3}
            />
            <div>
              <Label>Footer</Label>
              <Input
                value={config.purchase_embed_footer}
                onChange={(e) => update("purchase_embed_footer", e.target.value)}
                placeholder="Texto do rodapé"
                className="mt-1"
              />
            </div>
            <div>
              <ImageUploadField label="Thumbnail" value={config.purchase_embed_thumbnail_url} onChange={(v) => update("purchase_embed_thumbnail_url", v)} folder="store/purchase-thumb" />
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

export default StoreCheckoutSettings;
