import { useState, useRef, useEffect } from "react";
import { Loader2, Bot, Upload, Lock, Crown, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { isMaster } from "@/lib/plans";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: any;
  tenantId: string | null;
  refetchTenant: () => void;
}

const EditBotProfileModal = ({ open, onOpenChange, tenant, tenantId, refetchTenant }: Props) => {
  const [botName, setBotName] = useState(tenant?.bot_name || "");
  const [botAvatarUrl, setBotAvatarUrl] = useState(tenant?.bot_avatar_url || "");
  const [botBannerUrl, setBotBannerUrl] = useState(tenant?.bot_banner_url || "");

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const userIsMaster = isMaster(tenant?.plan);

  // Re-sincroniza com o tenant sempre que o modal abre ou o tenant muda externamente
  useEffect(() => {
    if (open) {
      setBotName(tenant?.bot_name || "");
      setBotAvatarUrl(tenant?.bot_avatar_url || "");
      setBotBannerUrl(tenant?.bot_banner_url || "");
    }
  }, [open, tenant?.bot_name, tenant?.bot_avatar_url, tenant?.bot_banner_url]);

  const handleUpload = async (file: File, kind: "avatar" | "banner") => {
    if (!tenantId) return;
    const setUploading = kind === "avatar" ? setUploadingAvatar : setUploadingBanner;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const subdir = kind === "avatar" ? "bot-avatar" : "bot-banner";
      const path = `${tenantId}/${subdir}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("tenant-assets")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
      if (kind === "avatar") setBotAvatarUrl(data.publicUrl);
      else setBotBannerUrl(data.publicUrl);
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        bot_name: botName.trim() || null,
        bot_avatar_url: botAvatarUrl.trim() || null,
      };
      // Banner só é enviado para tenants Master
      if (userIsMaster) {
        updates.bot_banner_url = botBannerUrl.trim() || null;
      }

      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: { tenant_id: tenantId, updates },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      toast({ title: "Perfil salvo! ✅" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Avatar */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Avatar do Bot</Label>
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                {botAvatarUrl ? (
                  <img src={botAvatarUrl} alt="Avatar" className="h-16 w-16 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                    <Bot className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => avatarRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Escolher Imagem
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">PNG, JPG até 10MB</p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Nome do Bot</Label>
            <Input
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Drika Bot"
              maxLength={32}
            />
          </div>

          {/* Banner — exclusivo Master */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                Capa do Bot
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 gap-1 border-primary/40 text-primary bg-primary/10"
                >
                  <Crown className="h-2.5 w-2.5" />
                  Master
                </Badge>
              </Label>
              {!userIsMaster && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Bloqueado
                </span>
              )}
            </div>

            <div className={`relative ${!userIsMaster ? "opacity-60 pointer-events-none select-none" : ""}`}>
              <div className="flex items-center gap-4">
                <div className="shrink-0">
                  {botBannerUrl ? (
                    <img src={botBannerUrl} alt="Capa" className="h-16 w-28 rounded-md object-cover border-2 border-border" />
                  ) : (
                    <div className="h-16 w-28 rounded-md bg-muted flex items-center justify-center border-2 border-border">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => bannerRef.current?.click()}
                  disabled={uploadingBanner || !userIsMaster}
                >
                  {uploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Escolher Capa
                </Button>
              </div>
            </div>

            {!userIsMaster ? (
              <p className="text-[11px] text-muted-foreground">
                <Crown className="inline h-3 w-3 mr-1 text-primary" />
                Disponível apenas no plano <strong className="text-primary">Master</strong>.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">PNG, JPG até 10MB. Recomendado 960×540px.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-pink text-primary-foreground border-none">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>

        <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file, "avatar");
          if (avatarRef.current) avatarRef.current.value = "";
        }} />
        <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file, "banner");
          if (bannerRef.current) bannerRef.current.value = "";
        }} />
      </DialogContent>
    </Dialog>
  );
};

export default EditBotProfileModal;
