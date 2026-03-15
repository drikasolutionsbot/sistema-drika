import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import WifiLoader from "@/components/ui/wifi-loader";
import {
  Server,
  ExternalLink,
  Loader2,
  Check,
  LayoutDashboard,
  Settings,
  RefreshCw,
} from "lucide-react";

const DISCORD_CLIENT_ID = "1477916070508757092";
const BOT_PERMISSIONS = "536870920"; // Administrator + MANAGE_WEBHOOKS

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phase, setPhase] = useState<"loading" | "add" | "select" | "done">("loading");
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState<DiscordGuild | null>(null);
  const [creatingTenant, setCreatingTenant] = useState(false);

  // Check if user already has a tenant
  useEffect(() => {
    // Token session users skip onboarding entirely
    const tokenSession = sessionStorage.getItem("token_session");
    if (tokenSession) {
      navigate("/dashboard", { replace: true });
      return;
    }

    const minDelay = new Promise(resolve => setTimeout(resolve, 5000));

    const checkExistingTenant = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();

        await minDelay;

        if (data?.tenant_id) {
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch {
        await minDelay;
      }
      setPhase("add");
    };
    checkExistingTenant();
  }, [user, navigate]);

  const getEdgeErrorMessage = async (error: any) => {
    const fallback = error?.message || "Erro inesperado";
    const response = error?.context;

    if (!response || typeof response.json !== "function") {
      return fallback;
    }

    try {
      const payload = await response.json();
      return payload?.error || fallback;
    } catch {
      return fallback;
    }
  };

  const handleAddBot = () => {
    const url = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=${BOT_PERMISSIONS}&scope=bot%20applications.commands`;
    window.open(url, "_blank");
  };

  const fetchBotGuilds = async () => {
    setGuildsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-bot-guilds", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list = Array.isArray(data) ? data : [];
      setGuilds(list);
      if (list.length > 0) {
        setPhase("select");
      } else {
        toast({ title: "Nenhum servidor encontrado", description: "Adicione o bot a um servidor primeiro.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar servidores", description: err.message, variant: "destructive" });
    } finally {
      setGuildsLoading(false);
    }
  };

  const handleSelectGuild = async (guild: DiscordGuild) => {
    setSelectedGuild(guild);
    setCreatingTenant(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-tenant", {
        body: {
          name: guild.name,
          discord_guild_id: guild.id,
        },
      });

      if (error) {
        const message = await getEdgeErrorMessage(error);
        if (message.includes("já está vinculado") || message.includes("já possui")) {
          setPhase("done");
          toast({ title: "Servidor já configurado! Prosseguindo..." });
          return;
        }
        throw new Error(message);
      }

      if (data?.error) {
        if (data.error.includes("já está vinculado") || data.error.includes("já possui")) {
          setPhase("done");
          toast({ title: "Servidor já configurado! Prosseguindo..." });
          return;
        }
        throw new Error(data.error);
      }

      setPhase("done");
      toast({ title: "Loja criada com sucesso! 🎉" });
    } catch (err: any) {
      const message = err?.message || "Erro ao criar loja";
      toast({ title: "Erro ao criar loja", description: message, variant: "destructive" });
      setSelectedGuild(null);
    } finally {
      setCreatingTenant(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg animate-fade-in">

          {/* Phase: Loading */}
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-16">
              <WifiLoader />
            </div>
          )}

          {/* Phase: Add bot */}
          {phase === "add" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Adicione o bot ao servidor</h2>
                <p className="text-muted-foreground mt-1">
                  Adicione o bot ao seu servidor e depois clique em "Já adicionei"
                </p>
              </div>

              <div className="flex flex-col items-center gap-4 py-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#5865F2]/10">
                  <Server className="h-10 w-10 text-[#5865F2]" />
                </div>
                <Button
                  onClick={handleAddBot}
                  className="gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6"
                  size="lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  Adicionar ao Discord
                </Button>
              </div>

              <Button
                onClick={fetchBotGuilds}
                disabled={guildsLoading}
                className="w-full gap-2 gradient-pink text-primary-foreground"
                size="lg"
              >
                {guildsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Já adicionei o bot
              </Button>
            </div>
          )}

          {/* Phase: Select server */}
          {phase === "select" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Selecione o servidor</h2>
                <p className="text-muted-foreground mt-1">
                  Escolha o servidor onde o bot foi adicionado
                </p>
              </div>

              {creatingTenant ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">Criando sua loja...</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {guilds.map((guild) => (
                    <button
                      key={guild.id}
                      onClick={() => handleSelectGuild(guild)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted transition-colors text-left"
                    >
                      {guild.icon ? (
                        <img src={guild.icon} alt="" className="h-10 w-10 rounded-full" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground font-bold">
                          {guild.name[0]}
                        </div>
                      )}
                      <span className="font-medium truncate">{guild.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPhase("add")} className="flex-1">
                  Voltar
                </Button>
                <Button variant="outline" onClick={fetchBotGuilds} disabled={guildsLoading} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${guildsLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>
            </div>
          )}

          {/* Phase: Done */}
          {phase === "done" && selectedGuild && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold">Tudo pronto!</h2>
                  <p className="text-muted-foreground mt-1">
                    Servidor <strong>{selectedGuild.name}</strong> conectado
                  </p>
                </div>
                {selectedGuild.icon && (
                  <img src={selectedGuild.icon} alt="" className="h-16 w-16 rounded-full border-2 border-border" />
                )}
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => navigate("/dashboard")}
                  className="w-full gap-2 gradient-pink text-primary-foreground"
                  size="lg"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Ir para o Painel
                </Button>
                <Button
                  onClick={() => navigate("/settings")}
                  variant="outline"
                  className="w-full gap-2"
                  size="lg"
                >
                  <Settings className="h-4 w-4" />
                  Configurar Loja
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Configure canais, produtos e cores no painel a qualquer momento.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
