import { useState, useRef } from "react";
import { Loader2, Bot, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
  
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!tenantId) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/bot-avatar/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("tenant-assets")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
      setBotAvatarUrl(data.publicUrl);
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
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
            bot_status: botStatus.trim() || "/panel",
          },
        },
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

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Status do Bot</Label>
            <Textarea
              value={botStatus}
              onChange={(e) => setBotStatus(e.target.value)}
              rows={2}
              className="resize-none font-mono text-sm"
              placeholder={"/panel\nDrika Solutions"}
            />
            <p className="text-[11px] text-muted-foreground">
              Texto exibido como "Jogando" no Discord. Um status por linha (alterna automaticamente).
            </p>
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
          if (file) handleUpload(file);
          if (avatarRef.current) avatarRef.current.value = "";
        }} />
      </DialogContent>
    </Dialog>
  );
};

export default EditBotProfileModal;
