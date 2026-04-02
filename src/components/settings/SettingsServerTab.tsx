import { useState, useEffect, useCallback, useRef } from "react";
import { Server, Unplug, Loader2, Check, AlertTriangle, Bot, ArrowRightLeft, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const BOT_PERMISSIONS = "536870920";

interface Props {
  tenant: any;
  tenantId: string | null;
  refetchTenant: () => void;
}

interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

interface BotInviteData {
  invite_url: string;
  client_id: string;
}

const SettingsServerTab = ({ tenant, tenantId, refetchTenant }: Props) => {
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [waitingForBot, setWaitingForBot] = useState(false);
  const [detectedGuild, setDetectedGuild] = useState<Guild | null>(null);
  const guildsBeforeInviteRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  // Transfer state
  const [transferMode, setTransferMode] = useState(false);

  // Clone state
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneGuildId, setCloneGuildId] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneResult, setCloneResult] = useState<{ token: string; stats: any } | null>(null);

  const isConnected = !!tenant?.discord_guild_id;
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

  const getRequestBody = () => {
    const body: any = { tenant_id: tenantId };
    const tokenSession = sessionStorage.getItem("token_session");
    if (tokenSession) {
      try {
        body.token = JSON.parse(tokenSession).token;
      } catch {
        // ignore
      }
    }
    return body;
  };

  const fetchAllBotGuilds = useCallback(async (): Promise<Guild[] | null> => {
    const { data, error } = await supabase.functions.invoke("discord-bot-guilds", {
      body: { ...getRequestBody(), action: "list_all" },
    });
    if (error) return null;
    if (data?.error) return null;
    const guilds = Array.isArray(data) ? data : (data?.guilds ?? []);
    return guilds.length > 0 ? guilds : null;
  }, [tenantId]);

  const {
    data: botInviteData,
    isLoading: inviteLoading,
    refetch: refetchInvite,
  } = useQuery({
    queryKey: ["discord-bot-invite", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase.functions.invoke("discord-bot-guilds", {
        body: { ...getRequestBody(), action: "invite_url", permissions: BOT_PERMISSIONS },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data ?? null) as BotInviteData | null;
    },
    enabled: !!tenantId && !isConnected,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: connectedGuildInfo } = useQuery({
    queryKey: ["connected-guild-info", tenantId, tenant?.discord_guild_id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("discord-bot-guilds", {
        body: { ...getRequestBody(), action: "verify_guild", guild_id: tenant?.discord_guild_id },
      });
      if (error || data?.error) return null;
      return data?.guild || null;
    },
    enabled: !!tenantId && isConnected,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  const autoLinkGuild = useCallback(async (guild: Guild) => {
    if (!tenantId) return false;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: { tenant_id: tenantId, updates: { discord_guild_id: guild.id } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      clearPreferredReconnectGuildId();
      await refetchTenant();
      setTransferMode(false);
      toast({ title: `Conectado ao servidor ${guild.name}! 🎉` });
      return true;
    } catch (err: any) {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
      return false;
    } finally {
      setConnecting(false);
    }
  }, [tenantId, clearPreferredReconnectGuildId, refetchTenant]);

  const tryAutoLink = useCallback(async () => {
    try {
      const preferredGuildId = getPreferredReconnectGuildId();
      if (preferredGuildId) {
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke("discord-bot-guilds", {
          body: { ...getRequestBody(), action: "verify_guild", guild_id: preferredGuildId },
        });

        if (!verifyError && verifyData?.guild) {
          const linked = await autoLinkGuild(verifyData.guild);
          if (linked) {
            stopPolling();
            setWaitingForBot(false);
            return true;
          }
        }

        if (verifyData?.error) {
          clearPreferredReconnectGuildId();
        }
      }

      const baselineIds = Array.from(guildsBeforeInviteRef.current);
      const { data: autoData, error: autoError } = await supabase.functions.invoke("discord-bot-guilds", {
        body: { ...getRequestBody(), baseline_guild_ids: baselineIds },
      });

      if (!autoError && autoData && !Array.isArray(autoData) && autoData.auto_linked) {
        stopPolling();
        setWaitingForBot(false);
        clearPreferredReconnectGuildId();
        setTransferMode(false);
        await refetchTenant();
        toast({ title: "Servidor conectado automaticamente! 🎉" });
        return true;
      }
    } catch {
      // silently ignore
    }
    return false;
  }, [getPreferredReconnectGuildId, autoLinkGuild, stopPolling, clearPreferredReconnectGuildId, refetchTenant, tenantId]);

  // Listen for tab focus / visibility to trigger immediate check
  useEffect(() => {
    if (!waitingForBot) return;

    const handleFocus = async () => {
      await tryAutoLink();
    };

    const handleVisibility = async () => {
      if (document.visibilityState === "visible") {
        await tryAutoLink();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [waitingForBot, tryAutoLink]);

  const startPollingForNewGuild = useCallback(() => {
    setWaitingForBot(true);
    setDetectedGuild(null);
    pollCountRef.current = 0;

    pollIntervalRef.current = setInterval(async () => {
      pollCountRef.current++;

      if (pollCountRef.current > 40) {
        stopPolling();
        setWaitingForBot(false);
        toast({
          title: "Tempo esgotado",
          description: "Não detectamos o bot em um novo servidor. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      try {
        const currentGuilds = await fetchAllBotGuilds();
        if (currentGuilds) {
          const newGuilds = currentGuilds.filter((g) => !guildsBeforeInviteRef.current.has(g.id));

          if (newGuilds.length > 0) {
            stopPolling();
            setWaitingForBot(false);

            const { data: verifyData } = await supabase.functions.invoke("discord-bot-guilds", {
              body: { ...getRequestBody(), action: "verify_guild", guild_id: newGuilds[0].id },
            });

            if (verifyData?.error) {
              toast({ title: "Erro", description: verifyData.error, variant: "destructive" });
              return;
            }

            setDetectedGuild(newGuilds[0]);
            await autoLinkGuild(newGuilds[0]);
            return;
          }
        }

        await tryAutoLink();
      } catch {
        // silently retry next interval
      }
    }, 5000);
  }, [fetchAllBotGuilds, stopPolling, autoLinkGuild, tryAutoLink]);

  const handleDisconnect = async () => {
    if (!tenantId) return;
    const previousGuildId = tenant?.discord_guild_id;
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: { tenant_id: tenantId, updates: { discord_guild_id: null } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (previousGuildId && disconnectedGuildStorageKey) {
        localStorage.setItem(disconnectedGuildStorageKey, previousGuildId);
      }
      await refetchTenant();
      toast({ title: "Servidor desconectado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao desconectar", description: err.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTransferServer = async () => {
    if (!tenantId) return;
    const previousGuildId = tenant?.discord_guild_id;
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: { tenant_id: tenantId, updates: { discord_guild_id: null } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (previousGuildId && disconnectedGuildStorageKey) {
        localStorage.setItem(disconnectedGuildStorageKey, previousGuildId);
      }
      await refetchTenant();
      setTransferMode(true);
      toast({ title: "Servidor desconectado. Agora conecte o novo servidor." });
    } catch (err: any) {
      toast({ title: "Erro ao desconectar", description: err.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleAddBot = async () => {
    let inviteUrl = botInviteData?.invite_url;
    if (!inviteUrl) {
      const refreshed = await refetchInvite();
      inviteUrl = refreshed.data?.invite_url;
    }
    if (!inviteUrl) {
      toast({ title: "Não foi possível gerar o link do bot", description: "Tente novamente.", variant: "destructive" });
      return;
    }

    try {
      const currentGuilds = await fetchAllBotGuilds();
      guildsBeforeInviteRef.current = new Set((currentGuilds || []).map((g) => g.id));
    } catch {
      guildsBeforeInviteRef.current = new Set();
    }

    window.open(inviteUrl, "_blank", "noopener,noreferrer");
    startPollingForNewGuild();
  };

  const handleCancelPolling = () => {
    stopPolling();
    setWaitingForBot(false);
    setDetectedGuild(null);
    if (transferMode && !isConnected) {
      // Keep transfer mode active so user can retry
    }
  };

  const handleClone = async () => {
    const trimmed = cloneGuildId.trim();
    if (!trimmed || !tenantId) return;

    if (!/^\d{17,20}$/.test(trimmed)) {
      toast({ title: "ID inválido", description: "O ID deve conter 17-20 dígitos.", variant: "destructive" });
      return;
    }

    setCloning(true);
    try {
      const { data, error } = await supabase.functions.invoke("clone-tenant", {
        body: { source_tenant_id: tenantId, new_discord_guild_id: trimmed },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Loja clonada com sucesso! 🎉",
        description: `${data?.cloned_products || 0} produtos copiados para o novo servidor.`,
      });
      setCloneDialogOpen(false);
      setCloneGuildId("");
    } catch (err: any) {
      toast({ title: "Erro ao clonar", description: err.message, variant: "destructive" });
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="wallet-section">
        <div className="wallet-section-header mb-5">
          <div className="wallet-section-icon">
            <Server className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-display font-semibold text-sm">Servidor Discord</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Gerencie a conexão com seu servidor</p>
          </div>
        </div>

        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
              <Check className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {connectedGuildInfo?.icon ? (
                  <img src={connectedGuildInfo.icon} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {(connectedGuildInfo?.name || "S").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-emerald-400 truncate">
                    {connectedGuildInfo?.name || "Servidor conectado"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                    ID: {tenant.discord_guild_id}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Transfer Server */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
                    disabled={disconnecting}
                  >
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                    Trocar servidor
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <ArrowRightLeft className="h-5 w-5 text-primary" />
                      Trocar de servidor?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Todas as configurações (produtos, estoque, cupons, embeds) serão mantidas
                      e transferidas para o novo servidor. Apenas a conexão atual será desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleTransferServer}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Sim, trocar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Clone to new server */}
              <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-accent/30 text-accent-foreground hover:bg-accent/10"
                  >
                    <Copy className="h-4 w-4" />
                    Clonar para outro
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Copy className="h-5 w-5 text-primary" />
                      Clonar loja para outro servidor
                    </DialogTitle>
                    <DialogDescription>
                      Isso criará uma nova loja com todos os produtos, estoque, cupons e configurações
                      copiados do servidor atual. Será gerado um novo plano gratuito para o clone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        ID do novo servidor Discord
                      </Label>
                      <Input
                        placeholder="Ex: 123456789012345678"
                        value={cloneGuildId}
                        onChange={(e) => setCloneGuildId(e.target.value)}
                        className="font-mono"
                        maxLength={20}
                      />
                      <p className="text-xs text-muted-foreground">
                        Certifique-se de que o bot já foi adicionado ao novo servidor antes de clonar.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleClone}
                      disabled={cloning || !cloneGuildId.trim()}
                      className="gradient-pink text-primary-foreground"
                    >
                      {cloning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      {cloning ? "Clonando..." : "Clonar loja"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Disconnect */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                    disabled={disconnecting}
                  >
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Desconectar servidor?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      O bot deixará de operar neste servidor. Todas as configurações ficarão salvas,
                      mas só funcionarão quando um servidor for reconectado.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnect}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Sim, desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {transferMode && !waitingForBot && !detectedGuild && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 mb-2">
                <p className="text-sm text-foreground font-medium">🔄 Modo transferência ativo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Adicione o bot ao novo servidor. Todas as configurações serão mantidas.
                </p>
              </div>
            )}

            {!waitingForBot && !detectedGuild ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Clique no botão abaixo para adicionar o bot ao seu servidor Discord. A conexão será feita automaticamente.
                </p>
                <Button
                  onClick={handleAddBot}
                  disabled={inviteLoading}
                  className="w-full gap-2 gradient-pink text-primary-foreground"
                  size="lg"
                >
                  {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                  Conectar Bot ao Servidor
                </Button>
                <p className="text-xs text-muted-foreground">
                  Você será redirecionado ao Discord para autorizar o bot. Ao voltar, o servidor será vinculado automaticamente.
                </p>
              </div>
            ) : waitingForBot ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-6 text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Aguardando conexão...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Adicione o bot ao seu servidor no Discord. A detecção é automática.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleCancelPolling}
                  className="w-full"
                  size="sm"
                >
                  Cancelar
                </Button>
              </div>
            ) : connecting ? (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-6 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm font-medium text-foreground">Vinculando servidor...</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsServerTab;
