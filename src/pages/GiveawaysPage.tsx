import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Gift, Plus, Trash2, Loader2, Trophy, Users, Clock, RefreshCw,
  PartyPopper, XCircle, Eye, Dices, Crown, CalendarIcon, Hash, Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Giveaway {
  id: string;
  title: string;
  description: string;
  prize: string;
  winners_count: number;
  ends_at: string;
  channel_id: string | null;
  message_id: string | null;
  status: "active" | "ended" | "canceled";
  winners: { discord_user_id: string; discord_username: string }[];
  require_role_id: string | null;
  created_by: string | null;
  entries_count: number;
  created_at: string;
}

interface GiveawayEntry {
  id: string;
  discord_user_id: string;
  discord_username: string | null;
  discord_avatar: string | null;
  entered_at: string;
}

const GiveawaysPage = () => {
  const { tenantId, tenant } = useTenant();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailGiveaway, setDetailGiveaway] = useState<Giveaway | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Giveaway | null>(null);
  const [drawTarget, setDrawTarget] = useState<Giveaway | null>(null);
  const [entries, setEntries] = useState<GiveawayEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [acting, setActing] = useState(false);

  // Create form
  const [form, setForm] = useState({
    title: "", description: "", prize: "", winners_count: 1,
    ends_at: null as Date | null, channel_id: "", require_role_id: "",
  });

  // Add entry form
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [entryUserId, setEntryUserId] = useState("");
  const [entryUsername, setEntryUsername] = useState("");

  const { data: giveaways = [], isLoading } = useQuery<Giveaway[]>({
    queryKey: ["giveaways", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Fetch Discord channels/roles
  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const [chRes, roRes] = await Promise.all([
          supabase.functions.invoke("discord-channels", { body: { tenant_id: tenantId } }),
          supabase.functions.invoke("discord-guild-info", { body: { tenant_id: tenantId } }),
        ]);
        if (chRes.data && Array.isArray(chRes.data))
          setChannels(chRes.data.filter((c: any) => c.type === 0).sort((a: any, b: any) => a.position - b.position));
        if (roRes.data?.roles && Array.isArray(roRes.data.roles))
          setRoles(roRes.data.roles.filter((r: any) => !r.managed && r.name !== "@everyone").sort((a: any, b: any) => b.position - a.position));
      } catch {}
    })();
  }, [tenantId]);

  const handleCreate = async () => {
    if (!form.title || !form.prize || !form.ends_at || !tenantId) {
      toast.error("Preencha título, prêmio e data de término");
      return;
    }
    setActing(true);
    try {
      const { error, data } = await supabase.functions.invoke("manage-giveaways", {
        body: {
          action: "create", tenant_id: tenantId,
          title: form.title, description: form.description, prize: form.prize,
          winners_count: form.winners_count, ends_at: form.ends_at.toISOString(),
          channel_id: form.channel_id || null, require_role_id: form.require_role_id || null,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro");
      toast.success("Sorteio criado!" + (form.channel_id ? " Anúncio enviado no Discord." : ""));
      setCreateOpen(false);
      setForm({ title: "", description: "", prize: "", winners_count: 1, ends_at: null, channel_id: "", require_role_id: "" });
      queryClient.invalidateQueries({ queryKey: ["giveaways", tenantId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActing(false);
    }
  };

  const handleDraw = async () => {
    if (!drawTarget || !tenantId) return;
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "draw", tenant_id: tenantId, giveaway_id: drawTarget.id },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro");
      toast.success("Sorteio realizado! Vencedores anunciados no Discord.");
      setDrawTarget(null);
      setDetailGiveaway(null);
      queryClient.invalidateQueries({ queryKey: ["giveaways", tenantId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActing(false);
    }
  };

  const handleReroll = async (giveaway: Giveaway) => {
    if (!tenantId) return;
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "reroll", tenant_id: tenantId, giveaway_id: giveaway.id, count: 1 },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro");
      toast.success("Re-sorteio realizado!");
      queryClient.invalidateQueries({ queryKey: ["giveaways", tenantId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async (giveaway: Giveaway) => {
    if (!tenantId) return;
    setActing(true);
    try {
      const { error, data } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "cancel", tenant_id: tenantId, giveaway_id: giveaway.id },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro");
      toast.success("Sorteio cancelado.");
      queryClient.invalidateQueries({ queryKey: ["giveaways", tenantId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !tenantId) return;
    try {
      const { error, data } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "delete", tenant_id: tenantId, giveaway_id: deleteTarget.id },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro");
      toast.success("Sorteio excluído.");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["giveaways", tenantId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openDetail = async (g: Giveaway) => {
    setDetailGiveaway(g);
    setLoadingEntries(true);
    try {
      const { data } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "list_entries", tenant_id: tenantId, giveaway_id: g.id },
      });
      setEntries(data || []);
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  const handleAddEntry = async () => {
    if (!entryUserId || !detailGiveaway || !tenantId) return;
    setActing(true);
    try {
      const { error, data } = await supabase.functions.invoke("manage-giveaways", {
        body: {
          action: "add_entry", tenant_id: tenantId, giveaway_id: detailGiveaway.id,
          discord_user_id: entryUserId, discord_username: entryUsername || null,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro");
      toast.success("Participante adicionado!");
      setEntryUserId("");
      setEntryUsername("");
      setAddEntryOpen(false);
      // Refresh entries
      const { data: updated } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "list_entries", tenant_id: tenantId, giveaway_id: detailGiveaway.id },
      });
      setEntries(updated || []);
      queryClient.invalidateQueries({ queryKey: ["giveaways", tenantId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActing(false);
    }
  };

  const handleRemoveEntry = async (entryId: string) => {
    if (!tenantId || !detailGiveaway) return;
    try {
      await supabase.functions.invoke("manage-giveaways", {
        body: { action: "remove_entry", tenant_id: tenantId, entry_id: entryId },
      });
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      queryClient.invalidateQueries({ queryKey: ["giveaways", tenantId] });
      toast.success("Participante removido.");
    } catch {}
  };

  const statusBadge = (status: string, endsAt: string) => {
    if (status === "canceled") return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">Cancelado</Badge>;
    if (status === "ended") return <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Encerrado</Badge>;
    if (isPast(new Date(endsAt))) return <Badge variant="outline" className="text-amber-400 border-amber-500/30">Expirado</Badge>;
    return <Badge variant="outline" className="text-blue-400 border-blue-500/30">Ativo</Badge>;
  };

  // Stats
  const active = giveaways.filter((g) => g.status === "active" && !isPast(new Date(g.ends_at))).length;
  const ended = giveaways.filter((g) => g.status === "ended").length;
  const totalEntries = giveaways.reduce((sum, g) => sum + (g.entries_count || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Gift className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Sorteios</h1>
            <p className="text-sm text-muted-foreground">Crie e gerencie sorteios com anúncio automático no Discord</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-yellow-600 hover:bg-yellow-700">
          <Plus className="h-4 w-4 mr-2" /> Novo Sorteio
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: Gift, color: "text-yellow-400 bg-yellow-500/20", label: "Total", value: giveaways.length },
          { icon: Clock, color: "text-blue-400 bg-blue-500/20", label: "Ativos", value: active },
          { icon: Trophy, color: "text-emerald-400 bg-emerald-500/20", label: "Encerrados", value: ended },
          { icon: Users, color: "text-purple-400 bg-purple-500/20", label: "Participações", value: totalEntries },
        ].map((s) => (
          <Card key={s.label} className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Giveaway List */}
      {giveaways.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-12 text-center">
            <Gift className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhum sorteio criado ainda.</p>
            <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" /> Criar Primeiro Sorteio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {giveaways.map((g) => {
            const expired = isPast(new Date(g.ends_at));
            return (
              <Card key={g.id} className={`border-border/50 hover:border-border transition-colors ${g.status === "canceled" ? "opacity-60" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{g.title}</CardTitle>
                      <CardDescription className="truncate">{g.prize}</CardDescription>
                    </div>
                    {statusBadge(g.status, g.ends_at)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{g.entries_count} participantes</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Trophy className="h-3.5 w-3.5" />
                      <span>{g.winners_count} vencedor{g.winners_count > 1 ? "es" : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {expired ? (
                      <span>Encerrou {formatDistanceToNow(new Date(g.ends_at), { addSuffix: true, locale: ptBR })}</span>
                    ) : (
                      <span>Encerra {formatDistanceToNow(new Date(g.ends_at), { addSuffix: true, locale: ptBR })}</span>
                    )}
                  </div>

                  {/* Winners */}
                  {g.winners.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {g.winners.map((w, i) => (
                        <Badge key={i} className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 gap-1">
                          <Crown className="h-3 w-3" /> {w.discord_username || w.discord_user_id}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Separator />

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openDetail(g)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Detalhes
                    </Button>
                    {g.status === "active" && (
                      <Button size="sm" onClick={() => setDrawTarget(g)} className="bg-yellow-600 hover:bg-yellow-700 flex-1">
                        <Dices className="h-3.5 w-3.5 mr-1" /> Sortear
                      </Button>
                    )}
                    {g.status === "ended" && (
                      <Button size="sm" variant="outline" onClick={() => handleReroll(g)} disabled={acting}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reroll
                      </Button>
                    )}
                    {g.status === "active" && (
                      <Button size="sm" variant="ghost" onClick={() => handleCancel(g)} className="text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(g)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-yellow-400" /> Novo Sorteio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Ex: Sorteio de Nitro" className="mt-1" />
            </div>
            <div>
              <Label>Prêmio *</Label>
              <Input value={form.prize} onChange={(e) => setForm((p) => ({ ...p, prize: e.target.value }))} placeholder="Ex: 1x Discord Nitro" className="mt-1" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Detalhes do sorteio..." className="mt-1" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nº de Vencedores</Label>
                <Input type="number" min={1} max={50} value={form.winners_count} onChange={(e) => setForm((p) => ({ ...p, winners_count: parseInt(e.target.value) || 1 }))} className="mt-1" />
              </div>
              <div>
                <Label>Data de Término *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !form.ends_at && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {form.ends_at ? format(form.ends_at, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.ends_at ?? undefined}
                      onSelect={(d) => setForm((p) => ({ ...p, ends_at: d ?? null }))}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label>Canal do Discord (anúncio)</Label>
              <select value={form.channel_id} onChange={(e) => setForm((p) => ({ ...p, channel_id: e.target.value }))} className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Nenhum (sem anúncio)</option>
                {channels.map((ch) => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Cargo Necessário (opcional)</Label>
              <select value={form.require_role_id} onChange={(e) => setForm((p) => ({ ...p, require_role_id: e.target.value }))} className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Qualquer membro</option>
                {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={acting} className="bg-yellow-600 hover:bg-yellow-700">
              {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PartyPopper className="h-4 w-4 mr-2" />}
              Criar Sorteio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailGiveaway} onOpenChange={(open) => !open && setDetailGiveaway(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailGiveaway && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-yellow-400" />
                  {detailGiveaway.title}
                  <span className="ml-2">{statusBadge(detailGiveaway.status, detailGiveaway.ends_at)}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-border/50 bg-card/50">
                    <p className="text-xs text-muted-foreground">Prêmio</p>
                    <p className="font-semibold text-sm">{detailGiveaway.prize}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border/50 bg-card/50">
                    <p className="text-xs text-muted-foreground">Vencedores</p>
                    <p className="font-semibold text-sm">{detailGiveaway.winners_count}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border/50 bg-card/50">
                    <p className="text-xs text-muted-foreground">Participantes</p>
                    <p className="font-semibold text-sm">{entries.length}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border/50 bg-card/50">
                    <p className="text-xs text-muted-foreground">Encerra</p>
                    <p className="font-semibold text-sm">{format(new Date(detailGiveaway.ends_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                </div>

                {detailGiveaway.description && (
                  <p className="text-sm text-muted-foreground">{detailGiveaway.description}</p>
                )}

                {/* Winners */}
                {detailGiveaway.winners.length > 0 && (
                  <div className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                    <p className="text-sm font-semibold flex items-center gap-2 mb-2"><Crown className="h-4 w-4 text-yellow-400" /> Vencedores</p>
                    <div className="flex flex-wrap gap-2">
                      {detailGiveaway.winners.map((w, i) => (
                        <Badge key={i} className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                          {w.discord_username || w.discord_user_id}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Entries */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold">Participantes ({entries.length})</p>
                    {detailGiveaway.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => setAddEntryOpen(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                      </Button>
                    )}
                  </div>

                  {loadingEntries ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum participante ainda.</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto rounded-lg border border-border/50">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Discord ID</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entries.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="font-medium">{e.discord_username || "—"}</TableCell>
                              <TableCell className="text-muted-foreground font-mono text-xs">{e.discord_user_id}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="ghost" onClick={() => handleRemoveEntry(e.id)} className="text-destructive hover:text-destructive h-7">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Entry Dialog */}
      <Dialog open={addEntryOpen} onOpenChange={setAddEntryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Participante</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Discord User ID *</Label>
              <Input value={entryUserId} onChange={(e) => setEntryUserId(e.target.value)} placeholder="Ex: 123456789012345678" className="mt-1" />
            </div>
            <div>
              <Label>Username (opcional)</Label>
              <Input value={entryUsername} onChange={(e) => setEntryUsername(e.target.value)} placeholder="Ex: usuario#1234" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEntryOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddEntry} disabled={!entryUserId || acting}>
              {acting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draw Confirmation */}
      <AlertDialog open={!!drawTarget} onOpenChange={(open) => !open && setDrawTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Dices className="h-5 w-5 text-yellow-400" /> Sortear Vencedores</AlertDialogTitle>
            <AlertDialogDescription>
              Será sorteado(s) <strong>{drawTarget?.winners_count}</strong> vencedor(es) de <strong>{drawTarget?.entries_count}</strong> participante(s) para o sorteio <strong>"{drawTarget?.title}"</strong>.
              {drawTarget?.channel_id && " O resultado será anunciado no Discord."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDraw} disabled={acting} className="bg-yellow-600 hover:bg-yellow-700">
              {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Dices className="h-4 w-4 mr-2" />}
              Sortear Agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Sorteio</AlertDialogTitle>
            <AlertDialogDescription>
              O sorteio <strong>"{deleteTarget?.title}"</strong> e todos os participantes serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GiveawaysPage;
