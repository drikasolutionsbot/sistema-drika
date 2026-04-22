import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ImageUploadField from "@/components/customization/ImageUploadField";
import ChannelSelectWithCreate from "@/components/channels/ChannelSelectWithCreate";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import {
  HandMetal, Send, MessageSquare, UserPlus, LogOut, Hash, Settings2, Eye, Save,
  RefreshCw, Plus, ToggleLeft, ToggleRight, Sparkles, Shield, Bot
} from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface EmbedField {
  id: string;
  name: string;
  value: string;
  inline: boolean;
}

interface EmbedData {
  color: string;
  title: string;
  description: string;
  thumbnail_url: string;
  image_url: string;
  footer_text: string;
  footer_icon_url: string;
  timestamp: boolean;
  fields: EmbedField[];
}

interface WelcomeConfig {
  enabled: boolean;
  channel_enabled: boolean;
  channel_id: string;
  dm_enabled: boolean;
  embed_data: EmbedData;
  dm_embed_data: EmbedData;
  auto_role_enabled: boolean;
  auto_role_id: string;
  content: string;
  dm_content: string;
  goodbye_enabled: boolean;
  goodbye_channel_id: string;
  goodbye_embed_data: EmbedData;
  goodbye_content: string;
}

const defaultEmbed: EmbedData = {
  color: "#2B2D31",
  title: "Bem-vindo(a)! 🎉",
  description: "Olá **{username}**, seja bem-vindo(a) ao **{server}**! 🥳\n\nVocê é nosso membro **#{memberCount}**. Aproveite sua estadia!",
  thumbnail_url: "{avatar}",
  image_url: "",
  footer_text: "Aproveite sua estadia!",
  footer_icon_url: "",
  timestamp: true,
  fields: [],
};

const defaultDmEmbed: EmbedData = {
  color: "#5865F2",
  title: "Bem-vindo(a) ao servidor! 💬",
  description: "Obrigado por entrar! Confira nossos canais.",
  thumbnail_url: "",
  image_url: "",
  footer_text: "",
  footer_icon_url: "",
  timestamp: false,
  fields: [],
};

const defaultGoodbyeEmbed: EmbedData = {
  color: "#ED4245",
  title: "Até logo! 👋",
  description: "**{username}** saiu do servidor. Agora somos **{memberCount}** membros.",
  thumbnail_url: "",
  image_url: "",
  footer_text: "",
  footer_icon_url: "",
  timestamp: true,
  fields: [],
};

const defaultConfig: WelcomeConfig = {
  enabled: false,
  channel_enabled: true,
  channel_id: "",
  dm_enabled: false,
  embed_data: defaultEmbed,
  dm_embed_data: defaultDmEmbed,
  auto_role_enabled: false,
  auto_role_id: "",
  content: "{user}",
  dm_content: "",
  goodbye_enabled: false,
  goodbye_channel_id: "",
  goodbye_embed_data: defaultGoodbyeEmbed,
  goodbye_content: "",
};

const WelcomePage = () => {
  const { tenantId } = useTenant();
  const [serverConfig, setServerConfig] = useState<WelcomeConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("welcome");
  const [previewTab, setPreviewTab] = useState<"welcome" | "dm" | "goodbye">("welcome");

  const { draft: config, setDraft: setConfig, clearDraft, hasDraft, discardDraft } = useLocalDraft<WelcomeConfig>(
    "welcome",
    tenantId,
    serverConfig,
    !loading
  );

  const fetchConfig = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-welcome", {
        body: { action: "get", tenant_id: tenantId },
      });
      if (error) throw error;
      if (data) {
        setServerConfig({
          enabled: data.enabled ?? false,
          channel_enabled: data.channel_enabled ?? true,
          channel_id: data.channel_id ?? "",
          dm_enabled: data.dm_enabled ?? false,
          embed_data: { ...defaultEmbed, ...(data.embed_data || {}) },
          dm_embed_data: { ...defaultDmEmbed, ...(data.dm_embed_data || {}) },
          auto_role_enabled: data.auto_role_enabled ?? false,
          auto_role_id: data.auto_role_id ?? "",
          content: data.content ?? "",
          dm_content: data.dm_content ?? "",
          goodbye_enabled: data.goodbye_enabled ?? false,
          goodbye_channel_id: data.goodbye_channel_id ?? "",
          goodbye_embed_data: { ...defaultGoodbyeEmbed, ...(data.goodbye_embed_data || {}) },
          goodbye_content: data.goodbye_content ?? "",
        });
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const fetchDiscordData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [chRes, roRes] = await Promise.all([
        supabase.functions.invoke("discord-channels", { body: { tenant_id: tenantId } }),
        supabase.functions.invoke("discord-guild-info", { body: { tenant_id: tenantId } }),
      ]);

      const parsedChannels = Array.isArray(chRes.data)
        ? chRes.data.filter((c: any) => c.type === 0)
        : Array.isArray(chRes.data?.channels)
          ? chRes.data.channels
          : [];

      const parsedCategories = Array.isArray(chRes.data?.categories)
        ? chRes.data.categories
        : [];

      setChannels(
        parsedChannels.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
      );
      setCategories(
        parsedCategories.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
      );

      if (roRes.data?.roles && Array.isArray(roRes.data.roles)) {
        setRoles(roRes.data.roles.filter((r: any) => !r.managed && r.name !== "@everyone").sort((a: any, b: any) => b.position - a.position));
      }
    } catch {}
  }, [tenantId]);

  useEffect(() => {
    fetchConfig();
    fetchDiscordData();
  }, [fetchConfig, fetchDiscordData]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-welcome", {
        body: { action: "upsert", tenant_id: tenantId, config },
      });
      if (error) throw error;
      clearDraft();
      toast.success("Configurações salvas com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (type: "welcome" | "dm" | "goodbye") => {
    if (!tenantId) return;
    setTesting(true);
    try {
      let channelId = "";
      let embedData: EmbedData;
      let content = "";

      if (type === "welcome") {
        channelId = config.channel_id;
        embedData = config.embed_data;
        content = config.content;
      } else if (type === "goodbye") {
        channelId = config.goodbye_channel_id;
        embedData = config.goodbye_embed_data;
        content = config.goodbye_content;
      } else {
        toast.error("Teste de DM não disponível por aqui. O bot enviará a DM automaticamente.");
        setTesting(false);
        return;
      }

      if (!channelId) {
        toast.error("Selecione um canal primeiro!");
        setTesting(false);
        return;
      }

      const { error } = await supabase.functions.invoke("manage-welcome", {
        body: { action: "test", tenant_id: tenantId, channel_id: channelId, embed_data: embedData, content },
      });
      if (error) throw error;
      toast.success("Mensagem de teste enviada!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar teste");
    } finally {
      setTesting(false);
    }
  };

  const updateEmbed = (type: "embed_data" | "dm_embed_data" | "goodbye_embed_data", field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  const addField = (type: "embed_data" | "dm_embed_data" | "goodbye_embed_data") => {
    setConfig((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        fields: [...prev[type].fields, { id: crypto.randomUUID(), name: "Campo", value: "Valor", inline: true }],
      },
    }));
  };

  const removeField = (type: "embed_data" | "dm_embed_data" | "goodbye_embed_data", id: string) => {
    setConfig((prev) => ({
      ...prev,
      [type]: { ...prev[type], fields: prev[type].fields.filter((f) => f.id !== id) },
    }));
  };

  const updateField = (type: "embed_data" | "dm_embed_data" | "goodbye_embed_data", id: string, key: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        fields: prev[type].fields.map((f) => (f.id === id ? { ...f, [key]: value } : f)),
      },
    }));
  };

  const renderEmbedEditor = (type: string, embedKey: "embed_data" | "dm_embed_data" | "goodbye_embed_data", contentKey: "content" | "dm_content" | "goodbye_content") => {
    const embed = config[embedKey];
    return (
      <div className="space-y-4">
        <div>
          <Label>Conteúdo (texto acima do embed)</Label>
          <Textarea
            value={config[contentKey]}
            onChange={(e) => setConfig((p) => ({ ...p, [contentKey]: e.target.value }))}
            placeholder="Texto enviado acima do embed... Use {user}, {server}, {memberCount}"
            className="mt-1"
          />
        </div>

        <Separator />

        <div>
          <Label>Cor do Embed</Label>
          <div className="flex gap-2 mt-1">
            <input type="color" value={embed.color} onChange={(e) => updateEmbed(embedKey, "color", e.target.value)} className="h-10 w-14 rounded border border-input cursor-pointer" />
            <Input value={embed.color} onChange={(e) => updateEmbed(embedKey, "color", e.target.value)} className="font-mono" />
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Capa & Descrição (template Drika)</span>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Título</Label>
            <Input value={embed.title} disabled readOnly className="mt-1 opacity-70 cursor-not-allowed" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Textarea
              value={embed.description}
              disabled
              readOnly
              rows={4}
              className="mt-1 opacity-70 cursor-not-allowed resize-none"
            />
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            🔒 Capa e descrição são fixas no padrão Drika. Você pode personalizar cor, imagens, footer e o conteúdo acima do embed.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ImageUploadField label="Thumbnail" value={embed.thumbnail_url} onChange={(v) => updateEmbed(embedKey, "thumbnail_url", v)} folder="welcome/thumbnails" />
          <ImageUploadField label="Imagem" value={embed.image_url} onChange={(v) => updateEmbed(embedKey, "image_url", v)} folder="welcome/images" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Texto do Footer</Label>
            <Input value={embed.footer_text} onChange={(e) => updateEmbed(embedKey, "footer_text", e.target.value)} className="mt-1" placeholder="Texto do rodapé" />
          </div>
          <div>
            <Label>Ícone do Footer</Label>
            <Input value={embed.footer_icon_url} onChange={(e) => updateEmbed(embedKey, "footer_icon_url", e.target.value)} className="mt-1" placeholder="https://..." />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={embed.timestamp} onCheckedChange={(v) => updateEmbed(embedKey, "timestamp", v)} />
          <Label>Mostrar Timestamp</Label>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-semibold">Campos do Embed</Label>
            <Button variant="outline" size="sm" onClick={() => addField(embedKey)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Campo
            </Button>
          </div>
          {embed.fields.length === 0 && <p className="text-sm text-muted-foreground">Nenhum campo adicionado.</p>}
          {embed.fields.map((field) => (
            <div key={field.id} className="flex gap-2 items-start mb-2 p-3 rounded-lg border border-border/50 bg-card/50">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input value={field.name} onChange={(e) => updateField(embedKey, field.id, "name", e.target.value)} placeholder="Nome" />
                <Input value={field.value} onChange={(e) => updateField(embedKey, field.id, "value", e.target.value)} placeholder="Valor" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={field.inline} onCheckedChange={(v) => updateField(embedKey, field.id, "inline", v)} />
                <span className="text-xs text-muted-foreground">Inline</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeField(embedKey, field.id)} className="text-destructive hover:text-destructive">
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEmbedPreview = (embed: EmbedData, content: string) => (
    <div className="bg-[#313338] rounded-lg p-4 max-w-md">
      {content && <p className="text-[#dcddde] text-sm mb-2 whitespace-pre-wrap">{content.replace(/\{user\}/g, "@Usuário").replace(/\{server\}/g, "Meu Servidor").replace(/\{memberCount\}/g, "150")}</p>}
      <div className="flex rounded" style={{ borderLeft: `4px solid ${embed.color}` }}>
        <div className="flex-1 p-3">
          {embed.title && <p className="text-white font-semibold text-sm mb-1">{embed.title}</p>}
          {embed.description && (
            <p className="text-[#dcddde] text-xs whitespace-pre-wrap">
              {embed.description.replace(/\{user\}/g, "@Usuário").replace(/\{server\}/g, "Meu Servidor").replace(/\{memberCount\}/g, "150")
                .replace(/\*\*(.*?)\*\*/g, "⟨b⟩$1⟨/b⟩")
                .replace(/\*(.*?)\*/g, "⟨i⟩$1⟨/i⟩")}
            </p>
          )}
          {embed.fields.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {embed.fields.map((f) => (
                <div key={f.id} className={f.inline ? "" : "col-span-3"}>
                  <p className="text-[#00b0f4] text-xs font-semibold">{f.name}</p>
                  <p className="text-[#dcddde] text-xs">{f.value}</p>
                </div>
              ))}
            </div>
          )}
          {embed.image_url && <img src={embed.image_url} alt="" className="mt-2 rounded max-h-48 w-full object-cover" />}
          {(embed.footer_text || embed.timestamp) && (
            <div className="flex items-center gap-1 mt-2">
              {embed.footer_icon_url && <img src={embed.footer_icon_url} alt="" className="h-4 w-4 rounded-full" />}
              <p className="text-[#72767d] text-[10px]">
                {embed.footer_text}{embed.footer_text && embed.timestamp ? " • " : ""}{embed.timestamp ? "Agora" : ""}
              </p>
            </div>
          )}
        </div>
        {embed.thumbnail_url && <img src={embed.thumbnail_url} alt="" className="h-16 w-16 rounded m-3 object-cover" />}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <HandMetal className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Boas-Vindas</h1>
            <p className="text-sm text-muted-foreground">Configure mensagens de boas-vindas, DM e despedida</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-card/50">
            {config.enabled ? <ToggleRight className="h-5 w-5 text-emerald-400" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
            <span className="text-sm font-medium">{config.enabled ? "Ativo" : "Inativo"}</span>
            <Switch checked={config.enabled} onCheckedChange={(v) => setConfig((p) => ({ ...p, enabled: v }))} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Canal Boas-Vindas</p>
              <p className="font-semibold">{config.channel_enabled ? "Ativo" : "Inativo"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">DM de Boas-Vindas</p>
              <p className="font-semibold">{config.dm_enabled ? "Ativo" : "Inativo"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <LogOut className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Despedida</p>
              <p className="font-semibold">{config.goodbye_enabled ? "Ativo" : "Inativo"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Auto Role</p>
              <p className="font-semibold">{config.auto_role_enabled ? "Ativo" : "Inativo"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card/50 border border-border/50">
          <TabsTrigger value="welcome" className="gap-2"><UserPlus className="h-4 w-4" /> Boas-Vindas</TabsTrigger>
          <TabsTrigger value="dm" className="gap-2"><MessageSquare className="h-4 w-4" /> DM</TabsTrigger>
          <TabsTrigger value="goodbye" className="gap-2"><LogOut className="h-4 w-4" /> Despedida</TabsTrigger>
          <TabsTrigger value="autorole" className="gap-2"><Shield className="h-4 w-4" /> Auto Role</TabsTrigger>
          <TabsTrigger value="variables" className="gap-2"><Sparkles className="h-4 w-4" /> Variáveis</TabsTrigger>
        </TabsList>

        {/* Welcome Tab */}
        <TabsContent value="welcome" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Mensagem de Boas-Vindas</CardTitle>
                    <CardDescription>Enviada no canal quando um membro entra</CardDescription>
                  </div>
                  <Switch checked={config.channel_enabled} onCheckedChange={(v) => setConfig((p) => ({ ...p, channel_enabled: v }))} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Canal de Boas-Vindas</Label>
                  <ChannelSelectWithCreate
                    value={config.channel_id}
                    onChange={(v) => setConfig((p) => ({ ...p, channel_id: v }))}
                    channels={channels}
                    categories={categories}
                    onChannelCreated={fetchDiscordData}
                    tenantId={tenantId}
                    placeholder="Selecione um canal"
                    defaultNewName="boas-vindas"
                  />
                </div>
                <Separator />
                {renderEmbedEditor("welcome", "embed_data", "content")}
                <Button onClick={() => handleTest("welcome")} disabled={testing} variant="outline" className="w-full">
                  <Send className="h-4 w-4 mr-2" /> {testing ? "Enviando..." : "Enviar Teste"}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Eye className="h-5 w-5" /> Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderEmbedPreview(config.embed_data, config.content)}
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-gradient-to-br from-emerald-500/5 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Bot className="h-5 w-5 text-emerald-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Dica</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Use variáveis como <code className="bg-muted px-1 rounded">{"{user}"}</code> para mencionar o membro,
                        <code className="bg-muted px-1 rounded ml-1">{"{server}"}</code> para o nome do servidor e
                        <code className="bg-muted px-1 rounded ml-1">{"{memberCount}"}</code> para o total de membros.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* DM Tab */}
        <TabsContent value="dm" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">DM de Boas-Vindas</CardTitle>
                    <CardDescription>Enviada por mensagem direta ao novo membro</CardDescription>
                  </div>
                  <Switch checked={config.dm_enabled} onCheckedChange={(v) => setConfig((p) => ({ ...p, dm_enabled: v }))} />
                </div>
              </CardHeader>
              <CardContent>
                {renderEmbedEditor("dm", "dm_embed_data", "dm_content")}
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Eye className="h-5 w-5" /> Preview DM</CardTitle>
              </CardHeader>
              <CardContent>
                {renderEmbedPreview(config.dm_embed_data, config.dm_content)}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Goodbye Tab */}
        <TabsContent value="goodbye" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Mensagem de Despedida</CardTitle>
                    <CardDescription>Enviada quando um membro sai do servidor</CardDescription>
                  </div>
                  <Switch checked={config.goodbye_enabled} onCheckedChange={(v) => setConfig((p) => ({ ...p, goodbye_enabled: v }))} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Canal de Despedida</Label>
                  <ChannelSelectWithCreate
                    value={config.goodbye_channel_id}
                    onChange={(v) => setConfig((p) => ({ ...p, goodbye_channel_id: v }))}
                    channels={channels}
                    categories={categories}
                    onChannelCreated={fetchDiscordData}
                    tenantId={tenantId}
                    placeholder="Selecione um canal"
                    defaultNewName="despedida"
                  />
                </div>
                <Separator />
                {renderEmbedEditor("goodbye", "goodbye_embed_data", "goodbye_content")}
                <Button onClick={() => handleTest("goodbye")} disabled={testing} variant="outline" className="w-full">
                  <Send className="h-4 w-4 mr-2" /> {testing ? "Enviando..." : "Enviar Teste de Despedida"}
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Eye className="h-5 w-5" /> Preview Despedida</CardTitle>
              </CardHeader>
              <CardContent>
                {renderEmbedPreview(config.goodbye_embed_data, config.goodbye_content)}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Auto Role Tab */}
        <TabsContent value="autorole" className="space-y-4">
          <Card className="border-border/50 max-w-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Auto Role</CardTitle>
                  <CardDescription>Atribua um cargo automaticamente quando um membro entra</CardDescription>
                </div>
                <Switch checked={config.auto_role_enabled} onCheckedChange={(v) => setConfig((p) => ({ ...p, auto_role_enabled: v }))} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Cargo a ser atribuído</Label>
                <select
                  value={config.auto_role_id}
                  onChange={(e) => setConfig((p) => ({ ...p, auto_role_id: e.target.value }))}
                  className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione um cargo</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>@{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-300">
                  ⚠️ O bot precisa ter um cargo superior ao cargo selecionado para poder atribuí-lo automaticamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Variables Tab */}
        <TabsContent value="variables" className="space-y-4">
          <Card className="border-border/50 max-w-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Variáveis Disponíveis</CardTitle>
              <CardDescription>Use essas variáveis nos textos e embeds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { var: "{user}", desc: "Menção do usuário (@Usuário)" },
                  { var: "{username}", desc: "Nome do usuário (sem menção)" },
                  { var: "{userId}", desc: "ID do usuário no Discord" },
                  { var: "{server}", desc: "Nome do servidor" },
                  { var: "{memberCount}", desc: "Total de membros no servidor" },
                  { var: "{avatar}", desc: "URL do avatar do usuário (para thumbnail/imagem)" },
                  { var: "{serverIcon}", desc: "URL do ícone do servidor" },
                  { var: "{createdAt}", desc: "Data de criação da conta" },
                  { var: "{joinedAt}", desc: "Data que entrou no servidor" },
                ].map((v) => (
                  <div key={v.var} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
                    <code className="bg-primary/20 text-primary px-2 py-1 rounded text-sm font-mono">{v.var}</code>
                    <span className="text-sm text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WelcomePage;
