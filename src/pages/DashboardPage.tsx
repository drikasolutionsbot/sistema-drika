import { useState, useEffect, useCallback, useRef } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogHeader,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  ExternalLink, Users, UserCheck, Settings2, Plus, UserPlus, Loader2, Shield,
  BarChart3, Eye, Unplug,
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
import { ptBR as ptBRLocale } from "date-fns/locale";
import { useLanguage } from "@/i18n/LanguageContext";

const BOT_PERMISSIONS = "536870920"; // Administrator + MANAGE_WEBHOOKS

const DashboardPage = () => {
  const { tenant, tenantId, loading: tenantLoading, refetch } = useTenant();
  const { providerToken } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"membros" | "cargos">("membros");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);

  // Always refetch tenant on mount to ensure fresh data after navigating back
  useEffect(() => {
    refetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Server switch modal
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [guilds, setGuilds] = useState<{ id: string; name: string; icon: string | null }[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [switchingGuild, setSwitchingGuild] = useState<string | null>(null);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

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

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Guild info state
  const [guildInfo, setGuildInfo] = useState<{ name: string; member_count: number; presence_count: number; icon: string | null } | null>(null);
  const [waitingForBot, setWaitingForBot] = useState(false);
  const guildsBeforeInviteRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const linkingInProgressRef = useRef(false);

  useEffect(() => {
    if (!tenant?.discord_guild_id) {
      setGuildInfo(null);
      return;
    }
    supabase.functions.invoke("discord-guild-info", {
      body: { guild_id: tenant.discord_guild_id },
    }).then(({ data, error }) => {
      if (data && !data.error && !error) {
        setGuildInfo({ name: data.name || tenant.name, member_count: data.member_count, presence_count: data.presence_count, icon: data.icon });
      } else {
        setGuildInfo(null);
      }
    }).catch(() => setGuildInfo(null));
  }, [tenant?.discord_guild_id]);

  // Fetch audit logs
  const loadAuditLogs = async () => {
    if (!tenant?.id) return;
    setAuditLoading(true);
    const logs = await fetchTenantAuditLogs(tenant.id, 10);
    setAuditLogs(logs);
    setAuditLoading(false);
  };

  useEffect(() => {
    loadAuditLogs();
  }, [tenant?.id]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

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
    if (result) {
      setMemberDraft({});
      toast.success(t.dashboard.permissionsSaved);
      if (tenantId) {
        await logTenantAudit(tenantId, "save_permissions", "membro", selectedMember.discord_display_name || selectedMember.discord_username, selectedMember.id, memberDraft);
        loadAuditLogs();
      }
    }
    else toast.error(t.dashboard.errorSaving);
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
    if (result) { setRoleDraft({}); toast.success(t.dashboard.rolePermsSaved); }
    else toast.error(t.dashboard.errorSaving);
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
        if (tenantId) {
          await logTenantAudit(tenantId, "create_role", "cargo", result.name, result.id);
          loadAuditLogs();
        }
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
    if (tenantId) {
      await logTenantAudit(tenantId, "delete_role", "cargo", role.name, role.id);
      loadAuditLogs();
    }
  };

  // --- Common handlers ---
  const handleSelectMember = async (member: DiscordMember) => {
    const result = await addMember({
      discord_user_id: member.id,
      discord_username: member.username,
      discord_display_name: member.displayName,
      discord_avatar_url: member.avatar ?? null,
    });
    if (result) {
      setSelectedMemberId(result.id);
      setMemberDraft({});
      if (tenantId) {
        await logTenantAudit(tenantId, "add_member", "membro", member.displayName || member.username, member.id);
        loadAuditLogs();
      }
    }
  };

  const getAuditActionLabel = (action: string) => {
    const map: Record<string, string> = {
      create: t.dashboard.auditCreate, update: t.dashboard.auditUpdate, delete: t.dashboard.auditDelete,
      activate: t.dashboard.auditActivate, deactivate: t.dashboard.auditDeactivate,
      switch_server: t.dashboard.auditSwitchServer, save_permissions: t.dashboard.auditSavePermissions,
      add_member: t.dashboard.auditAddMember, remove_member: t.dashboard.auditRemoveMember,
      create_role: t.dashboard.auditCreateRole, delete_role: t.dashboard.auditDeleteRole,
      add_stock: t.dashboard.auditAddStock, deliver_order: t.dashboard.auditDeliverOrder,
      disconnect_server: t.dashboard.auditDisconnectServer,
    };
    return map[action] || action;
  };

  const appendGuildToInvite = (inviteUrl: string) => {
    const reconnectGuildId = getPreferredReconnectGuildId();
    const targetGuildId = tenant?.discord_guild_id || reconnectGuildId;
    if (!targetGuildId) return inviteUrl;
    try {
      const url = new URL(inviteUrl);
      url.searchParams.set("guild_id", targetGuildId);
      return url.toString();
    } catch {
      return inviteUrl;
    }
  };

  const disconnectedGuildStorageKey = tenantId ? `last_disconnected_guild:${tenantId}` : null;

  const getPreferredReconnectGuildId = useCallback(() => {
    if (!disconnectedGuildStorageKey) return null;
    const value = localStorage.getItem(disconnectedGuildStorageKey);
    if (!value || !/^\d{17,20}$/.test(value)) return null;
    return value;
  }, [disconnectedGuildStorageKey]);

  const clearPreferredReconnectGuildId = useCallback(() => {
    if (!disconnectedGuildStorageKey) return;
    localStorage.removeItem(disconnectedGuildStorageKey);
  }, [disconnectedGuildStorageKey]);

  const getDiscordRequestBody = useCallback(() => {
    const body: Record<string, unknown> = { tenant_id: tenantId };
    const tokenSession = sessionStorage.getItem("token_session");
    if (providerToken) {
      body.discord_user_token = providerToken;
    }
    if (!tokenSession) return body;

    try {
      const parsed = JSON.parse(tokenSession);
      if (parsed?.token) body.token = parsed.token;
    } catch {
      // ignore parsing errors
    }

    return body;
  }, [tenantId, providerToken]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  const fetchAllBotGuilds = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("discord-bot-guilds", {
      body: { ...getDiscordRequestBody(), action: "list_all" },
    });

    if (error || data?.error) return null;
    const guilds = Array.isArray(data) ? data : (data?.guilds ?? []);
    return Array.isArray(guilds) ? guilds : null;
  }, [getDiscordRequestBody]);

  const autoLinkGuild = useCallback(async (guild: { id: string; name: string }) => {
    if (!tenantId || linkingInProgressRef.current) return false;
    linkingInProgressRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: { ...getDiscordRequestBody(), updates: { discord_guild_id: guild.id } },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await refetch();
      clearPreferredReconnectGuildId();
      stopPolling();
      setWaitingForBot(false);
      toast.success(`Servidor ${guild.name} conectado! 🎉`);
      return true;
    } catch {
      linkingInProgressRef.current = false;
      return false;
    }
  }, [tenantId, refetch, clearPreferredReconnectGuildId, stopPolling]);

  const tryBackendAutoLink = useCallback(async () => {
    const freshTenant = await refetch();

    if (freshTenant?.discord_guild_id) {
      stopPolling();
      setWaitingForBot(false);
      clearPreferredReconnectGuildId();
      return true;
    }

    const preferredGuildId = getPreferredReconnectGuildId();
    if (preferredGuildId) {
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("discord-bot-guilds", {
        body: { ...getDiscordRequestBody(), action: "verify_guild", guild_id: preferredGuildId },
      });

      if (!verifyError && verifyData?.guild) {
        return await autoLinkGuild(verifyData.guild);
      }

      if (verifyData?.error) {
        clearPreferredReconnectGuildId();
      }
    }

    const { data: autoData, error: autoError } = await supabase.functions.invoke("discord-bot-guilds", {
      body: {
        ...getDiscordRequestBody(),
        baseline_guild_ids: Array.from(guildsBeforeInviteRef.current),
        allow_stored_reconnect: true,
      },
    });

    if (autoError || !autoData || Array.isArray(autoData)) return false;

    if (autoData.auto_linked) {
      if (linkingInProgressRef.current) return true;
      linkingInProgressRef.current = true;
      stopPolling();
      setWaitingForBot(false);
      const freshTenant = await refetch();
      if (!freshTenant?.discord_guild_id) {
        linkingInProgressRef.current = false;
        setWaitingForBot(true);
        return false;
      }
      clearPreferredReconnectGuildId();
      toast.success("Servidor conectado automaticamente! 🎉");
      return true;
    }

    const autoGuilds = Array.isArray(autoData.guilds) ? autoData.guilds : [];
    if (autoGuilds.length === 1) {
      return await autoLinkGuild(autoGuilds[0]);
    }

    return false;
  }, [getPreferredReconnectGuildId, getDiscordRequestBody, autoLinkGuild, clearPreferredReconnectGuildId, stopPolling, refetch]);

  const startPollingForGuildConnection = useCallback(() => {
    if (!tenantId) return;

    stopPolling();
    linkingInProgressRef.current = false;
    setWaitingForBot(true);
    pollCountRef.current = 0;

    pollIntervalRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      if (pollCountRef.current > 40) {
        stopPolling();
        setWaitingForBot(false);
        toast.error("Tempo esgotado para detectar o servidor. Tente novamente.");
        return;
      }

      try {
        const freshTenant = await refetch();

        if (freshTenant?.discord_guild_id) {
          stopPolling();
          setWaitingForBot(false);
          clearPreferredReconnectGuildId();
          return;
        }

        const currentGuilds = await fetchAllBotGuilds();

        if (currentGuilds) {
          const newGuilds = currentGuilds.filter((guild: { id: string }) => !guildsBeforeInviteRef.current.has(guild.id));

          if (newGuilds.length > 0) {
            const guild = newGuilds[0];
            const { data: verifyData } = await supabase.functions.invoke("discord-bot-guilds", {
              body: { ...getDiscordRequestBody(), action: "verify_guild", guild_id: guild.id },
            });

            if (verifyData?.error) {
              stopPolling();
              setWaitingForBot(false);
              toast.error(verifyData.error);
              return;
            }

            const linked = await autoLinkGuild(guild);
            if (linked) return;
          }
        }

        const linked = await tryBackendAutoLink();
        if (linked) return;
      } catch {
        // keep polling
      }
    }, 5000);

    void tryBackendAutoLink();
  }, [tenantId, stopPolling, fetchAllBotGuilds, getDiscordRequestBody, autoLinkGuild, tryBackendAutoLink, refetch, clearPreferredReconnectGuildId]);

  useEffect(() => {
    if (!waitingForBot) return;

    const triggerBackgroundCheck = () => {
      if (document.visibilityState === "hidden") return;
      void refetch();
      void tryBackendAutoLink();
    };

    window.addEventListener("focus", triggerBackgroundCheck);
    document.addEventListener("visibilitychange", triggerBackgroundCheck);

    return () => {
      window.removeEventListener("focus", triggerBackgroundCheck);
      document.removeEventListener("visibilitychange", triggerBackgroundCheck);
    };
  }, [waitingForBot, tryBackendAutoLink, refetch]);

  useEffect(() => {
    if (!waitingForBot || !tenant?.discord_guild_id) return;
    stopPolling();
    setWaitingForBot(false);
  }, [waitingForBot, tenant?.discord_guild_id, stopPolling]);

  if (tenantLoading || !tenant) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const handleAddBot = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("discord-bot-guilds", {
        body: { ...getDiscordRequestBody(), action: "invite_url", permissions: BOT_PERMISSIONS },
      });

      if (error || !data?.invite_url) {
        throw new Error(data?.error || error?.message || "Não foi possível gerar o convite do bot externo.");
      }

      const currentGuilds = await fetchAllBotGuilds();
      guildsBeforeInviteRef.current = new Set((currentGuilds || []).map((guild: { id: string }) => guild.id));

      window.open(appendGuildToInvite(data.invite_url), "_blank", "noopener,noreferrer");
      startPollingForGuildConnection();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível abrir o convite do bot externo.");
    }
  };

  const handleCancelBotPolling = () => {
    stopPolling();
    setWaitingForBot(false);
  };


  const handleDisconnectServer = async () => {
    if (!tenantId || !tenant?.discord_guild_id) return;
    setDisconnecting(true);
    try {
      if (disconnectedGuildStorageKey) {
        localStorage.setItem(disconnectedGuildStorageKey, tenant.discord_guild_id);
      }
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: { ...getDiscordRequestBody(), updates: { discord_guild_id: null } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(t.dashboard.serverDisconnected);
      if (tenantId) {
        await logTenantAudit(tenantId, "disconnect_server", "servidor", guildInfo?.name || tenant.name, tenant.discord_guild_id);
        loadAuditLogs();
      }
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao desconectar servidor.");
    } finally {
      setDisconnecting(false);
      setDisconnectModalOpen(false);
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
        body: { ...getDiscordRequestBody(), updates: { discord_guild_id: guildId } },
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
          {t.dashboard.controlPanel} <strong className="text-foreground">{tenant.name}</strong>
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="bg-muted/50 border border-border w-max min-w-full sm:w-auto">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-background text-xs sm:text-sm">
              <Eye className="h-4 w-4" /> {t.dashboard.overviewTab}
            </TabsTrigger>
            <TabsTrigger value="resumo" className="gap-2 data-[state=active]:bg-background text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" /> {t.dashboard.summaryTab}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ===== ABA VISÃO GERAL ===== */}
        <TabsContent value="overview" className="space-y-8">

      {/* Server Section */}
      <div>
        <h1 className="font-display text-2xl font-bold">{t.dashboard.operationsServer}</h1>
        <p className="text-muted-foreground">
          {t.dashboard.operationsServerDesc.replace("{name}", tenant.name)}
        </p>
      </div>

      {/* Server Info + Audit */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold border-l-2 border-primary pl-3">{t.dashboard.mainServer}</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={openServerModal}><Settings2 className="h-4 w-4" /></Button>
          </div>
          {tenant.discord_guild_id ? (
            <>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {guildInfo?.icon ? (
                  <img
                    src={guildInfo.icon}
                    alt="Server icon"
                    className="h-9 w-9 sm:h-10 sm:w-10 rounded-full shrink-0"
                  />
                ) : (
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs sm:text-sm shrink-0">
                    {(guildInfo?.name || tenant.name)[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium">{guildInfo?.name || tenant.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">({tenant.discord_guild_id})</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground border-l-2 border-primary pl-2 mb-2">{t.dashboard.serverInfo}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] sm:text-xs font-medium text-muted-foreground"><Users className="h-3 w-3" /> {guildInfo?.member_count ?? 0} {t.dashboard.membersCount}</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] sm:text-xs font-medium text-muted-foreground"><UserCheck className="h-3 w-3" /> {guildInfo?.presence_count ?? 0} {t.dashboard.online}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2 text-sm" onClick={handleAddBot}>
                  <ExternalLink className="h-3.5 w-3.5" /> {t.dashboard.addDrikaBot}
                </Button>
                <Button variant="outline" className="gap-2 text-sm text-destructive hover:text-destructive" onClick={() => setDisconnectModalOpen(true)}>
                  <Unplug className="h-3.5 w-3.5" /> {t.dashboard.disconnectServer}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                <Shield className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t.dashboard.noServerConnected}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.dashboard.noServerDesc}</p>
              </div>
              {waitingForBot ? (
                <div className="w-full max-w-sm space-y-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-center gap-2 text-sm text-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      {t.dashboard.waitingConnection}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleCancelBotPolling}>
                    {t.common.cancel}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="gap-2 text-sm" onClick={handleAddBot}>
                  <ExternalLink className="h-3.5 w-3.5" /> {t.dashboard.addBot}
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold border-l-2 border-primary pl-3">{t.dashboard.auditLog}</h2>
          {auditLoading ? (
            <div className="space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.dashboard.noAuditLogs}</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-none">
              {auditLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">
                    {(log.actor_name || "S")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      <span className="text-primary">{log.actor_name || t.dashboard.system}</span>{" "}
                      <span className="text-muted-foreground font-normal">{getAuditActionLabel(log.action)}</span>{" "}
                      {log.entity_name && <span className="font-semibold">{log.entity_name}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.entity_type} • {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBRLocale })}
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
          <h2 className="font-display text-2xl font-bold">{t.dashboard.permissions}</h2>
          <p className="text-muted-foreground">{t.dashboard.permissionsDesc}</p>
        </div>

        <div className="flex gap-4 sm:gap-6 border-b border-border overflow-x-auto scrollbar-none">
          {([
            { key: "membros" as const, label: t.dashboard.members },
            { key: "cargos" as const, label: t.dashboard.roles },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === tab.key ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===== MEMBROS ===== */}
        {activeTab === "membros" && (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold border-l-2 border-primary pl-3">{t.dashboard.membersList}</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setMemberSearchOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {permLoading ? (
                <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
              ) : permissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <UserPlus className="h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">{t.dashboard.noMembersInList}</p>
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
              title={selectedMember ? `${t.dashboard.permissionsFor} ${selectedMember.discord_display_name || selectedMember.discord_username}` : null}
              subtitle={t.dashboard.selectPermissions}
              emptyText={t.dashboard.selectMember}
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
                toast.success(t.dashboard.memberRemoved);
              } : undefined}
            />
          </div>
        )}

        {/* ===== CARGOS ===== */}
        {activeTab === "cargos" && (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold border-l-2 border-primary pl-3">{t.dashboard.rolesList}</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setCreateRoleOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {rolesLoading ? (
                <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
              ) : roles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Shield className="h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">{t.dashboard.noRolesCreated}</p>
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
              title={selectedRole ? `${t.dashboard.rolePermissions} ${selectedRole.name}` : null}
              subtitle={t.dashboard.selectRolePermissions}
              emptyText={t.dashboard.selectRole}
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
            <DialogTitle>{t.dashboard.createNewRole}</DialogTitle>
            <DialogDescription>{t.dashboard.createNewRoleDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.dashboard.roleName}</label>
              <Input
                placeholder={t.dashboard.roleNamePlaceholder}
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.dashboard.color}</label>
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
            <Button variant="ghost" onClick={() => setCreateRoleOpen(false)} disabled={creatingRole}>{t.common.cancel}</Button>
            <Button onClick={handleCreateRole} disabled={creatingRole || !newRoleName.trim()}>
              {creatingRole ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t.dashboard.creating}</> : t.dashboard.createRole}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Server Switch Modal */}
      <Dialog open={serverModalOpen} onOpenChange={setServerModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.dashboard.switchServer}</DialogTitle>
            <DialogDescription>{t.dashboard.switchServerDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-[300px] overflow-y-auto py-2">
            {loadingGuilds ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : guilds.length === 0 ? (
               <div className="space-y-3 py-4">
                 <p className="text-sm text-muted-foreground text-center">{t.dashboard.noServerFound}</p>
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
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">{t.dashboard.currentServer}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Disconnect Server Modal */}
      <AlertDialog open={disconnectModalOpen} onOpenChange={setDisconnectModalOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Unplug className="h-5 w-5 text-destructive" />
              Desconectar servidor
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja desconectar o servidor{" "}
              <span className="font-semibold text-foreground">{guildInfo?.name || tenant?.name}</span>
              ? O bot continuará no servidor, mas o painel não estará mais vinculado a ele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnectServer}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const { t } = useLanguage();
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
                <div key={key} className="flex items-center justify-between rounded-lg border border-border px-3 sm:px-4 py-2.5 sm:py-3">
                  <div className="pr-3 sm:pr-4 min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold">{label}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">{description}</p>
                  </div>
                  <Switch checked={getValue(key)} onCheckedChange={() => onToggle(key)} />
                </div>
              ))}
            </div>
          </div>

          {hasChanges && (
            <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 border-t border-border bg-card/95 backdrop-blur flex items-center justify-end gap-3 rounded-b-xl">
              <span className="text-xs text-muted-foreground mr-auto">{t.dashboard.unsavedChanges}</span>
              <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>{t.dashboard.discardChanges}</Button>
              <Button size="sm" onClick={onSave} disabled={saving}>
                {saving ? t.dashboard.saving : t.common.save}
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
