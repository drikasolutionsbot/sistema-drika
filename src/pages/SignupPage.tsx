import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Copy, Check, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import WifiLoader from "@/components/ui/wifi-loader";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";
import TermsModal from "@/components/TermsModal";
import { useAuth } from "@/contexts/AuthContext";

// Discord SVG icon
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const SignupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInWithDiscord } = useAuth();
  const wantsPro = searchParams.get("plan") === "pro";
  const refCode = searchParams.get("ref") || null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Token display state
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const formatWhatsapp = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      toast({ title: "Preencha email e senha", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-client", {
        body: {
          email: email.trim(),
          password,
          whatsapp: whatsapp.replace(/\D/g, "") || null,
          ref_code: refCode,
        },
      });

      if (error) {
        // Try to parse the actual error message from the response
        let errMsg = "Erro ao criar conta";
        try {
          if (error.context?.body) {
            const text = await new Response(error.context.body).text();
            const parsed = JSON.parse(text);
            if (parsed?.error) errMsg = parsed.error;
          }
        } catch {}
        if (errMsg === "Erro ao criar conta" && error.message) {
          errMsg = error.message;
        }
        toast({ title: errMsg, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (data?.error) {
        toast({ title: data.error, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (data?.token) {
        setGeneratedToken(data.token);
        toast({ title: "Conta criada com sucesso! 🎉" });
      } else {
        toast({ title: "Conta criada, mas sem token", description: data?.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleCopy = () => {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken);
    setCopied(true);
    toast({ title: "Token copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoToLogin = () => {
    if (wantsPro) {
      sessionStorage.setItem("pending_pro_upgrade", "true");
    }
    window.location.href = "/login";
  };

  const handleDiscordSignup = async () => {
    setDiscordLoading(true);
    try {
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
        {/* Backdrop overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10" />

        {/* Modal */}
        <div className="relative z-20 w-full max-w-md mx-4 animate-fade-in">
          <div className="rounded-3xl border border-white/10 bg-[#1a1a2e]/95 backdrop-blur-xl p-8 shadow-[0_0_60px_rgba(255,40,73,0.15)] text-center">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3 mb-6">
              <img src={drikaLogo} alt="Drika Solutions" className="h-24 w-auto drop-shadow-[0_0_20px_rgba(255,40,73,0.2)]" />
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

  // Token display screen — modal over same background
  if (generatedToken) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden login-pattern-bg">
        {/* Backdrop overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10" />

        {/* Modal */}
        <div className="relative z-20 w-full max-w-md mx-4 animate-fade-in">
          <div className="rounded-3xl border border-white/10 bg-[#1a1a2e]/95 backdrop-blur-xl p-8 shadow-[0_0_60px_rgba(255,40,73,0.15)]">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3 mb-6">
              <img src={drikaLogo} alt="Drika Solutions" className="h-24 w-auto drop-shadow-[0_0_20px_hsl(330_100%_71%/0.4)]" />
            </div>

            {/* Title */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-1">Seu Token Único</h2>
              <p className="text-sm text-white/50">Válido por <span className="text-primary font-semibold">4 dias</span> — guarde-o com segurança</p>
            </div>

            {/* Token box */}
            <div className="rounded-2xl border border-primary/20 bg-black/40 p-4 mb-4">
              <code className="block text-sm font-mono text-primary break-all leading-relaxed text-center">
                {generatedToken}
              </code>
            </div>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className={`w-full h-11 flex items-center justify-center gap-2 rounded-full font-medium text-base tracking-wide cursor-pointer border-none transition-all mb-3 ${
                copied
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-white/10 text-white hover:bg-white/20 border border-white/20"
              }`}
            >
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              <span>{copied ? "Copiado!" : "Copiar Token"}</span>
            </button>

            {/* Go to login */}
            <button
              onClick={handleGoToLogin}
              disabled={!copied}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-[#FF2849] hover:bg-[#e52441] text-white font-medium text-base tracking-wide cursor-pointer border-none transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
            >
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              <span>Já copiei, ir para Login</span>
            </button>

            <p className="text-[11px] text-white/30 text-center mt-4">⚠️ Este token não será exibido novamente.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden login-pattern-bg">
      {(loading || checkingConfig) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-12">
            <WifiLoader />
          </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-lg px-4 space-y-6">
        {/* Logo */}
        <div className="animate-fade-in flex flex-col items-center gap-4">
          <img
            src={drikaLogo}
            alt="Drika Solutions"
            className="h-40 w-auto drop-shadow-[0_0_30px_hsl(330_100%_71%/0.3)]"
          />
        </div>

        {/* Signup form */}
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="space-y-3">
            {/* Email */}
            <div className="relative login-floating-input">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-base px-4 py-3 bg-white/10 border-2 border-white/30 rounded-[20px] outline-none text-white transition-colors focus:border-primary"
              />
              <label className="absolute left-0 px-4 py-3 ml-2 pointer-events-none text-white/70 font-semibold text-base tracking-wide transition-all duration-300">
                Email
              </label>
            </div>

            {/* Password */}
            <div className="relative login-floating-input">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-base px-4 py-3 pr-12 bg-white/10 border-2 border-white/30 rounded-[20px] outline-none text-white transition-colors focus:border-primary"
              />
              <label className="absolute left-0 px-4 py-3 ml-2 pointer-events-none text-white/70 font-semibold text-base tracking-wide transition-all duration-300">
                Senha
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors bg-transparent border-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {/* WhatsApp */}
            <div className="relative login-floating-input">
              <input
                type="tel"
                required
                autoComplete="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
                className="w-full text-base px-4 py-3 bg-white/10 border-2 border-white/30 rounded-[20px] outline-none text-white transition-colors focus:border-primary"
              />
              <label className="absolute left-0 px-4 py-3 ml-2 pointer-events-none text-white/70 font-semibold text-base tracking-wide transition-all duration-300">
                WhatsApp
              </label>
            </div>

            {/* Signup button */}
            <button
              onClick={handleSignup}
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-full bg-[#FF2849] hover:bg-[#e52441] text-white font-medium text-base tracking-wide cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
            >
              <UserPlus className="h-5 w-5 group-hover:animate-[flickering_2s_linear_infinite]" />
              <span>Criar Conta</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-white/15" />
              <span className="text-xs text-white/30">ou</span>
              <div className="flex-1 h-px bg-white/15" />
            </div>

            {/* Discord Signup */}
            <button
              onClick={handleDiscordSignup}
              disabled={discordLoading || loading}
              className="w-full h-11 flex items-center justify-center gap-2.5 rounded-full border border-[#5865F2]/50 bg-[#5865F2]/15 hover:bg-[#5865F2]/25 text-white font-medium text-base tracking-wide cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
            >
              {discordLoading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <DiscordIcon className="h-5 w-5 text-[#7289DA]" />}
              <span>Cadastrar com Discord</span>
            </button>
          </div>

          {/* Login link */}
          <div className="text-center space-y-2">
            <p className="text-sm text-white/60">
              Já tem uma conta?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-primary hover:text-primary/80 font-semibold bg-transparent border-none cursor-pointer underline transition-colors text-sm p-0"
              >
                Entrar com Token
              </button>
            </p>
            <p className="text-sm font-medium text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              Ao criar conta, você concorda com nossos{" "}
              <button
                onClick={() => setTermsOpen(true)}
                className="underline text-white hover:text-primary transition-colors bg-transparent border-none cursor-pointer font-medium text-sm p-0"
              >
                Termos de Serviço
              </button>
            </p>
          </div>
        </div>
      </div>

      <TermsModal open={termsOpen} onOpenChange={setTermsOpen} />
    </div>
  );
};

export default SignupPage;
