import { useState } from "react";
import { Plus, Shield, Loader2, ChevronDown, ChevronRight, Save } from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed: boolean;
}

const colorToHex = (color: number) =>
  color === 0 ? "#99AAB5" : `#${color.toString(16).padStart(6, "0")}`;

// Discord permission flags (bigint-safe as strings)
const DISCORD_PERMISSIONS: { flag: bigint; label: string; description: string; category: string }[] = [
  // General
  { flag: 0x8n, label: "Administrador", description: "Acesso total ao servidor", category: "Geral" },
  { flag: 0x20n, label: "Gerenciar Servidor", description: "Alterar configurações do servidor", category: "Geral" },
  { flag: 0x10000000n, label: "Gerenciar Cargos", description: "Criar, editar e deletar cargos", category: "Geral" },
  { flag: 0x10n, label: "Gerenciar Canais", description: "Criar, editar e deletar canais", category: "Geral" },
  { flag: 0x20000000n, label: "Gerenciar Webhooks", description: "Criar, editar e deletar webhooks", category: "Geral" },
  { flag: 0x40000000000n, label: "Gerenciar Expressões", description: "Gerenciar emojis, stickers e sons", category: "Geral" },
  { flag: 0x1n, label: "Criar Convites", description: "Criar links de convite", category: "Geral" },
  { flag: 0x40n, label: "Banir Membros", description: "Banir membros do servidor", category: "Moderação" },
  { flag: 0x2n, label: "Expulsar Membros", description: "Expulsar membros do servidor", category: "Moderação" },
  { flag: 0x4000000000n, label: "Moderar Membros", description: "Timeout e gerenciar membros", category: "Moderação" },
  { flag: 0x2000n, label: "Gerenciar Mensagens", description: "Deletar e fixar mensagens", category: "Texto" },
  { flag: 0x4000000n, label: "Mencionar Everyone", description: "Usar @everyone e @here", category: "Texto" },
  { flag: 0x800n, label: "Enviar Mensagens", description: "Enviar mensagens em canais de texto", category: "Texto" },
  { flag: 0x8000n, label: "Anexar Arquivos", description: "Enviar arquivos em mensagens", category: "Texto" },
  { flag: 0x4000n, label: "Inserir Links", description: "Links com pré-visualização", category: "Texto" },
  { flag: 0x40000n, label: "Adicionar Reações", description: "Reagir a mensagens", category: "Texto" },
  { flag: 0x10000n, label: "Usar Emojis Externos", description: "Usar emojis de outros servidores", category: "Texto" },
  { flag: 0x400n, label: "Ver Canais", description: "Visualizar canais de texto e voz", category: "Geral" },
  { flag: 0x100000n, label: "Conectar", description: "Conectar em canais de voz", category: "Voz" },
  { flag: 0x200000n, label: "Falar", description: "Falar em canais de voz", category: "Voz" },
  { flag: 0x400000n, label: "Silenciar Membros", description: "Mutar membros em canais de voz", category: "Voz" },
  { flag: 0x800000n, label: "Ensurdecer Membros", description: "Ensurdecer membros em canais de voz", category: "Voz" },
  { flag: 0x1000000n, label: "Mover Membros", description: "Mover membros entre canais de voz", category: "Voz" },
];

const CATEGORIES = ["Geral", "Moderação", "Texto", "Voz"];

function hasPermission(perms: bigint, flag: bigint): boolean {
  // Admin has all permissions
  if ((perms & 0x8n) === 0x8n && flag !== 0x8n) return true;
  return (perms & flag) === flag;
}

function togglePermission(perms: bigint, flag: bigint, enabled: boolean): bigint {
  if (enabled) return perms | flag;
  return perms & ~flag;
}

export const RolesTab = () => {
  const { tenant, tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#FF69B4");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [draftPerms, setDraftPerms] = useState<Record<string, bigint>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const guildId = tenant?.discord_guild_id;

  const { data: roles = [], isLoading } = useQuery<DiscordRole[]>({
    queryKey: ["discord-roles", guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase.functions.invoke("discord-guild-info", {
        body: { guild_id: guildId },
      });
      if (error) throw error;
      return (data?.roles ?? [])
        .filter((r: DiscordRole) => r.name !== "@everyone" && !r.managed)
        .sort((a: DiscordRole, b: DiscordRole) => b.position - a.position);
    },
    enabled: !!guildId,
  });

  const handleCreate = async () => {
    if (!newRoleName.trim() || !guildId) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: {
          action: "create",
          guild_id: guildId,
          name: newRoleName.trim(),
          color: parseInt(newRoleColor.replace("#", ""), 16),
          tenant_id: tenantId,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao criar cargo");
      toast.success(`Cargo "${newRoleName}" criado!`);
      setNewRoleName("");
      setNewRoleColor("#FF69B4");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["discord-roles", guildId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar cargo");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (role: DiscordRole) => {
    if (!guildId) return;
    setDeletingId(role.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: {
          action: "delete",
          guild_id: guildId,
          role_id: role.id,
          tenant_id: tenantId,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao deletar");
      toast.success(`Cargo "${role.name}" removido`);
      queryClient.invalidateQueries({ queryKey: ["discord-roles", guildId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao deletar cargo");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExpand = (role: DiscordRole) => {
    if (expandedRoleId === role.id) {
      setExpandedRoleId(null);
      return;
    }
    setExpandedRoleId(role.id);
    if (!draftPerms[role.id]) {
      setDraftPerms(prev => ({ ...prev, [role.id]: BigInt(role.permissions) }));
    }
  };

  const handleTogglePerm = (roleId: string, flag: bigint, enabled: boolean) => {
    setDraftPerms(prev => ({
      ...prev,
      [roleId]: togglePermission(prev[roleId] ?? 0n, flag, enabled),
    }));
  };

  const handleSavePerms = async (role: DiscordRole) => {
    const perms = draftPerms[role.id];
    if (perms === undefined) return;
    setSavingId(role.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: {
          action: "update_discord_permissions",
          tenant_id: tenantId,
          role_id: role.id,
          permissions: perms.toString(),
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao salvar permissões");
      toast.success(`Permissões de "${role.name}" atualizadas!`);
      queryClient.invalidateQueries({ queryKey: ["discord-roles", guildId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar permissões");
    } finally {
      setSavingId(null);
    }
  };

  const hasChanges = (role: DiscordRole) => {
    const draft = draftPerms[role.id];
    if (draft === undefined) return false;
    return draft !== BigInt(role.permissions);
  };

  if (!guildId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Conecte um servidor Discord na Visão Geral para gerenciar cargos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Gerencie os cargos e permissões do servidor Discord.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gradient-pink text-primary-foreground border-none hover:opacity-90">
              <Plus className="h-4 w-4 mr-1.5" /> Novo Cargo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Cargo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  placeholder="Ex: Moderador"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="h-10 w-14 rounded-lg border border-border cursor-pointer bg-transparent"
                  />
                  <Input
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="font-mono text-sm w-28"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={!newRoleName.trim() || creating}
                className="w-full gradient-pink text-primary-foreground border-none hover:opacity-90"
              >
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Cargo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="rounded-xl border border-border bg-card flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : roles.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum cargo encontrado no servidor.</p>
          </div>
        ) : (
          roles.map((role) => {
            const isExpanded = expandedRoleId === role.id;
            const currentPerms = draftPerms[role.id] ?? BigInt(role.permissions);
            const isAdmin = (currentPerms & 0x8n) === 0x8n;
            const changed = hasChanges(role);

            return (
              <div key={role.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Role Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleExpand(role)}
                >
                  <div className="flex items-center justify-center w-6">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: colorToHex(role.color) }}
                  />
                  <span className="font-medium text-sm flex-1">{role.name}</span>
                  {isAdmin && (
                    <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-500">
                      Admin
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">Pos. {role.position}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(role); }}
                    disabled={deletingId === role.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                  >
                    {deletingId === role.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TrashIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Expanded Permissions */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-5">
                    {CATEGORIES.map((cat) => {
                      const perms = DISCORD_PERMISSIONS.filter((p) => p.category === cat);
                      if (perms.length === 0) return null;
                      return (
                        <div key={cat}>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                            {cat}
                          </h4>
                          <div className="space-y-1">
                            {perms.map((p) => {
                              const enabled = hasPermission(currentPerms, p.flag);
                              const isAdminFlag = p.flag === 0x8n;
                              const disabledByAdmin = isAdmin && !isAdminFlag;
                              return (
                                <div
                                  key={p.flag.toString()}
                                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/40 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{p.label}</p>
                                    <p className="text-xs text-muted-foreground">{p.description}</p>
                                  </div>
                                  <Switch
                                    checked={enabled}
                                    disabled={disabledByAdmin}
                                    onCheckedChange={(val) => handleTogglePerm(role.id, p.flag, val)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Save button */}
                    <div className="flex justify-end pt-2">
                      <Button
                        size="sm"
                        disabled={!changed || savingId === role.id}
                        onClick={() => handleSavePerms(role)}
                        className="gradient-pink text-primary-foreground border-none hover:opacity-90"
                      >
                        {savingId === role.id ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-1.5" />
                        )}
                        Salvar Permissões
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
