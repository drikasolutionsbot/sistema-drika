import { useState, useRef, useEffect } from "react";
import { Palette, Pencil, Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/contexts/TenantContext";

const CustomizationPage = () => {
  const { tenant, tenantId, refetch } = useTenant();
  const [status, setStatus] = useState("");
  const [interval, setStatusInterval] = useState("30");
  const [prefix, setPrefix] = useState("d!");
  const [savingConfig, setSavingConfig] = useState(false);

  // Load bot config from tenant
  useEffect(() => {
    if (tenant) {
      setStatus((tenant as any).bot_status || "/panel");
      setStatusInterval(String((tenant as any).bot_status_interval || 30));
      setPrefix((tenant as any).bot_prefix || "d!");
    }
  }, [tenant]);

  // Edit profile modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const botName = tenant?.name || "Drika Bot";
  const botId = tenant?.discord_guild_id || "000000000000000000";

  const openEditModal = () => {
    setEditName(botName);
    setAvatarPreview(tenant?.logo_url || null);
    setBannerPreview(null);
    setEditOpen(true);
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string | null) => void,
    fileSetter: (f: File | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileSetter(file);
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const updates: Record<string, string> = {};

      if (editName && editName !== botName) {
        updates.name = editName;
      }

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${tenantId}/avatar.${ext}`;
        const { error } = await supabase.storage
          .from("tenant-assets")
          .upload(path, avatarFile, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage
          .from("tenant-assets")
          .getPublicUrl(path);
        updates.logo_url = urlData.publicUrl;
      }

      if (bannerFile) {
        const ext = bannerFile.name.split(".").pop();
        const path = `${tenantId}/banner.${ext}`;
        const { error } = await supabase.storage
          .from("tenant-assets")
          .upload(path, bannerFile, { upsert: true });
        if (error) throw error;
      }

      if (Object.keys(updates).length > 0) {
        const { data, error } = await supabase.functions.invoke("update-tenant", {
          body: { tenant_id: tenantId, updates },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      toast.success("Perfil atualizado com sucesso!");
      refetch();
      setEditOpen(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  };
  const handleSaveConfig = async () => {
    if (!tenantId) return;
    setSavingConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            bot_status: status,
            bot_status_interval: parseInt(interval) || 30,
            bot_prefix: prefix,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Configurações salvas com sucesso!");
      refetch();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Tente novamente"));
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Palette className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Personalização</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Configure o <span className="font-semibold text-foreground">{botName}</span> para o seu estilo.
        </p>
      </div>

      {/* Banner */}
      <div className="relative rounded-xl overflow-hidden border border-border">
        <div className="h-32 bg-gradient-to-r from-primary/30 via-primary/10 to-accent/20 relative">
          <button
            onClick={openEditModal}
            className="absolute top-3 right-3 z-10 p-2 rounded-lg bg-background/60 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/95 to-transparent px-6 pb-4 pt-10">
          <div className="flex items-end gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-sidebar border-4 border-background flex items-center justify-center overflow-hidden">
                {tenant?.logo_url ? (
                  <img src={tenant.logo_url} alt={botName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-primary">
                    {botName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-green-500 border-2 border-background" />
            </div>
            <div className="pb-1">
              <h2 className="text-lg font-bold text-foreground">{botName}</h2>
              <p className="text-xs text-muted-foreground font-mono">Bot ID: {botId}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md bg-sidebar border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Editar Perfil</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Avatar */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Avatar do Bot</label>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-primary">
                      {editName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Escolher Imagem
                  </Button>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG até 10MB</p>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, setAvatarPreview, setAvatarFile)}
                />
              </div>
            </div>

            {/* Banner */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Banner do Bot</label>
              <div className="flex items-center gap-4">
                <div className="h-14 w-20 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="Banner" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Banner</span>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Escolher Imagem
                  </Button>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG até 10MB</p>
                </div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, setBannerPreview, setBannerFile)}
                />
              </div>
            </div>

            {/* Bot Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Nome do Bot</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-background border-border"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue="geral">
        <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start px-0 gap-4">
          <TabsTrigger
            value="geral"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent px-1 pb-2"
          >
            Geral
          </TabsTrigger>
          <TabsTrigger
            value="embeds"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent px-1 pb-2"
          >
            Embeds
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 space-y-5 bg-sidebar border-border">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-primary inline-block" />
                  Status
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">Configurações de status do bot.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Status (um por linha)</label>
                <Textarea
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  rows={4}
                  className="bg-background border-border resize-none font-mono text-sm"
                  placeholder={"/panel\nDrika Solutions\nOnline"}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Intervalo de Status (segundos)</label>
                <Input
                  type="number"
                  value={interval}
                  onChange={(e) => setStatusInterval(e.target.value)}
                  className="bg-background border-border font-mono"
                />
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="p-5 space-y-4 bg-sidebar border-border">
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-primary inline-block" />
                    Informações
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Dados da aplicação.</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Nome da Aplicação</span>
                    <span className="text-sm font-semibold text-foreground">{botName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">ID da Aplicação</span>
                    <span className="text-sm font-mono text-foreground">{botId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className="text-sm font-semibold text-green-500">Online</span>
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-4 bg-sidebar border-border">
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-primary inline-block" />
                    Prefixo
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Prefixo para comandos do bot.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Prefixo do Bot</label>
                  <Input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="bg-background border-border font-mono"
                  />
                </div>
              </Card>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleSaveConfig} disabled={savingConfig}>
              {savingConfig && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Configurações
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="embeds" className="mt-6">
          <Card className="p-8 bg-sidebar border-border flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Construtor de Embeds em breve.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomizationPage;
