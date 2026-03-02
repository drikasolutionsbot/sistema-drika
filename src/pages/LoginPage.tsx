import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Key } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import WifiLoader from "@/components/ui/wifi-loader";
const LoginPage = () => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [token, setToken] = useState("");
  const [validating, setValidating] = useState(false);

  const handleTokenLogin = async () => {
    if (!token.trim()) return;
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-token", {
        body: { token: token.trim() },
      });

      // Garante mínimo de 5s no loader
      await new Promise(resolve => setTimeout(resolve, 5000));

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
    <div className="flex min-h-screen items-center justify-center bg-background">
      {/* Overlay de validação */}
      {validating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-12">
            <WifiLoader />
          </div>
        </div>
      )}

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/5 blur-3xl" />
      </div>
      
      <div className="relative z-10 w-full max-w-md space-y-8 px-4">
        <div className="flex flex-col items-center space-y-4 animate-fade-in">
          {!imgError ? (
            <img src="/logo.png" alt="Drika Solutions" className="h-40 w-40 object-contain" onError={() => setImgError(true)} />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-primary/10 text-4xl font-bold text-primary">D</div>
          )}
          <h1 className="font-display text-3xl font-bold text-gradient-pink">DRIKA SOLUTIONS</h1>
          <p className="text-center text-muted-foreground">
            Gerencie sua loja no Discord com estilo
          </p>
        </div>

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
            <Button
              onClick={handleTokenLogin}
              disabled={validating || !token.trim()}
              className="w-full h-12 gradient-pink text-primary-foreground border-none hover:opacity-90"
            >
              Entrar
            </Button>
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
