import { useState, useEffect, useCallback, useRef } from "react";
import { Server, Unplug, Loader2, Check, AlertTriangle, Bot, Trash2, Database, Cookie, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { openAsyncExternalUrl } from "@/lib/openAsyncExternalUrl";

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
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [waitingForBot, setWaitingForBot] = useState(false);
  const [availableGuilds, setAvailableGuilds] = useState<Guild[]>([]);
  const [inviteRequested, setInviteRequested] = useState(false);
  const guildsBeforeInviteRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const isConnected = !!tenant?.discord_guild_id;

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

  const fetchAllBotGuilds = useCallback(async (): Promise<Guild[]> => {
    const { data, error } = await supabase.functions.invoke("discord-bot-guilds", {
      body: { ...getRequestBody(), action: "list_all" },
    });
    if (error) return [];
    if (data?.error) return [];
    const guilds = Array.isArray(data) ? data : (data?.guilds ?? []);
    return guilds;
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
    enabled: !!tenantId && !isConnected && inviteRequested,
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
      document.body.style.pointerEvents = "";
    };
  }, []);

  useEffect(() => {
    if (!disconnectDialogOpen) {
      document.body.style.pointerEvents = "";
    }
  }, [disconnectDialogOpen]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  const linkGuild = async (guild: Guild) => {
    if (!tenantId) return;
    setConnecting(true);
    try {
      // Verify guild is not claimed by another tenant
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("discord-bot-guilds", {
        body: { ...getRequestBody(), action: "verify_guild", guild_id: guild.id },
      });

      if (verifyError) throw verifyError;
      if (verifyData?.error) throw new Error(verifyData.error);

      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: { tenant_id: tenantId, updates: { discord_guild_id: guild.id } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      setAvailableGuilds([]);
      setWaitingForBot(false);
      stopPolling();
      toast({ title: `Conectado ao servidor ${guild.name}! 🎉` });
    } catch (err: any) {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const startPollingForNewGuild = useCallback(() => {
    setWaitingForBot(true);
    setAvailableGuilds([]);
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
        const newGuilds = currentGuilds.filter((g) => !guildsBeforeInviteRef.current.has(g.id));

        if (newGuilds.length > 0) {
          stopPolling();
          setWaitingForBot(false);
          // Show the new guilds for the user to pick
          setAvailableGuilds(newGuilds);
        }
      } catch {
        // silently retry
      }
    }, 5000);
  }, [fetchAllBotGuilds, stopPolling]);

  // Listen for tab focus to trigger check
  useEffect(() => {
    if (!waitingForBot) return;

    const handleFocus = async () => {
      const currentGuilds = await fetchAllBotGuilds();
      const newGuilds = currentGuilds.filter((g) => !guildsBeforeInviteRef.current.has(g.id));
      if (newGuilds.length > 0) {
        stopPolling();
        setWaitingForBot(false);
        setAvailableGuilds(newGuilds);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void handleFocus();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [waitingForBot, fetchAllBotGuilds, stopPolling]);

  const handleDisconnect = async () => {
    if (!tenantId) return;
    setDisconnectDialogOpen(false);
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: { tenant_id: tenantId, updates: { discord_guild_id: null } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Reset invite state so we don't auto-fetch on disconnect
      setInviteRequested(false);
      setWaitingForBot(false);
      setAvailableGuilds([]);
      stopPolling();
      await refetchTenant();
      toast({ title: "Servidor desconectado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao desconectar", description: err.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleAddBot = async () => {
    try {
      await openAsyncExternalUrl(async () => {
        setInviteRequested(true);

        let inviteUrl = botInviteData?.invite_url;
        if (!inviteUrl) {
          const refreshed = await refetchInvite();
          inviteUrl = refreshed.data?.invite_url;
        }

        if (!inviteUrl) {
          throw new Error("Não foi possível gerar o link do bot. Tente novamente.");
        }

        try {
          const currentGuilds = await fetchAllBotGuilds();
          guildsBeforeInviteRef.current = new Set(currentGuilds.map((g) => g.id));
        } catch {
          guildsBeforeInviteRef.current = new Set();
        }

        return inviteUrl;
      }, {
        loadingTitle: "Abrindo convite do Discord...",
      });

      startPollingForNewGuild();
    } catch (err: any) {
      toast({
        title: "Não foi possível gerar o link do bot",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleCancelPolling = () => {
    stopPolling();
    setWaitingForBot(false);
    setAvailableGuilds([]);
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

            <Button
              variant="outline"
              className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
              disabled={disconnecting}
              onClick={() => setDisconnectDialogOpen(true)}
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
              Desconectar servidor
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Guild selection list */}
            {availableGuilds.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-foreground font-medium">
                  Selecione o servidor que deseja conectar:
                </p>
                <div className="space-y-2">
                  {availableGuilds.map((guild) => (
                    <button
                      key={guild.id}
                      onClick={() => linkGuild(guild)}
                      disabled={connecting}
                      className="w-full flex items-center gap-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors px-4 py-3 text-left disabled:opacity-50"
                    >
                      {guild.icon ? (
                        <img src={guild.icon} alt="" className="h-8 w-8 rounded-full" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {guild.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{guild.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{guild.id}</p>
                      </div>
                      {connecting ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      ) : (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setAvailableGuilds([])}
                  className="w-full"
                  size="sm"
                >
                  Cancelar
                </Button>
              </div>
            ) : !waitingForBot ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Clique no botão abaixo para adicionar o bot ao seu servidor Discord. Após adicionar, você poderá escolher qual servidor conectar.
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
                  Você será redirecionado ao Discord para autorizar o bot. Ao voltar, selecione o servidor desejado.
                </p>
              </div>
            ) : (
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
            )}
          </div>
        )}

        <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
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
                onClick={() => void handleDisconnect()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sim, desconectar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Clear local cache */}
      <div className="wallet-section">
        <div className="wallet-section-header mb-5">
          <div className="wallet-section-icon">
            <Trash2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-display font-semibold text-sm">Cache Local</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Limpe dados salvos no navegador caso algo esteja bugado</p>
          </div>
        </div>

        <div className="space-y-2">
          {/* Limpar apenas rascunhos */}
          <Button
            variant="outline"
            className="w-full gap-2 justify-start text-left h-auto py-3"
            onClick={() => {
              const keys = Object.keys(localStorage);
              let count = 0;
              keys.forEach((key) => {
                if (key.startsWith("draft:")) {
                  localStorage.removeItem(key);
                  count++;
                }
              });
              toast({ title: `${count} rascunho(s) removido(s) ✓` });
            }}
          >
            <Cookie className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Limpar rascunhos</p>
              <p className="text-[11px] text-muted-foreground font-normal">Remove formulários salvos localmente</p>
            </div>
          </Button>

          {/* Limpar cache do tenant */}
          <Button
            variant="outline"
            className="w-full gap-2 justify-start text-left h-auto py-3"
            onClick={() => {
              const keys = Object.keys(localStorage);
              let count = 0;
              keys.forEach((key) => {
                if (tenantId && key.includes(tenantId)) {
                  localStorage.removeItem(key);
                  count++;
                }
                if (key.startsWith("last_disconnected_guild:")) {
                  localStorage.removeItem(key);
                  count++;
                }
              });
              // Limpar sessionStorage do tenant
              const sKeys = Object.keys(sessionStorage);
              sKeys.forEach((key) => {
                if (tenantId && key.includes(tenantId)) {
                  sessionStorage.removeItem(key);
                  count++;
                }
              });
              toast({ title: `${count} item(ns) de cache removido(s) ✓` });
            }}
          >
            <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Limpar cache do servidor</p>
              <p className="text-[11px] text-muted-foreground font-normal">Remove dados em cache deste tenant específico</p>
            </div>
          </Button>

          {/* Limpeza total */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full gap-2 justify-start text-left h-auto py-3 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <HardDrive className="h-4 w-4 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Limpeza total + recarregar</p>
                  <p className="text-[11px] text-muted-foreground font-normal">Remove todo localStorage, sessionStorage, cache do navegador e recarrega</p>
                </div>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Limpeza total?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Isso removerá todos os dados em cache do navegador (rascunhos, sessões, preferências) e recarregará a página. Você pode precisar fazer login novamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    localStorage.clear();
                    sessionStorage.clear();
                    // Limpar Cache API (service workers, etc.)
                    if ('caches' in window) {
                      try {
                        const cacheNames = await caches.keys();
                        await Promise.all(cacheNames.map((name) => caches.delete(name)));
                      } catch { /* ignore */ }
                    }
                    window.location.reload();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sim, limpar tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default SettingsServerTab;
