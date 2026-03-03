import { useState, useEffect, useCallback } from "react";
import {
  Zap, Plus, Trash2, Edit2, Power, PowerOff, RefreshCw, Search,
  Play, Clock, Activity, ChevronDown, ChevronRight, Eye, Copy,
  UserPlus, UserMinus, MessageSquare, Hash, AtSign, Gift, ShieldCheck,
  Bell, Send, Globe, Tag, Star, Heart, Award, Megaphone,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ──────────────────────────────
interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  actions: AutoAction[];
  conditions: AutoCondition[];
  executions: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AutoAction {
  type: string;
  config: Record<string, any>;
}

interface AutoCondition {
  type: string;
  value: string;
}

interface AutoLog {
  id: string;
  automation_id: string;
  trigger_data: Record<string, any>;
  result: string;
  details: string | null;
  created_at: string;
}

// ─── Trigger & Action Definitions ──────────
interface TriggerDef {
  key: string;
  label: string;
  description: string;
  icon: any;
  color: string;
  category: string;
  configFields: { key: string; label: string; type: "text" | "number" | "select"; placeholder?: string; options?: { value: string; label: string }[] }[];
}

interface ActionDef {
  key: string;
  label: string;
  icon: any;
  color: string;
  configFields: { key: string; label: string; type: "text" | "number" | "select" | "textarea"; placeholder?: string; options?: { value: string; label: string }[] }[];
}

const TRIGGERS: TriggerDef[] = [
  { key: "member_join", label: "Membro Entrou", description: "Quando um novo membro entra no servidor", icon: UserPlus, color: "text-emerald-400 bg-emerald-500/10", category: "Membros", configFields: [] },
  { key: "member_leave", label: "Membro Saiu", description: "Quando um membro sai do servidor", icon: UserMinus, color: "text-red-400 bg-red-500/10", category: "Membros", configFields: [] },
  { key: "member_boost", label: "Membro Boostou", description: "Quando um membro impulsiona o servidor", icon: Star, color: "text-pink-400 bg-pink-500/10", category: "Membros", configFields: [] },
  { key: "message_contains", label: "Mensagem Contém", description: "Quando uma mensagem contém palavras específicas", icon: MessageSquare, color: "text-blue-400 bg-blue-500/10", category: "Mensagens", configFields: [
    { key: "keywords", label: "Palavras-chave (separadas por vírgula)", type: "text", placeholder: "comprar, preço, ajuda" },
    { key: "channel_id", label: "Canal específico (opcional)", type: "text", placeholder: "ID do canal" },
  ]},
  { key: "reaction_add", label: "Reação Adicionada", description: "Quando uma reação é adicionada a uma mensagem", icon: Heart, color: "text-pink-400 bg-pink-500/10", category: "Mensagens", configFields: [
    { key: "emoji", label: "Emoji específico (opcional)", type: "text", placeholder: "✅ ou nome do emoji" },
    { key: "message_id", label: "Mensagem específica (opcional)", type: "text", placeholder: "ID da mensagem" },
  ]},
  { key: "order_created", label: "Pedido Criado", description: "Quando um novo pedido é criado", icon: Tag, color: "text-yellow-400 bg-yellow-500/10", category: "Loja", configFields: [] },
  { key: "order_paid", label: "Pagamento Confirmado", description: "Quando um pedido é pago", icon: Award, color: "text-emerald-400 bg-emerald-500/10", category: "Loja", configFields: [] },
  { key: "ticket_created", label: "Ticket Criado", description: "Quando um ticket de suporte é aberto", icon: Bell, color: "text-blue-400 bg-blue-500/10", category: "Suporte", configFields: [] },
  { key: "scheduled", label: "Agendado", description: "Executa em intervalos regulares", icon: Clock, color: "text-purple-400 bg-purple-500/10", category: "Sistema", configFields: [
    { key: "interval_minutes", label: "Intervalo (minutos)", type: "number", placeholder: "60" },
    { key: "start_time", label: "Horário inicial (HH:MM)", type: "text", placeholder: "08:00" },
  ]},
];

const ACTIONS: ActionDef[] = [
  { key: "send_message", label: "Enviar Mensagem", icon: Send, color: "text-blue-400 bg-blue-500/10", configFields: [
    { key: "channel_id", label: "ID do Canal", type: "text", placeholder: "ID do canal Discord" },
    { key: "content", label: "Mensagem", type: "textarea", placeholder: "Use {user}, {server}, {member_count} como variáveis" },
  ]},
  { key: "send_dm", label: "Enviar DM", icon: MessageSquare, color: "text-purple-400 bg-purple-500/10", configFields: [
    { key: "content", label: "Mensagem", type: "textarea", placeholder: "Use {user}, {server} como variáveis" },
  ]},
  { key: "add_role", label: "Adicionar Cargo", icon: ShieldCheck, color: "text-emerald-400 bg-emerald-500/10", configFields: [
    { key: "role_id", label: "ID do Cargo", type: "text", placeholder: "ID do cargo Discord" },
  ]},
  { key: "remove_role", label: "Remover Cargo", icon: ShieldCheck, color: "text-red-400 bg-red-500/10", configFields: [
    { key: "role_id", label: "ID do Cargo", type: "text", placeholder: "ID do cargo Discord" },
  ]},
  { key: "send_webhook", label: "Chamar Webhook", icon: Globe, color: "text-yellow-400 bg-yellow-500/10", configFields: [
    { key: "url", label: "URL do Webhook", type: "text", placeholder: "https://..." },
    { key: "body_template", label: "Body (JSON)", type: "textarea", placeholder: '{"event": "{trigger_type}", "user": "{user}"}' },
  ]},
  { key: "send_announcement", label: "Enviar Anúncio", icon: Megaphone, color: "text-orange-400 bg-orange-500/10", configFields: [
    { key: "channel_id", label: "ID do Canal", type: "text", placeholder: "ID do canal Discord" },
    { key: "title", label: "Título", type: "text", placeholder: "Título do embed" },
    { key: "description", label: "Descrição", type: "textarea", placeholder: "Conteúdo do embed" },
    { key: "color", label: "Cor (hex)", type: "text", placeholder: "#FF69B4" },
  ]},
];

const CONDITION_TYPES = [
  { value: "has_role", label: "Tem o cargo (ID)" },
  { value: "not_has_role", label: "Não tem o cargo (ID)" },
  { value: "in_channel", label: "No canal (ID)" },
  { value: "account_age_days", label: "Conta com mais de X dias" },
];

// ─── Component ──────────────────────────
const AutomationsPage = () => {
  const { tenantId } = useTenant();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [logs, setLogs] = useState<AutoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [formName, setFormName] = useState("");
  const [formTrigger, setFormTrigger] = useState("");
  const [formTriggerConfig, setFormTriggerConfig] = useState<Record<string, any>>({});
  const [formActions, setFormActions] = useState<AutoAction[]>([]);
  const [formConditions, setFormConditions] = useState<AutoCondition[]>([]);
  const [saving, setSaving] = useState(false);
  const [formStep, setFormStep] = useState(0); // 0=trigger, 1=actions, 2=conditions

  // Logs dialog
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logsForAutomation, setLogsForAutomation] = useState<string | null>(null);
  const [automationLogs, setAutomationLogs] = useState<AutoLog[]>([]);

  const invoke = useCallback(async (body: any) => {
    const { data, error } = await supabase.functions.invoke("manage-automations", { body: { ...body, tenant_id: tenantId } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, [tenantId]);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [autoData, logsData] = await Promise.all([
        invoke({ action: "list" }),
        invoke({ action: "list_logs", limit: 20 }),
      ]);
      setAutomations(autoData || []);
      setLogs(logsData || []);
    } catch (err: any) { console.error(err); }
    finally { setLoading(false); }
  }, [tenantId, invoke]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`automations-realtime-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "automations", filter: `tenant_id=eq.${tenantId}` }, () => fetchData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "automation_logs", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        const row = payload.new as any;
        const auto = automations.find((a) => a.id === row.automation_id);
        toast.info("⚡ Automação executada", { description: auto?.name || "Automação" });
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, fetchData]);

  // CRUD
  const openNew = () => {
    setEditing(null);
    setFormName("");
    setFormTrigger("");
    setFormTriggerConfig({});
    setFormActions([]);
    setFormConditions([]);
    setFormStep(0);
    setDialogOpen(true);
  };

  const openEdit = (auto: Automation) => {
    setEditing(auto);
    setFormName(auto.name);
    setFormTrigger(auto.trigger_type);
    setFormTriggerConfig(auto.trigger_config);
    setFormActions(auto.actions);
    setFormConditions(auto.conditions);
    setFormStep(0);
    setDialogOpen(true);
  };

  const saveAutomation = async () => {
    if (!formName.trim() || !formTrigger) { toast.error("Nome e trigger são obrigatórios"); return; }
    if (formActions.length === 0) { toast.error("Adicione pelo menos uma ação"); return; }
    setSaving(true);
    try {
      if (editing) {
        await invoke({ action: "update", automation_id: editing.id, name: formName, trigger_type: formTrigger, trigger_config: formTriggerConfig, actions: formActions, conditions: formConditions });
        toast.success("Automação atualizada");
      } else {
        await invoke({ action: "create", name: formName, trigger_type: formTrigger, trigger_config: formTriggerConfig, actions: formActions, conditions: formConditions });
        toast.success("Automação criada");
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const deleteAutomation = async (id: string) => {
    try { await invoke({ action: "delete", automation_id: id }); toast.success("Automação removida"); fetchData(); }
    catch (err: any) { toast.error(err.message); }
  };

  const toggleAutomation = async (id: string, enabled: boolean) => {
    try { await invoke({ action: "toggle", automation_id: id, enabled }); fetchData(); }
    catch (err: any) { toast.error(err.message); }
  };

  const openLogs = async (automationId: string) => {
    setLogsForAutomation(automationId);
    try {
      const data = await invoke({ action: "list_logs", automation_id: automationId, limit: 30 });
      setAutomationLogs(data || []);
    } catch { setAutomationLogs([]); }
    setLogsDialogOpen(true);
  };

  const addAction = (type: string) => {
    const def = ACTIONS.find((a) => a.key === type);
    if (!def) return;
    const config: Record<string, any> = {};
    def.configFields.forEach((f) => { config[f.key] = ""; });
    setFormActions([...formActions, { type, config }]);
  };

  const updateActionConfig = (idx: number, key: string, value: string) => {
    const updated = [...formActions];
    updated[idx] = { ...updated[idx], config: { ...updated[idx].config, [key]: value } };
    setFormActions(updated);
  };

  const removeAction = (idx: number) => {
    setFormActions(formActions.filter((_, i) => i !== idx));
  };

  const addCondition = () => {
    setFormConditions([...formConditions, { type: "has_role", value: "" }]);
  };

  const updateCondition = (idx: number, field: "type" | "value", val: string) => {
    const updated = [...formConditions];
    updated[idx] = { ...updated[idx], [field]: val };
    setFormConditions(updated);
  };

  const removeCondition = (idx: number) => {
    setFormConditions(formConditions.filter((_, i) => i !== idx));
  };

  const filtered = automations.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));
  const activeCount = automations.filter((a) => a.enabled).length;
  const totalExecs = automations.reduce((sum, a) => sum + a.executions, 0);
  const triggerDef = (key: string) => TRIGGERS.find((t) => t.key === key);
  const actionDef = (key: string) => ACTIONS.find((a) => a.key === key);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[1,2,3,4].map(i=><Skeleton key={i} className="h-28 rounded-xl"/>)}</div>
        <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-24 rounded-xl"/>)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" /> Ações Automáticas
          </h1>
          <p className="text-muted-foreground text-sm">Crie automações poderosas para o seu servidor Discord</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2"><RefreshCw className="h-4 w-4"/>Atualizar</Button>
          <Button size="sm" onClick={openNew} className="gap-2"><Plus className="h-4 w-4"/>Nova Automação</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg p-2.5 bg-primary/10"><Zap className="h-5 w-5 text-primary"/></div>
          <div><p className="text-2xl font-bold">{automations.length}</p><p className="text-xs text-muted-foreground">Automações</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg p-2.5 bg-emerald-500/10"><Power className="h-5 w-5 text-emerald-400"/></div>
          <div><p className="text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground">Ativas</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg p-2.5 bg-blue-500/10"><Play className="h-5 w-5 text-blue-400"/></div>
          <div><p className="text-2xl font-bold">{totalExecs}</p><p className="text-xs text-muted-foreground">Execuções</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg p-2.5 bg-yellow-500/10"><Activity className="h-5 w-5 text-yellow-400"/></div>
          <div><p className="text-2xl font-bold">{logs.length}</p><p className="text-xs text-muted-foreground">Logs Recentes</p></div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
        <Input placeholder="Buscar automações..." value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-10"/>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="automations">
        <TabsList className="bg-muted">
          <TabsTrigger value="automations">Automações ({automations.length})</TabsTrigger>
          <TabsTrigger value="logs">Logs Recentes ({logs.length})</TabsTrigger>
        </TabsList>

        {/* AUTOMATIONS TAB */}
        <TabsContent value="automations" className="mt-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Zap className="h-12 w-12 text-muted-foreground/30 mb-3"/>
              <p className="text-muted-foreground font-medium">Nenhuma automação</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Crie uma automação para começar</p>
              <Button size="sm" onClick={openNew} className="mt-4 gap-2"><Plus className="h-4 w-4"/>Criar Primeira Automação</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((auto) => {
                const trig = triggerDef(auto.trigger_type);
                const TrigIcon = trig?.icon || Zap;
                const isOpen = expandedId === auto.id;
                return (
                  <Collapsible key={auto.id} open={isOpen} onOpenChange={() => setExpandedId(isOpen ? null : auto.id)}>
                    <div className={`rounded-xl border transition-all duration-300 ${auto.enabled ? "border-primary/20 bg-card" : "border-border bg-card/50 opacity-70"}`}>
                      <div className="flex items-center justify-between p-4">
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-3 flex-1 text-left group">
                            <div className={`rounded-lg p-2.5 ${trig?.color || "bg-muted text-muted-foreground"} transition-transform group-hover:scale-110`}>
                              <TrigIcon className="h-4 w-4"/>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold">{auto.name}</p>
                                <Badge variant="outline" className="text-[10px]">{trig?.label || auto.trigger_type}</Badge>
                                {auto.actions.length > 0 && <Badge variant="outline" className="text-[10px] bg-muted">{auto.actions.length} ação(ões)</Badge>}
                                {auto.conditions.length > 0 && <Badge variant="outline" className="text-[10px] bg-muted">{auto.conditions.length} condição(ões)</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {auto.executions} execuções
                                {auto.last_executed_at && ` · última ${formatDistanceToNow(new Date(auto.last_executed_at), { addSuffix: true, locale: ptBR })}`}
                              </p>
                            </div>
                            {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0"/>}
                          </button>
                        </CollapsibleTrigger>
                        <div className="flex items-center gap-2 ml-3">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openLogs(auto.id)}><Eye className="h-3.5 w-3.5"/></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(auto)}><Edit2 className="h-3.5 w-3.5"/></Button>
                          <Switch checked={auto.enabled} onCheckedChange={(v) => toggleAutomation(auto.id, v)}/>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5"/></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
                                <AlertDialogDescription>Todos os logs associados também serão removidos.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteAutomation(auto.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                          {/* Trigger detail */}
                          <div>
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Gatilho</Label>
                            <div className="mt-1.5 rounded-lg border border-border p-3 bg-card/50">
                              <p className="text-sm font-medium">{trig?.label} — {trig?.description}</p>
                              {Object.keys(auto.trigger_config).length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {Object.entries(auto.trigger_config).map(([k, v]) => (
                                    <p key={k} className="text-xs text-muted-foreground"><span className="font-mono">{k}:</span> {String(v)}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Actions detail */}
                          <div>
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Ações ({auto.actions.length})</Label>
                            <div className="mt-1.5 space-y-2">
                              {auto.actions.map((act, i) => {
                                const aDef = actionDef(act.type);
                                const AIcon = aDef?.icon || Zap;
                                return (
                                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-3 bg-card/50">
                                    <div className={`rounded p-1.5 ${aDef?.color || "bg-muted"}`}><AIcon className="h-3.5 w-3.5"/></div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium">{aDef?.label || act.type}</p>
                                      {Object.entries(act.config).filter(([,v])=>v).map(([k,v]) => (
                                        <p key={k} className="text-xs text-muted-foreground truncate"><span className="font-mono">{k}:</span> {String(v)}</p>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* Conditions */}
                          {auto.conditions.length > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Condições</Label>
                              <div className="mt-1.5 flex flex-wrap gap-2">
                                {auto.conditions.map((c, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{CONDITION_TYPES.find(ct=>ct.value===c.type)?.label || c.type}: {c.value}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* LOGS TAB */}
        <TabsContent value="logs" className="mt-4">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/30 mb-3"/>
              <p className="text-muted-foreground font-medium">Nenhum log recente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const auto = automations.find((a) => a.id === log.automation_id);
                const trig = auto ? triggerDef(auto.trigger_type) : null;
                const TIcon = trig?.icon || Zap;
                return (
                  <div key={log.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <div className={`rounded-lg p-2 ${trig?.color || "bg-muted text-muted-foreground"} shrink-0`}>
                      <TIcon className="h-4 w-4"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{auto?.name || "Automação removida"}</p>
                      <p className="text-xs text-muted-foreground truncate">{log.details || log.result}</p>
                    </div>
                    <Badge variant="outline" className={log.result === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                      {log.result === "success" ? "Sucesso" : "Erro"}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ CREATE/EDIT DIALOG ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary"/>
              {editing ? "Editar Automação" : "Nova Automação"}
            </DialogTitle>
          </DialogHeader>

          {/* Step Tabs */}
          <div className="flex gap-1 border-b border-border pb-3 mb-4">
            {["Gatilho", "Ações", "Condições"].map((label, i) => (
              <button key={i} onClick={() => setFormStep(i)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${formStep === i ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {i + 1}. {label}
              </button>
            ))}
          </div>

          {/* Name */}
          <div className="space-y-2 mb-4">
            <Label>Nome da Automação *</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Boas-vindas automática"/>
          </div>

          {/* STEP 0 - Trigger */}
          {formStep === 0 && (
            <div className="space-y-4">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Escolha o Gatilho</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TRIGGERS.map((t) => {
                  const TIcon = t.icon;
                  const selected = formTrigger === t.key;
                  return (
                    <button key={t.key} onClick={() => { setFormTrigger(t.key); setFormTriggerConfig({}); }}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                    >
                      <div className={`rounded-lg p-2 ${t.color}`}><TIcon className="h-4 w-4"/></div>
                      <div>
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Trigger config */}
              {formTrigger && (() => {
                const t = triggerDef(formTrigger);
                if (!t || t.configFields.length === 0) return null;
                return (
                  <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/20">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Configuração do Gatilho</Label>
                    {t.configFields.map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <Label className="text-sm">{f.label}</Label>
                        <Input value={formTriggerConfig[f.key] || ""} onChange={(e) => setFormTriggerConfig({...formTriggerConfig, [f.key]: e.target.value})} placeholder={f.placeholder} type={f.type === "number" ? "number" : "text"}/>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* STEP 1 - Actions */}
          {formStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Ações ({formActions.length})</Label>
                <Select onValueChange={addAction}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Adicionar ação..."/></SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {formActions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ação adicionada. Selecione acima.</p>
              ) : (
                <div className="space-y-3">
                  {formActions.map((act, idx) => {
                    const aDef = actionDef(act.type);
                    const AIcon = aDef?.icon || Zap;
                    return (
                      <div key={idx} className="rounded-xl border border-border p-4 space-y-3 bg-card/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`rounded p-1.5 ${aDef?.color || "bg-muted"}`}><AIcon className="h-3.5 w-3.5"/></div>
                            <span className="text-sm font-semibold">{aDef?.label || act.type}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAction(idx)}><Trash2 className="h-3.5 w-3.5"/></Button>
                        </div>
                        {aDef?.configFields.map((f) => (
                          <div key={f.key} className="space-y-1">
                            <Label className="text-xs">{f.label}</Label>
                            {f.type === "textarea" ? (
                              <Textarea value={act.config[f.key] || ""} onChange={(e) => updateActionConfig(idx, f.key, e.target.value)} placeholder={f.placeholder} rows={2}/>
                            ) : (
                              <Input value={act.config[f.key] || ""} onChange={(e) => updateActionConfig(idx, f.key, e.target.value)} placeholder={f.placeholder}/>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 - Conditions */}
          {formStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Condições (opcional)</Label>
                <Button variant="outline" size="sm" onClick={addCondition} className="gap-1"><Plus className="h-3.5 w-3.5"/>Adicionar</Button>
              </div>
              <p className="text-xs text-muted-foreground">Condições são verificadas antes de executar as ações. Todas devem ser verdadeiras.</p>

              {formConditions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem condições — a automação sempre será executada.</p>
              ) : (
                <div className="space-y-2">
                  {formConditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Select value={cond.type} onValueChange={(v) => updateCondition(idx, "type", v)}>
                        <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {CONDITION_TYPES.map((ct) => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input value={cond.value} onChange={(e) => updateCondition(idx, "value", e.target.value)} placeholder="Valor" className="flex-1"/>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCondition(idx)}><Trash2 className="h-3.5 w-3.5"/></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {formStep > 0 && <Button variant="outline" onClick={() => setFormStep(formStep - 1)}>Voltar</Button>}
            {formStep < 2 ? (
              <Button onClick={() => setFormStep(formStep + 1)} disabled={formStep === 0 && !formTrigger}>Próximo</Button>
            ) : (
              <Button onClick={saveAutomation} disabled={saving}>{saving ? "Salvando..." : editing ? "Atualizar" : "Criar Automação"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LOGS DIALOG */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Logs de Execução</DialogTitle>
          </DialogHeader>
          {automationLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma execução registrada</p>
          ) : (
            <div className="space-y-2">
              {automationLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Badge variant="outline" className={log.result === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                    {log.result === "success" ? "OK" : "Erro"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{log.details || "Executado com sucesso"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutomationsPage;
