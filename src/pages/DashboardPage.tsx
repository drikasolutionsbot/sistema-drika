import { useState, useEffect } from "react";
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
  ExternalLink, Users, UserCheck, Settings2, Plus, UserPlus, Loader2, Shield,
  BarChart3, Eye,
} from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import MemberSearchModal from "@/components/dashboard/MemberSearchModal";
import { usePermissions, PERMISSION_LABELS, type TenantPermission, type PermissionKey } from "@/hooks/usePermissions";
import { useRoles, type TenantRole } from "@/hooks/useRoles";
import type { DiscordMember } from "@/components/dashboard/MemberSearchModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logTenantAudit, fetchTenantAuditLogs, type AuditLogEntry } from "@/lib/tenantAuditLog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const BOT_PERMISSIONS = "536870920"; // Administrator + MANAGE_WEBHOOKS
...
  const appendGuildToInvite = (inviteUrl: string) => {
    if (!tenant?.discord_guild_id) return inviteUrl;
    try {
      const url = new URL(inviteUrl);
      url.searchParams.set("guild_id", tenant.discord_guild_id);
      return url.toString();
    } catch {
      return inviteUrl;
    }
  };

  const handleAddBot = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("discord-bot-guilds", {
        body: { tenant_id: tenantId, action: "invite_url", permissions: BOT_PERMISSIONS },
      });

      if (error || !data?.invite_url) {
        throw new Error(data?.error || error?.message || "Não foi possível gerar o convite do bot externo.");
      }

      window.open(appendGuildToInvite(data.invite_url), "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível abrir o convite do bot externo.");
    }
  };

  const openServerModal = async () => {
    if (!tenantId) {
      toast.error("Tenant não encontrado.");
      return;
    }

    let tokenData: { token?: string } | null = null;
    try {
      const tokenSession = sessionStorage.getItem("token_session");
      tokenData = tokenSession ? JSON.parse(tokenSession) : null;
    } catch {
      tokenData = null;
    }

    setServerModalOpen(true);
    setManualGuildId("");
    setLoadingGuilds(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-bot-guilds", {
        body: { tenant_id: tenantId, token: tokenData?.token || null },
      });
      if (error) throw error;
      setGuilds(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar servidores.");
    } finally {
      setLoadingGuilds(false);
    }
  };

  const handleSwitchGuild = async (guildId: string) => {
    if (!tenantId) return;
    setSwitchingGuild(guildId);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: { tenant_id: tenantId, updates: { discord_guild_id: guildId } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Servidor alterado com sucesso!");
      if (tenantId) {
        const guild = guilds.find(g => g.id === guildId);
        await logTenantAudit(tenantId, "switch_server", "servidor", guild?.name || guildId, guildId);
        loadAuditLogs();
      }
      refetch();
      setManualGuildId("");
      setServerModalOpen(false);
    } catch (err: any) {
      toast.error("Erro ao trocar servidor: " + (err.message || "Tente novamente"));
    } finally {
      setSwitchingGuild(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Painel de controle de <strong className="text-foreground">{tenant.name}</strong>
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="bg-muted/50 border border-border w-max min-w-full sm:w-auto">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-background text-xs sm:text-sm">
              <Eye className="h-4 w-4" /> Visão Geral
            </TabsTrigger>
            <TabsTrigger value="resumo" className="gap-2 data-[state=active]:bg-background text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" /> Resumo
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ===== ABA VISÃO GERAL ===== */}
        <TabsContent value="overview" className="space-y-8">

      {/* Server Section */}
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
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={openServerModal}><Settings2 className="h-4 w-4" /></Button>
          </div>
          {tenant.discord_guild_id ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">{tenant.name[0]?.toUpperCase()}</div>
                <div>
                  <p className="font-medium">{tenant.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">({tenant.discord_guild_id})</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground border-l-2 border-primary pl-2 mb-2">Informações do Servidor</p>
                <div className="flex gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"><Users className="h-3 w-3" /> {guildInfo?.member_count ?? 0} membros</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"><UserCheck className="h-3 w-3" /> {guildInfo?.presence_count ?? 0} online</span>
                </div>
              </div>
              <Button variant="outline" className="gap-2 text-sm" onClick={handleAddBot}>
                <ExternalLink className="h-3.5 w-3.5" /> Adicionar <strong>Drika Bot</strong> ao servidor
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                <Shield className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Nenhum servidor conectado</p>
                <p className="text-xs text-muted-foreground mt-1">Adicione o bot ao seu servidor Discord</p>
              </div>
              <Button variant="outline" className="gap-2 text-sm" onClick={() => window.open("https://discord.com/oauth2/authorize?client_id=1477916070508757092&permissions=536870920&scope=bot%20applications.commands", "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" /> Adicionar Drika Bot
              </Button>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold border-l-2 border-primary pl-3">Auditoria</h2>
          {auditLoading ? (
            <div className="space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro de auditoria encontrado.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-none">
              {auditLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">
                    {(log.actor_name || "S")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      <span className="text-primary">{log.actor_name || "Sistema"}</span>{" "}
                      <span className="text-muted-foreground font-normal">{getAuditActionLabel(log.action)}</span>{" "}
                      {log.entity_name && <span className="font-semibold">{log.entity_name}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.entity_type} • {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
        </TabsContent>

        {/* ===== ABA RESUMO ===== */}
        <TabsContent value="resumo" className="space-y-6">
          <DashboardOverview />
        </TabsContent>
      </Tabs>

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

      {/* Server Switch Modal */}
      <Dialog open={serverModalOpen} onOpenChange={setServerModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trocar Servidor</DialogTitle>
            <DialogDescription>Selecione o servidor onde o bot irá operar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-[300px] overflow-y-auto py-2">
            {loadingGuilds ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : guilds.length === 0 ? (
              <div className="space-y-3 py-4">
                <p className="text-sm text-muted-foreground text-center">Nenhum servidor encontrado automaticamente.</p>
                <div className="space-y-2">
                  <Input
                    value={manualGuildId}
                    onChange={(e) => setManualGuildId(e.target.value.replace(/\D/g, ""))}
                    placeholder="Cole o ID do seu servidor Discord"
                    className="font-mono"
                  />
                  <Button
                    className="w-full"
                    disabled={!manualGuildId.trim() || switchingGuild !== null}
                    onClick={() => handleSwitchGuild(manualGuildId.trim())}
                  >
                    {switchingGuild === manualGuildId.trim() ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Vinculando...
                      </>
                    ) : (
                      "Vincular servidor por ID"
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Adicione o bot no seu servidor, copie o ID do servidor no Discord e cole acima.
                  </p>
                </div>
              </div>
            ) : (
              guilds.map(guild => (
                <button
                  key={guild.id}
                  onClick={() => handleSwitchGuild(guild.id)}
                  disabled={switchingGuild !== null}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
                    tenant?.discord_guild_id === guild.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {guild.icon ? (
                      <img src={guild.icon} alt={guild.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">{guild.name[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{guild.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{guild.id}</p>
                  </div>
                  {switchingGuild === guild.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {tenant?.discord_guild_id === guild.id && !switchingGuild && (
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Atual</span>
                  )}
                </button>
              ))
            )}
          </div>
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
                <TrashIcon className="h-4 w-4" />
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
