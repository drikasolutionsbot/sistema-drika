import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Copy, Check, ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import WifiLoader from "@/components/ui/wifi-loader";
import drikaLogo from "@/assets/drika_logo_crown.png";
import TermsModal from "@/components/TermsModal";

const SignupPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Token display state
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        },
      });

      if (error) {
        const errMsg = error?.message || "Erro ao criar conta";
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
    navigate("/login");
  };

  // Token display screen
  if (generatedToken) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden login-pattern-bg">
        <div className="relative z-10 w-full max-w-lg px-4 space-y-6">
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <img src={drikaLogo} alt="Drika Solutions" className="h-32 w-auto drop-shadow-[0_0_30px_hsl(330_100%_71%/0.3)]" />
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-500/40">
              <Check className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white text-center">Conta criada com sucesso!</h2>
            <p className="text-white/70 text-sm text-center max-w-sm">
              Guarde seu token de acesso com segurança. Você precisará dele para acessar o painel.
            </p>
          </div>

          <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            {/* Token display */}
            <div className="rounded-2xl border-2 border-primary/30 bg-black/40 backdrop-blur-sm p-5 space-y-3">
              <p className="text-xs text-white/50 font-semibold uppercase tracking-wider">Seu Token de Acesso</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-primary break-all bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
                  {generatedToken}
                </code>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                    copied
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-white/10 text-white/70 hover:text-white border border-white/20 hover:border-white/40"
                  }`}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-white/40">⚠️ Este token não será exibido novamente.</p>
            </div>

            {/* Go to login button */}
            <button
              onClick={handleGoToLogin}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-[#FF2849] hover:bg-[#e52441] text-white font-medium text-base tracking-wide cursor-pointer border-none transition-colors group"
            >
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              <span>Ir para o Login</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden login-pattern-bg">
      {loading && (
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
                className="w-full text-base px-4 py-3 bg-transparent border-2 border-white/30 rounded-[20px] outline-none text-white transition-colors focus:border-primary"
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
                className="w-full text-base px-4 py-3 pr-12 bg-transparent border-2 border-white/30 rounded-[20px] outline-none text-white transition-colors focus:border-primary"
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
                className="w-full text-base px-4 py-3 bg-transparent border-2 border-white/30 rounded-[20px] outline-none text-white transition-colors focus:border-primary"
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
