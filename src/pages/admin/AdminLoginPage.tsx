import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const AdminLoginPage = () => {
  const { user, loading, signInWithDiscord } = useAuth();
  const [imgError, setImgError] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8 px-4">
        <div className="flex flex-col items-center space-y-4 animate-fade-in">
          {!imgError ? (
            <img src={logo} alt="Admin" className="h-32 w-32 object-contain" onError={() => setImgError(true)} />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-primary/10 text-4xl font-bold text-primary">A</div>
          )}
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold">
              <span className="text-gradient-pink">ADMIN</span>{" "}
              <span className="text-foreground">PANEL</span>
            </h1>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Acesso restrito a super administradores
          </p>
        </div>

        <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <Button
            onClick={signInWithDiscord}
            className="w-full h-12 gradient-pink text-primary-foreground border-none hover:opacity-90"
          >
            Entrar com Discord
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Apenas usuários com permissão de super admin podem acessar.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
