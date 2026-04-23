import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase coloca os tokens no hash (#access_token=...&type=recovery)
    // O cliente detecta isso automaticamente e dispara onAuthStateChange("PASSWORD_RECOVERY")
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Verifica se já existe sessão de recovery
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    // Timeout de segurança: se em 2s não houver sessão, libera o form mesmo assim
    const t = setTimeout(() => setReady(true), 2000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Use pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao atualizar senha", description: error.message, variant: "destructive" });
      return;
    }
    setDone(true);
    toast({ title: "✅ Senha atualizada!", description: "Você já pode entrar com a nova senha.", variant: "success" as any });
    await supabase.auth.signOut();
    setTimeout(() => navigate("/login", { replace: true }), 1500);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden login-pattern-bg">
      <div className="relative z-10 w-full max-w-md px-4 space-y-6">
        <div className="animate-fade-in flex flex-col items-center gap-4">
          <img src={drikaLogo} alt="Drika Solutions" className="h-32 w-auto drop-shadow-[0_0_30px_hsl(330_100%_71%/0.3)]" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Redefinir senha</h1>
            <p className="text-sm text-white/60 mt-1">Digite sua nova senha abaixo</p>
          </div>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 text-center bg-white/5 border border-white/20 rounded-2xl p-6">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-white font-medium">Senha atualizada com sucesso!</p>
            <p className="text-white/60 text-sm">Redirecionando para o login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nova senha"
                required
                className="w-full text-base pl-12 pr-12 py-3 bg-white/10 border-2 border-white/30 rounded-[20px] outline-none text-white placeholder:text-white/40 focus:border-primary"
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
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirme a nova senha"
                required
                className="w-full text-base pl-12 pr-4 py-3 bg-white/10 border-2 border-white/30 rounded-[20px] outline-none text-white placeholder:text-white/40 focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !ready || !password || !confirm}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-full bg-[#FF2849] hover:bg-[#e52441] text-white font-medium text-base cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Salvando..." : "Salvar nova senha"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full flex items-center justify-center gap-2 text-sm text-white/80 hover:text-white py-2 bg-transparent border border-white/20 rounded-full hover:bg-white/5 transition-colors"
            >
              ← Voltar para o login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
