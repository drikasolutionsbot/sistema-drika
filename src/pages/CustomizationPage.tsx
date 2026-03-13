import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Server, Loader2, Save, Bot, Wifi, WifiOff, RefreshCw, ShieldCheck, Send,
  Upload, X, Eye, Undo2, ChevronRight
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
  bot_status: string;
  bot_status_interval: string;
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
  bot_status: "/panel",
  bot_status_interval: "30",
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
          bot_status: t.bot_status || "/panel",
          bot_status_interval: String(t.bot_status_interval || 30),
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
      if (!error && guild && !guild.error) { setGuildInfo(guild); setBotOnline(true); }
      else setBotOnline(false);
    } catch { setBotOnline(false); }
  }, [tenant?.discord_guild_id]);

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

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
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
          <TabsTrigger value="verificacao" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-5">
            Verificação
          </TabsTrigger>
          <TabsTrigger value="verificados" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-5" onClick={() => navigate("/verified-members")}>
            Verificados
          </TabsTrigger>
          <TabsTrigger value="embeds" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-5">
            Embeds
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
                  <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                    {guildInfo?.icon ? (
                      <img
                        src={`https://cdn.discordapp.com/icons/${tenant?.discord_guild_id}/${guildInfo.icon}.png?size=64`}
                        alt="" className="h-full w-full object-cover"
                      />
                    ) : botAvatar ? (
                      <img src={botAvatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Bot className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{guildInfo?.name || botName}</p>
                    <p className="text-xs font-mono text-muted-foreground">{guildId}</p>
                  </div>
                  <Badge variant={botOnline ? "default" : "destructive"} className="gap-1.5 shrink-0">
                    {botOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {botOnline === null ? "..." : botOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
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

          {/* Bot Status */}
          <Card className="border-border/50 bg-sidebar">
            <CardContent className="pt-6 space-y-4">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status do Bot</Label>
              <div className="space-y-2">
                <Label className="text-sm">Status (um por linha)</Label>
                <Textarea
                  value={config.bot_status}
                  onChange={(e) => update("bot_status", e.target.value)}
                  rows={3}
                  className="bg-background border-border resize-none font-mono text-sm"
                  placeholder={"/panel\nDrika Solutions"}
                />
                <p className="text-xs text-muted-foreground">
                  Alterna a cada <strong>{config.bot_status_interval}s</strong>.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Intervalo (seg)</Label>
                  <Input
                    type="number"
                    value={config.bot_status_interval}
                    onChange={(e) => update("bot_status_interval", e.target.value)}
                    className="bg-background border-border font-mono"
                    min={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Prefixo</Label>
                  <Input
                    value={config.bot_prefix}
                    onChange={(e) => update("bot_prefix", e.target.value)}
                    className="bg-background border-border font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ex: <code className="px-1 py-0.5 rounded bg-muted font-mono">{config.bot_prefix}help</code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === VERIFICAÇÃO === */}
        <TabsContent value="verificacao" className="mt-6">
          {/* Verified Members Button */}
          <Card className="border-border/50 bg-sidebar mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Membros Verificados</p>
                    <p className="text-xs text-muted-foreground">Visualize e gerencie todos os membros verificados</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/verified-members")} className="gap-2">
                  Ver Membros <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <div className="space-y-6">
              {/* Toggle */}
              <Card className="border-border/50 bg-sidebar">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-bold">Verificação Ativa</p>
                        <p className="text-xs text-muted-foreground">Membros precisam verificar para receber o cargo</p>
                      </div>
                    </div>
                    <Switch checked={config.verify_enabled} onCheckedChange={(v) => update("verify_enabled", v)} />
                  </div>
                </CardContent>
              </Card>

              {/* Cargo Verificado */}
              <Card className="border-border/50 bg-sidebar">
                <CardContent className="pt-6 space-y-4">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Cargo Verificado</Label>
                  <div className="p-3 rounded-xl bg-background border border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full bg-emerald-500" />
                      <div>
                        <p className="text-sm font-semibold">
                          {roles.find((r: any) => r.id === config.verify_role_id)?.name || "Nenhum selecionado"}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground">{config.verify_role_id || "—"}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <select
                    value={config.verify_role_id}
                    onChange={(e) => update("verify_role_id", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Selecione um cargo</option>
                    {roles.map((role: any) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Quando um usuário verifica, o cargo <strong>{roles.find((r: any) => r.id === config.verify_role_id)?.name || "selecionado"}</strong> será dado.
                  </p>
                </CardContent>
              </Card>

              {/* Canais */}
              <Card className="border-border/50 bg-sidebar">
                <CardContent className="pt-6 space-y-4">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Canais</Label>
                  <div>
                    <Label className="text-sm">Canal de Verificação</Label>
                    <ChannelSelectWithCreate
                      value={config.verify_channel_id}
                      onChange={(v) => update("verify_channel_id", v)}
                      channels={channels}
                      categories={categories}
                      onChannelCreated={fetchData}
                      tenantId={tenantId}
                      guildId={tenant?.discord_guild_id}
                      placeholder="Selecione o canal"
                      defaultNewName="verificação"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Canal de Logs</Label>
                    <ChannelSelectWithCreate
                      value={config.verify_logs_channel_id}
                      onChange={(v) => update("verify_logs_channel_id", v)}
                      channels={channels}
                      categories={categories}
                      onChannelCreated={fetchData}
                      tenantId={tenantId}
                      guildId={tenant?.discord_guild_id}
                      placeholder="Canal de logs"
                      defaultNewName="logs-verificação"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Embed Customization */}
              <Card className="border-border/50 bg-sidebar">
                <CardContent className="pt-6 space-y-4">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Embed de Verificação</Label>
                  <div>
                    <Label className="text-sm">Título</Label>
                    <Input value={config.verify_title} onChange={(e) => update("verify_title", e.target.value)} className="mt-1 bg-background" />
                  </div>
                  <div>
                    <Label className="text-sm">Descrição</Label>
                    <Textarea value={config.verify_description} onChange={(e) => update("verify_description", e.target.value)} rows={3} className="mt-1 bg-background" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Texto do Botão</Label>
                      <Input value={config.verify_button_label} onChange={(e) => update("verify_button_label", e.target.value)} className="mt-1 bg-background" />
                    </div>
                    <div>
                      <Label className="text-sm">Cor</Label>
                      <div className="flex gap-2 mt-1">
                        <input type="color" value={config.verify_embed_color} onChange={(e) => update("verify_embed_color", e.target.value)} className="h-10 w-12 rounded border border-border cursor-pointer bg-transparent" />
                        <Input value={config.verify_embed_color} onChange={(e) => update("verify_embed_color", e.target.value)} className="font-mono bg-background" />
                      </div>
                    </div>
                  </div>
                  <DiscordButtonStylePicker value={config.verify_button_style} onChange={(s) => update("verify_button_style", s)} label="Estilo do Botão" />
                  
                  {/* Image */}
                  <div>
                    <Label className="text-sm">Imagem (opcional)</Label>
                    <div className="mt-2 space-y-2">
                      {config.verify_image_url && (
                        <div className="relative group rounded-lg overflow-hidden border border-border/50">
                          <img src={config.verify_image_url} alt="" className="w-full max-h-32 object-cover" />
                          <button onClick={() => update("verify_image_url", "")} className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="h-3 w-3 text-white" />
                          </button>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !tenantId) return;
                          setUploading(true);
                          try {
                            const ext = file.name.split(".").pop() || "png";
                            const path = `${tenantId}/verify-embed-${Date.now()}.${ext}`;
                            const { error: upErr } = await supabase.storage.from("tenant-assets").upload(path, file, { upsert: true });
                            if (upErr) throw upErr;
                            const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(path);
                            update("verify_image_url", urlData.publicUrl);
                          } catch (err: any) {
                            toast.error("Erro no upload: " + err.message);
                          } finally {
                            setUploading(false);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }
                        }} />
                        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          {uploading ? "Enviando..." : "Upload"}
                        </Button>
                        <Input value={config.verify_image_url} onChange={(e) => update("verify_image_url", e.target.value)} placeholder="https://..." className="flex-1 text-xs bg-background" />
                      </div>
                    </div>
                  </div>

                  <Button onClick={handlePostVerify} disabled={posting || !config.verify_channel_id} variant="outline" className="w-full gap-2 mt-2">
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar Embed no Discord
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Preview */}
            <div className="sticky top-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Eye className="h-4 w-4" /> Preview
              </div>
              <div className="bg-[#313338] rounded-lg p-4">
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
                <div className="flex rounded" style={{ borderLeft: `4px solid ${config.verify_embed_color}` }}>
                  <div className="flex-1 p-3 space-y-2">
                    {config.verify_title && <p className="text-white font-semibold text-sm">{config.verify_title}</p>}
                    {config.verify_description && <p className="text-[#dcddde] text-xs whitespace-pre-wrap">{config.verify_description}</p>}
                    {config.verify_image_url && <img src={config.verify_image_url} alt="" className="mt-2 rounded max-h-36 w-full object-cover" />}
                  </div>
                </div>
                <div className="mt-2">
                  {(() => {
                    const style = config.verify_button_style || "primary";
                    const styleConfig = getDiscordButtonStyles(style);
                    if (style === "glass") return <button className="text-white text-xs font-medium px-4 py-1.5 rounded cursor-default border border-white/10 bg-white/10 backdrop-blur-sm">{config.verify_button_label || "Verificar"}</button>;
                    if (style === "link") return <button className="text-[#00AFF4] text-xs font-medium px-4 py-1.5 rounded cursor-default underline bg-transparent">{config.verify_button_label || "Verificar"}</button>;
                    return <button className="text-xs font-medium px-4 py-1.5 rounded cursor-default" style={{ backgroundColor: styleConfig.bgColor, color: styleConfig.textColor }}>{config.verify_button_label || "Verificar"}</button>;
                  })()}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">*Preview aproximado</p>
            </div>
          </div>
        </TabsContent>

        {/* === EMBEDS === */}
        <TabsContent value="embeds" className="mt-6">
          <EmbedBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomizationPage;
