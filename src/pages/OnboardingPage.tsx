import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import WifiLoader from "@/components/ui/wifi-loader";
import {
  Server,
  ExternalLink,
  Loader2,
  Check,
  LayoutDashboard,
  Settings,
} from "lucide-react";

const BOT_PERMISSIONS = "536870920";

const appendGuildToInvite = (inviteUrl: string, targetGuildId: string) => {
  if (!targetGuildId.trim()) return inviteUrl;
  try {
    const url = new URL(inviteUrl);
    url.searchParams.set("guild_id", targetGuildId.trim());
    return url.toString();
  } catch {
    return inviteUrl;
  }
};

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phase, setPhase] = useState<"loading" | "setup" | "done">("loading");
  const [guildId, setGuildId] = useState("");
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [serverName, setServerName] = useState("");

  useEffect(() => {
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
      setPhase("setup");
    };
    checkExistingTenant();
  }, [user, navigate]);

  const handleAddBot = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("discord-bot-guilds", {
        body: { action: "invite_url", permissions: BOT_PERMISSIONS },
      });

      if (error || !data?.invite_url) {
        throw new Error(data?.error || error?.message || "Não foi possível gerar o link de convite.");
      }

      const inviteUrl = appendGuildToInvite(data.invite_url, guildId);
      window.open(inviteUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast({
        title: "Erro ao abrir convite",
        description: err?.message || "Não foi possível gerar o convite do bot externo.",
        variant: "destructive",
      });
    }
  };

  const handleCreateTenant = async () => {
    const trimmedId = guildId.trim();
    if (!trimmedId) {
      toast({ title: "Insira o ID do servidor", variant: "destructive" });
      return;
    }

    if (!/^\d{17,20}$/.test(trimmedId)) {
      toast({ title: "ID inválido", description: "O ID do servidor deve conter apenas números (17-20 dígitos).", variant: "destructive" });
      return;
    }

    setCreatingTenant(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-tenant", {
        body: {
          name: trimmedId,
          discord_guild_id: trimmedId,
        },
      });

      if (error) {
        const fallback = error?.message || "Erro inesperado";
        let message = fallback;
        try {
          const payload = await (error as any)?.context?.json?.();
          message = payload?.error || fallback;
        } catch {}

        if (message.includes("já está vinculado") || message.includes("já possui")) {
          setServerName(trimmedId);
          setPhase("done");
          toast({ title: "Servidor já configurado! Prosseguindo..." });
          return;
        }
        throw new Error(message);
      }

      if (data?.error) {
        if (data.error.includes("já está vinculado") || data.error.includes("já possui")) {
          setServerName(trimmedId);
          setPhase("done");
          toast({ title: "Servidor já configurado! Prosseguindo..." });
          return;
        }
        throw new Error(data.error);
      }

      const tenantName = data?.tenant?.name || trimmedId;
      setServerName(tenantName);
      setPhase("done");
      toast({ title: "Loja criada com sucesso! 🎉" });
    } catch (err: any) {
      const message = err?.message || "Erro ao criar loja";
      toast({ title: "Erro ao criar loja", description: message, variant: "destructive" });
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

          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-16">
              <WifiLoader />
            </div>
          )}

          {phase === "setup" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Configure seu servidor</h2>
                <p className="text-muted-foreground mt-1">
                  Adicione o bot ao seu servidor e cole o ID abaixo
                </p>
              </div>

              {/* Step 1: Add bot */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5865F2]/10 text-xs font-bold text-[#5865F2]">1</span>
                  Adicione o bot ao seu servidor
                </div>
                <Button
                  onClick={handleAddBot}
                  className="w-full gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white"
                  size="lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  Adicionar Drika Bot ao Discord
                </Button>
              </div>

              {/* Step 2: Server ID */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                  Cole o ID do servidor Discord
                </div>
                <Input
                  placeholder="Ex: 123456789012345678"
                  value={guildId}
                  onChange={(e) => setGuildId(e.target.value)}
                  className="font-mono"
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground">
                  No Discord: clique com botão direito no ícone do servidor → "Copiar ID do servidor"
                  <br />
                  (ative o Modo Desenvolvedor em Configurações → Avançado)
                </p>
              </div>

              {/* Submit */}
              <Button
                onClick={handleCreateTenant}
                disabled={creatingTenant || !guildId.trim()}
                className="w-full gap-2 gradient-pink text-primary-foreground"
                size="lg"
              >
                {creatingTenant ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {creatingTenant ? "Verificando e criando..." : "Criar minha loja"}
              </Button>
            </div>
          )}

          {phase === "done" && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold">Tudo pronto!</h2>
                  <p className="text-muted-foreground mt-1">
                    Servidor <strong>{serverName}</strong> conectado
                  </p>
                </div>
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
