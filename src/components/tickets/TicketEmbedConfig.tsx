import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Palette, Type, Image, MessageSquare, Send, Undo2 } from "lucide-react";
import ImageUploadField from "@/components/customization/ImageUploadField";
import ChannelSelectWithCreate from "@/components/channels/ChannelSelectWithCreate";
import { DiscordButtonStylePicker, getDiscordButtonStyles, type DiscordButtonStyle } from "@/components/discord/DiscordButtonStylePicker";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { useLocalDraft } from "@/hooks/useLocalDraft";

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
};

const TicketEmbedConfig = () => {
  const { tenantId, tenant } = useTenant();
  const [data, setData] = useState<TicketEmbedData>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [channels, setChannels] = useState<{ id: string; name: string; parent_id?: string | null }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; position: number }[]>([]);

  const guildId = tenant?.discord_guild_id || null;

  const fetchChannels = useCallback(async () => {
    if (!guildId && !tenantId) return;
    try {
      const { data: res } = await supabase.functions.invoke("discord-channels", {
        body: guildId ? { guild_id: guildId } : { tenant_id: tenantId },
      });
      if (res) {
        // Edge function already returns pre-filtered channels and categories
        if (res.categories) {
          setCategories(res.categories);
        }
        if (res.channels) {
          setChannels(res.channels);
        }
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
      const { data: config } = await supabase
        .from("store_configs")
        .select("ticket_embed_title, ticket_embed_description, ticket_embed_color, ticket_embed_image_url, ticket_embed_thumbnail_url, ticket_embed_footer, ticket_embed_button_label, ticket_embed_button_style, ticket_channel_id, ticket_logs_channel_id")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (config) {
        setData({
          ticket_embed_title: config.ticket_embed_title || defaults.ticket_embed_title,
          ticket_embed_description: config.ticket_embed_description || defaults.ticket_embed_description,
          ticket_embed_color: config.ticket_embed_color || defaults.ticket_embed_color,
          ticket_embed_image_url: config.ticket_embed_image_url || "",
          ticket_embed_thumbnail_url: config.ticket_embed_thumbnail_url || "",
          ticket_embed_footer: config.ticket_embed_footer || "",
          ticket_embed_button_label: config.ticket_embed_button_label || defaults.ticket_embed_button_label,
          ticket_embed_button_style: (config.ticket_embed_button_style as DiscordButtonStyle) || defaults.ticket_embed_button_style,
          ticket_channel_id: config.ticket_channel_id || "",
          ticket_logs_channel_id: (config as any).ticket_logs_channel_id || "",
        });
      }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("store_configs")
        .update({
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
          updated_at: new Date().toISOString(),
        } as any)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("Configuração do ticket salva!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!tenantId || !data.ticket_channel_id) {
      toast.error("Selecione um canal antes de enviar.");
      return;
    }
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
              <div className="mt-3">
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
        </div>
      </div>
    </div>
  );
};

export default TicketEmbedConfig;
