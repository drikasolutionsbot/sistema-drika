import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight, Sparkles, ShieldCheck, Zap, Bot, Bell } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import WifiLoader from "@/components/ui/wifi-loader";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";
import TermsModal from "@/components/TermsModal";
import { useAuth } from "@/contexts/AuthContext";

// Discord SVG icon
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const SignupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInWithDiscord } = useAuth();
  const wantsPro = searchParams.get("plan") === "pro";
  const refCode = searchParams.get("ref") || null;

  const [discordLoading, setDiscordLoading] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Config checking state
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [checkingConfig, setCheckingConfig] = useState(true);

  useEffect(() => {
    supabase
      .from("landing_config")
      .select("show_trial, is_free_system")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data && data.show_trial === false && data.is_free_system !== true) {
          setTrialEnabled(false);
        }
        setCheckingConfig(false);
      })
      .catch(() => {
        setCheckingConfig(false);
      });
  }, []);

  const handleDiscordSignup = async () => {
    setDiscordLoading(true);
    try {
      if (wantsPro) {
        sessionStorage.setItem("pending_pro_upgrade", "true");
      }
      if (refCode) {
        sessionStorage.setItem("ref_code", refCode);
      }
      await signInWithDiscord();
    } catch (e: any) {
      toast({ title: "Erro ao conectar com Discord", description: e.message, variant: "destructive" });
      setDiscordLoading(false);
    }
  };

  // Block signup if trial is disabled in admin
  if (!checkingConfig && !trialEnabled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden login-pattern-bg">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10" />

        <div className="relative z-20 w-full max-w-md mx-4 animate-fade-in">
          <div className="rounded-3xl border border-white/10 bg-[#1a1a2e]/95 backdrop-blur-xl p-8 shadow-[0_0_60px_rgba(255,40,73,0.15)] text-center">
            <div className="flex flex-col items-center gap-3 mb-6">
              <img src={drikaLogo} alt="Drika Hub" className="h-24 w-auto drop-shadow-[0_0_20px_rgba(255,40,73,0.2)]" />
            </div>

            <h2 className="text-xl font-bold text-white mb-3">Cadastro Indisponível</h2>
            <p className="text-sm text-white/60 mb-6 leading-relaxed">
              O período de testes gratuito (Trial) não está ativo no momento. 
              Para utilizar as funcionalidades do sistema, por favor, adquira um de nossos planos na página inicial.
            </p>

            <button
              onClick={() => navigate("/")}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-[#FF2849] hover:bg-[#e52441] text-white font-medium text-base tracking-wide cursor-pointer border-none transition-all"
            >
              <span>Ver Planos Disponíveis</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden login-pattern-bg p-4">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-[#5865F2]/25 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-primary/20 blur-[100px]" />
      </div>

      {/* Loading overlay */}
      {(checkingConfig || discordLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6">
            <WifiLoader />
            <p className="text-sm text-white/70 animate-pulse font-medium">Conectando ao Discord...</p>
          </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center animate-fade-in">
          <img
            src={drikaLogo}
            alt="Drika Hub"
            className="h-32 w-auto drop-shadow-[0_0_30px_hsl(330_100%_71%/0.35)]"
          />
        </div>

        {/* Main Card */}
        <div 
          className="rounded-3xl border border-white/12 bg-black/60 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(88,101,242,0.15)] space-y-6 animate-fade-in"
          style={{ animationDelay: "0.15s" }}
        >
          {/* Badge & Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2] text-xs font-bold tracking-wide">
              <Sparkles className="h-3.5 w-3.5" />
              <span>CADASTRO EXCLUSIVO VIA DISCORD</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Crie sua conta em 1 clique
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">
              Vincule sua conta do Discord para ativar sua loja, gerenciar seu bot e acessar todas as ferramentas da plataforma.
            </p>
          </div>

          {/* Benefits List */}
          <div className="space-y-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                <Zap className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">4 Dias Grátis para Testar</p>
                <p className="text-white/50">Acesso instantâneo a todos os recursos básicos sem cartão.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-[#5865F2]/20 text-[#7289DA] shrink-0 mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Bot e Servidor 100% Sincronizados</p>
                <p className="text-white/50">Seu perfil Discord vira o proprietário oficial da sua loja.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400 shrink-0 mt-0.5">
                <Bell className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Notificações e Lembretes na DM</p>
                <p className="text-white/50">Receba comprovantes, relatórios e avisos direto no seu Discord.</p>
              </div>
            </div>
          </div>

          {/* Discord Registration Button */}
          <button
            type="button"
            onClick={handleDiscordSignup}
            disabled={discordLoading || checkingConfig}
            className="w-full h-13 flex items-center justify-center gap-3 rounded-2xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-base tracking-wide cursor-pointer border-none shadow-[0_0_30px_rgba(88,101,242,0.45)] hover:shadow-[0_0_40px_rgba(88,101,242,0.65)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
          >
            {discordLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <DiscordIcon className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
            )}
            <span>Cadastrar com Discord</span>
            <ArrowRight className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>

          {/* Security notice */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-white/40 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-400/80" />
            <span>Autenticação oficial Discord OAuth2 • Rápido e Seguro</span>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10" />

          {/* Already have an account link */}
          <div className="text-center space-y-2">
            <p className="text-sm text-white/60">
              Já possui conta ou token de loja?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-primary hover:text-primary/80 font-semibold bg-transparent border-none cursor-pointer underline transition-colors text-sm p-0 ml-1"
              >
                Fazer login
              </button>
            </p>
          </div>
        </div>

        {/* Terms footer */}
        <p className="text-center text-xs text-white/40">
          Ao se cadastrar, você concorda com nossos{" "}
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="underline text-white/70 hover:text-primary transition-colors bg-transparent border-none cursor-pointer text-xs p-0"
          >
            Termos de Serviço
          </button>
        </p>
      </div>

      <TermsModal open={termsOpen} onOpenChange={setTermsOpen} />
    </div>
  );
};

export default SignupPage;
