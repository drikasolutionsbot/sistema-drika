import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Server, Loader2, Save, Bot, Wifi, WifiOff, RefreshCw, ShieldCheck, Send,
  Upload, X, Eye, Undo2, ChevronRight, Camera
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTenant } from "@/contexts/TenantContext";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import EmbedBuilder from "@/components/customization/EmbedBuilder";
import ChannelSelectWithCreate from "@/components/channels/ChannelSelectWithCreate";
import { DiscordButtonStylePicker, type DiscordButtonStyle, getDiscordButtonStyles } from "@/components/discord/DiscordButtonStylePicker";

interface ServerConfig {
  server_name: string;
  bot_prefix: string;
  // Verification
  verify_enabled: boolean;
  verify_role_id: string;
  verify_channel_id: string;
  verify_logs_channel_id: string;
  verify_title: string;
  verify_description: string;
  verify_button_label: string;
  verify_embed_color: string;
  verify_image_url: string;
  verify_button_style: DiscordButtonStyle;
}

const defaultConfig: ServerConfig = {
  server_name: "",
  bot_prefix: "d!",
  verify_enabled: false,
  verify_role_id: "",
  verify_channel_id: "",
  verify_logs_channel_id: "",
  verify_title: "👑 Verificação",
  verify_description: "Clique no botão abaixo para se verificar em nosso servidor.",
  verify_button_label: "Verificar",
  verify_embed_color: "#5865F2",
  verify_image_url: "",
  verify_button_style: "primary",
};

const CustomizationPage = () => {
  const navigate = useNavigate();
  const { tenant, tenantId, refetch } = useTenant();
  const [serverConfig, setServerConfig] = useState<ServerConfig>(defaultConfig);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [botOnline, setBotOnline] = useState<boolean | null>(null);
  const [checkingBot, setCheckingBot] = useState(false);
  const [guildInfo, setGuildInfo] = useState<{ name: string; member_count: number; presence_count: number; icon: string | null } | null>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const guildIconInputRef = useRef<HTMLInputElement>(null);
  const guildInfoLoadedRef = useRef(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  const { draft: config, setDraft: setConfig, clearDraft, hasDraft, discardDraft } = useLocalDraft<ServerConfig>(
    "server-config",
    tenantId,
    serverConfig,
    configLoaded
  );

  const update = (field: keyof ServerConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  // Load all data
  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [chRes, discordRolesRes, panelRolesRes, tenantRes] = await Promise.all([
        supabase.functions.invoke("discord-channels", { body: { tenant_id: tenantId } }),
        supabase.functions.invoke("manage-roles", { body: { action: "list_discord", tenant_id: tenantId } }),
        supabase.functions.invoke("manage-roles", { body: { action: "list", tenant_id: tenantId } }),
        supabase.functions.invoke("get-tenant", { body: { tenant_id: tenantId } }),
      ]);

      // Channels
      const ch = Array.isArray(chRes.data?.channels) ? chRes.data.channels : Array.isArray(chRes.data) ? chRes.data.filter((c: any) => c.type === 0) : [];
      const cats = Array.isArray(chRes.data?.categories) ? chRes.data.categories : [];
      setChannels(ch.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)));
      setCategories(cats.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)));

      // Roles
      const discordRoles = Array.isArray(discordRolesRes.data?.roles) ? discordRolesRes.data.roles : [];
      const panelRoles = Array.isArray(panelRolesRes.data) ? panelRolesRes.data : [];
      const discordIds = new Set(discordRoles.map((r: any) => r.id));
      const panelOnly = panelRoles
        .filter((r: any) => r.discord_role_id && !discordIds.has(r.discord_role_id))
        .map((r: any) => ({ id: r.discord_role_id, name: r.name, position: 0 }));
      setRoles([...discordRoles, ...panelOnly]);

      // Tenant config
      const t = tenantRes.data || tenant;
      if (t) {
        const loaded: ServerConfig = {
          server_name: t.name || "",
          bot_prefix: t.bot_prefix || "d!",
          verify_enabled: t.verify_enabled ?? false,
          verify_role_id: t.verify_role_id ?? "",
          verify_channel_id: t.verify_channel_id ?? "",
          verify_logs_channel_id: t.verify_logs_channel_id ?? "",
          verify_title: t.verify_title ?? defaultConfig.verify_title,
          verify_description: t.verify_description ?? defaultConfig.verify_description,
          verify_button_label: t.verify_button_label ?? defaultConfig.verify_button_label,
          verify_embed_color: t.verify_embed_color ?? defaultConfig.verify_embed_color,
          verify_image_url: t.verify_image_url ?? "",
          verify_button_style: t.verify_button_style ?? "primary",
        };
        setServerConfig(loaded);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConfigLoaded(true);
    }
  }, [tenantId, tenant]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Bot status check
  const checkBotStatus = useCallback(async () => {
    if (!tenant?.discord_guild_id) { setBotOnline(false); return; }
    try {
      const { data: guild, error } = await supabase.functions.invoke("discord-guild-info", {
        body: { guild_id: tenant.discord_guild_id },
      });
      if (!error && guild && !guild.error) {
        setGuildInfo(guild);
        setBotOnline(true);
        // Always pre-fill server name from Discord guild on first load
        if (guild.name && !guildInfoLoadedRef.current) {
          guildInfoLoadedRef.current = true;
          setConfig(prev => ({ ...prev, server_name: guild.name }));
        }
      }
      else setBotOnline(false);
    } catch { setBotOnline(false); }
  }, [tenant?.discord_guild_id, setConfig]);

  useEffect(() => {
    checkBotStatus();
    const iv = setInterval(checkBotStatus, 30000);
    return () => clearInterval(iv);
  }, [checkBotStatus]);

  const handleRefreshBot = async () => {
    setCheckingBot(true);
    await checkBotStatus();
    setCheckingBot(false);
  };

  const handleGuildIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 8MB");
      return;
    }
    setUploadingIcon(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          guild_icon_base64: base64,
        },
      });
      if (error) throw error;
      toast.success("Ícone do servidor atualizado!");
      guildInfoLoadedRef.current = false;
      await checkBotStatus();
    } catch (err: any) {
      toast.error("Erro ao atualizar ícone: " + (err.message || "Tente novamente"));
    } finally {
      setUploadingIcon(false);
      if (guildIconInputRef.current) guildIconInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            name: config.server_name,
            bot_status: config.bot_status,
            bot_status_interval: parseInt(config.bot_status_interval) || 30,
            bot_prefix: config.bot_prefix,
            verify_enabled: config.verify_enabled,
            verify_role_id: config.verify_role_id || null,
            verify_channel_id: config.verify_channel_id || null,
            verify_logs_channel_id: config.verify_logs_channel_id || null,
            verify_title: config.verify_title,
            verify_description: config.verify_description,
            verify_button_label: config.verify_button_label,
            verify_embed_color: config.verify_embed_color,
            verify_image_url: config.verify_image_url || null,
            verify_button_style: config.verify_button_style,
          },
        },
      });
      if (error) throw error;
      clearDraft();
      toast.success("Configurações salvas!");
      refetch();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const handlePostVerify = async () => {
    if (!tenantId || !config.verify_channel_id) {
      toast.error("Selecione um canal de verificação primeiro");
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
          button_style: config.verify_button_style,
          embed_color: config.verify_embed_color,
          image_url: config.verify_image_url || null,
        },
      });
      if (error) throw error;
      toast.success("Embed de verificação enviado!");
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e.message || ""));
    } finally {
      setPosting(false);
    }
  };

  const botName = tenant?.name || "Drika Bot";
  const botAvatar = tenant?.logo_url;
  const guildId = tenant?.discord_guild_id || "—";

  if (!configLoaded) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Draft banner */}
      {hasDraft && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-2.5">
          <p className="text-sm text-yellow-400">📝 Alterações não salvas (rascunho local).</p>
          <Button variant="ghost" size="sm" onClick={discardDraft} className="text-yellow-400 hover:text-yellow-300 gap-1.5">
            <Undo2 className="h-3.5 w-3.5" /> Descartar
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <Server className="h-6 w-6 text-primary" />
            Editar Servidor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as configurações do bot e verificação do seu servidor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshBot} disabled={checkingBot} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${checkingBot ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Verificar</span>
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral">
        <TabsList className="bg-muted/50 border border-border rounded-xl p-1 w-full sm:w-auto">
          <TabsTrigger value="geral" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-5">
            Geral
          </TabsTrigger>
        </TabsList>

        {/* === GERAL === */}
        <TabsContent value="geral" className="mt-6 space-y-6">
          {/* Discord Server */}
          <Card className="border-border/50 bg-sidebar">
            <CardContent className="pt-6 space-y-5">
               <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Servidor Discord</Label>
                <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-background border border-border">
                  <div
                    className="relative h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer group"
                    onClick={() => guildIconInputRef.current?.click()}
                    title="Clique para alterar o ícone do servidor"
                  >
                    {uploadingIcon ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : guildInfo?.icon ? (
                      <img
                        src={guildInfo.icon.startsWith("http") ? guildInfo.icon : `https://cdn.discordapp.com/icons/${tenant?.discord_guild_id}/${guildInfo.icon}.png?size=64`}
                        alt="" className="h-full w-full object-cover"
                      />
                    ) : botAvatar ? (
                      <img src={botAvatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Bot className="h-5 w-5 text-primary" />
                    )}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                      <Camera className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <input
                    ref={guildIconInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleGuildIconUpload}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground">{guildId}</p>
                  </div>
                  <Badge variant={botOnline ? "default" : "destructive"} className="gap-1.5 shrink-0">
                    {botOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {botOnline === null ? "..." : botOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
              </div>

              <div>
                <Label htmlFor="server_name" className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Nome do Servidor</Label>
                <Input
                  id="server_name"
                  value={config.server_name}
                  onChange={e => update("server_name", e.target.value)}
                  placeholder="Nome do seu servidor"
                  className="mt-2"
                />
              </div>

              {guildInfo && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-background border border-border">
                    <p className="text-xs text-muted-foreground">Membros</p>
                    <p className="text-lg font-bold">{guildInfo.member_count.toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background border border-border">
                    <p className="text-xs text-muted-foreground">Online</p>
                    <p className="text-lg font-bold text-emerald-500">{guildInfo.presence_count.toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomizationPage;
