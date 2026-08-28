import { useState, useEffect } from "react";
import { Loader2, Save, LayoutTemplate, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import EmbedForm from "@/components/customization/EmbedForm";
import EmbedPreview from "@/components/customization/EmbedPreview";
import { defaultEmbed, type EmbedData } from "@/components/customization/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ChannelEmbedsTabProps {
  configs: any[];
  refetchConfigs: () => void;
  channelSections: any[];
}

export default function ChannelEmbedsTab({ configs, refetchConfigs, channelSections }: ChannelEmbedsTabProps) {
  const { tenantId } = useTenant();
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [embed, setEmbed] = useState<EmbedData>({ ...defaultEmbed });
  const [content, setContent] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Group channels for select
  const channelGroups = channelSections.map(section => ({
    label: section.title,
    channels: section.channels
  }));

  const getDefaultContent = (key: string) => {
    switch (key) {
      case "welcome": return "{user}";
      case "member_leave": return "";
      case "logs_sales": return "";
      default: return "";
    }
  };

  const getFactoryEmbed = (key: string): Partial<EmbedData> => {
    switch (key) {
      case "welcome":
        return {
          color: "#FF1493",
          title: "Bem-vindo(a)! 🎉",
          description: "Olá {username}, ficamos felizes em ter você aqui no **{server}**!\n\nVocê é o nosso membro de número **{memberCount}**.",
          footer_text: "Aproveite sua estadia!",
          timestamp: true,
          // Use a generic placeholder or leaving it blank, the bot injects DRIKA_COVER automatically, 
          // but we can put the user's bot_banner_url or a placeholder here so they see it.
          // Wait, we don't have bot_banner_url in this component context directly, but we can just say "Imagem Padrão do Bot".
          // Actually, leaving image_url blank will render without image, but they want it to look like Image 2.
          // Let's set a placeholder image URL for the preview.
          image_url: "https://krudxivcuygykoswjbbx.supabase.co/storage/v1/object/public/tenant-assets/drika-placeholder-banner.png" 
        };
      case "member_leave":
        return {
          color: "#ED4245",
          title: "Membro Saiu",
          description: "O membro **{username}** saiu do servidor.",
          footer_text: "Sentiremos saudades!",
          timestamp: true,
        };
      case "logs_sales":
        return {
          color: "#57F287",
          title: "Compra Confirmada ✅",
          description: "O pedido de **{username}** foi aprovado com sucesso!",
          fields: [
            { id: "1", name: "Produto", value: "{product_name}", inline: true },
            { id: "2", name: "Valor", value: "R$ {price}", inline: true }
          ],
          timestamp: true,
        };
      default:
        return {};
    }
  };

  // When selected key changes, load its config
  useEffect(() => {
    if (!selectedKey) {
      setEmbed({ ...defaultEmbed });
      setContent("");
      return;
    }

    const config = configs.find(c => c.channel_key === selectedKey);
    if (config?.embed_config) {
      // Merge with default to ensure all properties exist
      setEmbed({ ...defaultEmbed, ...config.embed_config });
    } else {
      // Apply factory defaults for the specific channel
      setEmbed({ ...defaultEmbed, ...getFactoryEmbed(selectedKey) });
    }
    
    setContent(config?.content !== undefined && config?.content !== null ? config.content : getDefaultContent(selectedKey));
  }, [selectedKey, configs]);

  const handleSave = async () => {
    if (!tenantId || !selectedKey) return;
    
    const config = configs.find(c => c.channel_key === selectedKey);
    
    setSaving(true);
    try {
      // If config doesn't exist, we just pass discord_channel_id as null, manage-channel-configs will create it
      const payload = {
        [selectedKey]: {
          discord_channel_id: config?.discord_channel_id || null,
          embed_config: embed,
          content: content
        }
      };

      const { data, error } = await supabase.functions.invoke("manage-channel-configs", {
        body: { tenant_id: tenantId, channels: payload },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Embed salvo com sucesso! ✅" });
      refetchConfigs();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefault = () => {
    setEmbed({ ...defaultEmbed, ...getFactoryEmbed(selectedKey) });
    setContent(getDefaultContent(selectedKey));
    toast({ title: "Preview restaurado para o padrão de fábrica. Clique em Salvar para confirmar." });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="space-y-2 flex-1">
          <Label>Selecione um canal para personalizar</Label>
          <Select value={selectedKey} onValueChange={setSelectedKey}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolha um log ou canal..." />
            </SelectTrigger>
            <SelectContent>
              {channelGroups.map(group => (
                <SelectGroup key={group.label}>
                  <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </SelectLabel>
                  {group.channels.map((ch: any) => (
                    <SelectItem key={ch.key} value={ch.key}>
                      {ch.label} ({ch.description})
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRestoreDefault} disabled={saving || !selectedKey} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Restaurar Padrão
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedKey} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      {!selectedKey ? (
        <div className="flex flex-col items-center justify-center p-12 border rounded-xl bg-background/50 text-muted-foreground">
          <LayoutTemplate className="h-12 w-12 mb-4 opacity-20" />
          <p>Selecione um canal acima para personalizar o visual das mensagens.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-2">
              <Label>Texto da Mensagem (Fora do Embed)</Label>
              <Input 
                placeholder="Ex: {user} acaba de comprar! ou deixe em branco..." 
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Variáveis suportadas dependem do tipo de evento (ex: {'{user}'}, {'{server}'}).
              </p>
            </div>
            
            <EmbedForm embed={embed} onChange={setEmbed} hideFields hideButtons />
          </div>

          <div className="sticky top-6 h-fit max-h-[800px] overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-medium">Preview</h3>
            </div>
            <EmbedPreview embed={embed} content={content} />
          </div>
        </div>
      )}
    </div>
  );
}
