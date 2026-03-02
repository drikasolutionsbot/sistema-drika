import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Server,
  ExternalLink,
  Loader2,
  Check,
  LayoutDashboard,
  Settings,
} from "lucide-react";

const DISCORD_CLIENT_ID = "1477916070508757092";
const BOT_PERMISSIONS = "8";

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

const OnboardingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [botAdded, setBotAdded] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState<DiscordGuild | null>(null);
  const [guildLoading, setGuildLoading] = useState(false);
  const [creatingTenant, setCreatingTenant] = useState(false);

  useEffect(() => {
    const guildId = searchParams.get("guild_id");
    if (guildId) {
      fetchGuildAndCreateTenant(guildId);
    }
  }, [searchParams]);

  const fetchGuildAndCreateTenant = async (guildId: string) => {
    setGuildLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-guild-info", {
        body: { guild_id: guildId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSelectedGuild(data);

      // Auto-create tenant with guild name
      setCreatingTenant(true);
      const { data: tenantData, error: tenantError } = await supabase.functions.invoke("create-tenant", {
        body: {
          name: data.name,
          discord_guild_id: data.id,
        },
      });
      if (tenantError) throw tenantError;
      if (tenantData?.error) throw new Error(tenantData.error);

      setBotAdded(true);
      toast({ title: "Bot adicionado com sucesso! 🎉" });
    } catch (err: any) {
      console.error("Error:", err);
      toast({ title: "Erro ao configurar", description: err.message, variant: "destructive" });
    } finally {
      setGuildLoading(false);
      setCreatingTenant(false);
    }
  };

  const handleAddBot = () => {
    const url = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=${BOT_PERMISSIONS}&scope=bot%20applications.commands`;
    window.location.href = url;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg animate-fade-in">
          {guildLoading || creatingTenant ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">
                {creatingTenant ? "Criando sua loja..." : "Conectando ao servidor..."}
              </p>
            </div>
          ) : botAdded && selectedGuild ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold">Bot conectado!</h2>
                  <p className="text-muted-foreground mt-1">
                    O bot foi adicionado ao servidor <strong>{selectedGuild.name}</strong>
                  </p>
                </div>
                {selectedGuild.icon && (
                  <img
                    src={selectedGuild.icon}
                    alt={selectedGuild.name}
                    className="h-16 w-16 rounded-full border-2 border-border"
                  />
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
                Você pode configurar canais, produtos e cores no painel a qualquer momento.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Adicione o bot ao servidor</h2>
                <p className="text-muted-foreground mt-1">
                  Clique no botão abaixo para adicionar o bot e selecionar seu servidor diretamente no Discord
                </p>
              </div>

              <div className="flex flex-col items-center gap-4 py-8">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#5865F2]/10">
                  <Server className="h-10 w-10 text-[#5865F2]" />
                </div>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Você será redirecionado para o Discord para escolher o servidor e autorizar o bot
                </p>
                <Button
                  onClick={handleAddBot}
                  className="gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6"
                  size="lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  Adicionar ao Discord
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
