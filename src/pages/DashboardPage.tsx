import { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogHeader,
} from "@/components/ui/dialog";
import {
  ExternalLink, Users, UserCheck, Settings2, Plus, UserPlus, Trash2, Loader2, Shield,
} from "lucide-react";
import MemberSearchModal from "@/components/dashboard/MemberSearchModal";
import { usePermissions, PERMISSION_LABELS, type TenantPermission, type PermissionKey } from "@/hooks/usePermissions";
import { useRoles, type TenantRole } from "@/hooks/useRoles";
import type { DiscordMember } from "@/components/dashboard/MemberSearchModal";
import { toast } from "sonner";

const DISCORD_CLIENT_ID = "1477916070508757092";
const BOT_PERMISSIONS = "8";

const DashboardPage = () => {
  const { tenant, loading: tenantLoading } = useTenant();
  const [activeTab, setActiveTab] = useState<"membros" | "cargos">("membros");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);

  // Members state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState<Partial<Record<PermissionKey, boolean>>>({});
  const [savingMember, setSavingMember] = useState(false);

  // Roles state
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<Partial<Record<PermissionKey, boolean>>>({});
  const [savingRole, setSavingRole] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#99AAB5");
  const [creatingRole, setCreatingRole] = useState(false);

  const { permissions, loading: permLoading, addMember, savePermissions, removeMember } = usePermissions(tenant?.id ?? null);
  const { roles, loading: rolesLoading, createRole, updateRole, deleteRole } = useRoles(tenant?.id ?? null);

  const selectedMember = permissions.find(p => p.id === selectedMemberId) ?? null;
  const selectedRole = roles.find(r => r.id === selectedRoleId) ?? null;

  // --- Member permission helpers ---
  const memberHasChanges = Object.keys(memberDraft).length > 0;

  const getMemberValue = (key: PermissionKey): boolean => {
    if (key in memberDraft) return memberDraft[key]!;
    return selectedMember ? selectedMember[key] : false;
  };

  const toggleMemberPerm = (key: PermissionKey) => {
    if (!selectedMember) return;
    const current = selectedMember[key];
    const effective = memberDraft[key] !== undefined ? memberDraft[key]! : current;
    const newVal = !effective;
    if (newVal === current) {
      const next = { ...memberDraft };
      delete next[key];
      setMemberDraft(next);
    } else {
      setMemberDraft({ ...memberDraft, [key]: newVal });
    }
  };

  const saveMemberPerms = async () => {
    if (!selectedMember || !memberHasChanges) return;
    setSavingMember(true);
    const result = await savePermissions(selectedMember.id, memberDraft);
    setSavingMember(false);
    if (result) { setMemberDraft({}); toast.success("Permissões salvas!"); }
    else toast.error("Erro ao salvar.");
  };

  // --- Role permission helpers ---
  const roleHasChanges = Object.keys(roleDraft).length > 0;

  const getRoleValue = (key: PermissionKey): boolean => {
    if (key in roleDraft) return roleDraft[key]!;
    return selectedRole ? selectedRole[key] : false;
  };

  const toggleRolePerm = (key: PermissionKey) => {
    if (!selectedRole) return;
    const current = selectedRole[key];
    const effective = roleDraft[key] !== undefined ? roleDraft[key]! : current;
    const newVal = !effective;
    if (newVal === current) {
      const next = { ...roleDraft };
      delete next[key];
      setRoleDraft(next);
    } else {
      setRoleDraft({ ...roleDraft, [key]: newVal });
    }
  };

  const saveRolePerms = async () => {
    if (!selectedRole || !roleHasChanges) return;
    setSavingRole(true);
    const result = await updateRole(selectedRole.id, roleDraft);
    setSavingRole(false);
    if (result) { setRoleDraft({}); toast.success("Permissões do cargo salvas!"); }
    else toast.error("Erro ao salvar.");
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    try {
      const result = await createRole(newRoleName.trim(), newRoleColor);
      if (result) {
        setSelectedRoleId(result.id);
        setRoleDraft({});
        toast.success(`Cargo "${result.name}" criado no Discord!`);
      }
    } catch {
      toast.error("Erro ao criar cargo no Discord.");
    }
    setCreatingRole(false);
    setCreateRoleOpen(false);
    setNewRoleName("");
    setNewRoleColor("#99AAB5");
  };

  const handleDeleteRole = async (role: TenantRole) => {
    await deleteRole(role.id);
    if (selectedRoleId === role.id) { setSelectedRoleId(null); setRoleDraft({}); }
    toast.success(`Cargo "${role.name}" removido do Discord.`);
  };

  // --- Common handlers ---
  const handleSelectMember = async (member: DiscordMember) => {
    const result = await addMember({
      discord_user_id: member.id,
      discord_username: member.username,
      discord_display_name: member.displayName,
      discord_avatar_url: member.avatar ?? null,
    });
    if (result) { setSelectedMemberId(result.id); setMemberDraft({}); }
  };

  if (tenantLoading || !tenant) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const handleAddBot = () => {
    window.open(
      `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=${BOT_PERMISSIONS}&scope=bot%20applications.commands`,
      "_blank"
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold">Servidor de Operações</h1>
        <p className="text-muted-foreground">
          Servidor onde <strong className="text-foreground">{tenant.name}</strong> está operando.
        </p>
      </div>

      {/* Server Info + Audit */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold border-l-2 border-primary pl-3">Servidor Principal</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Settings2 className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">{tenant.name[0]?.toUpperCase()}</div>
            <div>
              <p className="font-medium">{tenant.name}</p>
              {tenant.discord_guild_id && <p className="text-xs font-mono text-muted-foreground">({tenant.discord_guild_id})</p>}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground border-l-2 border-primary pl-2 mb-2">Informações do Servidor</p>
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"><Users className="h-3 w-3" /> 0 membros</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"><UserCheck className="h-3 w-3" /> 0 clientes</span>
            </div>
          </div>
          <Button variant="outline" className="gap-2 text-sm" onClick={handleAddBot}>
            <ExternalLink className="h-3.5 w-3.5" /> Adicionar <strong>Drika Bot</strong> ao servidor
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold border-l-2 border-primary pl-3">Auditoria</h2>
          <p className="text-sm text-muted-foreground">Nenhum registro de auditoria encontrado.</p>
        </div>
      </div>

      {/* Permissões */}
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Permissões</h2>
          <p className="text-muted-foreground">Configure as permissões da Aplicação.</p>
        </div>

        <div className="flex gap-6 border-b border-border">
          {(["membros", "cargos"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-sm font-medium transition-colors capitalize ${
                activeTab === tab ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ===== MEMBROS ===== */}
        {activeTab === "membros" && (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold border-l-2 border-primary pl-3">Lista de membros</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setMemberSearchOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {permLoading ? (
                <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
              ) : permissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <UserPlus className="h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum membro na lista</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {permissions.map(perm => (
                    <button
                      key={perm.id}
                      onClick={() => { setSelectedMemberId(perm.id); setMemberDraft({}); }}
                      className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-colors ${
                        selectedMemberId === perm.id ? "bg-primary/10 border border-primary/20" : "hover:bg-accent/50"
                      }`}
                    >
                      <Avatar className="h-7 w-7">
                        {perm.discord_avatar_url && <AvatarImage src={perm.discord_avatar_url} />}
                        <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-semibold uppercase">
                          {(perm.discord_display_name || perm.discord_username)?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">{perm.discord_display_name || perm.discord_username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <PermissionPanel
              title={selectedMember ? `Permissões para ${selectedMember.discord_display_name || selectedMember.discord_username}` : null}
              subtitle="Selecione as permissões que deseja conceder a este usuário"
              emptyText="Selecione um membro para configurar as permissões"
              getValue={getMemberValue}
              onToggle={toggleMemberPerm}
              hasChanges={memberHasChanges}
              saving={savingMember}
              onSave={saveMemberPerms}
              onDiscard={() => setMemberDraft({})}
              onDelete={selectedMember ? () => {
                removeMember(selectedMember.id);
                setSelectedMemberId(null);
                setMemberDraft({});
                toast.success("Membro removido.");
              } : undefined}
            />
          </div>
        )}

        {/* ===== CARGOS ===== */}
        {activeTab === "cargos" && (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold border-l-2 border-primary pl-3">Lista de cargos</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setCreateRoleOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {rolesLoading ? (
                <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
              ) : roles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Shield className="h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum cargo criado</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {roles.map(role => (
                    <button
                      key={role.id}
                      onClick={() => { setSelectedRoleId(role.id); setRoleDraft({}); }}
                      className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-colors ${
                        selectedRoleId === role.id ? "bg-primary/10 border border-primary/20" : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                      <span className="text-sm font-medium truncate">{role.name}</span>
                      {role.synced && (
                        <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">sync</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <PermissionPanel
              title={selectedRole ? `Permissões do cargo ${selectedRole.name}` : null}
              subtitle="Selecione as permissões que este cargo concede"
              emptyText="Selecione um cargo para configurar as permissões"
              getValue={getRoleValue}
              onToggle={toggleRolePerm}
              hasChanges={roleHasChanges}
              saving={savingRole}
              onSave={saveRolePerms}
              onDiscard={() => setRoleDraft({})}
              onDelete={selectedRole ? () => handleDeleteRole(selectedRole) : undefined}
              roleColor={selectedRole?.color}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <MemberSearchModal open={memberSearchOpen} onOpenChange={setMemberSearchOpen} onSelectMember={handleSelectMember} />

      <Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar novo cargo</DialogTitle>
            <DialogDescription>O cargo será criado automaticamente no servidor Discord.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do cargo</label>
              <Input
                placeholder="Ex: Moderador"
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cor</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newRoleColor}
                  onChange={e => setNewRoleColor(e.target.value)}
                  className="h-10 w-10 rounded-md border border-border cursor-pointer bg-transparent"
                />
                <Input value={newRoleColor} onChange={e => setNewRoleColor(e.target.value)} className="font-mono" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateRoleOpen(false)} disabled={creatingRole}>Cancelar</Button>
            <Button onClick={handleCreateRole} disabled={creatingRole || !newRoleName.trim()}>
              {creatingRole ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando...</> : "Criar cargo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ===== Shared Permission Panel Component =====
function PermissionPanel({
  title,
  subtitle,
  emptyText,
  getValue,
  onToggle,
  hasChanges,
  saving,
  onSave,
  onDiscard,
  onDelete,
  roleColor,
}: {
  title: string | null;
  subtitle: string;
  emptyText: string;
  getValue: (key: PermissionKey) => boolean;
  onToggle: (key: PermissionKey) => void;
  hasChanges: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onDelete?: () => void;
  roleColor?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 relative">
      {title ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {roleColor && <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: roleColor }} />}
              <div>
                <h3 className="font-semibold text-lg">{title}</h3>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div>
            <p className="text-sm font-bold mb-3">Principal</p>
            <div className="space-y-1">
              {PERMISSION_LABELS.map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div className="pr-4">
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Switch checked={getValue(key)} onCheckedChange={() => onToggle(key)} />
                </div>
              ))}
            </div>
          </div>

          {hasChanges && (
            <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 border-t border-border bg-card/95 backdrop-blur flex items-center justify-end gap-3 rounded-b-xl">
              <span className="text-xs text-muted-foreground mr-auto">Alterações não salvas</span>
              <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>Limpar</Button>
              <Button size="sm" onClick={onSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <Settings2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
