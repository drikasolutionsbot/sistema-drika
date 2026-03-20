import { useState } from "react";
import { Server, Unplug, Loader2, Check, AlertTriangle, Bot, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const BOT_PERMISSIONS = "536870920";

interface Props {
  tenant: any;
  tenantId: string | null;
  refetchTenant: () => void;
}

interface BotInviteData {
  invite_url: string;
  client_id: string;
}

const SettingsServerTab = ({ tenant, tenantId, refetchTenant }: Props) => {
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [guildIdInput, setGuildIdInput] = useState("");

  const isConnected = !!tenant?.discord_guild_id;

  const getRequestBody = () => {
    const body: any = { tenant_id: tenantId };
    const tokenSession = sessionStorage.getItem("token_session");
    if (tokenSession) {
      try {
        body.token = JSON.parse(tokenSession).token;
      } catch {
        // ignore malformed session
      }
    }
    return body;
  };

  const {
    data: botInviteData,
    isLoading: inviteLoading,
    refetch: refetchInvite,
  } = useQuery({
    queryKey: ["discord-bot-invite", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase.functions.invoke("discord-bot-guilds", {
        body: {
          ...getRequestBody(),
          action: "invite_url",
          permissions: BOT_PERMISSIONS,
        },
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
        body: {
          ...getRequestBody(),
          action: "verify_guild",
          guild_id: tenant?.discord_guild_id,
        },
      });
      if (error) return null;
      if (data?.error) return null;
      return data?.guild || null;
    },
    enabled: !!tenantId && isConnected,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    retry: 1,
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

  const handleConnectGuild = async () => {
    if (!tenantId || !guildIdInput.trim()) return;
    const guildId = guildIdInput.trim();

    if (!/^\d{17,20}$/.test(guildId)) {
      toast({ title: "ID inválido", description: "O ID do servidor deve conter apenas números (17-20 dígitos).", variant: "destructive" });
      return;
    }

    setConnecting(true);
    try {
      // Verify the bot is in this guild
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("discord-bot-guilds", {
        body: {
          ...getRequestBody(),
          action: "verify_guild",
          guild_id: guildId,
        },
      });

      if (verifyError || verifyData?.error) {
        throw new Error(verifyData?.error || "Erro ao verificar servidor");
      }

      if (!verifyData?.guild) {
        toast({
          title: "Bot não encontrado neste servidor",
          description: "Certifique-se de que você adicionou o bot ao servidor antes de vincular.",
          variant: "destructive",
        });
        setConnecting(false);
        return;
      }

      // Link the guild
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: { discord_guild_id: guildId },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      toast({ title: `Conectado ao servidor ${verifyData.guild.name}! 🎉` });
      setGuildIdInput("");
    } catch (err: any) {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleAddBot = async () => {
    let inviteUrl = botInviteData?.invite_url;

    if (!inviteUrl) {
      const refreshed = await refetchInvite();
      inviteUrl = refreshed.data?.invite_url;
    }

    if (!inviteUrl) {
      toast({
        title: "Não foi possível gerar o link do bot",
        description: "Tente novamente em alguns segundos.",
        variant: "destructive",
      });
      return;
    }

    window.open(inviteUrl, "_blank", "noopener,noreferrer");
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <p className="text-sm font-medium text-foreground">Adicione o bot ao seu servidor</p>
              </div>
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
                Você será redirecionado ao Discord para autorizar o bot e escolher o servidor.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <p className="text-sm font-medium text-foreground">Cole o ID do seu servidor</p>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Ex: 1234567890123456789"
                  value={guildIdInput}
                  onChange={(e) => setGuildIdInput(e.target.value)}
                  className="font-mono text-sm"
                  maxLength={20}
                />
                <Button
                  onClick={handleConnectGuild}
                  disabled={connecting || !guildIdInput.trim()}
                  className="gradient-pink text-primary-foreground border-none hover:opacity-90 shrink-0 gap-1.5"
                >
                  {connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  Vincular
                </Button>
              </div>

              <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Como encontrar o ID do servidor?</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Abra o Discord e vá até seu servidor</li>
                  <li>Clique com o botão direito no nome do servidor</li>
                  <li>Clique em <span className="font-medium text-foreground">"Copiar ID do servidor"</span></li>
                </ol>
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  💡 Se não aparecer, ative o Modo Desenvolvedor em Configurações → Avançado
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsServerTab;
