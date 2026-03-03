import { useState, useEffect, useCallback } from "react";
import { Hash, Shield, Users, Volume2, Plus, Loader2, RefreshCw, Megaphone, Mic, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTenantQuery } from "@/hooks/useSupabaseQuery";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const channelSections = [
  {
    title: "Sistema",
    description: "Canais para logs do sistema e operações",
    channels: [
      { key: "logs_system", label: "Sistema" },
      { key: "logs_commands", label: "Comandos" },
    ],
  },
  {
    title: "Loja",
    description: "Canais relacionados a transações e compras",
    channels: [
      { key: "logs_sales", label: "Compras" },
      { key: "logs_events", label: "Eventos de Compras" },
      { key: "logs_feedback", label: "Feedback" },
    ],
  },
  {
    title: "Membros",
    description: "Canais para logs de atividades dos membros",
    channels: [
      { key: "welcome", label: "Boas-vindas" },
      { key: "member_join", label: "Entrada" },
      { key: "member_leave", label: "Saída" },
      { key: "member_messages", label: "Mensagens" },
      { key: "traffic", label: "Tráfego" },
    ],
  },
  {
    title: "Moderação",
    description: "Canais para logs de ações de moderação",
    channels: [
      { key: "logs_moderation_bans", label: "Bans" },
      { key: "logs_moderation_kicks", label: "Kicks" },
      { key: "logs_moderation_timeouts", label: "Timeouts" },
    ],
  },
  {
    title: "Cargos",
    description: "Canais para logs de gerenciamento de cargos",
    channels: [
      { key: "logs_roles_added", label: "Cargos Adicionados" },
      { key: "logs_roles_removed", label: "Cargos Removidos" },
      { key: "logs_roles_created", label: "Cargos Criados" },
      { key: "logs_roles_deleted", label: "Cargos Deletados" },
      { key: "logs_roles_edited", label: "Cargos Editados" },
    ],
  },
  {
    title: "Canais",
    description: "Canais para logs de gerenciamento de canais",
    channels: [
      { key: "logs_channels_created", label: "Canais Criados" },
      { key: "logs_channels_edited", label: "Canais Editados" },
      { key: "logs_channels_deleted", label: "Canais Deletados" },
    ],
  },
  {
    title: "Permissões",
    description: "Canais para logs de gerenciamento de permissões",
    channels: [
      { key: "logs_perms_added", label: "Permissões Adicionadas" },
      { key: "logs_perms_removed", label: "Permissões Removidas" },
    ],
  },
  {
    title: "Suporte",
    description: "Canais para logs de suporte e tickets",
    channels: [
      { key: "logs_tickets_opened", label: "Tickets Abertos" },
      { key: "logs_tickets_closed", label: "Tickets Fechados" },
    ],
  },
];

interface ChannelConfig {
  id: string;
  channel_key: string;
  discord_channel_id: string | null;
}

interface DiscordChannel {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
}

interface DiscordCategory {
  id: string;
  name: string;
  position: number;
}

const CHANNEL_TYPE_OPTIONS = [
  { value: "text", label: "Texto", icon: Hash },
  { value: "voice", label: "Voz", icon: Mic },
  { value: "category", label: "Categoria", icon: MessageSquare },
  { value: "announcement", label: "Anúncio", icon: Megaphone },
];

const ChannelsPage = () => {
  const { tenant, tenantId } = useTenant();
  const { data: configs = [], isLoading, refetch } = useTenantQuery<ChannelConfig>("channel-configs", "channel_configs");

  const [discordChannels, setDiscordChannels] = useState<DiscordChannel[]>([]);
  const [discordCategories, setDiscordCategories] = useState<DiscordCategory[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("text");
  const [newParent, setNewParent] = useState<string>("");
  const [newTopic, setNewTopic] = useState("");

  const guildId = tenant?.discord_guild_id;

  const fetchDiscordChannels = useCallback(async () => {
    if (!guildId) return;
    setLoadingChannels(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-channels", {
        body: { guild_id: guildId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDiscordChannels(data.channels || []);
      setDiscordCategories(data.categories || []);
    } catch (err: any) {
      console.error("Failed to fetch channels:", err);
    } finally {
      setLoadingChannels(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchDiscordChannels();
  }, [fetchDiscordChannels]);

  const getChannelValue = (key: string) => {
    const cfg = configs.find(c => c.channel_key === key);
    return cfg?.discord_channel_id || undefined;
  };

  const handleChange = async (channelKey: string, discordChannelId: string) => {
    if (!tenantId) return;
    const existing = configs.find(c => c.channel_key === channelKey);
    if (existing) {
      await (supabase as any).from("channel_configs").update({ discord_channel_id: discordChannelId }).eq("id", existing.id);
    } else {
      await (supabase as any).from("channel_configs").insert({ tenant_id: tenantId, channel_key: channelKey, discord_channel_id: discordChannelId });
    }
    refetch();
    toast({ title: "Canal atualizado" });
  };

  const handleCreate = async () => {
    if (!guildId || !newName.trim()) {
      toast({ title: "Preencha o nome do canal", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-discord-channel", {
        body: {
          guild_id: guildId,
          name: newName.trim(),
          type: newType,
          parent_id: newParent || undefined,
          topic: newTopic.trim() || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Canal criado no Discord! ✅",
        description: `#${data.channel?.name} foi adicionado ao servidor.`,
      });

      setNewName("");
      setNewType("text");
      setNewParent("");
      setNewTopic("");
      setCreateOpen(false);

      // Refresh channel list
      await fetchDiscordChannels();
    } catch (err: any) {
      toast({
        title: "Erro ao criar canal",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const getChannelCategory = (parentId: string | null) => {
    if (!parentId) return null;
    return discordCategories.find(c => c.id === parentId);
  };

  // Group channels by category
  const channelsByCategory = discordCategories.map(cat => ({
    category: cat,
    channels: discordChannels.filter(ch => ch.parent_id === cat.id),
  }));
  const uncategorized = discordChannels.filter(ch => !ch.parent_id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Canais</h1>
          <p className="text-muted-foreground">
            Configure os canais da <span className="font-semibold text-foreground">{tenant?.name || "sua loja"}</span> para logs e notificações
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={fetchDiscordChannels}
            disabled={loadingChannels}
          >
            {loadingChannels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setCreateOpen(true)}
            disabled={!guildId}
          >
            <Plus className="h-4 w-4" />
            Criar Canal
          </Button>
        </div>
      </div>

      {/* Channel config mapping */}
      {isLoading ? (
        <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <div className="space-y-8">
          {channelSections.map((section) => (
            <div key={section.title} className="border-l-2 border-primary pl-5">
              <h2 className="font-display text-lg font-bold text-foreground">{section.title}</h2>
              <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.channels.map((ch) => (
                  <div key={ch.key} className="space-y-1.5">
                    <span className="text-sm font-medium text-foreground">{ch.label}</span>
                    <Select value={getChannelValue(ch.key)} onValueChange={(v) => handleChange(ch.key, v)}>
                      <SelectTrigger className="bg-muted/50 border-border h-10">
                        <SelectValue placeholder="Não configurado" />
                      </SelectTrigger>
                      <SelectContent>
                        {discordChannels.length > 0 ? (
                          discordChannels.map(dc => (
                            <SelectItem key={dc.id} value={dc.id}>
                              # {dc.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="placeholder" disabled>Sincronize os canais primeiro</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create channel dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Canal no Discord</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do canal</Label>
              <Input
                placeholder="logs-vendas"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Será convertido para minúsculas com hifens</p>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-3.5 w-3.5" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newType !== "category" && discordCategories.length > 0 && (
              <div className="space-y-2">
                <Label>Categoria (opcional)</Label>
                <Select value={newParent} onValueChange={setNewParent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {discordCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(newType === "text" || newType === "announcement") && (
              <div className="space-y-2">
                <Label>Tópico (opcional)</Label>
                <Input
                  placeholder="Descrição do canal..."
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  maxLength={1024}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar no Discord
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChannelsPage;
