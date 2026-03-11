import { useState, useEffect, useCallback } from "react";
import { Send, Loader2, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";

interface DiscordChannel {
  id: string;
  name: string;
  parent_id: string | null;
}

interface PostMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    compare_price_cents?: number | null;
    icon_url?: string | null;
    banner_url?: string | null;
    auto_delivery?: boolean;
  };
}

export const PostMessageModal = ({
  open,
  onOpenChange,
  product,
}: PostMessageModalProps) => {
  const { tenant, tenantId } = useTenant();
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [posting, setPosting] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");
  const [embedColor, setEmbedColor] = useState<string>("#5865F2");

  const guildId = tenant?.discord_guild_id;

  const fetchChannels = useCallback(async () => {
    if (!guildId) return;
    setLoadingChannels(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-channels", {
        body: { guild_id: guildId },
      });
      if (!error && data?.channels) {
        setChannels(data.channels);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingChannels(false);
    }
  }, [guildId]);

  useEffect(() => {
    if (open) fetchChannels();
  }, [open, fetchChannels]);

  const handlePost = async () => {
    if (!selectedChannel || !guildId) {
      toast({ title: "Selecione um canal", variant: "destructive" });
      return;
    }

    setPosting(true);
    try {
      const autoDeliveryLine = product.auto_delivery ? "⚡ **Entrega Automática!**\n\n" : "";
      const embed: Record<string, any> = {
        title: `${product.name}`,
        description: `${autoDeliveryLine}${product.description || ""}`,
        color: 0x2B2D31,
        fields: [
          ...(product.compare_price_cents && product.compare_price_cents > product.price_cents
            ? [
                {
                  name: "~~Preço original~~",
                  value: `~~R$ ${(product.compare_price_cents / 100).toFixed(2).replace(".", ",")}~~`,
                  inline: true,
                },
                {
                  name: "🔥 Preço promocional",
                  value: `**R$ ${(product.price_cents / 100).toFixed(2).replace(".", ",")}**`,
                  inline: true,
                },
              ]
            : [
                {
                  name: "Valor à vista",
                  value: `R$ ${(product.price_cents / 100).toFixed(2).replace(".", ",")}`,
                  inline: true,
                },
              ]),
        ],
        footer: {
          text: `Servidor de ${tenant?.name} • ${new Date().toLocaleString("pt-BR")}`,
        },
      };

      if (product.banner_url) {
        embed.image = { url: product.banner_url };
      }

      if (product.icon_url) {
        embed.thumbnail = { url: product.icon_url };
      }

      const { data, error } = await supabase.functions.invoke("send-webhook-message", {
        body: {
          tenant_id: tenant?.id,
          channel_id: selectedChannel,
          embeds: [embed],
          content: "",
          product_id: product.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Mensagem postada no Discord! ✅" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao postar", description: err.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(channelSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Postar Mensagem</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-bold">Canal</Label>
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Selecione um canal..." />
              </SelectTrigger>
              <SelectContent>
                <div className="flex items-center gap-2 px-2 pb-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar"
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    className="h-8 bg-muted border-none text-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchChannels();
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingChannels ? "animate-spin" : ""}`} />
                  </button>
                </div>
                {filteredChannels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    {ch.name}
                  </SelectItem>
                ))}
                {filteredChannels.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-3">
                    Nenhum canal encontrado
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handlePost}
            disabled={posting || !selectedChannel}
            className="gap-2"
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Postar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
