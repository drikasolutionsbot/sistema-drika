import { useState, useEffect, useCallback } from "react";
import {
  Shield, ShieldAlert, ShieldCheck, ShieldOff, Ban, Users, MessageSquare,
  Zap, Link2, UserX, AlertTriangle, Clock, RefreshCw, Plus, Trash2,
  Settings2, Activity, Eye, EyeOff, Search, Check, X, Skull,
  Volume2, AtSign, Hash, Globe, Lock, Unlock, ChevronDown, ChevronRight,
  Siren, BellRing, RotateCcw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
interface ProtectionSetting {
  id?: string;
  tenant_id: string;
  module_key: string;
  enabled: boolean;
  config: Record<string, any>;
}

interface WhitelistEntry {
  id: string;
  type: "user" | "role";
  discord_id: string;
  label: string | null;
  created_at: string;
}

interface ProtectionLog {
  id: string;
  module_key: string;
  action: string;
  target_user_id: string | null;
  target_username: string | null;
  details: Record<string, any>;
  created_at: string;
}

// ─── Module Definitions ──────────────────
interface ModuleDef {
  key: string;
  name: string;
  description: string;
  icon: any;
  category: "anti_raid" | "anti_spam" | "anti_nuke" | "moderation";
  color: string;
  configFields: ConfigField[];
}

interface ConfigField {
  key: string;
  label: string;
  type: "number" | "select" | "boolean" | "slider";
  default: any;
  description?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

const MODULES: ModuleDef[] = [
  // ANTI-RAID
  {
    key: "anti_raid",
    name: "Anti-Raid",
    description: "Detecta e bloqueia entradas em massa suspeitas no servidor",
    icon: ShieldAlert,
    category: "anti_raid",
    color: "text-red-400 bg-red-500/10",
    configFields: [
      { key: "join_threshold", label: "Limite de entradas", type: "slider", default: 10, min: 3, max: 50, step: 1, description: "Máximo de entradas em X segundos" },
      { key: "join_window", label: "Janela de tempo (seg)", type: "slider", default: 10, min: 5, max: 60, step: 5, description: "Período para contar entradas" },
      { key: "action", label: "Ação", type: "select", default: "kick", options: [{ value: "kick", label: "Expulsar" }, { value: "ban", label: "Banir" }, { value: "mute", label: "Silenciar" }, { value: "lockdown", label: "Lockdown" }] },
      { key: "notify_channel", label: "Notificar no canal de logs", type: "boolean", default: true },
      { key: "auto_lockdown", label: "Lockdown automático", type: "boolean", default: false, description: "Tranca o servidor automaticamente durante raids" },
    ],
  },
  {
    key: "anti_massban",
    name: "Anti-Mass Ban",
    description: "Impede que membros/bots bannem múltiplos usuários rapidamente",
    icon: Ban,
    category: "anti_nuke",
    color: "text-orange-400 bg-orange-500/10",
    configFields: [
      { key: "ban_threshold", label: "Limite de bans", type: "slider", default: 3, min: 1, max: 20, step: 1 },
      { key: "ban_window", label: "Janela de tempo (seg)", type: "slider", default: 30, min: 5, max: 120, step: 5 },
      { key: "action", label: "Ação contra infrator", type: "select", default: "remove_roles", options: [{ value: "remove_roles", label: "Remover cargos" }, { value: "ban", label: "Banir" }, { value: "kick", label: "Expulsar" }] },
      { key: "restore_banned", label: "Restaurar membros banidos", type: "boolean", default: true },
    ],
  },
  {
    key: "anti_masskick",
    name: "Anti-Mass Kick",
    description: "Impede expulsões em massa por membros ou bots comprometidos",
    icon: UserX,
    category: "anti_nuke",
    color: "text-orange-400 bg-orange-500/10",
    configFields: [
      { key: "kick_threshold", label: "Limite de kicks", type: "slider", default: 3, min: 1, max: 20, step: 1 },
      { key: "kick_window", label: "Janela de tempo (seg)", type: "slider", default: 30, min: 5, max: 120, step: 5 },
      { key: "action", label: "Ação contra infrator", type: "select", default: "remove_roles", options: [{ value: "remove_roles", label: "Remover cargos" }, { value: "ban", label: "Banir" }] },
    ],
  },
  // ANTI-SPAM
  {
    key: "anti_spam",
    name: "Anti-Spam",
    description: "Detecta e pune envio de mensagens repetidas ou rápidas",
    icon: MessageSquare,
    category: "anti_spam",
    color: "text-yellow-400 bg-yellow-500/10",
    configFields: [
      { key: "msg_threshold", label: "Mensagens por janela", type: "slider", default: 5, min: 3, max: 20, step: 1 },
      { key: "msg_window", label: "Janela de tempo (seg)", type: "slider", default: 5, min: 2, max: 30, step: 1 },
      { key: "duplicate_check", label: "Detectar duplicatas", type: "boolean", default: true, description: "Considera mensagens idênticas como spam" },
      { key: "action", label: "Ação", type: "select", default: "mute", options: [{ value: "warn", label: "Avisar" }, { value: "mute", label: "Silenciar" }, { value: "kick", label: "Expulsar" }, { value: "ban", label: "Banir" }] },
      { key: "mute_duration", label: "Duração do mute (min)", type: "slider", default: 5, min: 1, max: 60, step: 1 },
      { key: "delete_messages", label: "Deletar mensagens", type: "boolean", default: true },
    ],
  },
  {
    key: "anti_link",
    name: "Anti-Link",
    description: "Bloqueia links e convites de servidores externos",
    icon: Link2,
    category: "anti_spam",
    color: "text-yellow-400 bg-yellow-500/10",
    configFields: [
      { key: "block_invites", label: "Bloquear convites Discord", type: "boolean", default: true },
      { key: "block_external_links", label: "Bloquear links externos", type: "boolean", default: false },
      { key: "block_ip_loggers", label: "Bloquear IP loggers", type: "boolean", default: true },
      { key: "action", label: "Ação", type: "select", default: "delete", options: [{ value: "delete", label: "Apenas deletar" }, { value: "warn", label: "Deletar + Avisar" }, { value: "mute", label: "Deletar + Silenciar" }, { value: "kick", label: "Deletar + Expulsar" }] },
      { key: "allowed_domains", label: "Domínios permitidos (separados por vírgula)", type: "select", default: "", options: [] },
    ],
  },
  {
    key: "anti_mention",
    name: "Anti-Mention Spam",
    description: "Limita menções em massa de membros ou cargos",
    icon: AtSign,
    category: "anti_spam",
    color: "text-yellow-400 bg-yellow-500/10",
    configFields: [
      { key: "max_mentions", label: "Máximo de menções", type: "slider", default: 5, min: 1, max: 30, step: 1 },
      { key: "action", label: "Ação", type: "select", default: "mute", options: [{ value: "warn", label: "Avisar" }, { value: "mute", label: "Silenciar" }, { value: "kick", label: "Expulsar" }, { value: "ban", label: "Banir" }] },
      { key: "delete_message", label: "Deletar mensagem", type: "boolean", default: true },
    ],
  },
  // ANTI-NUKE
  {
    key: "anti_channel_delete",
    name: "Anti-Channel Delete",
    description: "Previne exclusão em massa de canais",
    icon: Hash,
    category: "anti_nuke",
    color: "text-orange-400 bg-orange-500/10",
    configFields: [
      { key: "delete_threshold", label: "Limite de exclusões", type: "slider", default: 3, min: 1, max: 10, step: 1 },
      { key: "delete_window", label: "Janela de tempo (seg)", type: "slider", default: 30, min: 5, max: 120, step: 5 },
      { key: "action", label: "Ação contra infrator", type: "select", default: "remove_roles", options: [{ value: "remove_roles", label: "Remover cargos" }, { value: "ban", label: "Banir" }] },
      { key: "restore_channels", label: "Restaurar canais deletados", type: "boolean", default: true },
    ],
  },
  {
    key: "anti_role_delete",
    name: "Anti-Role Delete",
    description: "Previne exclusão em massa de cargos",
    icon: ShieldOff,
    category: "anti_nuke",
    color: "text-orange-400 bg-orange-500/10",
    configFields: [
      { key: "delete_threshold", label: "Limite de exclusões", type: "slider", default: 3, min: 1, max: 10, step: 1 },
      { key: "delete_window", label: "Janela de tempo (seg)", type: "slider", default: 30, min: 5, max: 120, step: 5 },
      { key: "action", label: "Ação contra infrator", type: "select", default: "remove_roles", options: [{ value: "remove_roles", label: "Remover cargos" }, { value: "ban", label: "Banir" }] },
    ],
  },
  // MODERATION
  {
    key: "anti_token",
    name: "Anti-Token / Alt Detector",
    description: "Detecta contas alternativas e tokens comprometidos",
    icon: Skull,
    category: "moderation",
    color: "text-purple-400 bg-purple-500/10",
    configFields: [
      { key: "min_account_age", label: "Idade mínima da conta (dias)", type: "slider", default: 7, min: 0, max: 90, step: 1 },
      { key: "no_avatar_action", label: "Ação sem avatar", type: "select", default: "none", options: [{ value: "none", label: "Nenhuma" }, { value: "warn", label: "Avisar" }, { value: "kick", label: "Expulsar" }] },
      { key: "no_verified_email", label: "Exigir email verificado", type: "boolean", default: false },
    ],
  },
  {
    key: "auto_mod_caps",
    name: "Anti-Caps Lock",
    description: "Limita o uso excessivo de letras maiúsculas",
    icon: Volume2,
    category: "moderation",
    color: "text-purple-400 bg-purple-500/10",
    configFields: [
      { key: "caps_percent", label: "% máximo de CAPS", type: "slider", default: 70, min: 30, max: 100, step: 5 },
      { key: "min_length", label: "Comprimento mínimo p/ verificar", type: "slider", default: 8, min: 3, max: 30, step: 1 },
      { key: "action", label: "Ação", type: "select", default: "delete", options: [{ value: "delete", label: "Deletar" }, { value: "warn", label: "Avisar" }, { value: "mute", label: "Silenciar" }] },
    ],
  },
];

const CATEGORY_META: Record<string, { label: string; description: string; icon: any; color: string }> = {
  anti_raid: { label: "Anti-Raid", description: "Proteção contra invasões em massa", icon: ShieldAlert, color: "text-red-400" },
  anti_spam: { label: "Anti-Spam", description: "Filtros de conteúdo e mensagens", icon: MessageSquare, color: "text-yellow-400" },
  anti_nuke: { label: "Anti-Nuke", description: "Proteção contra destruição do servidor", icon: Siren, color: "text-orange-400" },
  moderation: { label: "Moderação Automática", description: "Ferramentas de moderação inteligente", icon: Settings2, color: "text-purple-400" },
};

// ─── Component ──────────────────────────
const ProtectionPage = () => {
  const { tenantId } = useTenant();
  const [settings, setSettings] = useState<Record<string, ProtectionSetting>>({});
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [logs, setLogs] = useState<ProtectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Whitelist form
  const [wlDialogOpen, setWlDialogOpen] = useState(false);
  const [wlForm, setWlForm] = useState({ type: "user" as "user" | "role", discord_id: "", label: "" });
  const [savingWl, setSavingWl] = useState(false);

  const invoke = useCallback(async (body: any) => {
    const { data, error } = await supabase.functions.invoke("manage-protection", { body: { ...body, tenant_id: tenantId } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, [tenantId]);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [settingsData, whitelistData, logsData] = await Promise.all([
        invoke({ action: "list_settings" }),
        invoke({ action: "list_whitelist" }),
        invoke({ action: "list_logs" }),
      ]);

      const map: Record<string, ProtectionSetting> = {};
      (settingsData || []).forEach((s: ProtectionSetting) => { map[s.module_key] = s; });
      setSettings(map);
      setWhitelist(whitelistData || []);
      setLogs(logsData || []);
    } catch (err: any) {
      console.error("Protection fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, invoke]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`protection-realtime-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "protection_settings", filter: `tenant_id=eq.${tenantId}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "protection_logs", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as any;
          toast.warning(`🛡️ ${row.action}`, { description: `${row.target_username || ""} — ${row.module_key}` });
        }
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "protection_whitelist", filter: `tenant_id=eq.${tenantId}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, fetchData]);

  const toggleModule = async (moduleKey: string, enabled: boolean) => {
    const existing = settings[moduleKey];
    const mod = MODULES.find((m) => m.key === moduleKey)!;
    const defaultConfig: Record<string, any> = {};
    mod.configFields.forEach((f) => { defaultConfig[f.key] = f.default; });

    try {
      await invoke({
        action: "upsert_setting",
        module_key: moduleKey,
        enabled,
        config: existing?.config || defaultConfig,
      });
      toast.success(enabled ? "Módulo ativado" : "Módulo desativado", { description: mod.name });
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const updateModuleConfig = async (moduleKey: string, configUpdate: Record<string, any>) => {
    const existing = settings[moduleKey];
    const mod = MODULES.find((m) => m.key === moduleKey)!;
    const defaultConfig: Record<string, any> = {};
    mod.configFields.forEach((f) => { defaultConfig[f.key] = f.default; });

    const merged = { ...(existing?.config || defaultConfig), ...configUpdate };
    try {
      await invoke({
        action: "upsert_setting",
        module_key: moduleKey,
        enabled: existing?.enabled ?? false,
        config: merged,
      });
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const syncToDiscord = async () => {
    setSyncing(true);
    try {
      const result = await invoke({ action: "sync_to_discord" });
      if (result?.success) {
        toast.success("🛡️ Proteção sincronizada", { description: "Configurações enviadas ao bot do Discord" });
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setSyncing(false); }
  };

  const addWhitelist = async () => {
    if (!wlForm.discord_id.trim()) { toast.error("ID obrigatório"); return; }
    setSavingWl(true);
    try {
      await invoke({ action: "add_whitelist", ...wlForm });
      toast.success("Adicionado à whitelist");
      setWlDialogOpen(false);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingWl(false); }
  };

  const removeWhitelist = async (id: string) => {
    try {
      await invoke({ action: "remove_whitelist", whitelist_id: id });
      toast.success("Removido da whitelist");
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const clearLogs = async () => {
    try {
      await invoke({ action: "clear_logs" });
      toast.success("Logs limpos");
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const toggleExpand = (key: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getModuleConfig = (moduleKey: string) => {
    const existing = settings[moduleKey];
    const mod = MODULES.find((m) => m.key === moduleKey)!;
    const defaultConfig: Record<string, any> = {};
    mod.configFields.forEach((f) => { defaultConfig[f.key] = f.default; });
    return { ...(defaultConfig), ...(existing?.config || {}) };
  };

  const enabledCount = Object.values(settings).filter((s) => s.enabled).length;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Proteção
          </h1>
          <p className="text-muted-foreground text-sm">Configure anti-raid, anti-spam, anti-nuke e moderação automática</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Button size="sm" onClick={syncToDiscord} disabled={syncing} className="gap-2 glow-pink">
            <Zap className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar com Discord"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg p-2.5 bg-primary/10"><ShieldCheck className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-bold">{enabledCount}</p><p className="text-xs text-muted-foreground">Módulos Ativos</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg p-2.5 bg-emerald-500/10"><Users className="h-5 w-5 text-emerald-400" /></div>
          <div><p className="text-2xl font-bold">{whitelist.length}</p><p className="text-xs text-muted-foreground">Na Whitelist</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg p-2.5 bg-yellow-500/10"><Activity className="h-5 w-5 text-yellow-400" /></div>
          <div><p className="text-2xl font-bold">{logs.length}</p><p className="text-xs text-muted-foreground">Logs Recentes</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="rounded-lg p-2.5 bg-blue-500/10"><Globe className="h-5 w-5 text-blue-400" /></div>
          <div><p className="text-2xl font-bold">{MODULES.length}</p><p className="text-xs text-muted-foreground">Total de Módulos</p></div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="modules">
        <TabsList className="bg-muted">
          <TabsTrigger value="modules">Módulos ({MODULES.length})</TabsTrigger>
          <TabsTrigger value="whitelist">Whitelist ({whitelist.length})</TabsTrigger>
          <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
        </TabsList>

        {/* ═══ MODULES TAB ═══ */}
        <TabsContent value="modules" className="space-y-6 mt-4">
          {(["anti_raid", "anti_spam", "anti_nuke", "moderation"] as const).map((category) => {
            const cat = CATEGORY_META[category];
            const CatIcon = cat.icon;
            const mods = MODULES.filter((m) => m.category === category);
            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <CatIcon className={`h-5 w-5 ${cat.color}`} />
                  <h2 className="font-display font-semibold text-lg">{cat.label}</h2>
                  <span className="text-xs text-muted-foreground">— {cat.description}</span>
                </div>
                <div className="space-y-2">
                  {mods.map((mod) => {
                    const Icon = mod.icon;
                    const isEnabled = settings[mod.key]?.enabled ?? false;
                    const isExpanded = expandedModules.has(mod.key);
                    const config = getModuleConfig(mod.key);

                    return (
                      <Collapsible key={mod.key} open={isExpanded} onOpenChange={() => toggleExpand(mod.key)}>
                        <div className={`rounded-xl border transition-all duration-300 ${isEnabled ? "border-primary/30 bg-card" : "border-border bg-card/50"}`}>
                          {/* Module Header */}
                          <div className="flex items-center justify-between p-4">
                            <CollapsibleTrigger asChild>
                              <button className="flex items-center gap-3 flex-1 text-left group">
                                <div className={`rounded-lg p-2.5 transition-all duration-300 ${mod.color} ${isEnabled ? "scale-110" : "opacity-50"}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold">{mod.name}</p>
                                    {isEnabled && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">ATIVO</Badge>}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{mod.description}</p>
                                </div>
                                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
                              </button>
                            </CollapsibleTrigger>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(v) => toggleModule(mod.key, v)}
                              className="ml-3"
                            />
                          </div>

                          {/* Module Config */}
                          <CollapsibleContent>
                            <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                              {mod.configFields.map((field) => (
                                <div key={field.key} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-sm">{field.label}</Label>
                                    {field.description && (
                                      <span className="text-[10px] text-muted-foreground">{field.description}</span>
                                    )}
                                  </div>

                                  {field.type === "slider" && (
                                    <div className="flex items-center gap-4">
                                      <Slider
                                        value={[config[field.key] ?? field.default]}
                                        min={field.min}
                                        max={field.max}
                                        step={field.step}
                                        onValueCommit={(v) => updateModuleConfig(mod.key, { [field.key]: v[0] })}
                                        className="flex-1"
                                        disabled={!isEnabled}
                                      />
                                      <span className="text-sm font-mono font-bold w-10 text-right">{config[field.key] ?? field.default}</span>
                                    </div>
                                  )}

                                  {field.type === "select" && field.options && field.options.length > 0 && (
                                    <Select
                                      value={config[field.key] ?? field.default}
                                      onValueChange={(v) => updateModuleConfig(mod.key, { [field.key]: v })}
                                      disabled={!isEnabled}
                                    >
                                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {field.options.map((opt) => (
                                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}

                                  {field.type === "boolean" && (
                                    <div className="flex items-center gap-3">
                                      <Switch
                                        checked={config[field.key] ?? field.default}
                                        onCheckedChange={(v) => updateModuleConfig(mod.key, { [field.key]: v })}
                                        disabled={!isEnabled}
                                      />
                                      <span className="text-xs text-muted-foreground">
                                        {(config[field.key] ?? field.default) ? "Ativado" : "Desativado"}
                                      </span>
                                    </div>
                                  )}

                                  {field.type === "number" && (
                                    <Input
                                      type="number"
                                      value={config[field.key] ?? field.default}
                                      onChange={(e) => updateModuleConfig(mod.key, { [field.key]: parseInt(e.target.value) || 0 })}
                                      disabled={!isEnabled}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* ═══ WHITELIST TAB ═══ */}
        <TabsContent value="whitelist" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Usuários e cargos isentos da proteção automática</p>
            <Button size="sm" onClick={() => { setWlForm({ type: "user", discord_id: "", label: "" }); setWlDialogOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>

          {whitelist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Lock className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">Whitelist vazia</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Adicione usuários ou cargos para isentá-los da proteção</p>
            </div>
          ) : (
            <div className="space-y-2">
              {whitelist.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${entry.type === "user" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"}`}>
                      {entry.type === "user" ? <Users className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{entry.label || entry.discord_id}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{entry.type === "user" ? "Usuário" : "Cargo"}</Badge>
                        <span className="text-xs font-mono text-muted-foreground">{entry.discord_id}</span>
                      </div>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover da whitelist?</AlertDialogTitle>
                        <AlertDialogDescription>Este item ficará sujeito às regras de proteção novamente.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeWhitelist(entry.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ LOGS TAB ═══ */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Eventos recentes de proteção do servidor</p>
            {logs.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" /> Limpar Logs
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar todos os logs?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={clearLogs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Limpar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">Nenhum log registrado</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Eventos de proteção aparecerão aqui em tempo real</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const mod = MODULES.find((m) => m.key === log.module_key);
                const LogIcon = mod?.icon || AlertTriangle;
                const color = mod?.color || "text-muted-foreground bg-muted";
                return (
                  <div key={log.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                    <div className={`rounded-lg p-2 ${color} shrink-0`}>
                      <LogIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{log.action}</p>
                        <Badge variant="outline" className="text-[10px]">{mod?.name || log.module_key}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {log.target_username || log.target_user_id || "Sistema"}
                        {log.details && Object.keys(log.details).length > 0 && ` — ${JSON.stringify(log.details)}`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Whitelist Dialog */}
      <Dialog open={wlDialogOpen} onOpenChange={setWlDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-primary" />
              Adicionar à Whitelist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={wlForm.type} onValueChange={(v: "user" | "role") => setWlForm({ ...wlForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="role">Cargo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ID do Discord *</Label>
              <Input value={wlForm.discord_id} onChange={(e) => setWlForm({ ...wlForm, discord_id: e.target.value })} placeholder="Ex: 123456789012345678" />
            </div>
            <div className="space-y-2">
              <Label>Rótulo (opcional)</Label>
              <Input value={wlForm.label} onChange={(e) => setWlForm({ ...wlForm, label: e.target.value })} placeholder="Ex: Administrador Principal" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWlDialogOpen(false)}>Cancelar</Button>
            <Button onClick={addWhitelist} disabled={savingWl}>{savingWl ? "Salvando..." : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProtectionPage;
