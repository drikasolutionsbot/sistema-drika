import { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Server, ExternalLink, Users, UserCheck, Settings2, Plus, UserPlus, Trash2 } from "lucide-react";
import MemberSearchModal from "@/components/dashboard/MemberSearchModal";
import { usePermissions, type TenantPermission } from "@/hooks/usePermissions";
import type { DiscordMember } from "@/components/dashboard/MemberSearchModal";

const DISCORD_CLIENT_ID = "1477916070508757092";
const BOT_PERMISSIONS = "8";

const DashboardPage = () => {
  const { tenant, loading: tenantLoading } = useTenant();
  const [activeTab, setActiveTab] = useState<"membros" | "cargos">("membros");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TenantPermission | null>(null);

  const { permissions, loading: permLoading, addMember, updatePermission, removeMember } = usePermissions(tenant?.id ?? null);

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

  const handleSelectMember = async (member: DiscordMember) => {
    const result = await addMember({
      discord_user_id: member.id,
      discord_username: member.username,
      discord_display_name: member.displayName,
      discord_avatar_url: member.avatar ?? null,
    });
    if (result) {
      setSelectedMember(result);
    }
  };

  const handleTogglePermission = async (
    perm: TenantPermission,
    key: "can_view" | "can_manage_app" | "can_manage_resources"
  ) => {
    const newValue = !perm[key];
    await updatePermission(perm.id, { [key]: newValue });
    if (selectedMember?.id === perm.id) {
      setSelectedMember({ ...selectedMember, [key]: newValue });
    }
  };

  const handleRemoveMember = async (perm: TenantPermission) => {
    await removeMember(perm.id);
    if (selectedMember?.id === perm.id) {
      setSelectedMember(null);
    }
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
        {/* Servidor Principal */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold border-l-2 border-primary pl-3">
              Servidor Principal
            </h2>
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
                <p className="text-xs font-mono text-muted-foreground">
                  ({tenant.discord_guild_id})
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground border-l-2 border-primary pl-2 mb-2">
              Informações do Servidor
            </p>
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

        {/* Auditoria */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold border-l-2 border-primary pl-3">
            Auditoria
          </h2>
          <p className="text-sm text-muted-foreground">
            Nenhum registro de auditoria encontrado.
          </p>
        </div>
      </div>

      {/* Permissões */}
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Permissões</h2>
          <p className="text-muted-foreground">Configure as permissões da Aplicação.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-border">
          <button
            onClick={() => setActiveTab("membros")}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === "membros"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Membros
          </button>
          <button
            onClick={() => setActiveTab("cargos")}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === "cargos"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Cargos
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "membros" && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Lista de membros */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold border-l-2 border-primary pl-3">Lista de membros</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => setMemberSearchOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {permLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : permissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <UserPlus className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="font-medium text-muted-foreground">Nenhum membro na lista</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Adicione membros para começar a configurar as permissões.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {permissions.map((perm) => (
                    <button
                      key={perm.id}
                      onClick={() => setSelectedMember(perm)}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
                        selectedMember?.id === perm.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        {perm.discord_avatar_url && <AvatarImage src={perm.discord_avatar_url} />}
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold uppercase">
                          {(perm.discord_display_name || perm.discord_username)?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {perm.discord_display_name || perm.discord_username}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          @{perm.discord_username}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Configurar permissões */}
            <div className="rounded-xl border border-border bg-card p-5">
              {selectedMember ? (
                <div className="space-y-6">
                  {/* Member header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {selectedMember.discord_avatar_url && (
                          <AvatarImage src={selectedMember.discord_avatar_url} />
                        )}
                        <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold uppercase">
                          {(selectedMember.discord_display_name || selectedMember.discord_username)?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">
                          {selectedMember.discord_display_name || selectedMember.discord_username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @{selectedMember.discord_username}
                        </p>
                      </div>
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

                  {/* Permissions toggles */}
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold border-l-2 border-primary pl-2 mb-3">
                      Permissões
                    </h4>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div>
                          <p className="text-sm font-medium">Visualizar</p>
                          <p className="text-xs text-muted-foreground">
                            Permite visualizar o painel e dados do servidor.
                          </p>
                        </div>
                        <Switch
                          checked={selectedMember.can_view}
                          onCheckedChange={() => handleTogglePermission(selectedMember, "can_view")}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div>
                          <p className="text-sm font-medium">Gerenciar Aplicação</p>
                          <p className="text-xs text-muted-foreground">
                            Permite gerenciar loja, pedidos e configurações.
                          </p>
                        </div>
                        <Switch
                          checked={selectedMember.can_manage_app}
                          onCheckedChange={() => handleTogglePermission(selectedMember, "can_manage_app")}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div>
                          <p className="text-sm font-medium">Gerenciar Recursos</p>
                          <p className="text-xs text-muted-foreground">
                            Permite criar e gerenciar canais, cargos e recursos do servidor.
                          </p>
                        </div>
                        <Switch
                          checked={selectedMember.can_manage_resources}
                          onCheckedChange={() => handleTogglePermission(selectedMember, "can_manage_resources")}
                        />
                      </div>
                    </div>
                  </div>
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
