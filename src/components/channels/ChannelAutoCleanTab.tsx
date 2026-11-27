import { useState, useEffect, useCallback, useMemo } from "react";
import { Eraser, Loader2, Plus, Trash2, Clock, ShieldCheck, Play, Sparkles, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";

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

interface CleanSchedule {
  id: string;
  tenant_id: string;
  discord_channel_id: string;
  channel_name: string | null;
  interval_minutes: number;
  keep_pinned: boolean;
  post_summary: boolean;
  enabled: boolean;
  last_cleaned_at: string | null;
  last_deleted_count: number;
}

interface ChannelAutoCleanTabProps {
  discordChannels: DiscordChannel[];
  discordCategories: DiscordCategory[];
  loadingChannels: boolean;
}

const INTERVAL_PRESETS = [
  { value: "15", label: "A cada 15 minutos" },
  { value: "30", label: "A cada 30 minutos" },
  { value: "60", label: "A cada 1 hora" },
  { value: "180", label: "A cada 3 horas" },
  { value: "360", label: "A cada 6 horas" },
  { value: "720", label: "A cada 12 horas" },
  { value: "1440", label: "A cada 24 horas" },
];

export default function ChannelAutoCleanTab({
  discordChannels,
  discordCategories,
}: ChannelAutoCleanTabProps) {
  const { tenantId, tenant } = useTenant();
  const [schedules, setSchedules] = useState<CleanSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [syncingCmds, setSyncingCmds] = useState(false);

  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [keepPinned, setKeepPinned] = useState(true);
  const [postSummary, setPostSummary] = useState(true);

  const loadSchedules = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-channel-clean", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar regras de limpeza", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const channelsByCategory = useMemo(() => {
    const groups: { label: string; channels: DiscordChannel[] }[] = [];
    const sorted = [...discordCategories].sort((a, b) => a.position - b.position);
    sorted.forEach((cat) => {
      const chans = discordChannels.filter((c) => c.parent_id === cat.id).sort((a, b) => a.position - b.position);
      if (chans.length > 0) groups.push({ label: cat.name, channels: chans });
    });
    const uncategorized = discordChannels.filter((c) => !c.parent_id).sort((a, b) => a.position - b.position);
    if (uncategorized.length > 0) groups.unshift({ label: "Sem Categoria", channels: uncategorized });
    return groups;
  }, [discordChannels, discordCategories]);

  const handleSaveSchedule = async () => {
    if (!tenantId || !selectedChannelId) {
      toast({ title: "Selecione um canal do Discord", variant: "destructive" });
      return;
    }
    const foundCh = discordChannels.find((c) => c.id === selectedChannelId);
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-channel-clean", {
        body: {
          action: "upsert",
          tenant_id: tenantId,
          discord_channel_id: selectedChannelId,
          channel_name: foundCh?.name || null,
          interval_minutes: Number(intervalMinutes) || 60,
          keep_pinned: keepPinned,
          post_summary: postSummary,
          enabled: true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Auto-limpeza configurada! ✅" });
      setSelectedChannelId("");
      await loadSchedules();
    } catch (err: any) {
      toast({ title: "Erro ao salvar regra", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (s: CleanSchedule) => {
    if (!tenantId) return;
    try {
      const { error } = await supabase.functions.invoke("manage-channel-clean", {
        body: { action: "toggle", tenant_id: tenantId, id: s.id, enabled: !s.enabled },
      });
      if (error) throw error;
      setSchedules((prev) => prev.map((item) => (item.id === s.id ? { ...item, enabled: !s.enabled } : item)));
    } catch (err: any) {
      toast({ title: "Erro ao atualizar status", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!tenantId) return;
    try {
      const { error } = await supabase.functions.invoke("manage-channel-clean", {
        body: { action: "delete", tenant_id: tenantId, id },
      });
      if (error) throw error;
      setSchedules((prev) => prev.filter((item) => item.id !== id));
      toast({ title: "Regra removida" });
    } catch (err: any) {
      toast({ title: "Erro ao remover regra", description: err.message, variant: "destructive" });
    }
  };

  const handleRunNow = async (s: CleanSchedule) => {
    if (!tenantId) return;
    setRunningId(s.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-channel-clean", {
        body: { action: "run_now", tenant_id: tenantId, id: s.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Limpeza executada! ✅",
        description: `${data?.deleted_count ?? 0} mensagem(ns) excluída(s) no canal.`,
      });
      await loadSchedules();
    } catch (err: any) {
      toast({ title: "Erro ao limpar canal", description: err.message, variant: "destructive" });
    } finally {
      setRunningId(null);
    }
  };

  const handleSyncCommands = async () => {
    if (!tenantId || !tenant?.discord_guild_id) {
      toast({ title: "Servidor Discord não conectado", variant: "destructive" });
      return;
    }
    setSyncingCmds(true);
    try {
      const { data: listData, error: listErr } = await supabase.functions.invoke("manage-bot-commands", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (listErr) throw listErr;
      const cmds = (Array.isArray(listData) ? listData : []).filter((c: any) => c.enabled);
      const { data: regData, error: regErr } = await supabase.functions.invoke("register-commands", {
        body: {
          tenant_id: tenantId,
          guild_id: tenant.discord_guild_id,
          commands: cmds.map((c: any) => ({
            name: c.name,
            description: c.description,
            options: Array.isArray(c.options) && c.options.length > 0 ? c.options : undefined,
          })),
        },
      });
      if (regErr) throw regErr;
      if (regData?.error) throw new Error(regData.error);
      toast({
        title: "Comandos /clear e /limpar sincronizados! ✅",
        description: "Visíveis e utilizáveis apenas por Administradores do servidor.",
      });
    } catch (err: any) {
      toast({ title: "Erro ao sincronizar comandos", description: err.message, variant: "destructive" });
    } finally {
      setSyncingCmds(false);
    }
  };

  const formatInterval = (mins: number) => {
    if (mins >= 60 && mins % 60 === 0) return `A cada ${mins / 60}h`;
    return `A cada ${mins} min`;
  };

  return (
    <div className="space-y-6">
      {/* Admin-only command card */}
      <Card className="border-white/10 bg-white/[0.02] backdrop-blur-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Comandos de Limpeza (Somente Administradores)
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Apenas membros com permissão de <strong>Administrador</strong> no Discord podem executar comandos ou clicar no botão <strong>Limpeza Manual</strong>.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={syncingCmds}
              onClick={handleSyncCommands}
              className="gap-1.5 text-xs shrink-0"
            >
              {syncingCmds ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
              Sincronizar Comandos no Discord
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-white/5 bg-background/40 p-3 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Terminal className="h-3.5 w-3.5 text-primary" />
              <code>/clear</code> ou <code>/limpar</code>
            </div>
            <p className="text-muted-foreground">Comando slash visível somente para Admins. Aceita quantidade opcional.</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-background/40 p-3 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Terminal className="h-3.5 w-3.5 text-primary" />
              <code>!clear</code> / <code>!limpar [qtd]</code>
            </div>
            <p className="text-muted-foreground">Atalho rápido direto no chat para Administradores do servidor.</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-background/40 p-3 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Eraser className="h-3.5 w-3.5 text-primary" />
              Botão <strong>Limpeza Manual</strong>
            </div>
            <p className="text-muted-foreground">Postado no card de resumo após limpar para repetir a faxina com 1 clique.</p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-clean schedule creator */}
      <Card className="border-white/10 bg-white/[0.02] backdrop-blur-sm rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Limpeza Automática Programada por Canal
          </CardTitle>
          <CardDescription className="text-xs">
            Configure canais para o bot limpar automaticamente em intervalos regulares.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Canal do Discord</Label>
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger className="bg-background/50 border-white/10">
                  <SelectValue placeholder="Selecione um canal" />
                </SelectTrigger>
                <SelectContent>
                  {channelsByCategory.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel className="text-xs uppercase">{group.label}</SelectLabel>
                      {group.channels.map((dc) => (
                        <SelectItem key={dc.id} value={dc.id}>
                          # {dc.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Intervalo</Label>
              <Select value={intervalMinutes} onValueChange={setIntervalMinutes}>
                <SelectTrigger className="bg-background/50 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSaveSchedule} disabled={saving || !selectedChannelId} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar Canal
            </Button>
          </div>

          <div className="flex flex-wrap gap-6 pt-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch checked={keepPinned} onCheckedChange={setKeepPinned} />
              <span>Manter mensagens fixadas</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch checked={postSummary} onCheckedChange={setPostSummary} />
              <span>Postar aviso com botão "Limpeza Manual"</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Active schedules */}
      <Card className="border-white/10 bg-white/[0.02] backdrop-blur-sm rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Canais com Auto-Limpeza ({schedules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-white/10 rounded-xl">
              Nenhum canal configurado para limpeza automática ainda.
            </div>
          ) : (
            <div className="space-y-2.5">
              {schedules.map((s) => {
                const resolvedName =
                  discordChannels.find((c) => c.id === s.discord_channel_id)?.name ||
                  s.channel_name ||
                  s.discord_channel_id;
                return (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/10 bg-background/40 px-4 py-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground"># {resolvedName}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {formatInterval(s.interval_minutes)}
                        </Badge>
                        {s.keep_pinned && (
                          <Badge variant="secondary" className="text-[10px]">
                            Preserva fixadas
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {s.last_cleaned_at
                          ? `Última limpeza: ${new Date(s.last_cleaned_at).toLocaleString("pt-BR")} (${s.last_deleted_count} excluída(s))`
                          : "Aguardando primeira execução automática"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={runningId === s.id}
                        onClick={() => handleRunNow(s)}
                        className="h-8 gap-1.5 text-xs"
                      >
                        {runningId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        Limpar Agora
                      </Button>
                      <Switch checked={s.enabled} onCheckedChange={() => handleToggle(s)} />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(s.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
