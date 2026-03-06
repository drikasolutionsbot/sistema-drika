import { useState, useEffect, useCallback, useRef } from "react";
import { ShieldCheck, Save, Loader2, Send, Eye, Upload, X, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import ChannelSelectWithCreate from "@/components/channels/ChannelSelectWithCreate";

interface VerifyConfig {
  verify_enabled: boolean;
  verify_role_id: string;
  verify_channel_id: string;
  verify_title: string;
  verify_description: string;
  verify_button_label: string;
  verify_embed_color: string;
  verify_image_url: string;
}

const defaultConfig: VerifyConfig = {
  verify_enabled: false,
  verify_role_id: "",
  verify_channel_id: "",
  verify_title: "👑 Verificação",
  verify_description: "Clique no botão abaixo para se verificar em nosso servidor.\nA verificação é necessária para liberar acesso aos canais.",
  verify_button_label: "Verificar",
  verify_embed_color: "#5865F2",
  verify_image_url: "",
};

const VerificationPage = () => {
  const { tenantId, tenant } = useTenant();
  const [config, setConfig] = useState<VerifyConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Fetch channels
      const { data: chData } = await supabase.functions.invoke("discord-channels", {
        body: { tenant_id: tenantId },
      });
      const ch = Array.isArray(chData?.channels) ? chData.channels : Array.isArray(chData) ? chData.filter((c: any) => c.type === 0) : [];
      const cats = Array.isArray(chData?.categories) ? chData.categories : [];
      setChannels(ch.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)));
      setCategories(cats.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)));

      // Fetch roles from Discord + panel
      const [discordRolesRes, panelRolesRes] = await Promise.all([
        supabase.functions.invoke("manage-roles", {
          body: { action: "list_discord", tenant_id: tenantId },
        }),
        supabase.functions.invoke("manage-roles", {
          body: { action: "list", tenant_id: tenantId },
        }),
      ]);

      const discordRoles = Array.isArray(discordRolesRes.data?.roles) ? discordRolesRes.data.roles : [];
      const panelRoles = Array.isArray(panelRolesRes.data) ? panelRolesRes.data : [];

      // Merge: panel roles that have discord_role_id are already in Discord list, so add panel-only ones
      const discordIds = new Set(discordRoles.map((r: any) => r.id));
      const panelOnly = panelRoles
        .filter((r: any) => r.discord_role_id && !discordIds.has(r.discord_role_id))
        .map((r: any) => ({ id: r.discord_role_id, name: r.name, position: 0 }));

      setRoles([...discordRoles, ...panelOnly]);

      // Fetch tenant verify settings
      const { data: tenantData } = await supabase.functions.invoke("get-tenant", {
        body: { tenant_id: tenantId },
      });
      if (tenantData) {
        setConfig(prev => ({
          ...prev,
          verify_enabled: tenantData.verify_enabled ?? false,
          verify_role_id: tenantData.verify_role_id ?? "",
          verify_channel_id: tenantData.verify_channel_id ?? "",
          verify_title: tenantData.verify_title ?? defaultConfig.verify_title,
          verify_description: tenantData.verify_description ?? defaultConfig.verify_description,
          verify_button_label: tenantData.verify_button_label ?? defaultConfig.verify_button_label,
          verify_embed_color: tenantData.verify_embed_color ?? defaultConfig.verify_embed_color,
          verify_image_url: tenantData.verify_image_url ?? "",
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            verify_enabled: config.verify_enabled,
            verify_role_id: config.verify_role_id || null,
            verify_channel_id: config.verify_channel_id || null,
            verify_title: config.verify_title,
            verify_description: config.verify_description,
            verify_button_label: config.verify_button_label,
            verify_embed_color: config.verify_embed_color,
            verify_image_url: config.verify_image_url || null,
          },
        },
      });
      if (error) throw error;
      toast({ title: "Verificação salva! ✅" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    if (!tenantId || !config.verify_channel_id) {
      toast({ title: "Selecione um canal primeiro", variant: "destructive" });
      return;
    }
    setPosting(true);
    try {
      const { error } = await supabase.functions.invoke("send-verification-embed", {
        body: {
          tenant_id: tenantId,
          channel_id: config.verify_channel_id,
          title: config.verify_title,
          description: config.verify_description,
          button_label: config.verify_button_label,
          embed_color: config.verify_embed_color,
          image_url: config.verify_image_url || null,
        },
      });
      if (error) throw error;
      toast({ title: "Embed de verificação enviado! ✅" });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const update = (field: keyof VerifyConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const botName = tenant?.name || "Bot";
  const botAvatar = tenant?.logo_url;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Verificação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure a verificação de membros no seu servidor Discord
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePost} disabled={posting || !config.verify_channel_id} variant="outline" className="gap-2">
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar Embed
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Settings */}
        <div className="space-y-6">
          {/* Toggle */}
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Ativar Verificação</p>
                  <p className="text-xs text-muted-foreground">Novos membros precisarão clicar no botão para receber o cargo</p>
                </div>
                <Switch
                  checked={config.verify_enabled}
                  onCheckedChange={(v) => update("verify_enabled", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Channel & Role */}
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Canal e Cargo</CardTitle>
              <CardDescription>Onde enviar o embed e qual cargo atribuir</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Canal de Verificação</Label>
                <ChannelSelectWithCreate
                  value={config.verify_channel_id}
                  onChange={(v) => update("verify_channel_id", v)}
                  channels={channels}
                  categories={categories}
                  onChannelCreated={fetchData}
                  tenantId={tenantId}
                  placeholder="Selecione o canal"
                  defaultNewName="verificação"
                />
                <p className="text-[11px] text-muted-foreground mt-1">O embed será enviado neste canal</p>
              </div>
              <div>
                <Label>Cargo ao Verificar</Label>
                <select
                  value={config.verify_role_id}
                  onChange={(e) => update("verify_role_id", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                >
                  <option value="">Selecione um cargo</option>
                  {roles.map((role: any) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Cargo atribuído automaticamente ao membro após verificar</p>
              </div>
            </CardContent>
          </Card>

          {/* Embed Customization */}
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Personalizar Embed</CardTitle>
              <CardDescription>Aparência da mensagem de verificação no Discord</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={config.verify_title}
                  onChange={(e) => update("verify_title", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={config.verify_description}
                  onChange={(e) => update("verify_description", e.target.value)}
                  rows={4}
                  className="mt-1"
                  placeholder="Texto da mensagem de verificação..."
                />
              </div>
              <div>
                <Label>Texto do Botão</Label>
                <Input
                  value={config.verify_button_label}
                  onChange={(e) => update("verify_button_label", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Cor do Embed</Label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="color"
                    value={config.verify_embed_color}
                    onChange={(e) => update("verify_embed_color", e.target.value)}
                    className="h-10 w-14 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <Input
                    value={config.verify_embed_color}
                    onChange={(e) => update("verify_embed_color", e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
              <div>
                <Label>Imagem do Embed (opcional)</Label>
                <div className="mt-2 space-y-3">
                  {config.verify_image_url && (
                    <div className="relative group rounded-lg overflow-hidden border border-border/50">
                      <img src={config.verify_image_url} alt="Preview" className="w-full max-h-40 object-cover" />
                      <button
                        onClick={() => update("verify_image_url", "")}
                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !tenantId) return;
                        if (file.size > 5 * 1024 * 1024) {
                          toast({ title: "Arquivo muito grande", description: "Máximo 5MB", variant: "destructive" });
                          return;
                        }
                        setUploading(true);
                        try {
                          const ext = file.name.split(".").pop() || "png";
                          const path = `${tenantId}/verify-embed-${Date.now()}.${ext}`;
                          const { error: upErr } = await supabase.storage.from("tenant-assets").upload(path, file, { upsert: true });
                          if (upErr) throw upErr;
                          const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(path);
                          update("verify_image_url", urlData.publicUrl);
                          toast({ title: "Imagem enviada! ✅" });
                        } catch (err: any) {
                          toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
                        } finally {
                          setUploading(false);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {uploading ? "Enviando..." : "Enviar Imagem"}
                    </Button>
                    <span className="text-[10px] text-muted-foreground self-center">ou</span>
                    <Input
                      value={config.verify_image_url}
                      onChange={(e) => update("verify_image_url", e.target.value)}
                      placeholder="https://..."
                      className="flex-1 text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Envie uma imagem ou cole uma URL. Máx 5MB.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="sticky top-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Eye className="h-4 w-4" />
            Preview no Discord
          </div>
          <div className="bg-[#313338] rounded-lg p-4">
            {/* Bot header */}
            <div className="flex items-center gap-2 mb-2">
              {botAvatar ? (
                <img src={botAvatar} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-[#5865F2] flex items-center justify-center">
                  <span className="text-[10px] text-white font-bold">{botName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <span className="text-[#dcddde] text-xs font-semibold">{botName}</span>
              <span className="bg-[#5865F2] text-white text-[9px] px-1 rounded font-medium">BOT</span>
            </div>

            {/* Embed */}
            <div className="flex rounded" style={{ borderLeft: `4px solid ${config.verify_embed_color}` }}>
              <div className="flex-1 p-3 space-y-2">
                {config.verify_title && (
                  <p className="text-white font-semibold text-sm">{config.verify_title}</p>
                )}
                {config.verify_description && (
                  <p className="text-[#dcddde] text-xs whitespace-pre-wrap">{config.verify_description}</p>
                )}
                {config.verify_image_url && (
                  <img src={config.verify_image_url} alt="" className="mt-2 rounded max-h-36 w-full object-cover" />
                )}
              </div>
            </div>

            {/* Button */}
            <div className="mt-2">
              <button className="bg-[#5865F2] text-white text-xs font-medium px-4 py-1.5 rounded flex items-center gap-1.5 cursor-default">
                🔗 {config.verify_button_label || "Verificar"}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            *Preview aproximado. A aparência pode variar conforme o Discord.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificationPage;
