import { useState, useEffect } from "react";
import { Copy, Eye, LayoutTemplate, Save, FolderOpen, Loader2, Send, Hash } from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import EmbedForm from "./EmbedForm";
import EmbedPreview from "./EmbedPreview";
import { defaultEmbed, embedTemplates, type EmbedData } from "./types";

interface SavedEmbed {
  id: string;
  name: string;
  embed_data: EmbedData;
  created_at: string;
}

const EmbedBuilder = () => {
  const { tenantId, tenant } = useTenant();
  const [embed, setEmbed] = useState<EmbedData>({ ...defaultEmbed });
  const [savedEmbeds, setSavedEmbeds] = useState<SavedEmbed[]>([]);
  const [loadingEmbeds, setLoadingEmbeds] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [embedName, setEmbedName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchSavedEmbeds = async () => {
    if (!tenantId) return;
    setLoadingEmbeds(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-saved-embeds", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error) throw error;
      setSavedEmbeds((data?.embeds as SavedEmbed[]) || []);
    } catch {
      setSavedEmbeds([]);
    }
    setLoadingEmbeds(false);
  };

  useEffect(() => {
    fetchSavedEmbeds();
  }, [tenantId]);

  const applyTemplate = (templateId: string) => {
    const tpl = embedTemplates.find(t => t.id === templateId);
    if (tpl) {
      setEmbed({ ...tpl.data, fields: tpl.data.fields.map(f => ({ ...f, id: crypto.randomUUID() })) });
      setEditingId(null);
      toast.success(`Template "${tpl.name}" aplicado!`);
    }
  };

  const generateJson = () => {
    const obj: Record<string, any> = {};
    if (embed.title) obj.title = embed.title;
    if (embed.description) obj.description = embed.description;
    if (embed.url) obj.url = embed.url;
    if (embed.color) obj.color = parseInt(embed.color.replace("#", ""), 16);
    if (embed.author_name) {
      obj.author = { name: embed.author_name };
      if (embed.author_icon_url) obj.author.icon_url = embed.author_icon_url;
      if (embed.author_url) obj.author.url = embed.author_url;
    }
    if (embed.thumbnail_url) obj.thumbnail = { url: embed.thumbnail_url };
    if (embed.image_url) obj.image = { url: embed.image_url };
    if (embed.fields.length > 0) {
      obj.fields = embed.fields.map(f => ({
        name: f.name || "​",
        value: f.value || "​",
        inline: f.inline,
      }));
    }
    if (embed.footer_text || embed.footer_icon_url) {
      obj.footer = {};
      if (embed.footer_text) obj.footer.text = embed.footer_text;
      if (embed.footer_icon_url) obj.footer.icon_url = embed.footer_icon_url;
    }
    if (embed.timestamp) obj.timestamp = new Date().toISOString();
    return JSON.stringify(obj, null, 2);
  };

  const copyJson = () => {
    navigator.clipboard.writeText(generateJson());
    toast.success("JSON copiado!");
  };

  const openSaveDialog = () => {
    if (!embedName && editingId) {
      const existing = savedEmbeds.find(e => e.id === editingId);
      if (existing) setEmbedName(existing.name);
    }
    setSaveDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tenantId || !embedName.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("saved_embeds")
          .update({ name: embedName.trim(), embed_data: JSON.parse(JSON.stringify(embed)), updated_at: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Embed atualizado!");
      } else {
        const { error } = await supabase
          .from("saved_embeds")
          .insert([{ tenant_id: tenantId, name: embedName.trim(), embed_data: JSON.parse(JSON.stringify(embed)) }]);
        if (error) throw error;
        toast.success("Embed salvo!");
      }
      setSaveDialogOpen(false);
      setEmbedName("");
      fetchSavedEmbeds();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const loadEmbed = (saved: SavedEmbed) => {
    setEmbed(saved.embed_data);
    setEditingId(saved.id);
    setEmbedName(saved.name);
    setLoadDialogOpen(false);
    toast.success(`Embed "${saved.name}" carregado!`);
  };

  const deleteEmbed = async (id: string) => {
    const { error } = await supabase.from("saved_embeds").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Embed excluído!");
    if (editingId === id) {
      setEditingId(null);
      setEmbedName("");
    }
    fetchSavedEmbeds();
  };

  const handleNew = () => {
    setEmbed({ ...defaultEmbed });
    setEditingId(null);
    setEmbedName("");
  };

  // Send embed state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);

  const openSendDialog = async () => {
    setSendDialogOpen(true);
    setLoadingChannels(true);
    try {
      const guildId = (tenant as any)?.discord_guild_id;
      if (!guildId) {
        toast.error("Servidor Discord não configurado.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("discord-channels", {
        body: { guild_id: guildId },
      });
      if (error) throw error;
      setChannels(data?.channels || []);
    } catch (err: any) {
      toast.error("Erro ao carregar canais: " + (err.message || ""));
    } finally {
      setLoadingChannels(false);
    }
  };

  const buildDiscordEmbed = () => {
    const obj: Record<string, any> = {};
    if (embed.title) obj.title = embed.title;
    if (embed.description) obj.description = embed.description;
    if (embed.url) obj.url = embed.url;
    if (embed.color) obj.color = parseInt(embed.color.replace("#", ""), 16);
    if (embed.author_name) {
      obj.author = { name: embed.author_name };
      if (embed.author_icon_url) obj.author.icon_url = embed.author_icon_url;
      if (embed.author_url) obj.author.url = embed.author_url;
    }
    if (embed.thumbnail_url) obj.thumbnail = { url: embed.thumbnail_url };
    if (embed.image_url) obj.image = { url: embed.image_url };
    if (embed.fields.length > 0) {
      obj.fields = embed.fields.map(f => ({
        name: f.name || "​",
        value: f.value || "​",
        inline: f.inline,
      }));
    }
    if (embed.footer_text || embed.footer_icon_url) {
      obj.footer = {};
      if (embed.footer_text) obj.footer.text = embed.footer_text;
      if (embed.footer_icon_url) obj.footer.icon_url = embed.footer_icon_url;
    }
    if (embed.timestamp) obj.timestamp = new Date().toISOString();
    return obj;
  };

  const handleSend = async () => {
    if (!tenantId || !selectedChannel) return;
    setSending(true);
    try {
      const discordEmbed = buildDiscordEmbed();
      const enabledButtons = (embed.buttons || []).filter(b => b.enabled && b.label);
      const body: Record<string, any> = {
        tenant_id: tenantId,
        channel_id: selectedChannel,
        embeds: [discordEmbed],
      };
      if (enabledButtons.length > 0) {
        body.buttons = enabledButtons.map(b => ({
          label: b.label,
          emoji: b.emoji || undefined,
          style: b.style,
          url: b.style === "link" ? b.url : undefined,
        }));
      }
      const { data, error } = await supabase.functions.invoke("send-webhook-message", {
        body,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Embed enviado com sucesso!");
      setSendDialogOpen(false);
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Tente novamente"));
    } finally {
      setSending(false);
    }
  };


  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Form */}
      <Card className="p-5 bg-sidebar border-border overflow-y-auto max-h-[700px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-primary inline-block" />
            Editor
            {editingId && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                — {embedName}
              </span>
            )}
          </h3>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={handleNew} title="Novo embed">
              Novo
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLoadDialogOpen(true)} title="Carregar embed salvo">
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> Carregar
            </Button>
            <Button variant="outline" size="sm" onClick={openSaveDialog} title="Salvar embed">
              <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar
            </Button>
            <Button variant="outline" size="sm" onClick={copyJson}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> JSON
            </Button>
            <Button size="sm" onClick={openSendDialog} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Send className="h-3.5 w-3.5 mr-1.5" /> Enviar
            </Button>
          </div>
        </div>

        {/* Templates */}
        <div className="flex items-center gap-2 mb-4">
          <LayoutTemplate className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">Templates:</span>
          <div className="flex gap-1.5 flex-wrap">
            {embedTemplates.map(tpl => (
              <Button
                key={tpl.id}
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => applyTemplate(tpl.id)}
              >
                {tpl.icon} {tpl.name}
              </Button>
            ))}
          </div>
        </div>

        <EmbedForm embed={embed} onChange={setEmbed} />
      </Card>

      {/* Preview */}
      <Card className="border-border overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-sidebar">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Preview</span>
        </div>
        <div className="bg-[#36393f] min-h-[400px]">
          <EmbedPreview embed={embed} />
        </div>
      </Card>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-sidebar border-border">
          <DialogHeader>
            <DialogTitle>{editingId ? "Atualizar Embed" : "Salvar Embed"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Nome do Embed</label>
              <Input
                value={embedName}
                onChange={e => setEmbedName(e.target.value)}
                placeholder="Ex: Boas-vindas, Compra confirmada..."
                className="bg-background border-border"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSaveDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving || !embedName.trim()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="sm:max-w-md bg-sidebar border-border">
          <DialogHeader>
            <DialogTitle>Embeds Salvos</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2 max-h-[400px] overflow-y-auto">
            {loadingEmbeds ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : savedEmbeds.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum embed salvo ainda.
              </p>
            ) : (
              savedEmbeds.map(saved => (
                <div
                  key={saved.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors"
                >
                  <button
                    className="flex-1 text-left"
                    onClick={() => loadEmbed(saved)}
                  >
                    <p className="text-sm font-medium">{saved.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(saved.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteEmbed(saved.id)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-sidebar border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" /> Enviar Embed
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Canal de destino</label>
              {loadingChannels ? (
                <div className="flex items-center gap-2 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Carregando canais...</span>
                </div>
              ) : (
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione um canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map(ch => (
                      <SelectItem key={ch.id} value={ch.id}>
                        <span className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                          {ch.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSendDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSend} disabled={sending || !selectedChannel}>
                {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmbedBuilder;
