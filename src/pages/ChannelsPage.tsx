import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Hash, Shield, Users, Volume2, Plus, Loader2, RefreshCw, Megaphone, Mic,
  MessageSquare, Save, Settings2, ShoppingBag, UserCheck, Gavel, Tag,
  Layers, Lock, LifeBuoy, ChevronDown, ChevronRight, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTenantQuery } from "@/hooks/useSupabaseQuery";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

const channelSections = [
  {
    title: "Sistema",
    description: "Logs do sistema e operações internas",
    icon: Settings2,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    channels: [
      { key: "logs_system", label: "Sistema", description: "Logs gerais do bot" },
      { key: "logs_commands", label: "Comandos", description: "Uso de comandos" },
    ],
  },
  {
    title: "Loja",
    description: "Transações, compras e feedback",
    icon: ShoppingBag,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    channels: [
      { key: "logs_sales", label: "Compras", description: "Registro de vendas" },
      { key: "logs_events", label: "Eventos de Compras", description: "Ações durante compra" },
      { key: "logs_feedback", label: "Feedback", description: "Avaliações de clientes" },
    ],
  },
  {
    title: "Membros",
    description: "Atividades e movimentação de membros",
    icon: Users,
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    channels: [
      { key: "welcome", label: "Boas-vindas", description: "Mensagem de boas-vindas" },
      { key: "member_join", label: "Entrada", description: "Novos membros" },
      { key: "member_leave", label: "Saída", description: "Membros que saíram" },
      { key: "member_messages", label: "Mensagens", description: "Atividade de mensagens" },
      { key: "traffic", label: "Tráfego", description: "Fluxo de membros" },
    ],
  },
  {
    title: "Moderação",
    description: "Ações de moderação e punições",
    icon: Gavel,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    channels: [
      { key: "logs_moderation_bans", label: "Bans", description: "Banimentos aplicados" },
      { key: "logs_moderation_kicks", label: "Kicks", description: "Expulsões aplicadas" },
      { key: "logs_moderation_timeouts", label: "Timeouts", description: "Silenciamentos" },
    ],
  },
  {
    title: "Cargos",
    description: "Gerenciamento de cargos do servidor",
    icon: Tag,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    channels: [
      { key: "logs_roles_added", label: "Adicionados", description: "Cargos dados a membros" },
      { key: "logs_roles_removed", label: "Removidos", description: "Cargos removidos de membros" },
      { key: "logs_roles_created", label: "Criados", description: "Novos cargos criados" },
      { key: "logs_roles_deleted", label: "Deletados", description: "Cargos excluídos" },
      { key: "logs_roles_edited", label: "Editados", description: "Cargos modificados" },
    ],
  },
  {
    title: "Canais",
    description: "Gerenciamento de canais do servidor",
    icon: Layers,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    channels: [
      { key: "logs_channels_created", label: "Criados", description: "Novos canais criados" },
      { key: "logs_channels_edited", label: "Editados", description: "Canais modificados" },
      { key: "logs_channels_deleted", label: "Deletados", description: "Canais excluídos" },
    ],
  },
  {
    title: "Permissões",
    description: "Alterações de permissões",
    icon: Lock,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    channels: [
      { key: "logs_perms_added", label: "Adicionadas", description: "Permissões concedidas" },
      { key: "logs_perms_removed", label: "Removidas", description: "Permissões revogadas" },
    ],
  },
  {
    title: "Suporte",
    description: "Tickets e atendimento",
    icon: LifeBuoy,
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    channels: [
      { key: "logs_tickets_opened", label: "Tickets Abertos", description: "Novos tickets" },
      { key: "logs_tickets_closed", label: "Tickets Fechados", description: "Tickets encerrados" },
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
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    channelSections.forEach(s => { initial[s.title] = true; });
    return initial;
  });

  useEffect(() => {
    const initial: Record<string, string> = {};
    configs.forEach(c => {
      if (c.discord_channel_id) initial[c.channel_key] = c.discord_channel_id;
    });
    setDraft(initial);
  }, [configs]);

  const hasChanges = useMemo(() => {
    const allKeys = new Set([
      ...Object.keys(draft),
      ...configs.map(c => c.channel_key),
    ]);
    for (const key of allKeys) {
      const savedVal = configs.find(c => c.channel_key === key)?.discord_channel_id || "";
      const draftVal = draft[key] || "";
      if (savedVal !== draftVal) return true;
    }
    return false;
  }, [draft, configs]);

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

  const getChannelValue = (key: string) => draft[key] || undefined;

  const getChannelName = (discordId: string) => {
    const ch = discordChannels.find(c => c.id === discordId);
    return ch ? `#${ch.name}` : null;
  };

  const handleLocalChange = (channelKey: string, discordChannelId: string) => {
    if (discordChannelId === "__clear__") {
      setDraft(prev => {
        const next = { ...prev };
        delete next[channelKey];
        return next;
      });
    } else {
      setDraft(prev => ({ ...prev, [channelKey]: discordChannelId }));
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const allKeys = channelSections.flatMap(s => s.channels.map(c => c.key));
      const channels: Record<string, string | null> = {};
      for (const key of allKeys) {
        const draftVal = draft[key] || null;
        const savedVal = configs.find(c => c.channel_key === key)?.discord_channel_id || null;
        if (draftVal !== savedVal) {
          channels[key] = draftVal;
        }
      }

      if (Object.keys(channels).length > 0) {
        const { data, error } = await supabase.functions.invoke("manage-channel-configs", {
          body: { tenant_id: tenantId, channels },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      await refetch();
      toast({ title: "Configurações salvas! ✅" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
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
          parent_id: newParent && newParent !== "none" ? newParent : undefined,
          topic: newTopic.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Canal criado no Discord! ✅", description: `#${data.channel?.name}` });
      setNewName(""); setNewType("text"); setNewParent(""); setNewTopic("");
      setCreateOpen(false);
      await fetchDiscordChannels();
    } catch (err: any) {
      toast({ title: "Erro ao criar canal", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!guildId || !newCategoryName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-discord-channel", {
        body: {
          guild_id: guildId,
          name: newCategoryName.trim(),
          type: "category",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Categoria criada! ✅", description: data.channel?.name });
      setNewParent(data.channel?.id || "");
      setNewCategoryName("");
      setCreatingCategory(false);
      await fetchDiscordChannels();
    } catch (err: any) {
      toast({ title: "Erro ao criar categoria", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const configuredCount = Object.keys(draft).length;
  const totalCount = channelSections.reduce((acc, s) => acc + s.channels.length, 0);

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // Group discord channels by category for selects
  const channelsByCategory = useMemo(() => {
    const groups: { label: string; channels: DiscordChannel[] }[] = [];
    const sorted = [...discordCategories].sort((a, b) => a.position - b.position);

    sorted.forEach(cat => {
      const chans = discordChannels.filter(ch => ch.parent_id === cat.id).sort((a, b) => a.position - b.position);
      if (chans.length > 0) groups.push({ label: cat.name, channels: chans });
    });

    const uncategorized = discordChannels.filter(ch => !ch.parent_id).sort((a, b) => a.position - b.position);
    if (uncategorized.length > 0) groups.unshift({ label: "Sem Categoria", channels: uncategorized });

    return groups;
  }, [discordChannels, discordCategories]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Canais</h1>
          <p className="text-muted-foreground text-sm">
            Direcione logs e notificações para canais específicos do seu servidor
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs gap-1.5 px-3 py-1.5">
            <span className={cn(configuredCount > 0 ? "text-emerald-400" : "text-muted-foreground")}>
              {configuredCount}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{totalCount}</span>
            <span className="text-muted-foreground ml-0.5">configurados</span>
          </Badge>
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchDiscordChannels} disabled={loadingChannels}>
            {loadingChannels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)} disabled={!guildId}>
            <Plus className="h-4 w-4" /> Criar Canal
          </Button>
        </div>
      </div>

      {/* Save bar */}
      {hasChanges && (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 backdrop-blur-md px-5 py-3">
          <p className="text-sm text-foreground font-medium">Você tem alterações não salvas</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => {
              const initial: Record<string, string> = {};
              configs.forEach(c => { if (c.discord_channel_id) initial[c.channel_key] = c.discord_channel_id; });
              setDraft(initial);
            }}>
              <X className="h-4 w-4 mr-1.5" /> Descartar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Tudo
            </Button>
          </div>
        </div>
      )}

      {/* Channel sections */}
      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-4">
          {channelSections.map((section) => {
            const SectionIcon = section.icon;
            const configuredInSection = section.channels.filter(ch => draft[ch.key]).length;
            const isOpen = openSections[section.title] !== false;

            return (
              <Collapsible key={section.title} open={isOpen} onOpenChange={() => toggleSection(section.title)}>
                <div className={cn(
                  "rounded-xl border transition-colors",
                  section.borderColor,
                  "bg-card"
                )}>
                  {/* Section header */}
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-xl">
                      <div className={cn("rounded-lg p-2.5 shrink-0", section.bgColor)}>
                        <SectionIcon className={cn("h-4.5 w-4.5", section.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-semibold text-foreground">{section.title}</h3>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-mono">
                            {configuredInSection}/{section.channels.length}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  </CollapsibleTrigger>

                  {/* Section content */}
                  <CollapsibleContent>
                    <div className="px-5 pb-5 pt-1 space-y-3">
                      {section.channels.map((ch) => {
                        const currentValue = getChannelValue(ch.key);
                        const channelName = currentValue ? getChannelName(currentValue) : null;

                        return (
                          <div key={ch.key} className="flex items-center gap-4 rounded-lg bg-muted/30 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{ch.label}</p>
                              <p className="text-[11px] text-muted-foreground">{ch.description}</p>
                            </div>
                            <div className="w-56 shrink-0">
                              <Select value={currentValue} onValueChange={(v) => handleLocalChange(ch.key, v)}>
                                <SelectTrigger className={cn(
                                  "h-9 text-sm",
                                  currentValue ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background"
                                )}>
                                  <div className="flex items-center gap-1.5 truncate">
                                    <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <SelectValue placeholder="Selecionar canal" />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {currentValue && (
                                    <SelectItem value="__clear__" className="text-red-400">
                                      ✕ Remover canal
                                    </SelectItem>
                                  )}
                                  {channelsByCategory.length > 0 ? (
                                    channelsByCategory.map(group => (
                                      <SelectGroup key={group.label}>
                                        <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                                          {group.label}
                                        </SelectLabel>
                                        {group.channels.map(dc => (
                                          <SelectItem key={dc.id} value={dc.id}>
                                            # {dc.name}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    ))
                                  ) : (
                                    <div className="text-center text-sm text-muted-foreground py-3">
                                      Sincronize os canais primeiro
                                    </div>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
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
              <Input placeholder="logs-vendas" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Será convertido para minúsculas com hifens</p>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            {newType !== "category" && (
              <div className="space-y-2">
                <Label>Categoria (opcional)</Label>
                {creatingCategory ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome da categoria"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateCategory();
                        }
                        if (e.key === "Escape") {
                          setCreatingCategory(false);
                          setNewCategoryName("");
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateCategory}
                      disabled={!newCategoryName.trim() || creating}
                      className="shrink-0"
                    >
                      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setCreatingCategory(false); setNewCategoryName(""); }}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Select value={newParent} onValueChange={(v) => {
                    if (v === "__create_cat__") {
                      setCreatingCategory(true);
                      return;
                    }
                    setNewParent(v);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      <SelectItem value="__create_cat__">
                        <div className="flex items-center gap-2 text-primary font-medium">
                          <Plus className="h-3.5 w-3.5" />
                          Criar nova categoria
                        </div>
                      </SelectItem>
                      {discordCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            {(newType === "text" || newType === "announcement") && (
              <div className="space-y-2">
                <Label>Tópico (opcional)</Label>
                <Input placeholder="Descrição do canal..." value={newTopic} onChange={(e) => setNewTopic(e.target.value)} maxLength={1024} />
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
