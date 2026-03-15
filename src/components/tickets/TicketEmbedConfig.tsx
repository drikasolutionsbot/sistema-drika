import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Palette, Type, Image, MessageSquare, Send, Undo2, Shield, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ImageUploadField from "@/components/customization/ImageUploadField";
import ChannelSelectWithCreate from "@/components/channels/ChannelSelectWithCreate";
import { DiscordButtonStylePicker, getDiscordButtonStyles, type DiscordButtonStyle } from "@/components/discord/DiscordButtonStylePicker";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { useDiscordRoles } from "@/hooks/useDiscordRoles";

interface TicketEmbedData {
  ticket_embed_title: string;
  ticket_embed_description: string;
  ticket_embed_color: string;
  ticket_embed_image_url: string;
  ticket_embed_thumbnail_url: string;
  ticket_embed_footer: string;
  ticket_embed_button_label: string;
  ticket_embed_button_style: DiscordButtonStyle;
  ticket_channel_id: string;
  ticket_logs_channel_id: string;
  ticket_staff_role_id: string; // comma-separated role IDs
}

const defaults: TicketEmbedData = {
  ticket_embed_title: "🎫 Ticket de Suporte",
  ticket_embed_description: "Seu ticket foi criado com sucesso! Aguarde atendimento.",
  ticket_embed_color: "#5865F2",
  ticket_embed_image_url: "",
  ticket_embed_thumbnail_url: "",
  ticket_embed_footer: "",
  ticket_embed_button_label: "📩 Abrir Ticket",
  ticket_embed_button_style: "glass",
  ticket_channel_id: "",
  ticket_logs_channel_id: "",
  ticket_staff_role_id: "",
};

const TicketEmbedConfig = () => {
  const { tenantId, tenant } = useTenant();
  const [serverData, setServerData] = useState<TicketEmbedData>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [staffRoleOpen, setStaffRoleOpen] = useState(false);
  const [channels, setChannels] = useState<{ id: string; name: string; parent_id?: string | null }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; position: number }[]>([]);
  const { roles: discordRoles, loading: rolesLoading } = useDiscordRoles();

  const { draft: data, setDraft: setData, clearDraft, hasDraft, discardDraft } = useLocalDraft<TicketEmbedData>(
    "ticket-embed",
    tenantId,
    serverData,
    !loading
  );

  const guildId = tenant?.discord_guild_id || null;

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
      const { data: config } = await (supabase as any)
        .from("store_configs")
        .select("ticket_embed_title, ticket_embed_description, ticket_embed_color, ticket_embed_image_url, ticket_embed_thumbnail_url, ticket_embed_footer, ticket_embed_button_label, ticket_embed_button_style, ticket_channel_id, ticket_logs_channel_id, ticket_staff_role_id")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (config) {
        const loaded: TicketEmbedData = {
          ticket_embed_title: config.ticket_embed_title || defaults.ticket_embed_title,
          ticket_embed_description: config.ticket_embed_description || defaults.ticket_embed_description,
          ticket_embed_color: config.ticket_embed_color || defaults.ticket_embed_color,
          ticket_embed_image_url: config.ticket_embed_image_url || "",
          ticket_embed_thumbnail_url: config.ticket_embed_thumbnail_url || "",
          ticket_embed_footer: config.ticket_embed_footer || "",
          ticket_embed_button_label: config.ticket_embed_button_label || defaults.ticket_embed_button_label,
          ticket_embed_button_style: (config.ticket_embed_button_style as DiscordButtonStyle) || defaults.ticket_embed_button_style,
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
        ticket_embed_color: data.ticket_embed_color || "#5865F2",
        ticket_embed_image_url: data.ticket_embed_image_url || null,
        ticket_embed_thumbnail_url: data.ticket_embed_thumbnail_url || null,
        ticket_embed_footer: data.ticket_embed_footer || null,
        ticket_embed_button_label: data.ticket_embed_button_label || null,
        ticket_embed_button_style: data.ticket_embed_button_style || "glass",
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
        ticket_embed_color: savedConfig?.ticket_embed_color || data.ticket_embed_color,
        ticket_embed_image_url: savedConfig?.ticket_embed_image_url || data.ticket_embed_image_url,
        ticket_embed_thumbnail_url: savedConfig?.ticket_embed_thumbnail_url || data.ticket_embed_thumbnail_url,
        ticket_embed_footer: savedConfig?.ticket_embed_footer || data.ticket_embed_footer,
        ticket_embed_button_label: savedConfig?.ticket_embed_button_label || data.ticket_embed_button_label,
        ticket_embed_button_style: (savedConfig?.ticket_embed_button_style as DiscordButtonStyle) || data.ticket_embed_button_style,
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
        },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      toast.success(res?.edited ? "Embed de ticket atualizado no canal!" : "Embed de ticket enviado ao canal!");
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" />
              Textos do Embed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Título do Embed</Label>
              <Input
                value={data.ticket_embed_title}
                onChange={(e) => update("ticket_embed_title", e.target.value)}
                placeholder="🎫 Ticket de Suporte"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={data.ticket_embed_description}
                onChange={(e) => update("ticket_embed_description", e.target.value)}
                placeholder="Seu ticket foi criado com sucesso!"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: {"{user}"} {"{product}"} {"{ticket_id}"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Texto do Botão</Label>
              <Input
                value={data.ticket_embed_button_label}
                onChange={(e) => update("ticket_embed_button_label", e.target.value)}
                placeholder="📩 Abrir Ticket"
              />
            </div>
            <div className="space-y-2">
              <Label>Footer</Label>
              <Input
                value={data.ticket_embed_footer}
                onChange={(e) => update("ticket_embed_footer", e.target.value)}
                placeholder="Texto do rodapé (opcional)"
              />
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
                Cor do Embed
              </Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={data.ticket_embed_color}
                  onChange={(e) => update("ticket_embed_color", e.target.value)}
                  className="h-10 w-12 rounded border border-border cursor-pointer bg-transparent"
                />
                <Input
                  value={data.ticket_embed_color}
                  onChange={(e) => update("ticket_embed_color", e.target.value)}
                  placeholder="#5865F2"
                  className="flex-1 font-mono"
                />
              </div>
            </div>
            <ImageUploadField
              label="Imagem do Embed"
              value={data.ticket_embed_image_url}
              onChange={(url) => update("ticket_embed_image_url", url)}
              folder="ticket-embeds"
            />
            <ImageUploadField
              label="Thumbnail do Embed"
              value={data.ticket_embed_thumbnail_url}
              onChange={(url) => update("ticket_embed_thumbnail_url", url)}
              folder="ticket-embeds"
            />
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
        <div className="rounded-lg bg-[#313338] p-4">
          <div className="flex gap-3">
            {/* Embed border */}
            <div
              className="w-1 rounded-full shrink-0"
              style={{ backgroundColor: data.ticket_embed_color || "#5865F2" }}
            />
            <div className="flex-1 min-w-0 space-y-2">
              {/* Title */}
              {data.ticket_embed_title && (
                <p className="font-semibold text-white text-sm">
                  {data.ticket_embed_title}
                </p>
              )}
              {/* Description */}
              {data.ticket_embed_description && (
                <p className="text-[#dbdee1] text-[13px] whitespace-pre-wrap">
                  {data.ticket_embed_description}
                </p>
              )}
              {/* Image */}
              {data.ticket_embed_image_url && (
                <img
                  src={data.ticket_embed_image_url}
                  alt="Embed"
                  className="rounded max-h-48 mt-2"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              {/* Footer */}
              {data.ticket_embed_footer && (
                <p className="text-[#a3a6aa] text-[11px] mt-2 pt-2 border-t border-[#3f4147]">
                  {data.ticket_embed_footer}
                </p>
              )}
            </div>
            {/* Thumbnail */}
            {data.ticket_embed_thumbnail_url && (
              <img
                src={data.ticket_embed_thumbnail_url}
                alt="Thumb"
                className="w-16 h-16 rounded object-cover shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
          </div>
          {/* Button */}
          {data.ticket_embed_button_label && (() => {
            const btnStyle = getDiscordButtonStyles(data.ticket_embed_button_style);
            const isGlass = data.ticket_embed_button_style === "glass";
            const isLink = data.ticket_embed_button_style === "link";
            return (
              <div className="mt-3 flex flex-wrap gap-2">
                <div
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium ${
                    isGlass ? "bg-white/5 backdrop-blur-md border border-white/10 shadow-lg text-[#dbdee1]" :
                    isLink ? "bg-transparent underline" : ""
                  }`}
                  style={{
                    backgroundColor: isGlass || isLink ? undefined : btnStyle.bgColor,
                    color: isGlass ? undefined : btnStyle.textColor,
                  }}
                >
                  {data.ticket_embed_button_label}
                </div>
              </div>
            );
          })()}
          {/* Action buttons preview (inside ticket) */}
          <div className="mt-2 pt-2 border-t border-[#3f4147]">
            <p className="text-[10px] text-[#a3a6aa] mb-2">Botões dentro do ticket:</p>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#5865F2] text-white">
                🕐 Lembrar
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#4f545c] text-[#dbdee1]">
                ✏️ Renomear
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#ed4245] text-white">
                🔒 Fechar Ticket
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketEmbedConfig;
