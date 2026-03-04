import { ShieldOff } from "lucide-react";
import drikaLogo from "@/assets/drika_logo_crown.png";

const PlanExpiredPage = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden login-pattern-bg">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10" />
      <div className="relative z-20 w-full max-w-md mx-4 animate-fade-in">
        <div className="rounded-3xl border border-destructive/20 bg-[#1a1a2e]/95 backdrop-blur-xl p-8 shadow-[0_0_60px_rgba(255,40,73,0.15)] text-center">
          <img src={drikaLogo} alt="Drika Solutions" className="h-20 w-auto mx-auto mb-6 drop-shadow-[0_0_20px_hsl(330_100%_71%/0.4)]" />
          
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-destructive/20 border-2 border-destructive/40 flex items-center justify-center">
              <ShieldOff className="h-8 w-8 text-destructive" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Assinatura Expirada</h1>
          <p className="text-white/60 text-sm mb-6">
            Seu plano <span className="text-primary font-semibold">Drika Solutions Pro</span> expirou. 
            O acesso ao painel foi bloqueado até a renovação.
          </p>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-6">
            <p className="text-white/80 text-sm">
              Entre em contato com o suporte para renovar sua assinatura e recuperar o acesso completo ao painel.
            </p>
          </div>

          <a
            href="https://wa.me/5548996915303"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-base tracking-wide cursor-pointer border-none transition-colors"
          >
            Falar com Suporte via WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
};

export default PlanExpiredPage;
