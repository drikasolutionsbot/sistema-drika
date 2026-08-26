import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, Mail, KeyRound, Eye, EyeOff, Key, ChevronDown, ChevronUp, Loader2, ArrowRight, UserPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import WifiLoader from "@/components/ui/wifi-loader";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";
import TermsModal from "@/components/TermsModal";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { languageFlags, languageLabels, type Language } from "@/i18n/LanguageContext";

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  // Primary mode is always email; token is collapsible
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState("");
  const [tokenExpanded, setTokenExpanded] = useState(false);

  const [validating, setValidating] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  const pt = language === "pt-BR";
  const de = language === "de";

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSending(true);
    try {
      const PROD_URL = "https://www.drikahub.com";
      const { error } = await supabase.functions.invoke("send-password-reset", {
        body: { email: forgotEmail.trim(), redirectTo: `${PROD_URL}/reset-password` },
      });
      if (error) throw error;
      toast({ title: "📧 Email enviado!", description: "Se o email existir, você receberá as instruções.", variant: "success" as any });
      setForgotOpen(false);
      setForgotEmail("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setForgotSending(false);
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast({ title: pt ? "Preencha email e senha" : "Enter email and password", variant: "destructive" });
      return;
    }
    setValidating(true);
    try {
      if (user) await signOut();
      localStorage.removeItem("token_session");

      const { data, error } = await supabase.functions.invoke("login-with-email", {
        body: { email: email.trim(), password },
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (error || data?.error) {
        toast({ title: pt ? "Falha no login" : "Login failed", description: data?.error || error?.message, variant: "destructive" });
        setValidating(false);
        return;
      }

      localStorage.setItem("token_session", JSON.stringify({
        tenant_id: data.tenant_id,
        tenant_name: data.tenant_name,
        token: data.token,
      }));
      toast({ title: `👋 ${t.login.welcome}, ${data.tenant_name}!`, description: t.login.panelLoaded, variant: "success" as any });
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      toast({ title: t.login.error, description: e.message, variant: "destructive" });
      setValidating(false);
    }
  };

  const handleTokenLogin = async () => {
    if (!token.trim()) return;
    setValidating(true);
    try {
      if (user) await signOut();
      localStorage.removeItem("token_session");

      const { data, error } = await supabase.functions.invoke("validate-token", {
        body: { token: token.trim() },
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      if (error || data?.error) {
        toast({ title: t.login.invalidToken, description: data?.error || error?.message, variant: "destructive" });
        setValidating(false);
      } else {
        localStorage.setItem("token_session", JSON.stringify({
          tenant_id: data.tenant_id,
          tenant_name: data.tenant_name,
          token: token.trim(),
        }));
        toast({ title: `👋 ${t.login.welcome}, ${data.tenant_name}!`, description: t.login.panelLoaded, variant: "success" as any });
        navigate("/dashboard", { replace: true });
      }
    } catch (e: any) {
      toast({ title: t.login.error, description: e.message, variant: "destructive" });
      setValidating(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden login-pattern-bg">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-primary/25 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-primary/15 blur-[80px]" />
      </div>

      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-20 flex gap-1">
        {(Object.keys(languageLabels) as Language[]).map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`px-2 py-1 rounded-lg text-sm transition-all ${language === lang ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/8 text-white/50 hover:bg-white/15 border border-transparent"}`}
          >
            {languageFlags[lang]}
          </button>
        ))}
      </div>

      {/* Validating overlay */}
      {validating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-12">
            <WifiLoader />
          </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-sm px-4 space-y-6">
        {/* Logo */}
        <div className="flex justify-center animate-fade-in">
          <img
            src={drikaLogo}
            alt="Drika Hub"
            className="h-36 w-auto drop-shadow-[0_0_30px_hsl(330_100%_71%/0.35)]"
          />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl space-y-4 animate-fade-in" style={{ animationDelay: "0.15s" }}>

          {/* ── Email section (primary) ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">
              {pt ? "Acesso por Email" : de ? "Zugang per E-Mail" : "Email Access"}
            </p>

            {/* Email input */}
            <div className="relative group">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-primary transition-colors pointer-events-none" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !password && document.getElementById("pw-input")?.focus()}
                placeholder={pt ? "seu@email.com" : de ? "deine@email.de" : "your@email.com"}
                className="w-full h-11 pl-10 pr-4 bg-white/8 border border-white/15 rounded-xl outline-none text-sm text-white placeholder:text-white/25 transition-all focus:border-primary focus:bg-white/10 focus:shadow-[0_0_0_3px_rgba(255,40,73,0.12)]"
              />
            </div>

            {/* Password input */}
            <div className="relative group">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-primary transition-colors pointer-events-none" />
              <input
                id="pw-input"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
                placeholder={pt ? "Senha" : de ? "Passwort" : "Password"}
                className="w-full h-11 pl-10 pr-11 bg-white/8 border border-white/15 rounded-xl outline-none text-sm text-white placeholder:text-white/25 transition-all focus:border-primary focus:bg-white/10 focus:shadow-[0_0_0_3px_rgba(255,40,73,0.12)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                className="text-xs text-white/40 hover:text-primary transition-colors bg-transparent border-none cursor-pointer"
              >
                {pt ? "Esqueci minha senha" : de ? "Passwort vergessen?" : "Forgot password?"}
              </button>
            </div>

            {/* Email login button */}
            <button
              onClick={handleEmailLogin}
              disabled={validating || !email.trim() || !password.trim()}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm tracking-wide cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 group"
            >
              <LogIn className="h-4 w-4" />
              <span>{pt ? "Entrar" : de ? "Anmelden" : "Sign in"}</span>
              <ArrowRight className="h-4 w-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/25">{pt ? "ou" : "or"}</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* ── Token section (secondary / collapsible) ── */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setTokenExpanded(v => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-white/12 bg-white/5 hover:bg-white/8 text-white/70 hover:text-white transition-all text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <Key className="h-4 w-4 text-white/40" />
                {pt ? "Entrar com Token de Acesso" : de ? "Mit Zugriffstoken anmelden" : "Sign in with Access Token"}
              </span>
              {tokenExpanded ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
            </button>

            {tokenExpanded && (
              <div className="space-y-2 animate-fade-in">
                <div className="relative group">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-primary transition-colors pointer-events-none" />
                  <input
                    type="text"
                    autoComplete="off"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleTokenLogin()}
                    placeholder={pt ? "Cole seu token aqui..." : de ? "Token hier einfügen..." : "Paste your token here..."}
                    className="w-full h-11 pl-10 pr-4 bg-white/8 border border-white/15 rounded-xl outline-none text-sm text-white placeholder:text-white/25 font-mono transition-all focus:border-primary focus:bg-white/10 focus:shadow-[0_0_0_3px_rgba(255,40,73,0.12)]"
                  />
                </div>
                <button
                  onClick={handleTokenLogin}
                  disabled={validating || !token.trim()}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-medium text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <LogIn className="h-4 w-4" />
                  {pt ? "Entrar com Token" : de ? "Mit Token anmelden" : "Sign in with Token"}
                </button>
              </div>
            )}
          </div>

          {/* Sign up */}
          <button
            type="button"
            onClick={() => navigate("/signup")}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/25 bg-primary/8 hover:bg-primary/15 text-white/80 hover:text-white text-sm font-medium transition-all"
          >
            <UserPlus className="h-4 w-4 text-primary/70" />
            {pt ? "Não tem conta? Cadastre-se" : de ? "Kein Konto? Registrieren" : "No account? Sign up"}
          </button>
        </div>

        {/* Terms */}
        <p className="text-center text-xs text-white/30">
          {pt ? "Ao entrar, você concorda com nossos " : de ? "Mit dem Login stimmen Sie unseren " : "By logging in, you agree to our "}
          <button
            onClick={() => setTermsOpen(true)}
            className="underline text-white/50 hover:text-primary transition-colors bg-transparent border-none cursor-pointer text-xs p-0"
          >
            {t.login.terms}
          </button>
        </p>
      </div>

      {/* Forgot password modal */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => !forgotSending && setForgotOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f0f0f]/95 backdrop-blur p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold text-white">
                {pt ? "Recuperar senha" : de ? "Passwort zurücksetzen" : "Reset password"}
              </h3>
              <p className="text-sm text-white/50 mt-1">
                {pt ? "Digite seu email e enviaremos um link de redefinição." : de ? "Geben Sie Ihre E-Mail ein und erhalten Sie einen Link." : "Enter your email and we'll send a reset link."}
              </p>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                <input
                  type="email"
                  autoFocus
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder={pt ? "seu@email.com" : "your@email.com"}
                  className="w-full h-11 pl-10 pr-4 bg-white/8 border border-white/15 rounded-xl outline-none text-sm text-white placeholder:text-white/25 focus:border-primary"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  disabled={forgotSending}
                  className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm border border-white/10 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {pt ? "Cancelar" : de ? "Abbrechen" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={forgotSending || !forgotEmail.trim()}
                  className="flex-1 h-10 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-sm border-none cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {forgotSending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {forgotSending ? (pt ? "Enviando..." : "Sending...") : (pt ? "Enviar link" : de ? "Link senden" : "Send link")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TermsModal open={termsOpen} onOpenChange={setTermsOpen} />
    </div>
  );
};

export default LoginPage;
