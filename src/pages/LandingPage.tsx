import { useNavigate } from "react-router-dom";
import { Crown, Zap, Check, ArrowRight, ShoppingCart, Shield, Lock } from "lucide-react";
import drikaLogo from "@/assets/drika_logo_crown.png";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-white overflow-x-hidden login-pattern-bg relative">
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40 z-0" />

      {/* Floating glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[200px] opacity-30 gradient-pink animate-[pulse_4s_ease-in-out_infinite]" />
        <div className="absolute bottom-[10%] right-[10%] w-60 h-60 rounded-full blur-[120px] opacity-15 gradient-gold animate-[pulse_6s_ease-in-out_infinite]" />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <img
            src={drikaLogo}
            alt="Drika Solutions"
            className="h-32 md:h-44 w-auto mx-auto mb-6 drop-shadow-[0_0_50px_hsl(330_100%_71%/0.5)] animate-fade-in"
          />

          <h1 className="text-3xl md:text-5xl font-extrabold font-display mb-3 leading-tight animate-fade-in drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)]">
            Seu servidor Discord
            <br />
            <span className="text-gradient-pink drop-shadow-none">no próximo nível</span>
          </h1>

          <p
            className="text-sm md:text-base text-white/70 max-w-md mx-auto mb-8 animate-fade-in font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
            style={{ animationDelay: "0.1s" }}
          >
            Vendas, moderação e segurança — tudo em um único bot.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <button
              onClick={() => navigate("/signup")}
              className="group px-6 py-3 rounded-full border-2 border-white/30 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/50 text-white font-semibold transition-all cursor-pointer"
            >
              <span className="flex items-center justify-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Testar Grátis — 4 dias
              </span>
            </button>
            <button
              onClick={() => navigate("/signup?plan=pro")}
              className="group px-6 py-3 rounded-full bg-[#FF2849] hover:bg-[#e52441] text-white font-semibold transition-all cursor-pointer border-none shadow-[0_0_30px_rgba(255,40,73,0.4)] animate-pulse-glow"
            >
              <span className="flex items-center justify-center gap-2">
                <Crown className="h-4 w-4" />
                Assinar Pro — R$ 26,90/mês
              </span>
            </button>
          </div>
        </div>

      </section>

      {/* ===== FEATURES ===== */}
      <section className="relative z-10 py-16 px-4">
        <div className="max-w-3xl mx-auto grid md:grid-cols-3 gap-4">
          {[
            {
              icon: ShoppingCart,
              title: "Vendas",
              desc: "Checkout PIX automático com entrega instantânea.",
            },
            {
              icon: Shield,
              title: "Moderação",
              desc: "Tickets, automações e controle de permissões.",
            },
            {
              icon: Lock,
              title: "Segurança",
              desc: "Anti-raid, anti-spam e verificação 24/7.",
            },
          ].map((f, i) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-5 hover:border-primary/40 hover:bg-black/50 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${0.1 * i}s` }}
            >
              <div className="h-10 w-10 rounded-xl bg-[#FF2849] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(255,40,73,0.3)]">
                <f.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-base font-bold font-display mb-1">{f.title}</h3>
              <p className="text-xs text-white/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section className="relative z-10 py-16 px-4 pb-24">
        <div className="max-w-xl mx-auto grid md:grid-cols-2 gap-4">
          {/* Free */}
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-5 flex flex-col animate-fade-in">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">
              Free
            </h3>
            <div className="text-2xl font-extrabold font-display mb-0.5">R$ 0</div>
            <p className="text-xs text-white/40 mb-4">4 dias grátis</p>
            <ul className="space-y-1.5 mb-5 flex-1">
              {["Painel completo", "1 servidor", "Loja com PIX", "Suporte via ticket"].map(
                (f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-xs text-white/50"
                  >
                    <Check className="h-3 w-3 text-white/30 shrink-0" />
                    {f}
                  </li>
                )
              )}
            </ul>
            <button
              onClick={() => navigate("/signup")}
              className="w-full py-2 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
            >
              Começar <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-primary/40 bg-black/50 backdrop-blur-md p-5 flex flex-col relative animate-fade-in glow-pink" style={{ animationDelay: "0.1s" }}>
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                <Crown className="h-2.5 w-2.5" /> Popular
              </span>
            </div>
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              Pro
            </h3>
            <div className="text-2xl font-extrabold font-display mb-0.5">R$ 26,90</div>
            <p className="text-xs text-white/40 mb-4">por mês</p>
            <ul className="space-y-1.5 mb-5 flex-1">
              {["Tudo do Free", "Sem limite de tempo", "Segurança avançada", "Suporte prioritário"].map(
                (f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-xs text-white/70"
                  >
                    <Check className="h-3 w-3 text-primary shrink-0" />
                    {f}
                  </li>
                )
              )}
            </ul>
            <button
              onClick={() => navigate("/signup?plan=pro")}
              className="w-full py-2 rounded-full bg-[#FF2849] hover:bg-[#e52441] text-white font-semibold transition-all cursor-pointer border-none flex items-center justify-center gap-2 text-sm shadow-[0_0_20px_rgba(255,40,73,0.3)]"
            >
              Assinar Pro <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-5 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={drikaLogo} alt="Drika" className="h-5 w-auto" />
            <span className="text-[10px] text-white/30">© 2026 Drika Solutions</span>
          </div>
          <button
            onClick={() => navigate("/termos")}
            className="text-[10px] text-white/30 hover:text-white/60 transition-colors bg-transparent border-none cursor-pointer"
          >
            Termos
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
