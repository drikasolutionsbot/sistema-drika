import { useState, useEffect, useCallback } from "react";
import {
  Crown, Plus, Trash2, Edit2, Users, Clock, RefreshCw, Search,
  ToggleLeft, ToggleRight, UserPlus, Calendar, DollarSign, Shield,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VipPlan {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_days: number;
  discord_role_id: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

interface VipMember {
  id: string;
  plan_id: string;
  discord_user_id: string;
  discord_username: string | null;
  started_at: string;
  expires_at: string;
  active: boolean;
  created_at: string;
  vip_plans: { name: string } | null;
}

const VipsPage = () => {
  const { tenantId } = useTenant();
  const [plans, setPlans] = useState<VipPlan[]>([]);
  const [members, setMembers] = useState<VipMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [checkingExpired, setCheckingExpired] = useState(false);

  // Plan form
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<VipPlan | null>(null);
  const [planForm, setPlanForm] = useState({ name: "", description: "", price_cents: 0, duration_days: 30, discord_role_id: "" });
  const [savingPlan, setSavingPlan] = useState(false);

  // Member form
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({ plan_id: "", discord_user_id: "", discord_username: "", duration_days: 30 });
  const [savingMember, setSavingMember] = useState(false);

  const invoke = useCallback(async (body: any) => {
    const { data, error } = await supabase.functions.invoke("manage-vips", { body: { ...body, tenant_id: tenantId } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, [tenantId]);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [plansData, membersData] = await Promise.all([
        invoke({ action: "list_plans" }),
        invoke({ action: "list_members" }),
      ]);
      setPlans(plansData || []);
      setMembers(membersData || []);
    } catch (err: any) {
      console.error("VIPs fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, invoke]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`vips-realtime-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vip_plans", filter: `tenant_id=eq.${tenantId}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "vip_members", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as any;
          toast.info("👑 Novo VIP", { description: row.discord_username || "Membro adicionado" });
        }
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, fetchData]);

  // Plan CRUD
  const openNewPlan = () => {
    setEditingPlan(null);
    setPlanForm({ name: "", description: "", price_cents: 0, duration_days: 30, discord_role_id: "" });
    setPlanDialogOpen(true);
  };
  const openEditPlan = (plan: VipPlan) => {
    setEditingPlan(plan);
    setPlanForm({ name: plan.name, description: plan.description || "", price_cents: plan.price_cents, duration_days: plan.duration_days, discord_role_id: plan.discord_role_id || "" });
    setPlanDialogOpen(true);
  };
  const savePlan = async () => {
    if (!planForm.name.trim()) { toast.error("Nome obrigatório"); return; }
    setSavingPlan(true);
    try {
      if (editingPlan) {
        await invoke({ action: "update_plan", plan_id: editingPlan.id, ...planForm });
        toast.success("Plano atualizado");
      } else {
        await invoke({ action: "create_plan", ...planForm });
        toast.success("Plano criado");
      }
      setPlanDialogOpen(false);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingPlan(false); }
  };
  const deletePlan = async (id: string) => {
    try {
      await invoke({ action: "delete_plan", plan_id: id });
      toast.success("Plano removido");
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  // Member CRUD
  const openAddMember = () => {
    setMemberForm({ plan_id: plans[0]?.id || "", discord_user_id: "", discord_username: "", duration_days: 30 });
    setMemberDialogOpen(true);
  };
  const addMember = async () => {
    if (!memberForm.plan_id || !memberForm.discord_user_id.trim()) { toast.error("Preencha todos os campos"); return; }
    setSavingMember(true);
    try {
      await invoke({ action: "add_member", ...memberForm });
      toast.success("Membro VIP adicionado");
      setMemberDialogOpen(false);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingMember(false); }
  };
  const removeMember = async (id: string) => {
    try {
      await invoke({ action: "remove_member", member_id: id });
      toast.success("Membro removido");
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };
  const toggleMember = async (id: string, active: boolean) => {
    try {
      await invoke({ action: "toggle_member", member_id: id, active });
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleCheckExpired = async () => {
    setCheckingExpired(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-expired-vips", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const { deactivated, roles_removed } = data;
      if (deactivated > 0) {
        toast.success(`${deactivated} VIP(s) desativado(s), ${roles_removed} cargo(s) removido(s)`);
        fetchData();
      } else {
        toast.info("Nenhum VIP expirado encontrado");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCheckingExpired(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const q = search.toLowerCase();
    return (m.discord_username || "").toLowerCase().includes(q) || m.discord_user_id.includes(q);
  });

  const activeMembers = members.filter((m) => m.active && new Date(m.expires_at) > new Date()).length;
  const expiredMembers = members.filter((m) => new Date(m.expires_at) <= new Date()).length;

  const formatPrice = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            VIPs
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie planos VIP e membros premium</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCheckExpired} disabled={checkingExpired} className="gap-2">
            <Clock className="h-4 w-4" />
            {checkingExpired ? "Verificando..." : "Verificar Expirados"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-primary/10 text-primary"><Crown className="h-4 w-4" /></div>
          <div><p className="text-2xl font-bold">{plans.length}</p><p className="text-xs text-muted-foreground">Planos</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-emerald-500/10 text-emerald-400"><Users className="h-4 w-4" /></div>
          <div><p className="text-2xl font-bold">{activeMembers}</p><p className="text-xs text-muted-foreground">VIPs Ativos</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-yellow-500/10 text-yellow-400"><Clock className="h-4 w-4" /></div>
          <div><p className="text-2xl font-bold">{expiredMembers}</p><p className="text-xs text-muted-foreground">Expirados</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-blue-500/10 text-blue-400"><DollarSign className="h-4 w-4" /></div>
          <div><p className="text-2xl font-bold">{members.length}</p><p className="text-xs text-muted-foreground">Total</p></div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="plans">
        <TabsList className="bg-muted">
          <TabsTrigger value="plans">Planos ({plans.length})</TabsTrigger>
          <TabsTrigger value="members">Membros ({members.length})</TabsTrigger>
        </TabsList>

        {/* PLANS TAB */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openNewPlan} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Plano
            </Button>
          </div>

          {plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Crown className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">Nenhum plano VIP</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Crie um plano para começar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {plan.name}
                        {!plan.active && <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
                      </h3>
                      {plan.description && <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPlan(plan)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
                            <AlertDialogDescription>Isso removerá o plano e todos os membros associados.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deletePlan(plan.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preço</span>
                      <span className="font-medium">{formatPrice(plan.price_cents)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duração</span>
                      <span className="font-medium">{plan.duration_days} dias</span>
                    </div>
                    {plan.discord_role_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cargo Discord</span>
                        <span className="font-mono text-xs text-muted-foreground">{plan.discord_role_id}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Membros</span>
                      <span className="font-medium">{members.filter((m) => m.plan_id === plan.id && m.active).length}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* MEMBERS TAB */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Button size="sm" onClick={openAddMember} disabled={plans.length === 0} className="gap-2">
              <UserPlus className="h-4 w-4" /> Adicionar VIP
            </Button>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">Nenhum membro VIP</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{plans.length === 0 ? "Crie um plano primeiro" : "Adicione membros VIP"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => {
                const expired = new Date(member.expires_at) <= new Date();
                return (
                  <div key={member.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`rounded-lg p-2.5 ${expired ? "bg-destructive/10 text-destructive" : member.active ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        <Crown className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{member.discord_username || member.discord_user_id}</p>
                        <p className="text-xs text-muted-foreground">{member.vip_plans?.name || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={expired ? "bg-destructive/10 text-destructive border-destructive/20" : member.active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground border-border"}>
                        {expired ? "Expirado" : member.active ? "Ativo" : "Inativo"}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                        {expired ? "Expirou " : "Expira "}
                        {formatDistanceToNow(new Date(member.expires_at), { addSuffix: true, locale: ptBR })}
                      </span>
                      <Switch checked={member.active} onCheckedChange={(v) => toggleMember(member.id, v)} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover membro VIP?</AlertDialogTitle>
                            <AlertDialogDescription>O membro perderá o acesso VIP.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeMember(member.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Editar Plano" : "Novo Plano VIP"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Ex: VIP Gold" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} placeholder="Benefícios do plano..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Preço (centavos)</Label>
                <Input type="number" value={planForm.price_cents} onChange={(e) => setPlanForm({ ...planForm, price_cents: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Duração (dias)</Label>
                <Input type="number" value={planForm.duration_days} onChange={(e) => setPlanForm({ ...planForm, duration_days: parseInt(e.target.value) || 30 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ID do Cargo Discord (opcional)</Label>
              <Input value={planForm.discord_role_id} onChange={(e) => setPlanForm({ ...planForm, discord_role_id: e.target.value })} placeholder="Ex: 123456789" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancelar</Button>
            <Button onClick={savePlan} disabled={savingPlan}>{savingPlan ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Membro VIP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plano *</Label>
              <Select value={memberForm.plan_id} onValueChange={(v) => setMemberForm({ ...memberForm, plan_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {plans.filter((p) => p.active).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {formatPrice(p.price_cents)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ID do Discord *</Label>
              <Input value={memberForm.discord_user_id} onChange={(e) => setMemberForm({ ...memberForm, discord_user_id: e.target.value })} placeholder="Ex: 123456789012345678" />
            </div>
            <div className="space-y-2">
              <Label>Username (opcional)</Label>
              <Input value={memberForm.discord_username} onChange={(e) => setMemberForm({ ...memberForm, discord_username: e.target.value })} placeholder="Ex: usuario#1234" />
            </div>
            <div className="space-y-2">
              <Label>Duração (dias)</Label>
              <Input type="number" value={memberForm.duration_days} onChange={(e) => setMemberForm({ ...memberForm, duration_days: parseInt(e.target.value) || 30 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>Cancelar</Button>
            <Button onClick={addMember} disabled={savingMember}>{savingMember ? "Adicionando..." : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VipsPage;
