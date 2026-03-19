import { useState } from "react";
import { Server, Unplug, Loader2, Check, ExternalLink, AlertTriangle, RefreshCw, Bot } from "lucide-react";
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

const GLOBAL_BOT_CLIENT_ID = "1477916070508757092";
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

const SettingsServerTab = ({ tenant, tenantId, refetchTenant }: Props) => {
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const isConnected = !!tenant?.discord_guild_id;

  // Fetch available guilds where bot is present (only when not connected)
  const { data: guilds = [], isLoading: guildsLoading, refetch: refetchGuilds } = useQuery({
    queryKey: ["server-guilds", tenantId],
    queryFn: async () => {
      const tokenSession = sessionStorage.getItem("token_session");
      const body: any = { tenant_id: tenantId };
      if (tokenSession) {
        try { body.token = JSON.parse(tokenSession).token; } catch {}
      }
      const { data, error } = await supabase.functions.invoke("discord-bot-guilds", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data ?? []) as Guild[];
    },
    enabled: !!tenantId && !isConnected,
  });

  // Find connected guild info
  const { data: connectedGuildInfo } = useQuery({
    queryKey: ["connected-guild-info", tenantId, tenant?.discord_guild_id],
    queryFn: async () => {
      const tokenSession = sessionStorage.getItem("token_session");
      const body: any = { tenant_id: tenantId };
      if (tokenSession) {
        try { body.token = JSON.parse(tokenSession).token; } catch {}
      }
      const { data, error } = await supabase.functions.invoke("discord-bot-guilds", { body });
      if (error) return null;
      if (data?.error) return null;
      const list = (data ?? []) as Guild[];
      return list.find((g) => g.id === tenant?.discord_guild_id) || null;
    },
    enabled: !!tenantId && isConnected,
  });

  const handleDisconnect = async () => {
    if (!tenantId) return;
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: { discord_guild_id: null },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      toast({ title: "Servidor desconectado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao desconectar", description: err.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConnectGuild = async (guild: Guild) => {
    if (!tenantId) return;
    setConnecting(guild.id);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: { discord_guild_id: guild.id },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      toast({ title: `Conectado ao servidor ${guild.name}! 🎉` });
    } catch (err: any) {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
    } finally {
      setConnecting(null);
    }
  };

  const botClientId = tenant?.bot_client_id || GLOBAL_BOT_CLIENT_ID;

  const handleAddBot = () => {
    const url = `https://discord.com/oauth2/authorize?client_id=${botClientId}&permissions=${BOT_PERMISSIONS}&scope=bot%20applications.commands`;
    window.open(url, "_blank");
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
            {/* Connected status with server info */}
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

            {/* Disconnect */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                  disabled={disconnecting}
                >
                  {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                  Desconectar servidor
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
        ) : (
          <div className="space-y-5">
            {/* Step 1: Add bot */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <p className="text-sm font-medium text-foreground">Adicione o bot ao seu servidor</p>
              </div>
              <Button
                onClick={handleAddBot}
                className="w-full gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white"
                size="lg"
              >
                <Bot className="h-4 w-4" />
                Conectar Bot ao Servidor
              </Button>
              <p className="text-xs text-muted-foreground">
                Você será redirecionado ao Discord para autorizar o bot e escolher o servidor.
              </p>
            </div>

            {/* Step 2: Select server */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <p className="text-sm font-medium text-foreground">Selecione o servidor para vincular</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => refetchGuilds()}
                  className="ml-auto h-7 w-7"
                  title="Atualizar lista"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>

              {guildsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />
                  ))}
                </div>
              ) : guilds.length === 0 ? (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-5 text-center">
                  <AlertTriangle className="h-7 w-7 text-amber-400/60 mx-auto mb-2" />
                  <p className="text-sm font-medium text-amber-400">Nenhum servidor encontrado</p>
                  <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
                    Adicione o bot ao seu servidor no passo 1 e depois clique em atualizar.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchGuilds()}
                    className="mt-3"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Atualizar lista
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {guilds.map((guild) => (
                    <div
                      key={guild.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors px-4 py-3"
                    >
                      {guild.icon ? (
                        <img src={guild.icon} alt="" className="h-10 w-10 rounded-full shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                          {guild.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{guild.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{guild.id}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleConnectGuild(guild)}
                        disabled={connecting === guild.id}
                        className="gradient-pink text-primary-foreground border-none hover:opacity-90 shrink-0"
                      >
                        {connecting === guild.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Vincular
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsServerTab;
