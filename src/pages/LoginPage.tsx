import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Key, LogIn } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import WifiLoader from "@/components/ui/wifi-loader";
import drikaBanner from "@/assets/drika_banner.png";
import drikaLogo from "@/assets/drika_logo_crown.png";

const LoginPage = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [validating, setValidating] = useState(false);

  const handleTokenLogin = async () => {
    if (!token.trim()) return;
    setValidating(true);
    try {
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
        toast({ title: `Bem-vindo! ${data.tenant_name}` });
        navigate("/dashboard", { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setValidating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Overlay de validação */}
      {validating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-12">
            <WifiLoader />
          </div>
        </div>
      )}

      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-secondary/8 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/3 blur-[120px]" />
      </div>

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
            <div className="relative">
              <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Cole seu token de acesso..."
                className="pl-9 bg-muted border-none h-12"
                onKeyDown={(e) => e.key === "Enter" && handleTokenLogin()}
              />
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

          <p className="text-center text-xs text-muted-foreground">
            Ao entrar, você concorda com nossos Termos de Serviço
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
