import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, Mail, KeyRound, Eye, EyeOff } from "lucide-react";
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
  const [mode, setMode] = useState<"token" | "email">("token");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validating, setValidating] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSending(true);
    try {
      // Sempre usa o domínio de produção pra evitar links quebrados (localhost/preview) no email
      const PROD_URL = "https://www.drikahub.com";
      const { error } = await supabase.functions.invoke("send-password-reset", {
        body: {
          email: forgotEmail.trim(),
          redirectTo: `${PROD_URL}/reset-password`,
        },
      });
      if (error) throw error;
      toast({
        title: "📧 Email enviado!",
        description: "Se o email existir, você receberá as instruções em instantes.",
        variant: "success" as any,
      });
      setForgotOpen(false);
      setForgotEmail("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setForgotSending(false);
  };

  const handleTokenLogin = async () => {
    if (!token.trim()) return;
    setValidating(true);
    try {
      // Sign out any existing Supabase Auth session (e.g., admin session)
      if (user) {
        await signOut();
      }
      // Also clear any previous token session
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

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast({ title: "Preencha email e senha", variant: "destructive" });
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
        toast({
          title: "Falha no login",
          description: data?.error || error?.message,
          variant: "destructive",
        });
        setValidating(false);
        return;
      }

      sessionStorage.setItem(
        "token_session",
        JSON.stringify({
          tenant_id: data.tenant_id,
          tenant_name: data.tenant_name,
          token: data.token,
        })
      );
      toast({
        title: `👋 ${t.login.welcome}, ${data.tenant_name}!`,
        description: t.login.panelLoaded,
        variant: "success" as any,
      });
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      toast({ title: t.login.error, description: e.message, variant: "destructive" });
      setValidating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden login-pattern-bg">
      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-20 flex gap-1">
        {(Object.keys(languageLabels) as Language[]).map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`px-2 py-1 rounded-lg text-sm transition-colors ${language === lang ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/10 text-white/60 hover:bg-white/20 border border-transparent"}`}
          >
            {languageFlags[lang]}
          </button>
        ))}
      </div>

      {/* Overlay de validação */}
      {validating && (
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

        {/* Login form */}
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          {mode === "token" ? (
            <div className="space-y-3">
              <div className="relative login-floating-input">
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTokenLogin()}
                  className="w-full text-base px-4 py-3 bg-white/10 border-2 border-white/30 rounded-[20px] outline-none text-white transition-colors focus:border-primary"
                />
                <label className="absolute left-0 px-4 py-3 ml-2 pointer-events-none text-white/70 font-semibold text-base tracking-wide transition-all duration-300">
                  {t.login.tokenPlaceholder}
                </label>
              </div>
              <button
                onClick={handleTokenLogin}
                disabled={validating || !token.trim()}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-full bg-[#FF2849] hover:bg-[#e52441] text-white font-medium text-base tracking-wide cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
              >
                <LogIn className="h-5 w-5 group-hover:animate-[flickering_2s_linear_infinite]" />
                <span>{t.login.tokenLogin}</span>
              </button>

              {/* Toggle para email */}
              <button
                type="button"
                onClick={() => setMode("email")}
                className="w-full flex items-center justify-center gap-2 text-sm text-white/80 hover:text-white transition-colors py-2 bg-transparent border border-white/20 rounded-full hover:bg-white/5"
              >
                <Mail className="h-4 w-4" />
                <span>
                  {language === "pt-BR"
                    ? "Logar por email"
                    : language === "de"
                    ? "Mit E-Mail anmelden"
                    : "Sign in with email"}
                </span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 pointer-events-none" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
                  placeholder={
                    language === "pt-BR" ? "seu@email.com" : language === "de" ? "deine@email.com" : "your@email.com"
                  }
                  className="w-full text-base pl-12 pr-4 py-3 bg-white/10 border-2 border-white/30 rounded-[20px] outline-none text-white placeholder:text-white/40 transition-colors focus:border-primary"
                />
              </div>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
                  placeholder={
                    language === "pt-BR" ? "Senha" : language === "de" ? "Passwort" : "Password"
                  }
                  className="w-full text-base pl-12 pr-12 py-3 bg-white/10 border-2 border-white/30 rounded-[20px] outline-none text-white placeholder:text-white/40 transition-colors focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-white/60 hover:text-white bg-transparent border-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={handleEmailLogin}
                disabled={validating || !email.trim() || !password.trim()}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-full bg-[#FF2849] hover:bg-[#e52441] text-white font-medium text-base tracking-wide cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
              >
                <LogIn className="h-5 w-5 group-hover:animate-[flickering_2s_linear_infinite]" />
                <span>
                  {language === "pt-BR" ? "Entrar" : language === "de" ? "Anmelden" : "Sign in"}
                </span>
              </button>

              {/* Esqueci minha senha */}
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setForgotOpen(true);
                }}
                className="w-full text-center text-sm text-white/70 hover:text-primary transition-colors bg-transparent border-none cursor-pointer py-1"
              >
                {language === "pt-BR"
                  ? "Esqueci minha senha"
                  : language === "de"
                  ? "Passwort vergessen?"
                  : "Forgot my password"}
              </button>

              {/* Voltar para token */}
              <button
                type="button"
                onClick={() => setMode("token")}
                className="w-full flex items-center justify-center gap-2 text-sm text-white/80 hover:text-white transition-colors py-2 bg-transparent border border-white/20 rounded-full hover:bg-white/5"
              >
                <span>
                  {language === "pt-BR"
                    ? "← Voltar para token"
                    : language === "de"
                    ? "← Zurück zum Token"
                    : "← Back to token"}
                </span>
              </button>
            </div>
          )}

          {/* Modal Esqueci Senha */}
          {forgotOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => !forgotSending && setForgotOpen(false)}>
              <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {language === "pt-BR" ? "Recuperar senha" : language === "de" ? "Passwort zurücksetzen" : "Reset password"}
                  </h3>
                  <p className="text-sm text-white/60 mt-1">
                    {language === "pt-BR"
                      ? "Digite seu email cadastrado e enviaremos um link para redefinir sua senha."
                      : language === "de"
                      ? "Geben Sie Ihre E-Mail-Adresse ein, und wir senden Ihnen einen Link."
                      : "Enter your email and we'll send you a reset link."}
                  </p>
                </div>
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 pointer-events-none" />
                    <input
                      type="email"
                      autoFocus
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder={language === "pt-BR" ? "seu@email.com" : "your@email.com"}
                      className="w-full text-base pl-12 pr-4 py-3 bg-white/5 border-2 border-white/20 rounded-[16px] outline-none text-white placeholder:text-white/40 focus:border-primary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForgotOpen(false)}
                      disabled={forgotSending}
                      className="flex-1 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 text-sm border border-white/10 cursor-pointer disabled:opacity-50"
                    >
                      {language === "pt-BR" ? "Cancelar" : language === "de" ? "Abbrechen" : "Cancel"}
                    </button>
                    <button
                      type="submit"
                      disabled={forgotSending || !forgotEmail.trim()}
                      className="flex-1 py-2.5 rounded-full bg-[#FF2849] hover:bg-[#e52441] text-white font-medium text-sm border-none cursor-pointer disabled:opacity-50"
                    >
                      {forgotSending
                        ? (language === "pt-BR" ? "Enviando..." : "Sending...")
                        : (language === "pt-BR" ? "Enviar link" : language === "de" ? "Link senden" : "Send link")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Terms */}
          <div className="text-center space-y-2">
            <p className="text-center text-sm font-medium text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {language === "pt-BR" ? "Ao entrar, você concorda com nossos " : language === "de" ? "Mit dem Login stimmen Sie unseren " : "By logging in, you agree to our "}
              <button
                onClick={() => setTermsOpen(true)}
                className="underline text-white hover:text-primary transition-colors bg-transparent border-none cursor-pointer font-medium text-sm p-0"
              >
                {t.login.terms}
              </button>
            </p>
          </div>
        </div>
      </div>

      <TermsModal open={termsOpen} onOpenChange={setTermsOpen} />
    </div>
  );
};

export default LoginPage;
