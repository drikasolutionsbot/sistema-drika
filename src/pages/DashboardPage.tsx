import { useState, useCallback } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Server, ExternalLink, Users, UserCheck, Settings2, Plus, UserPlus, Trash2 } from "lucide-react";
import MemberSearchModal from "@/components/dashboard/MemberSearchModal";
import { usePermissions, PERMISSION_LABELS, type TenantPermission, type PermissionKey } from "@/hooks/usePermissions";
import type { DiscordMember } from "@/components/dashboard/MemberSearchModal";
import { toast } from "sonner";

const DISCORD_CLIENT_ID = "1477916070508757092";
const BOT_PERMISSIONS = "8";

const DashboardPage = () => {
  const { tenant, loading: tenantLoading } = useTenant();
  const [activeTab, setActiveTab] = useState<"membros" | "cargos">("membros");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Record<PermissionKey, boolean>>>({});
  const [saving, setSaving] = useState(false);

  const { permissions, loading: permLoading, addMember, savePermissions, removeMember } = usePermissions(tenant?.id ?? null);

  const selectedMember = permissions.find(p => p.id === selectedMemberId) ?? null;

  const hasUnsavedChanges = Object.keys(draft).length > 0;

  const getEffectiveValue = (key: PermissionKey): boolean => {
    if (key in draft) return draft[key]!;
    return selectedMember ? selectedMember[key] : false;
  };

  const handleToggle = (key: PermissionKey) => {
    if (!selectedMember) return;
    const current = selectedMember[key];
    const draftVal = draft[key];
    const effective = draftVal !== undefined ? draftVal : current;
    const newVal = !effective;
    
    // If toggling back to original, remove from draft
    if (newVal === current) {
      const next = { ...draft };
      delete next[key];
      setDraft(next);
    } else {
      setDraft({ ...draft, [key]: newVal });
    }
  };

  const handleSave = async () => {
    if (!selectedMember || !hasUnsavedChanges) return;
    setSaving(true);
    const result = await savePermissions(selectedMember.id, draft);
    setSaving(false);
    if (result) {
      setDraft({});
      toast.success("Permissões salvas com sucesso!");
    } else {
      toast.error("Erro ao salvar permissões.");
    }
  };

  const handleDiscard = () => {
    setDraft({});
  };

  const handleSelectMemberFromList = (perm: TenantPermission) => {
    setSelectedMemberId(perm.id);
    setDraft({});
  };

  const handleSelectMember = async (member: DiscordMember) => {
    const result = await addMember({
      discord_user_id: member.id,
      discord_username: member.username,
      discord_display_name: member.displayName,
      discord_avatar_url: member.avatar ?? null,
    });
    if (result) {
      setSelectedMemberId(result.id);
      setDraft({});
    }
  };

  const handleRemoveMember = async (perm: TenantPermission) => {
    await removeMember(perm.id);
    if (selectedMemberId === perm.id) {
      setSelectedMemberId(null);
      setDraft({});
    }
    toast.success("Membro removido.");
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
    const url = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=${BOT_PERMISSIONS}&scope=bot%20applications.commands`;
    window.open(url, "_blank");
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
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
              {tenant.name[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{tenant.name}</p>
              {tenant.discord_guild_id && (
                <p className="text-xs font-mono text-muted-foreground">({tenant.discord_guild_id})</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground border-l-2 border-primary pl-2 mb-2">Informações do Servidor</p>
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Users className="h-3 w-3" /> 0 membros
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <UserCheck className="h-3 w-3" /> 0 clientes
              </span>
            </div>
          </div>
          <Button variant="outline" className="gap-2 text-sm" onClick={handleAddBot}>
            <ExternalLink className="h-3.5 w-3.5" />
            Adicionar <strong>Drika Bot</strong> ao servidor
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
          <button
            onClick={() => setActiveTab("membros")}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === "membros" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Membros
          </button>
          <button
            onClick={() => setActiveTab("cargos")}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === "cargos" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Cargos
          </button>
        </div>

        {activeTab === "membros" && (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* Lista de membros */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold border-l-2 border-primary pl-3">Lista de membros</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => setMemberSearchOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {permLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : permissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <UserPlus className="h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum membro na lista</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {permissions.map((perm) => (
                    <button
                      key={perm.id}
                      onClick={() => handleSelectMemberFromList(perm)}
                      className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-colors ${
                        selectedMemberId === perm.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <Avatar className="h-7 w-7">
                        {perm.discord_avatar_url && <AvatarImage src={perm.discord_avatar_url} />}
                        <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-semibold uppercase">
                          {(perm.discord_display_name || perm.discord_username)?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">
                        {perm.discord_display_name || perm.discord_username}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Painel de permissões */}
            <div className="rounded-xl border border-border bg-card p-5 relative">
              {selectedMember ? (
                <div className="space-y-5">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">
                        Permissões para {selectedMember.discord_display_name || selectedMember.discord_username}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Selecione as permissões que deseja conceder a este usuário
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveMember(selectedMember)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Section: Principal */}
                  <div>
                    <p className="text-sm font-bold mb-3">Principal</p>
                    <div className="space-y-1">
                      {PERMISSION_LABELS.map(({ key, label, description }) => (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                        >
                          <div className="pr-4">
                            <p className="text-sm font-semibold">{label}</p>
                            <p className="text-xs text-muted-foreground">{description}</p>
                          </div>
                          <Switch
                            checked={getEffectiveValue(key)}
                            onCheckedChange={() => handleToggle(key)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Unsaved changes bar */}
                  {hasUnsavedChanges && (
                    <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 border-t border-border bg-card/95 backdrop-blur flex items-center justify-end gap-3 rounded-b-xl">
                      <span className="text-xs text-muted-foreground mr-auto">Alterações não salvas</span>
                      <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={saving}>
                        Limpar
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <Settings2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Selecione um membro para configurar as permissões
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "cargos" && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Server className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-muted-foreground">Nenhum cargo configurado</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Configure cargos para gerenciar permissões do servidor.
              </p>
            </div>
          </div>
        )}
      </div>

      <MemberSearchModal
        open={memberSearchOpen}
        onOpenChange={setMemberSearchOpen}
        onSelectMember={handleSelectMember}
      />
    </div>
  );
};

export default DashboardPage;
