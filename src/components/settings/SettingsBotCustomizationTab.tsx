import { useState, useRef } from "react";
import { Palette, Loader2, Check, Upload, X, Bot, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  tenant: any;
  tenantId: string | null;
  refetchTenant: () => void;
}

const SettingsBotCustomizationTab = ({ tenant, tenantId, refetchTenant }: Props) => {
  const [botName, setBotName] = useState(tenant?.bot_name || "");
  const [botAvatarUrl, setBotAvatarUrl] = useState(tenant?.bot_avatar_url || "");
  const [botBannerUrl, setBotBannerUrl] = useState(tenant?.banner_url || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/bot-avatar/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("tenant-assets")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
      setBotAvatarUrl(data.publicUrl);
      toast({ title: "Avatar enviado!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleUploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/bot-banner/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("tenant-assets")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
      setBotBannerUrl(data.publicUrl);
      toast({ title: "Capa enviada!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setUploadingBanner(false);
      if (bannerFileRef.current) bannerFileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            bot_name: botName.trim() || null,
            bot_avatar_url: botAvatarUrl.trim() || null,
            banner_url: botBannerUrl.trim() || null,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      toast({ title: "Personalização salva! ✅" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bot Customization Section */}
      <div className="wallet-section">
        <div className="wallet-section-header mb-5">
          <div className="wallet-section-icon">
            <Palette className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-display font-semibold text-sm">Personalização do Bot</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Altere o nome, avatar e capa que o bot exibe nas mensagens do Discord
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Preview */}
          <div className="rounded-xl bg-[#313338] p-4">
            <div className="flex items-start gap-3">
              {botAvatarUrl ? (
                <img src={botAvatarUrl} alt="Bot avatar" className="h-10 w-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {botName || "Drika Bot"}
                  </span>
                  <span className="text-[10px] bg-[#5865F2] text-white px-1.5 py-0.5 rounded font-medium">BOT</span>
                </div>
                <p className="text-[#dcddde] text-xs mt-1">Olá! Aqui está seu pedido 🎉</p>
              </div>
            </div>
          </div>

          {/* Bot Name */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Nome do Bot</Label>
            <Input
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Drika Bot"
              maxLength={32}
            />
            <p className="text-[11px] text-muted-foreground">
              Nome exibido nas mensagens via webhook. Máx. 32 caracteres.
            </p>
          </div>

          {/* Bot Avatar */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Avatar do Bot</Label>
            <div className="flex items-center gap-3">
              {botAvatarUrl ? (
                <div className="relative">
                  <img src={botAvatarUrl} alt="Avatar" className="h-16 w-16 rounded-full object-cover border-2 border-border" />
                  <button
                    onClick={() => setBotAvatarUrl("")}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center"
                  >
                    <X className="h-3 w-3 text-destructive-foreground" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted/50 border-2 border-dashed border-border flex items-center justify-center">
                  <Bot className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-2 flex-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Fazer upload
                </Button>
                <Input
                  value={botAvatarUrl}
                  onChange={(e) => setBotAvatarUrl(e.target.value)}
                  placeholder="https://... ou faça upload"
                  className="text-sm"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Imagem quadrada recomendada (128x128 ou maior). Usado nas mensagens via webhook.
            </p>
          </div>

          {/* Bot Banner/Capa */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Capa / Banner</Label>
            {botBannerUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img src={botBannerUrl} alt="Banner" className="w-full h-32 object-cover" />
                <button
                  onClick={() => setBotBannerUrl("")}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive flex items-center justify-center"
                >
                  <X className="h-3.5 w-3.5 text-destructive-foreground" />
                </button>
              </div>
            ) : (
              <div className="w-full h-32 rounded-xl bg-muted/50 border-2 border-dashed border-border flex flex-col items-center justify-center gap-2">
                <Image className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Nenhuma capa definida</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => bannerFileRef.current?.click()}
                disabled={uploadingBanner}
                className="gap-2"
              >
                {uploadingBanner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Fazer upload
              </Button>
              <Input
                value={botBannerUrl}
                onChange={(e) => setBotBannerUrl(e.target.value)}
                placeholder="https://... ou faça upload"
                className="text-sm flex-1"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Imagem retangular recomendada (1200x400 ou similar). Usada como banner da loja.
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="gradient-pink text-primary-foreground border-none hover:opacity-90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Salvar personalização
          </Button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} />
      <input ref={bannerFileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadBanner} />
    </div>
  );
};

export default SettingsBotCustomizationTab;
