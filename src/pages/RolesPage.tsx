import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck, Plus, Trash2, Loader2, Pencil, Save, X, RefreshCw,
  Eye, Settings2, Package, ShoppingCart, Boxes, Shield, Cloud,
  Wrench, Crown, Users, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  Ban, UserMinus, Volume2, MessageSquare, Hash, AtSign, Megaphone,
  Link, Clock, Smile, Globe, Mic, Video, Webhook, Bot
} from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface TenantRole {
  id: string;
  tenant_id: string;
  discord_role_id: string | null;
  name: string;
  color: string;
  synced: boolean;
  can_view: boolean;
  can_manage_app: boolean;
  can_manage_resources: boolean;
  can_change_server: boolean;
  can_manage_permissions: boolean;
  can_manage_bot_appearance: boolean;
  can_manage_products: boolean;
  can_manage_store: boolean;
  can_manage_stock: boolean;
  can_manage_protection: boolean;
  can_manage_ecloud: boolean;
  created_at: string;
  updated_at: string;
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
  permissions: string;
}

// ======= Panel RBAC permissions =======
const PANEL_PERMISSIONS = [
  { key: "can_view", label: "Visualizar Painel", icon: Eye, desc: "Acesso ao dashboard" },
  { key: "can_manage_app", label: "Gerenciar App", icon: Settings2, desc: "Configurações gerais" },
  { key: "can_manage_resources", label: "Gerenciar Recursos", icon: Wrench, desc: "Comandos e módulos" },
  { key: "can_change_server", label: "Trocar Servidor", icon: RefreshCw, desc: "Alterar servidor Discord" },
  { key: "can_manage_permissions", label: "Gerenciar Permissões", icon: Crown, desc: "Cargos e permissões" },
  { key: "can_manage_bot_appearance", label: "Aparência do Bot", icon: Pencil, desc: "Avatar, nome e status" },
  { key: "can_manage_products", label: "Gerenciar Produtos", icon: Package, desc: "CRUD de produtos" },
  { key: "can_manage_store", label: "Gerenciar Loja", icon: ShoppingCart, desc: "Config da loja" },
  { key: "can_manage_stock", label: "Gerenciar Estoque", icon: Boxes, desc: "Itens de estoque" },
  { key: "can_manage_protection", label: "Gerenciar Proteção", icon: Shield, desc: "Anti-raid/nuke" },
  { key: "can_manage_ecloud", label: "Gerenciar eCloud", icon: Cloud, desc: "Hosting eCloud" },
] as const;

// ======= Discord native permissions (bitwise) =======
const DISCORD_PERMISSIONS = [
  // General
  { bit: 0, label: "Administrador", icon: Crown, desc: "Acesso total ao servidor", category: "Geral", dangerous: true },
  { bit: 3, label: "Gerenciar Servidor", icon: Settings2, desc: "Alterar nome, região e ícone", category: "Geral" },
  { bit: 4, label: "Gerenciar Canais", icon: Hash, desc: "Criar, editar e excluir canais", category: "Geral" },
  { bit: 28, label: "Gerenciar Cargos", icon: ShieldCheck, desc: "Criar, editar e excluir cargos", category: "Geral" },
  { bit: 29, label: "Gerenciar Webhooks", icon: Webhook, desc: "Criar e gerenciar webhooks", category: "Geral" },
  { bit: 30, label: "Gerenciar Emojis", icon: Smile, desc: "Gerenciar emojis e figurinhas", category: "Geral" },
  { bit: 5, label: "Gerenciar Expressões", icon: Smile, desc: "Gerenciar expressões do servidor", category: "Geral" },
  { bit: 31, label: "Usar Comandos de App", icon: Bot, desc: "Usar comandos de barra e apps", category: "Geral" },
  { bit: 0x28, label: "Ver Insights do Servidor", icon: Eye, desc: "Acessar analytics do servidor", category: "Geral" },

  // Members
  { bit: 1, label: "Expulsar Membros", icon: UserMinus, desc: "Remover membros do servidor", category: "Membros" },
  { bit: 2, label: "Banir Membros", icon: Ban, desc: "Banir membros permanentemente", category: "Membros", dangerous: true },
  { bit: 0, label: "Criar Convites", icon: Link, desc: "Criar links de convite", category: "Membros", bitValue: BigInt(1) },
  { bit: 27, label: "Alterar Apelido", icon: Pencil, desc: "Alterar próprio apelido", category: "Membros" },
  { bit: 26, label: "Gerenciar Apelidos", icon: Users, desc: "Alterar apelido de outros", category: "Membros" },
  { bit: 40, label: "Moderar Membros", icon: Clock, desc: "Aplicar timeout em membros", category: "Membros" },

  // Text channels
  { bit: 10, label: "Ver Canais", icon: Eye, desc: "Visualizar canais de texto e voz", category: "Canais de Texto" },
  { bit: 11, label: "Enviar Mensagens", icon: MessageSquare, desc: "Enviar mensagens em canais", category: "Canais de Texto" },
  { bit: 14, label: "Inserir Links", icon: Link, desc: "Links com preview automático", category: "Canais de Texto" },
  { bit: 15, label: "Anexar Arquivos", icon: Package, desc: "Enviar imagens e arquivos", category: "Canais de Texto" },
  { bit: 6, label: "Adicionar Reações", icon: Smile, desc: "Reagir com emojis", category: "Canais de Texto" },
  { bit: 16, label: "Ler Histórico", icon: Eye, desc: "Ver mensagens anteriores", category: "Canais de Texto" },
  { bit: 17, label: "Mencionar @everyone", icon: AtSign, desc: "Mencionar @everyone e @here", category: "Canais de Texto" },
  { bit: 18, label: "Usar Emojis Externos", icon: Globe, desc: "Emojis de outros servidores", category: "Canais de Texto" },
  { bit: 13, label: "Gerenciar Mensagens", icon: Trash2, desc: "Deletar mensagens de outros", category: "Canais de Texto" },
  { bit: 12, label: "Gerenciar Threads", icon: MessageSquare, desc: "Gerenciar threads/tópicos", category: "Canais de Texto" },
  { bit: 38, label: "Enviar em Threads", icon: MessageSquare, desc: "Enviar mensagens em threads", category: "Canais de Texto" },
  { bit: 35, label: "Criar Threads Públicas", icon: MessageSquare, desc: "Criar threads públicas", category: "Canais de Texto" },
  { bit: 36, label: "Criar Threads Privadas", icon: MessageSquare, desc: "Criar threads privadas", category: "Canais de Texto" },

  // Voice channels
  { bit: 20, label: "Conectar", icon: Mic, desc: "Entrar em canais de voz", category: "Canais de Voz" },
  { bit: 21, label: "Falar", icon: Volume2, desc: "Falar em canais de voz", category: "Canais de Voz" },
  { bit: 22, label: "Transmitir Vídeo", icon: Video, desc: "Compartilhar câmera/tela", category: "Canais de Voz" },
  { bit: 23, label: "Mutar Membros", icon: Mic, desc: "Silenciar outros membros", category: "Canais de Voz" },
  { bit: 24, label: "Ensurdecer Membros", icon: Volume2, desc: "Ensurdecer outros membros", category: "Canais de Voz" },
  { bit: 25, label: "Mover Membros", icon: Users, desc: "Mover membros entre canais", category: "Canais de Voz" },
  { bit: 8, label: "Voz Prioritária", icon: Megaphone, desc: "Falar com prioridade (Push to Talk)", category: "Canais de Voz" },
];

// Deduplicate permissions by bit (some have same bit but different labels - fix them)
const UNIQUE_DISCORD_PERMS = DISCORD_PERMISSIONS.reduce((acc, perm) => {
  const key = `${perm.category}_${perm.bit}`;
  if (!acc.find(p => `${p.category}_${p.bit}` === key)) acc.push(perm);
  return acc;
}, [] as typeof DISCORD_PERMISSIONS);

const DISCORD_CATEGORIES = [...new Set(UNIQUE_DISCORD_PERMS.map(p => p.category))];

const colorToHex = (color: number) =>
  color === 0 ? "#99AAB5" : `#${color.toString(16).padStart(6, "0")}`;

function hasDiscordBit(permStr: string, bit: number): boolean {
  const perms = BigInt(permStr || "0");
  return (perms & (BigInt(1) << BigInt(bit))) !== BigInt(0);
}

function toggleBit(permStr: string, bit: number, enable: boolean): string {
  let perms = BigInt(permStr || "0");
  const mask = BigInt(1) << BigInt(bit);
  if (enable) perms |= mask;
  else perms &= ~mask;
  return perms.toString();
}

const RolesPage = () => {
  const { tenant, tenantId } = useTenant();
  const queryClient = useQueryClient();
  const guildId = tenant?.discord_guild_id;

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TenantRole | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#FF69B4");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<TenantRole>>>({});

  // Discord permissions draft: { roleId: "permissionsBitString" }
  const [discordPermDrafts, setDiscordPermDrafts] = useState<Record<string, string>>({});
  const [discordPermOriginal, setDiscordPermOriginal] = useState<Record<string, string>>({});
  const [savingDiscord, setSavingDiscord] = useState<string | null>(null);

  // Fetch tenant roles from DB
  const { data: roles = [], isLoading } = useQuery<TenantRole[]>({
    queryKey: ["tenant-roles", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Fetch Discord roles (with permissions)
  const { data: discordRoles = [] } = useQuery<DiscordRole[]>({
    queryKey: ["discord-roles-raw", guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase.functions.invoke("discord-guild-info", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      return (data?.roles ?? [])
        .filter((r: DiscordRole) => r.name !== "@everyone" && !r.managed)
        .sort((a: DiscordRole, b: DiscordRole) => b.position - a.position);
    },
    enabled: !!guildId,
  });

  // When a role is expanded, load its Discord permissions
  useEffect(() => {
    if (!expandedRole) return;
    const role = roles.find(r => r.id === expandedRole);
    if (!role?.discord_role_id) return;
    const discordRole = discordRoles.find(dr => dr.id === role.discord_role_id);
    if (discordRole) {
      const permsStr = discordRole.permissions || "0";
      setDiscordPermDrafts(prev => ({ ...prev, [expandedRole]: permsStr }));
      setDiscordPermOriginal(prev => ({ ...prev, [expandedRole]: permsStr }));
    }
  }, [expandedRole, roles, discordRoles]);

  const handleCreate = async () => {
    if (!newName.trim() || !tenantId) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: { action: "create", tenant_id: tenantId, name: newName.trim(), color: newColor },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao criar cargo");
      toast.success(`Cargo "${newName}" criado e sincronizado com Discord!`);
      setNewName(""); setNewColor("#FF69B4"); setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["tenant-roles", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["discord-roles-raw", guildId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !tenantId) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: { action: "delete", tenant_id: tenantId, id: deleteTarget.id },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro");
      toast.success(`Cargo "${deleteTarget.name}" removido!`);
      queryClient.invalidateQueries({ queryKey: ["tenant-roles", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["discord-roles-raw", guildId] });
      setDeleteTarget(null);
      if (expandedRole === deleteTarget.id) setExpandedRole(null);
    } catch (e: any) {
      toast.error(e.message);
      setDeleteTarget(null);
    }
  };

  const getDraft = (roleId: string) => editDrafts[roleId] || {};
  const updateDraft = (roleId: string, key: string, value: any) => {
    setEditDrafts(prev => ({ ...prev, [roleId]: { ...prev[roleId], [key]: value } }));
  };

  const handleSavePanelPerms = async (role: TenantRole) => {
    if (!tenantId) return;
    const draft = getDraft(role.id);
    if (Object.keys(draft).length === 0) return;
    setSaving(role.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: { action: "update", tenant_id: tenantId, id: role.id, ...draft },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro");
      toast.success(`Permissões do painel de "${role.name}" atualizadas!`);
      setEditDrafts(prev => { const c = { ...prev }; delete c[role.id]; return c; });
      queryClient.invalidateQueries({ queryKey: ["tenant-roles", tenantId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(null);
    }
  };

  const handleSaveDiscordPerms = async (role: TenantRole) => {
    if (!tenantId || !role.discord_role_id) return;
    const perms = discordPermDrafts[role.id];
    if (!perms || perms === discordPermOriginal[role.id]) return;
    setSavingDiscord(role.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: { action: "update_discord_permissions", tenant_id: tenantId, role_id: role.discord_role_id, permissions: perms },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro");
      toast.success(`Permissões Discord de "${role.name}" atualizadas!`);
      setDiscordPermOriginal(prev => ({ ...prev, [role.id]: perms }));
      queryClient.invalidateQueries({ queryKey: ["discord-roles-raw", guildId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingDiscord(null);
    }
  };

  const discardDraft = (roleId: string) => {
    setEditDrafts(prev => { const c = { ...prev }; delete c[roleId]; return c; });
  };

  const discardDiscordDraft = (roleId: string) => {
    setDiscordPermDrafts(prev => ({ ...prev, [roleId]: discordPermOriginal[roleId] || "0" }));
  };

  const getPermValue = (role: TenantRole, key: string) => {
    const draft = getDraft(role.id);
    return draft[key as keyof TenantRole] !== undefined
      ? (draft[key as keyof TenantRole] as boolean)
      : (role[key as keyof TenantRole] as boolean);
  };

  const hasPanelDraft = (roleId: string) => Object.keys(getDraft(roleId)).length > 0;
  const hasDiscordDraft = (roleId: string) =>
    discordPermDrafts[roleId] !== undefined && discordPermDrafts[roleId] !== discordPermOriginal[roleId];

  const activePermsCount = (role: TenantRole) =>
    PANEL_PERMISSIONS.filter(p => getPermValue(role, p.key)).length;

  const totalRoles = roles.length;
  const syncedRoles = roles.filter(r => r.synced).length;

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
          <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Cargos</h1>
            <p className="text-sm text-muted-foreground">Gerencie cargos e permissões do Discord e do painel</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["tenant-roles", tenantId] });
            queryClient.invalidateQueries({ queryKey: ["discord-roles-raw", guildId] });
            toast.success("Dados atualizados!");
          }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-1" /> Novo Cargo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Cargo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Nome do Cargo</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Moderador" className="mt-1" />
                </div>
                <div>
                  <Label>Cor</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-10 w-14 rounded border border-input cursor-pointer" />
                    <Input value={newColor} onChange={(e) => setNewColor(e.target.value)} className="font-mono w-28" />
                    <div className="h-8 w-8 rounded-full border border-border" style={{ backgroundColor: newColor }} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!newName.trim() || creating} className="bg-indigo-600 hover:bg-indigo-700">
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Criar no Discord
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Cargos</p>
              <p className="text-xl font-bold">{totalRoles}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sincronizados</p>
              <p className="text-xl font-bold">{syncedRoles}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Globe className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">No Discord</p>
              <p className="text-xl font-bold">{discordRoles.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!guildId && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-6 text-center">
            <Shield className="h-10 w-10 mx-auto mb-3 text-amber-400" />
            <p className="text-sm text-muted-foreground">Conecte um servidor Discord nas Configurações para gerenciar cargos.</p>
          </CardContent>
        </Card>
      )}

      {/* Roles List */}
      {roles.length === 0 && guildId ? (
        <Card className="border-border/50">
          <CardContent className="p-12 text-center">
            <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhum cargo cadastrado. Crie um cargo para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => {
            const isExpanded = expandedRole === role.id;
            const panelDirty = hasPanelDraft(role.id);
            const discordDirty = hasDiscordDraft(role.id);
            const anyDirty = panelDirty || discordDirty;

            return (
              <Card key={role.id} className={cn("border-border/50 transition-all", isExpanded && "ring-1 ring-indigo-500/30")}>
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                >
                  <div className="h-8 w-8 rounded-full border-2 border-border flex-shrink-0" style={{ backgroundColor: role.color || "#99AAB5" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{role.name}</span>
                      {role.synced && (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Sincronizado
                        </Badge>
                      )}
                      {anyDirty && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                          Alterações não salvas
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {activePermsCount(role)} permissões do painel
                      {role.discord_role_id && <span className="ml-2">• ID: {role.discord_role_id}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm" variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(role); }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/50">
                    <Tabs defaultValue="discord" className="w-full">
                      <div className="px-4 pt-3">
                        <TabsList className="w-full justify-start">
                          <TabsTrigger value="discord" className="gap-2">
                            <Globe className="h-3.5 w-3.5" /> Permissões Discord
                            {discordDirty && <span className="h-2 w-2 rounded-full bg-amber-400" />}
                          </TabsTrigger>
                          <TabsTrigger value="panel" className="gap-2">
                            <Settings2 className="h-3.5 w-3.5" /> Permissões do Painel
                            {panelDirty && <span className="h-2 w-2 rounded-full bg-amber-400" />}
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      {/* ===== Discord Permissions Tab ===== */}
                      <TabsContent value="discord" className="px-4 pb-4">
                        {!role.discord_role_id ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            Este cargo não está sincronizado com o Discord
                          </div>
                        ) : (
                          <>
                            {/* Save bar */}
                            {discordDirty && (
                              <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 mb-4">
                                <p className="text-sm font-medium">Permissões Discord alteradas</p>
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => discardDiscordDraft(role.id)}>
                                    <X className="h-4 w-4 mr-1" /> Descartar
                                  </Button>
                                  <Button size="sm" onClick={() => handleSaveDiscordPerms(role)} disabled={savingDiscord === role.id} className="gap-2">
                                    {savingDiscord === role.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Salvar no Discord
                                  </Button>
                                </div>
                              </div>
                            )}

                            {DISCORD_CATEGORIES.map(cat => {
                              const perms = UNIQUE_DISCORD_PERMS.filter(p => p.category === cat);
                              return (
                                <div key={cat} className="mb-5">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {perms.map(perm => {
                                      const Icon = perm.icon;
                                      const currentPerms = discordPermDrafts[role.id] || "0";
                                      const enabled = hasDiscordBit(currentPerms, perm.bit);
                                      return (
                                        <div
                                          key={`${cat}_${perm.bit}_${perm.label}`}
                                          className={cn(
                                            "flex items-center gap-3 p-2.5 rounded-lg border transition-colors",
                                            enabled
                                              ? perm.dangerous
                                                ? "border-red-500/30 bg-red-500/5"
                                                : "border-indigo-500/30 bg-indigo-500/5"
                                              : "border-border/50 bg-card/30"
                                          )}
                                        >
                                          <Icon className={cn(
                                            "h-4 w-4 flex-shrink-0",
                                            enabled
                                              ? perm.dangerous ? "text-red-400" : "text-indigo-400"
                                              : "text-muted-foreground"
                                          )} />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{perm.label}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{perm.desc}</p>
                                          </div>
                                          <Switch
                                            checked={enabled}
                                            onCheckedChange={(v) => {
                                              const newPerms = toggleBit(currentPerms, perm.bit, v);
                                              setDiscordPermDrafts(prev => ({ ...prev, [role.id]: newPerms }));
                                            }}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </TabsContent>

                      {/* ===== Panel Permissions Tab ===== */}
                      <TabsContent value="panel" className="px-4 pb-4">
                        {panelDirty && (
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 mb-4">
                            <p className="text-sm font-medium">Permissões do painel alteradas</p>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => discardDraft(role.id)}>
                                <X className="h-4 w-4 mr-1" /> Descartar
                              </Button>
                              <Button size="sm" onClick={() => handleSavePanelPerms(role)} disabled={saving === role.id} className="gap-2">
                                {saving === role.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Salvar
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {PANEL_PERMISSIONS.map(perm => {
                            const Icon = perm.icon;
                            const value = getPermValue(role, perm.key);
                            return (
                              <div
                                key={perm.key}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                                  value ? "border-indigo-500/30 bg-indigo-500/5" : "border-border/50 bg-card/30"
                                )}
                              >
                                <Icon className={cn("h-4 w-4 flex-shrink-0", value ? "text-indigo-400" : "text-muted-foreground")} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{perm.label}</p>
                                  <p className="text-[10px] text-muted-foreground">{perm.desc}</p>
                                </div>
                                <Switch checked={value} onCheckedChange={(v) => updateDraft(role.id, perm.key, v)} />
                              </div>
                            );
                          })}
                        </div>
                      </TabsContent>
                    </Tabs>

                    {/* Role info */}
                    <div className="border-t border-border/50 px-4 py-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Cor</span>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: role.color }} />
                            <span className="font-mono">{role.color}</span>
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Discord Role ID</span>
                          <p className="mt-1 font-mono">{role.discord_role_id || "—"}</p>
                        </div>
                        <div>
                          <span className="font-medium">Criado em</span>
                          <p className="mt-1">{new Date(role.created_at).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <div>
                          <span className="font-medium">Atualizado em</span>
                          <p className="mt-1">{new Date(role.updated_at).toLocaleDateString("pt-BR")}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cargo</AlertDialogTitle>
            <AlertDialogDescription>
              O cargo <strong>"{deleteTarget?.name}"</strong> será removido do Discord e do banco de dados. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RolesPage;
