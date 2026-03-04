import { useState, useEffect, useCallback } from "react";
import {
  Zap, Plus, Trash2, Edit2, Power, PowerOff, RefreshCw, Search,
  Play, Clock, Activity, ChevronDown, ChevronRight, Eye, Copy,
  UserPlus, UserMinus, MessageSquare, Hash, AtSign, Gift, ShieldCheck,
  Bell, Send, Tag, Star, Heart, Award, Megaphone, Ban, UserX,
  PenLine, Image,
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

// ─── Types ──────────────────────────
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

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

// ─── Trigger & Action Definitions ──────────
interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea" | "channel" | "role";
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface TriggerDef {
  key: string;
  label: string;
  description: string;
  icon: any;
  color: string;
  category: string;
  configFields: FieldDef[];
  auto?: boolean; // true = funciona automaticamente sem bot externo
}

interface ActionDef {
  key: string;
  label: string;
  description: string;
  icon: any;
  color: string;
  configFields: FieldDef[];
}

const TRIGGERS: TriggerDef[] = [
  { key: "order_created", label: "Pedido Criado", description: "Quando um novo pedido é criado na loja", icon: Tag, color: "text-yellow-400 bg-yellow-500/10", category: "Loja", auto: true, configFields: [] },
  { key: "order_paid", label: "Pagamento Confirmado", description: "Quando um pedido é pago", icon: Award, color: "text-emerald-400 bg-emerald-500/10", category: "Loja", auto: true, configFields: [] },
  { key: "member_join", label: "Membro Entrou", description: "Quando um novo membro entra no servidor", icon: UserPlus, color: "text-emerald-400 bg-emerald-500/10", category: "Membros", configFields: [] },
  { key: "member_leave", label: "Membro Saiu", description: "Quando um membro sai do servidor", icon: UserMinus, color: "text-red-400 bg-red-500/10", category: "Membros", configFields: [] },
  { key: "member_boost", label: "Membro Boostou", description: "Quando um membro impulsiona o servidor", icon: Star, color: "text-pink-400 bg-pink-500/10", category: "Membros", configFields: [] },
  { key: "message_contains", label: "Mensagem Contém", description: "Quando uma mensagem contém palavras específicas", icon: MessageSquare, color: "text-blue-400 bg-blue-500/10", category: "Mensagens", configFields: [
    { key: "keywords", label: "Palavras-chave (separadas por vírgula)", type: "text", placeholder: "comprar, preço, ajuda" },
    { key: "channel_id", label: "Canal específico (opcional)", type: "channel" },
  ]},
  { key: "reaction_add", label: "Reação Adicionada", description: "Quando uma reação é adicionada a uma mensagem", icon: Heart, color: "text-pink-400 bg-pink-500/10", category: "Mensagens", configFields: [
    { key: "emoji", label: "Emoji específico (opcional)", type: "text", placeholder: "✅ ou nome do emoji" },
    { key: "message_id", label: "ID da Mensagem (opcional)", type: "text", placeholder: "ID da mensagem" },
  ]},
  { key: "ticket_created", label: "Ticket Criado", description: "Quando um ticket de suporte é aberto", icon: Bell, color: "text-blue-400 bg-blue-500/10", category: "Suporte", auto: true, configFields: [] },
  { key: "scheduled", label: "Agendado", description: "Executa em intervalos regulares", icon: Clock, color: "text-purple-400 bg-purple-500/10", category: "Sistema", configFields: [
    { key: "interval_minutes", label: "Intervalo (minutos)", type: "number", placeholder: "60" },
    { key: "start_time", label: "Horário inicial (HH:MM)", type: "text", placeholder: "08:00" },
  ]},
];

const ACTIONS: ActionDef[] = [
  { key: "send_message", label: "Enviar Mensagem", description: "Envia uma mensagem de texto em um canal", icon: Send, color: "text-blue-400 bg-blue-500/10", configFields: [
    { key: "channel_id", label: "Canal", type: "channel" },
    { key: "content", label: "Mensagem", type: "textarea", placeholder: "Use {user}, {server}, {member_count} como variáveis" },
  ]},
  { key: "send_embed", label: "Enviar Embed", description: "Envia um embed rico em um canal", icon: Image, color: "text-indigo-400 bg-indigo-500/10", configFields: [
    { key: "channel_id", label: "Canal", type: "channel" },
    { key: "title", label: "Título", type: "text", placeholder: "Título do embed" },
    { key: "description", label: "Descrição", type: "textarea", placeholder: "Conteúdo do embed. Use {user}, {server}" },
    { key: "color", label: "Cor (hex)", type: "text", placeholder: "#5865F2" },
    { key: "thumbnail_url", label: "Thumbnail URL (opcional)", type: "text", placeholder: "https://..." },
    { key: "image_url", label: "Imagem URL (opcional)", type: "text", placeholder: "https://..." },
  ]},
  { key: "send_dm", label: "Enviar DM", description: "Envia uma mensagem direta ao usuário", icon: MessageSquare, color: "text-purple-400 bg-purple-500/10", configFields: [
    { key: "content", label: "Mensagem", type: "textarea", placeholder: "Use {user}, {server} como variáveis" },
  ]},
  { key: "add_role", label: "Adicionar Cargo", description: "Adiciona um cargo ao membro", icon: ShieldCheck, color: "text-emerald-400 bg-emerald-500/10", configFields: [
    { key: "role_id", label: "Cargo", type: "role" },
  ]},
  { key: "remove_role", label: "Remover Cargo", description: "Remove um cargo do membro", icon: ShieldCheck, color: "text-red-400 bg-red-500/10", configFields: [
    { key: "role_id", label: "Cargo", type: "role" },
  ]},
  { key: "kick_member", label: "Expulsar Membro", description: "Expulsa o membro do servidor", icon: UserX, color: "text-orange-400 bg-orange-500/10", configFields: [] },
  { key: "ban_member", label: "Banir Membro", description: "Bane o membro do servidor", icon: Ban, color: "text-red-500 bg-red-500/10", configFields: [
    { key: "delete_days", label: "Deletar mensagens (dias)", type: "number", placeholder: "0" },
  ]},
  { key: "change_nickname", label: "Alterar Apelido", description: "Altera o apelido do membro", icon: PenLine, color: "text-cyan-400 bg-cyan-500/10", configFields: [
    { key: "nickname", label: "Novo apelido", type: "text", placeholder: "Use {username} como variável" },
  ]},
  { key: "send_announcement", label: "Enviar Anúncio", description: "Envia um embed de anúncio em um canal", icon: Megaphone, color: "text-orange-400 bg-orange-500/10", configFields: [
    { key: "channel_id", label: "Canal", type: "channel" },
    { key: "title", label: "Título", type: "text", placeholder: "Título do anúncio" },
    { key: "description", label: "Descrição", type: "textarea", placeholder: "Conteúdo do anúncio" },
    { key: "color", label: "Cor (hex)", type: "text", placeholder: "#FF69B4" },
  ]},
];

const CONDITION_TYPES = [
  { value: "has_role", label: "Tem o cargo" },
  { value: "not_has_role", label: "Não tem o cargo" },
  { value: "in_channel", label: "No canal" },
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

  // Discord data
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);

  // Form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [formName, setFormName] = useState("");
  const [formTrigger, setFormTrigger] = useState("");
  const [formTriggerConfig, setFormTriggerConfig] = useState<Record<string, any>>({});
  const [formActions, setFormActions] = useState<AutoAction[]>([]);
  const [formConditions, setFormConditions] = useState<AutoCondition[]>([]);
  const [saving, setSaving] = useState(false);
  const [formStep, setFormStep] = useState(0);

  // Logs dialog
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logsForAutomation, setLogsForAutomation] = useState<string | null>(null);
  const [automationLogs, setAutomationLogs] = useState<AutoLog[]>([]);

  const invoke = useCallback(async (fn: string, body: any) => {
    const { data, error } = await supabase.functions.invoke(fn, { body: { ...body, tenant_id: tenantId } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, [tenantId]);

  const fetchDiscordData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [chData, roleData] = await Promise.all([
        supabase.functions.invoke("discord-channels", { body: { tenant_id: tenantId } }),
        supabase.functions.invoke("manage-roles", { body: { action: "list", tenant_id: tenantId } }),
      ]);
      const chResult = chData.data;
      if (chResult?.channels && Array.isArray(chResult.channels)) {
        setChannels(chResult.channels.filter((c: any) => c.type === undefined || c.type === 0 || c.type === 5).sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "")));
      } else if (Array.isArray(chResult)) {
        setChannels(chResult.filter((c: any) => c.type === 0 || c.type === 5).sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "")));
      }
      // Try to get Discord roles directly
      const guildInfo = await supabase.functions.invoke("discord-guild-info", { body: { tenant_id: tenantId } });
      if (guildInfo.data?.roles) {
        setRoles(guildInfo.data.roles.filter((r: any) => r.name !== "@everyone").sort((a: any, b: any) => b.position - a.position));
      }
    } catch (err) {
      console.error("Failed to fetch Discord data:", err);
    }
  }, [tenantId]);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [autoData, logsData] = await Promise.all([
        invoke("manage-automations", { action: "list" }),
        invoke("manage-automations", { action: "list_logs", limit: 20 }),
      ]);
      setAutomations(autoData || []);
      setLogs(logsData || []);
    } catch (err: any) { console.error(err); }
    finally { setLoading(false); }
  }, [tenantId, invoke]);

  useEffect(() => { fetchData(); fetchDiscordData(); }, [fetchData, fetchDiscordData]);

  // Realtime
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`automations-realtime-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "automations", filter: `tenant_id=eq.${tenantId}` }, () => fetchData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "automation_logs", filter: `tenant_id=eq.${tenantId}` }, () => {
        toast.info("⚡ Automação executada");
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, fetchData]);

  // CRUD
  const openNew = () => {
    setEditing(null); setFormName(""); setFormTrigger(""); setFormTriggerConfig({});
    setFormActions([]); setFormConditions([]); setFormStep(0); setDialogOpen(true);
  };

  const openEdit = (auto: Automation) => {
    setEditing(auto); setFormName(auto.name); setFormTrigger(auto.trigger_type);
    setFormTriggerConfig(auto.trigger_config); setFormActions(auto.actions);
    setFormConditions(auto.conditions); setFormStep(0); setDialogOpen(true);
  };

  const saveAutomation = async () => {
    if (!formName.trim() || !formTrigger) { toast.error("Nome e gatilho são obrigatórios"); return; }
    if (formActions.length === 0) { toast.error("Adicione pelo menos uma ação"); return; }
    setSaving(true);
    try {
      if (editing) {
        await invoke("manage-automations", { action: "update", automation_id: editing.id, name: formName, trigger_type: formTrigger, trigger_config: formTriggerConfig, actions: formActions, conditions: formConditions });
        toast.success("Automação atualizada");
      } else {
        await invoke("manage-automations", { action: "create", name: formName, trigger_type: formTrigger, trigger_config: formTriggerConfig, actions: formActions, conditions: formConditions });
        toast.success("Automação criada");
      }
      setDialogOpen(false); fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const deleteAutomation = async (id: string) => {
    try { await invoke("manage-automations", { action: "delete", automation_id: id }); toast.success("Automação removida"); fetchData(); }
    catch (err: any) { toast.error(err.message); }
  };

  const toggleAutomation = async (id: string, enabled: boolean) => {
    try { await invoke("manage-automations", { action: "toggle", automation_id: id, enabled }); fetchData(); }
    catch (err: any) { toast.error(err.message); }
  };

  const openLogs = async (automationId: string) => {
    setLogsForAutomation(automationId);
    try {
      const data = await invoke("manage-automations", { action: "list_logs", automation_id: automationId, limit: 30 });
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

  const removeAction = (idx: number) => setFormActions(formActions.filter((_, i) => i !== idx));

  const addCondition = () => setFormConditions([...formConditions, { type: "has_role", value: "" }]);

  const updateCondition = (idx: number, field: "type" | "value", val: string) => {
    const updated = [...formConditions];
    updated[idx] = { ...updated[idx], [field]: val };
    setFormConditions(updated);
  };

  const removeCondition = (idx: number) => setFormConditions(formConditions.filter((_, i) => i !== idx));

  const filtered = automations.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));
  const activeCount = automations.filter((a) => a.enabled).length;
  const totalExecs = automations.reduce((sum, a) => sum + a.executions, 0);
  const triggerDef = (key: string) => TRIGGERS.find((t) => t.key === key);
  const actionDef = (key: string) => ACTIONS.find((a) => a.key === key);

  const channelName = (id: string) => channels.find(c => c.id === id)?.name || id;
  const roleName = (id: string) => roles.find(r => r.id === id)?.name || id;

  // ─── Dynamic field renderer ──────────
  const renderField = (f: FieldDef, value: string, onChange: (v: string) => void) => {
    if (f.type === "channel") {
      return (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Selecione um canal..." /></SelectTrigger>
          <SelectContent>
            {channels.map(ch => (
              <SelectItem key={ch.id} value={ch.id}>
                <span className="flex items-center gap-1.5">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  {ch.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (f.type === "role") {
      return (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Selecione um cargo..." /></SelectTrigger>
          <SelectContent>
            {roles.map(r => (
              <SelectItem key={r.id} value={r.id}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#99AAB5" }} />
                  {r.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (f.type === "textarea") {
      return <Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} rows={2} />;
    }
    return <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} type={f.type === "number" ? "number" : "text"} />;
  };

  // ─── Condition value renderer ──────────
  const renderConditionValue = (cond: AutoCondition, idx: number) => {
    if (cond.type === "has_role" || cond.type === "not_has_role") {
      return (
        <Select value={cond.value} onValueChange={(v) => updateCondition(idx, "value", v)}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um cargo..." /></SelectTrigger>
          <SelectContent>
            {roles.map(r => (
              <SelectItem key={r.id} value={r.id}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#99AAB5" }} />
                  {r.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (cond.type === "in_channel") {
      return (
        <Select value={cond.value} onValueChange={(v) => updateCondition(idx, "value", v)}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um canal..." /></SelectTrigger>
          <SelectContent>
            {channels.map(ch => (
              <SelectItem key={ch.id} value={ch.id}>
                <span className="flex items-center gap-1.5"><Hash className="h-3 w-3 text-muted-foreground" />{ch.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return <Input value={cond.value} onChange={(e) => updateCondition(idx, "value", e.target.value)} placeholder="Valor" className="flex-1" />;
  };

  // ─── Human-readable config display ──────────
  const displayConfigValue = (key: string, value: string) => {
    if (key === "channel_id") return `#${channelName(value)}`;
    if (key === "role_id") return `@${roleName(value)}`;
    return String(value);
  };

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
          <p className="text-muted-foreground text-sm">Crie automações sincronizadas com o seu servidor Discord</p>
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
                          <div>
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Gatilho</Label>
                            <div className="mt-1.5 rounded-lg border border-border p-3 bg-card/50">
                              <p className="text-sm font-medium">{trig?.label} — {trig?.description}</p>
                              {Object.keys(auto.trigger_config).length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {Object.entries(auto.trigger_config).filter(([,v]) => v).map(([k, v]) => (
                                    <p key={k} className="text-xs text-muted-foreground"><span className="font-mono">{k}:</span> {displayConfigValue(k, String(v))}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
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
                                        <p key={k} className="text-xs text-muted-foreground truncate"><span className="font-mono">{k}:</span> {displayConfigValue(k, String(v))}</p>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {auto.conditions.length > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Condições</Label>
                              <div className="mt-1.5 flex flex-wrap gap-2">
                                {auto.conditions.map((c, i) => {
                                  const label = CONDITION_TYPES.find(ct=>ct.value===c.type)?.label || c.type;
                                  const val = (c.type === "has_role" || c.type === "not_has_role") ? `@${roleName(c.value)}` :
                                    c.type === "in_channel" ? `#${channelName(c.value)}` : c.value;
                                  return <Badge key={i} variant="outline" className="text-xs">{label}: {val}</Badge>;
                                })}
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
                    <Badge variant="outline" className={
                      log.result === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      log.result === "skipped" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                      "bg-destructive/10 text-destructive border-destructive/20"
                    }>
                      {log.result === "success" ? "Sucesso" : log.result === "skipped" ? "Ignorado" : "Erro"}
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium">{t.label}</p>
                          {t.auto ? (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Auto</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-muted text-muted-foreground">Bot</Badge>
                          )}
                        </div>
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
                        {renderField(f, formTriggerConfig[f.key] || "", (v) => setFormTriggerConfig({...formTriggerConfig, [f.key]: v}))}
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
                  <SelectTrigger className="w-52"><SelectValue placeholder="Adicionar ação..."/></SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => (
                      <SelectItem key={a.key} value={a.key}>
                        <span className="flex items-center gap-1.5">
                          <a.icon className="h-3.5 w-3.5" />
                          {a.label}
                        </span>
                      </SelectItem>
                    ))}
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
                            <div>
                              <span className="text-sm font-semibold">{aDef?.label || act.type}</span>
                              {aDef?.description && <p className="text-[10px] text-muted-foreground">{aDef.description}</p>}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAction(idx)}><Trash2 className="h-3.5 w-3.5"/></Button>
                        </div>
                        {aDef?.configFields.map((f) => (
                          <div key={f.key} className="space-y-1">
                            <Label className="text-xs">{f.label}</Label>
                            {renderField(f, act.config[f.key] || "", (v) => updateActionConfig(idx, f.key, v))}
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
                <div className="space-y-3">
                  {formConditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-border p-3 bg-card/50">
                      <Select value={cond.type} onValueChange={(v) => updateCondition(idx, "type", v)}>
                        <SelectTrigger className="w-52"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {CONDITION_TYPES.map((ct) => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {renderConditionValue(cond, idx)}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeCondition(idx)}><Trash2 className="h-3.5 w-3.5"/></Button>
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
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum log encontrado.</p>
          ) : (
            <div className="space-y-2">
              {automationLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border p-3 bg-card/50">
                  <Badge variant="outline" className={`shrink-0 mt-0.5 ${
                    log.result === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    log.result === "skipped" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                    "bg-destructive/10 text-destructive border-destructive/20"
                  }`}>
                    {log.result === "success" ? "✓" : log.result === "skipped" ? "—" : "✗"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{log.details || log.result}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutomationsPage;
