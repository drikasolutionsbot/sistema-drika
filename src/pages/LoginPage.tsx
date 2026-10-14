import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, Key, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import WifiLoader from "@/components/ui/wifi-loader";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";
import TermsModal from "@/components/TermsModal";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { languageFlags, languageLabels, type Language } from "@/i18n/LanguageContext";

// Discord SVG icon
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, signOut, signInWithDiscord } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [token, setToken] = useState("");
  const [tokenExpanded, setTokenExpanded] = useState(false);

  const [validating, setValidating] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const pt = language === "pt-BR";
  const de = language === "de";

  const handleDiscordLogin = async () => {
    setDiscordLoading(true);
    try {
      await signInWithDiscord();
    } catch (e: any) {
      toast({ title: "Erro ao conectar com Discord", description: e.message, variant: "destructive" });
      setDiscordLoading(false);
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

      await new Promise(resolve => setTimeout(resolve, 2000));

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

          {/* Discord Login (Destaque Principal) */}
          <button
            type="button"
            onClick={handleDiscordLogin}
            disabled={discordLoading || validating}
            className="w-full h-12 flex items-center justify-center gap-2.5 rounded-xl border border-[#5865F2]/50 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-sm tracking-wide cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#5865F2]/30 hover:shadow-[#5865F2]/45 hover:-translate-y-0.5 active:translate-y-0 group"
          >
            {discordLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <DiscordIcon className="h-5 w-5 text-white group-hover:scale-110 transition-transform" />
            )}
            <span>{pt ? "Entrar com Discord" : de ? "Mit Discord anmelden" : "Sign in with Discord"}</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30 font-medium">{pt ? "ou com token" : de ? "oder mit Token" : "or with token"}</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* ── Token section (collapsible) ── */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setTokenExpanded(v => !v)}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl border border-white/12 bg-white/5 hover:bg-white/8 text-white/80 hover:text-white transition-all text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <Key className="h-4 w-4 text-white/40" />
                {pt ? "Entrar com Token de Acesso" : de ? "Mit Zugriffstoken anmelden" : "Sign in with Access Token"}
              </span>
              {tokenExpanded ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
            </button>

            {tokenExpanded && (
              <div className="space-y-2 animate-fade-in pt-1">
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

      <TermsModal open={termsOpen} onOpenChange={setTermsOpen} />
    </div>
  );
};

export default LoginPage;
