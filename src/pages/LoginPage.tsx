import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogIn } from "lucide-react";
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
  const [token, setToken] = useState("");
  const [validating, setValidating] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const handleTokenLogin = async () => {
    if (!token.trim()) return;
    setValidating(true);
    try {
      // Sign out any existing Supabase Auth session (e.g., admin session)
      if (user) {
        await signOut();
      }
      // Also clear any previous token session
      sessionStorage.removeItem("token_session");

      const { data, error } = await supabase.functions.invoke("validate-token", {
        body: { token: token.trim() },
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      if (error || data?.error) {
        toast({ title: "Token inválido", description: data?.error || error?.message, variant: "destructive" });
        setValidating(false);
      } else {
        sessionStorage.setItem("token_session", JSON.stringify({
          tenant_id: data.tenant_id,
          tenant_name: data.tenant_name,
          token: token.trim(),
        }));
        toast({ title: `👋 Bem-vindo, ${data.tenant_name}!`, description: "Painel carregado com sucesso.", variant: "success" as any });
        navigate("/dashboard", { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setValidating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden login-pattern-bg">
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
                Token de acesso
              </label>
            </div>
            <button
              onClick={handleTokenLogin}
              disabled={validating || !token.trim()}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-full bg-[#FF2849] hover:bg-[#e52441] text-white font-medium text-base tracking-wide cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
            >
              <LogIn className="h-5 w-5 group-hover:animate-[flickering_2s_linear_infinite]" />
              <span>Entrar</span>
            </button>
          </div>

          {/* Terms */}
          <div className="text-center space-y-2">
            <p className="text-center text-sm font-medium text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              Ao entrar, você concorda com nossos{" "}
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

export default LoginPage;
