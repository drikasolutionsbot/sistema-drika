import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2, LogIn, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("validate-admin-login", {
        body: { email: email.trim(), password: password.trim() },
      });

      if (error || data?.error) {
        toast({
          title: "Acesso negado",
          description: data?.error || error?.message || "Credenciais inválidas.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (data?.success && data?.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          toast({ title: "Erro ao iniciar sessão", description: sessionError.message, variant: "destructive" });
          setLoading(false);
          return;
        }

        toast({ title: "🛡️ Bem-vindo, Admin!", description: "Sessão iniciada com sucesso.", variant: "success" as any });
        navigate("/admin", { replace: true });
      } else {
        toast({ title: "Erro", description: "Resposta inesperada do servidor.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden admin-pattern-bg">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative z-10 w-full max-w-[400px] px-4">
        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl space-y-7">

          {/* Header */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {!imgError ? (
                <img
                  src={logo}
                  alt="Admin"
                  className="h-20 w-20 object-contain drop-shadow-lg"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/20 border border-primary/30 text-3xl font-bold text-primary">A</div>
              )}
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary border-2 border-background shadow">
                <Shield className="h-3 w-3 text-white" />
              </span>
            </div>

            <div className="text-center space-y-1">
              <h1 className="text-2xl font-extrabold tracking-tight">
                <span className="text-gradient-pink">ADMIN</span>{" "}
                <span className="text-white">PANEL</span>
              </h1>
              <p className="text-sm text-white/50">Acesso restrito a super administradores</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="relative group">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-primary transition-colors" />
              <input
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email do administrador"
                className="w-full h-11 pl-10 pr-4 bg-white/8 border border-white/15 rounded-xl outline-none text-sm text-white placeholder:text-white/30 transition-all focus:border-primary focus:bg-white/10 focus:shadow-[0_0_0_3px_rgba(255,40,73,0.12)]"
              />
            </div>

            {/* Password */}
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-primary transition-colors" />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                className="w-full h-11 pl-10 pr-11 bg-white/8 border border-white/15 rounded-xl outline-none text-sm text-white placeholder:text-white/30 transition-all focus:border-primary focus:bg-white/10 focus:shadow-[0_0_0_3px_rgba(255,40,73,0.12)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm tracking-wide cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</>
              ) : (
                <><LogIn className="h-4 w-4" /> Entrar no Painel</>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-[11px] text-white/30">
            🔒 Apenas usuários com permissão de super admin podem acessar.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
