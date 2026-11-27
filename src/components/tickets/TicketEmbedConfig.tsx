import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import DrikaLockedFields from "@/components/customization/DrikaLockedFields";
import { Loader2, Save, Palette, Type, Image, MessageSquare, Send, Undo2, Shield, ChevronDown, FolderOpen, BookmarkPlus } from "lucide-react";
import TextareaWithEmoji from "@/components/discord/TextareaWithEmoji";
import TrashIcon from "@/components/ui/trash-icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ImageUploadField from "@/components/customization/ImageUploadField";
import ChannelSelectWithCreate from "@/components/channels/ChannelSelectWithCreate";
import { DiscordButtonStylePicker, getDiscordButtonStyles, type DiscordButtonStyle } from "@/components/discord/DiscordButtonStylePicker";
import ButtonLabelWithEmoji, { parseEmojiFromLabel } from "@/components/discord/ButtonLabelWithEmoji";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { useDiscordRoles } from "@/hooks/useDiscordRoles";
import {
  DEFAULT_HOW_IT_WORKS_TITLE,
  TICKET_SELECT_PLACEHOLDER,
  parseTicketAccentColor,
  parseTicketPreviewLines,
  resolveHowItWorksHeading,
  resolveTicketPromptLine,
  type PreviewLine,
} from "@/lib/ticketPanel";

interface TicketEmbedData {
  ticket_embed_title: string;
  ticket_embed_description: string;
  ticket_embed_color: string;
  ticket_embed_image_url: string;
  ticket_embed_thumbnail_url: string;
  ticket_embed_footer: string;
  ticket_embed_button_label: string;
  ticket_embed_button_style: DiscordButtonStyle;
  ticket_embed_how_it_works_title: string;
  ticket_embed_how_it_works: string;
  ticket_channel_id: string;
  ticket_logs_channel_id: string;
  ticket_staff_role_id: string;
}

const defaults: TicketEmbedData = {
  ticket_embed_title: "Atendimento",
  ticket_embed_description: "Clique no botão abaixo para abrir um ticket.",
  ticket_embed_color: "",
  ticket_embed_image_url: "",
  ticket_embed_thumbnail_url: "",
  ticket_embed_footer: "",
  ticket_embed_button_label: "📩 Abrir Ticket",
  ticket_embed_button_style: "glass",
  ticket_embed_how_it_works_title: DEFAULT_HOW_IT_WORKS_TITLE,
  ticket_embed_how_it_works: "",
  ticket_channel_id: "",
  ticket_logs_channel_id: "",
  ticket_staff_role_id: "",
};

function renderPreviewLines(lines: PreviewLine[], keyPrefix: string) {
  return lines.map((line, idx) => {
    if (line.kind === "spacer") return <div key={`${keyPrefix}-${idx}`} className="h-1" />;
    if (line.kind === "quote") {
      return (
        <div key={`${keyPrefix}-${idx}`} className="flex items-start gap-2.5 pl-0.5">
          <span className="w-[3px] self-stretch rounded-full bg-[#4e5058] shrink-0" />
          <p className="text-[#dbdee1] text-[13px] leading-relaxed break-words">{line.text}</p>
        </div>
      );
    }
    return <p key={`${keyPrefix}-${idx}`} className="text-[#dbdee1] text-[13px] leading-relaxed break-words">{line.text}</p>;
  });
}

interface TicketPreset {
  id: string;
  name: string;
  preset_data: TicketEmbedData;
  created_at: string;
}

const TicketEmbedConfig = () => {
  const { tenantId, tenant } = useTenant();
  const [serverData, setServerData] = useState<TicketEmbedData>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [staffRoleOpen, setStaffRoleOpen] = useState(false);
  const [channels, setChannels] = useState<{ id: string; name: string; parent_id?: string | null }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; position: number }[]>([]);
  const [activeTicketCategoryCount, setActiveTicketCategoryCount] = useState(0);
  const { roles: discordRoles, loading: rolesLoading } = useDiscordRoles();

  // Presets state
  const [presets, setPresets] = useState<TicketPreset[]>([]);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [loadPresetOpen, setLoadPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

  const { draft: data, setDraft: setData, clearDraft, hasDraft, discardDraft } = useLocalDraft<TicketEmbedData>(
    "ticket-embed",
    tenantId,
    serverData,
    !loading
  );

  const guildId = tenant?.discord_guild_id || null;

  // Fetch presets
  const fetchPresets = useCallback(async () => {
    if (!tenantId) return;

    try {
      const { data: res, error } = await supabase.functions.invoke("manage-tickets", {
        body: {
          action: "list_presets",
          tenant_id: tenantId,
        },
      });

      if (error) throw error;
      if (res?.error) throw new Error(res.error);

      setPresets((res?.presets as TicketPreset[]) || []);
    } catch (err: any) {
      toast.error("Erro ao carregar presets: " + err.message);
      setPresets([]);
    }
  }, [tenantId]);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const handleSavePreset = async () => {
    if (!tenantId || !presetName.trim()) return;
    setSavingPreset(true);

    try {
      const { data: res, error } = await supabase.functions.invoke("manage-tickets", {
        body: {
          action: "save_preset",
          tenant_id: tenantId,
          preset_name: presetName.trim(),
          preset_data: JSON.parse(JSON.stringify(data)),
        },
      });

      if (error) throw error;
      if (res?.error) throw new Error(res.error);

      toast.success(`Preset "${presetName}" salvo!`);
      setSavePresetOpen(false);
      setPresetName("");
      fetchPresets();
    } catch (err: any) {
      toast.error("Erro ao salvar preset: " + err.message);
    } finally {
      setSavingPreset(false);
    }
  };

  const loadPreset = (preset: TicketPreset) => {
    // Preserve channel/role configs, only apply visual/text settings
    setData(prev => ({
      ...prev,
      ticket_embed_title: preset.preset_data.ticket_embed_title,
      ticket_embed_description: preset.preset_data.ticket_embed_description,
      ticket_embed_color: preset.preset_data.ticket_embed_color || "",
      ticket_embed_image_url: preset.preset_data.ticket_embed_image_url || "",
      ticket_embed_thumbnail_url: preset.preset_data.ticket_embed_thumbnail_url || "",
      ticket_embed_footer: preset.preset_data.ticket_embed_footer || "",
      ticket_embed_button_label: preset.preset_data.ticket_embed_button_label,
      ticket_embed_button_style: preset.preset_data.ticket_embed_button_style,
      ticket_embed_how_it_works_title: preset.preset_data.ticket_embed_how_it_works_title ?? defaults.ticket_embed_how_it_works_title,
      ticket_embed_how_it_works: preset.preset_data.ticket_embed_how_it_works || "",
    }));
    setLoadPresetOpen(false);
    toast.success(`Preset "${preset.name}" aplicado!`);
  };

  const deletePreset = async (id: string) => {
    if (!tenantId) return;

    try {
      const { data: res, error } = await supabase.functions.invoke("manage-tickets", {
        body: {
          action: "delete_preset",
          tenant_id: tenantId,
          preset_id: id,
        },
      });

      if (error) throw error;
      if (res?.error) throw new Error(res.error);

      toast.success("Preset excluído!");
      fetchPresets();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const fetchChannels = useCallback(async () => {
    if (!guildId && !tenantId) return;
    try {
      const { data: res } = await supabase.functions.invoke("discord-channels", {
        body: guildId ? { guild_id: guildId } : { tenant_id: tenantId },
      });
      if (res) {
        if (res.categories) setCategories(res.categories);
        if (res.channels) setChannels(res.channels);
      }
    } catch (err) {
      console.error("Error fetching channels:", err);
    }
  }, [guildId, tenantId]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const [{ data: config }, { count: catCount }] = await Promise.all([
        (supabase as any)
          .from("store_configs")
          .select("ticket_embed_title, ticket_embed_description, ticket_embed_color, ticket_embed_image_url, ticket_embed_thumbnail_url, ticket_embed_footer, ticket_embed_button_label, ticket_embed_button_style, ticket_embed_how_it_works_title, ticket_embed_how_it_works, ticket_channel_id, ticket_logs_channel_id, ticket_staff_role_id")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
        (supabase as any)
          .from("ticket_categories")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("active", true),
      ]);
      setActiveTicketCategoryCount(catCount || 0);
      if (config) {
        const loaded: TicketEmbedData = {
          ticket_embed_title: config.ticket_embed_title || defaults.ticket_embed_title,
          ticket_embed_description: config.ticket_embed_description || defaults.ticket_embed_description,
          ticket_embed_color: config.ticket_embed_color ?? "",
          ticket_embed_image_url: config.ticket_embed_image_url || "",
          ticket_embed_thumbnail_url: config.ticket_embed_thumbnail_url || "",
          ticket_embed_footer: config.ticket_embed_footer || "",
          ticket_embed_button_label: config.ticket_embed_button_label || defaults.ticket_embed_button_label,
          ticket_embed_button_style: (config.ticket_embed_button_style as DiscordButtonStyle) || defaults.ticket_embed_button_style,
          ticket_embed_how_it_works_title: config.ticket_embed_how_it_works_title ?? defaults.ticket_embed_how_it_works_title,
          ticket_embed_how_it_works: config.ticket_embed_how_it_works ?? "",
          ticket_channel_id: config.ticket_channel_id || "",
          ticket_logs_channel_id: config.ticket_logs_channel_id || "",
          ticket_staff_role_id: config.ticket_staff_role_id || "",
        };
        setServerData(loaded);
      }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const handleSave = async () => {
    if (!tenantId) return false;
    setSaving(true);
    try {
      const configPayload = {
        ticket_embed_title: data.ticket_embed_title || null,
        ticket_embed_description: data.ticket_embed_description || null,
        ticket_embed_color: data.ticket_embed_color || null,
        ticket_embed_image_url: data.ticket_embed_image_url || null,
        ticket_embed_thumbnail_url: data.ticket_embed_thumbnail_url || null,
        ticket_embed_footer: data.ticket_embed_footer || null,
        ticket_embed_button_label: data.ticket_embed_button_label || null,
        ticket_embed_button_style: data.ticket_embed_button_style || "glass",
        ticket_embed_how_it_works_title: data.ticket_embed_how_it_works_title.trim(),
        ticket_embed_how_it_works: data.ticket_embed_how_it_works || null,
        ticket_channel_id: data.ticket_channel_id || null,
        ticket_logs_channel_id: data.ticket_logs_channel_id || null,
        ticket_staff_role_id: data.ticket_staff_role_id || null,
      };

      const { data: savedConfig, error } = await supabase.functions.invoke("manage-store-config", {
        body: {
          action: "upsert",
          tenant_id: tenantId,
          config: configPayload,
        },
      });

      if (error) throw error;

      clearDraft();
      setServerData({
        ticket_embed_title: savedConfig?.ticket_embed_title || data.ticket_embed_title,
        ticket_embed_description: savedConfig?.ticket_embed_description || data.ticket_embed_description,
        ticket_embed_color: savedConfig?.ticket_embed_color ?? data.ticket_embed_color,
        ticket_embed_image_url: savedConfig?.ticket_embed_image_url || data.ticket_embed_image_url,
        ticket_embed_thumbnail_url: savedConfig?.ticket_embed_thumbnail_url || data.ticket_embed_thumbnail_url,
        ticket_embed_footer: savedConfig?.ticket_embed_footer || data.ticket_embed_footer,
        ticket_embed_button_label: savedConfig?.ticket_embed_button_label || data.ticket_embed_button_label,
        ticket_embed_button_style: (savedConfig?.ticket_embed_button_style as DiscordButtonStyle) || data.ticket_embed_button_style,
        ticket_embed_how_it_works_title: savedConfig?.ticket_embed_how_it_works_title ?? data.ticket_embed_how_it_works_title,
        ticket_embed_how_it_works: savedConfig?.ticket_embed_how_it_works ?? data.ticket_embed_how_it_works,
        ticket_channel_id: savedConfig?.ticket_channel_id || data.ticket_channel_id,
        ticket_logs_channel_id: savedConfig?.ticket_logs_channel_id || data.ticket_logs_channel_id,
        ticket_staff_role_id: savedConfig?.ticket_staff_role_id || data.ticket_staff_role_id,
      });
      toast.success("Configuração do ticket salva!");
      return true;
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!tenantId || !data.ticket_channel_id) {
      toast.error("Selecione um canal antes de enviar.");
      return;
    }

    const saved = await handleSave();
    if (!saved) return;

    setSending(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("send-ticket-embed", {
        body: {
          tenant_id: tenantId,
          channel_id: data.ticket_channel_id,
          title: data.ticket_embed_title,
          description: data.ticket_embed_description,
          button_label: data.ticket_embed_button_label,
          button_style: data.ticket_embed_button_style,
          embed_color: data.ticket_embed_color,
          image_url: data.ticket_embed_image_url || undefined,
          thumbnail_url: data.ticket_embed_thumbnail_url || undefined,
          footer: data.ticket_embed_footer || undefined,
          how_it_works_title: data.ticket_embed_how_it_works_title,
          how_it_works: data.ticket_embed_how_it_works || undefined,
        },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      toast.success("Embed de ticket enviado ao canal!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const update = (key: keyof TicketEmbedData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value as any }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="space-y-5">
        {hasDraft && (
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm text-muted-foreground">Rascunho não salvo recuperado</p>
            <Button variant="ghost" size="sm" onClick={discardDraft} className="gap-1.5 text-xs">
              <Undo2 className="h-3.5 w-3.5" />
              Descartar
            </Button>
          </div>
        )}
        {/* Preset buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSavePresetOpen(true)}>
            <BookmarkPlus className="h-3.5 w-3.5" /> Salvar Preset
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLoadPresetOpen(true)}>
            <FolderOpen className="h-3.5 w-3.5" /> Carregar Preset
            {presets.length > 0 && (
              <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{presets.length}</span>
            )}
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" />
              Textos do Embed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={data.ticket_embed_title}
                onChange={(e) => update("ticket_embed_title", e.target.value)}
                placeholder="Atendimento"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <TextareaWithEmoji
                value={data.ticket_embed_description}
                onChange={(val) => update("ticket_embed_description", val)}
                placeholder="Clique no botão abaixo para abrir um ticket."
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground">Dica: inicie linhas com <code className="font-mono">&gt;</code> para criar blocos de citação com barra lateral no Discord.</p>
            </div>
            <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="space-y-1.5">
                <Label>Título do Campo Extra <span className="text-xs text-muted-foreground font-normal">(padrão: Como funciona?)</span></Label>
                <Input
                  value={data.ticket_embed_how_it_works_title}
                  onChange={(e) => update("ticket_embed_how_it_works_title", e.target.value)}
                  placeholder="Como funciona?"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {resolveHowItWorksHeading(data.ticket_embed_how_it_works_title) || "Campo Extra"}{" "}
                  <span className="text-xs text-muted-foreground font-normal">(texto do campo)</span>
                </Label>
                <TextareaWithEmoji
                  value={data.ticket_embed_how_it_works}
                  onChange={(val) => update("ticket_embed_how_it_works", val)}
                  placeholder="Selecione uma opção no menu para direcionar melhor seu atendimento.\nA equipe será avisada e acompanhará tudo pelo canal criado."
                  rows={3}
                />
                <p className="text-[11px] text-muted-foreground">Aparece com o título acima dentro do modal, logo antes do seletor/botão (deixe o título vazio para mostrar só o texto).</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Texto do Botão <span className="text-xs text-muted-foreground font-normal">(quando sem categorias)</span></Label>
              <ButtonLabelWithEmoji
                value={data.ticket_embed_button_label}
                onChange={(val) => update("ticket_embed_button_label", val)}
                placeholder="Abrir Ticket"
              />
            </div>
            <div className="space-y-2">
              <Label>Footer</Label>
              <Input
                value={data.ticket_embed_footer}
                onChange={(e) => update("ticket_embed_footer", e.target.value)}
                placeholder="Nome da Loja #1K • 08/09/2026, 19:09"
              />
              <p className="text-[11px] text-muted-foreground">Aparece em itálico no rodapé do embed.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              Imagens & Aparência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-3.5 w-3.5" />
                Cor da Barra Lateral <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(data.ticket_embed_color) ? data.ticket_embed_color : "#242429"}
                  onChange={(e) => update("ticket_embed_color", e.target.value)}
                  className="h-10 w-12 rounded border border-border cursor-pointer bg-transparent"
                />
                <Input
                  value={data.ticket_embed_color}
                  onChange={(e) => update("ticket_embed_color", e.target.value)}
                  placeholder="Sem barra (Padrão V2)"
                  className="flex-1 font-mono"
                />
                {data.ticket_embed_color && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => update("ticket_embed_color", "")}
                    className="shrink-0 text-xs h-10"
                  >
                    Sem barra
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Deixe sem cor para manter a borda escura limpa (Padrão Components V2).</p>
            </div>
            <ImageUploadField
              label="Banner do Embed"
              value={data.ticket_embed_image_url}
              onChange={(url) => update("ticket_embed_image_url", url)}
              folder="ticket-embeds"
            />
            <p className="-mt-1 text-[11px] text-muted-foreground">Imagem grande exibida no topo do embed (ex: banner de suporte).</p>
            <ImageUploadField
              label="Thumbnail do Embed"
              value={data.ticket_embed_thumbnail_url}
              onChange={(url) => update("ticket_embed_thumbnail_url", url)}
              folder="ticket-embeds"
            />
            <p className="-mt-1 text-[11px] text-muted-foreground">Ícone/miniatura exibida no canto superior direito do embed.</p>
            <div className="space-y-2">
              <Label>📂 Categoria/Canal de Tickets</Label>
              <ChannelSelectWithCreate
                value={data.ticket_channel_id}
                onChange={(val) => update("ticket_channel_id", val)}
                channels={channels}
                categories={categories}
                onChannelCreated={fetchChannels}
                tenantId={tenantId}
                guildId={guildId}
                placeholder="Onde os tickets serão abertos"
              />
              <p className="text-xs text-muted-foreground">
                Os tickets criados serão organizados dentro desta categoria/canal
              </p>
            </div>
            <div className="space-y-2">
              <Label>📋 Canal de Logs de Tickets</Label>
              <ChannelSelectWithCreate
                value={data.ticket_logs_channel_id}
                onChange={(val) => update("ticket_logs_channel_id", val)}
                channels={channels}
                categories={categories}
                onChannelCreated={fetchChannels}
                tenantId={tenantId}
                guildId={guildId}
                placeholder="Onde ficam os logs quando fechados"
              />
              <p className="text-xs text-muted-foreground">
                Quando um ticket for fechado, o transcript será enviado neste canal
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" />
                Cargos de Staff (Gerenciar Tickets)
              </Label>
              {(() => {
                const selectedIds = data.ticket_staff_role_id ? data.ticket_staff_role_id.split(",").filter(Boolean) : [];
                const selectedCount = selectedIds.length;
                return (
                  <Popover open={staffRoleOpen} onOpenChange={setStaffRoleOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        <span className="truncate">
                          {selectedCount === 0
                            ? "Selecione os cargos..."
                            : `${selectedCount} cargo${selectedCount > 1 ? "s" : ""} selecionado${selectedCount > 1 ? "s" : ""}`}
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${staffRoleOpen ? "rotate-180" : ""}`} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                      <div className="space-y-1 max-h-52 overflow-y-auto">
                        {discordRoles.length === 0 && (
                          <p className="text-xs text-muted-foreground p-2">Nenhum cargo encontrado</p>
                        )}
                        {discordRoles.map((role) => {
                          const isSelected = selectedIds.includes(role.id);
                          const roleColor = typeof role.color === "string" ? role.color : `#${(role.color as number).toString(16).padStart(6, "0")}`;
                          return (
                            <label
                              key={role.id}
                              className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${isSelected ? "bg-primary/10" : "hover:bg-muted/50"}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  const ids = data.ticket_staff_role_id ? data.ticket_staff_role_id.split(",").filter(Boolean) : [];
                                  const newIds = isSelected ? ids.filter((id) => id !== role.id) : [...ids, role.id];
                                  update("ticket_staff_role_id", newIds.join(","));
                                }}
                                className="rounded border-border"
                              />
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: roleColor }} />
                              <span className="text-sm">{role.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })()}
              <p className="text-xs text-muted-foreground">
                Membros com qualquer um desses cargos poderão fechar, arquivar e deletar tickets
              </p>
            </div>
            <DiscordButtonStylePicker
              value={data.ticket_embed_button_style}
              onChange={(style) => update("ticket_embed_button_style", style)}
              label="Estilo do Botão"
            />
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || sending} className="flex-1 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || saving || !data.ticket_channel_id}
            variant="secondary"
            className="flex-1 gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar ao Canal
          </Button>
        </div>
      </div>

      {/* Discord Preview */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Pré-visualização do Discord</h3>
        <div className="rounded-lg bg-[#1a1b1e] p-4 space-y-2 font-sans">
          {(() => {
            const hasCategories = activeTicketCategoryCount > 0;
            const accentInt = parseTicketAccentColor(data.ticket_embed_color);
            const combinedBody = [data.ticket_embed_description, data.ticket_embed_how_it_works].filter(Boolean).join("\n");
            const autoPrompt = resolveTicketPromptLine(combinedBody, hasCategories);
            const cleanPreviewTitle = (data.ticket_embed_title || "").replace(/^#{1,3}\s+/, "").replace(/^\*\*(.*)\*\*$/, "$1");
            const parsedButton = parseEmojiFromLabel(data.ticket_embed_button_label || "Abrir Ticket");
            const descLines = parseTicketPreviewLines(data.ticket_embed_description || "");
            const howItWorksLines = parseTicketPreviewLines(data.ticket_embed_how_it_works || "");
            const howItWorksHeading = resolveHowItWorksHeading(data.ticket_embed_how_it_works_title);

            return (
              <div
                className="rounded-lg bg-[#242429] border border-[#34363c] p-3.5 space-y-3"
                style={accentInt !== undefined ? { borderLeftWidth: "4px", borderLeftColor: data.ticket_embed_color } : undefined}
              >
                {/* MediaGallery Banner inside Container */}
                {data.ticket_embed_image_url && (
                  <img
                    src={data.ticket_embed_image_url}
                    alt="Banner"
                    className="w-full max-h-44 object-cover rounded-lg block"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}

                {/* Title + Description + Optional Thumbnail Section */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2 min-w-0">
                    {cleanPreviewTitle && (
                      <p className="font-bold text-white text-[15px] leading-snug tracking-tight">{cleanPreviewTitle}</p>
                    )}

                    {data.ticket_embed_description && (
                      <div className="space-y-1.5">
                        {renderPreviewLines(descLines, "desc")}
                      </div>
                    )}

                    {data.ticket_embed_how_it_works && (
                      <div className="pt-1.5 space-y-1">
                        {howItWorksHeading && (
                          <p className="text-white text-[13px] font-semibold">{howItWorksHeading}</p>
                        )}
                        {renderPreviewLines(howItWorksLines, "how")}
                      </div>
                    )}

                    {autoPrompt && (
                      <p className="text-[#dbdee1] text-[13px] pt-1">{autoPrompt}</p>
                    )}

                    {data.ticket_embed_footer && (
                      <p className="text-[#949ba4] text-[11px] pt-0.5">{data.ticket_embed_footer}</p>
                    )}
                  </div>

                  {data.ticket_embed_thumbnail_url && (
                    <img
                      src={data.ticket_embed_thumbnail_url}
                      alt="Thumbnail"
                      className="w-16 h-16 object-cover rounded-lg shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                </div>

                {/* Separator (type 14) inside Container */}
                <div className="border-t border-[#34363c]" />

                {/* Interactive ActionRow inside Container */}
                {hasCategories ? (
                  <div className="w-full flex items-center justify-between bg-[#1e1f22] border border-[#383a40] hover:border-[#4e5058] rounded-md px-3 py-2.5 text-[#dbdee1] text-[13px] cursor-default">
                    <span className="truncate">{TICKET_SELECT_PLACEHOLDER}</span>
                    <ChevronDown className="h-4 w-4 text-[#b5bac1] shrink-0 ml-2" />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <div
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium cursor-default ${getDiscordButtonStyles(data.ticket_embed_button_style)}`}
                    >
                      <span>{parsedButton.emoji && !parsedButton.isCustom ? parsedButton.emoji : "📩"}</span>
                      <span>{parsedButton.cleanLabel || "Abrir Ticket"}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Action buttons inside ticket preview */}
          <div className="mt-2 pt-2 border-t border-[#34363c]">
            <p className="text-[10px] text-[#949ba4] mb-2">
              {activeTicketCategoryCount > 0
                ? `${activeTicketCategoryCount} categoria(s) ativa(s) no seletor • Botões internos do ticket:`
                : "Sem categorias cadastradas (exibindo botão) • Botões internos do ticket:"}
            </p>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#4f545c] text-[#dbdee1]">🔔 Lembrar</div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#4f545c] text-[#dbdee1]">✏️ Renomear</div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#4f545c] text-[#dbdee1]">📁 Arquivar</div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#ed4245] text-white">🗑️ Deletar</div>
            </div>
          </div>
        </div>
      </div>
      {/* Save Preset Dialog */}
      <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
        <DialogContent className="sm:max-w-sm bg-sidebar border-border">
          <DialogHeader>
            <DialogTitle>Salvar Preset de Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nome do Preset</Label>
              <Input
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="Ex: Suporte Padrão, Ticket VIP..."
                className="bg-background border-border"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Salva todas as configurações atuais (textos, cores, imagens, botão) para uso futuro.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSavePresetOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSavePreset} disabled={savingPreset || !presetName.trim()}>
                {savingPreset && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Preset Dialog */}
      <Dialog open={loadPresetOpen} onOpenChange={setLoadPresetOpen}>
        <DialogContent className="sm:max-w-md bg-sidebar border-border">
          <DialogHeader>
            <DialogTitle>Presets Salvos</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2 max-h-[400px] overflow-y-auto">
            {presets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum preset salvo ainda. Salve a configuração atual para criar um.
              </p>
            ) : (
              presets.map(preset => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors"
                >
                  <button className="flex-1 text-left" onClick={() => loadPreset(preset)}>
                    <p className="text-sm font-medium">{preset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(preset.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deletePreset(preset.id)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TicketEmbedConfig;
