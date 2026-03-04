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
      <footer className="relative z-10 border-t border-white/15 py-5 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={drikaLogo} alt="Drika" className="h-6 w-auto" />
            <span className="text-xs text-white/70 font-medium">© 2026 Drika Solutions</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://discord.com/invite/xJ9g2TA98e"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 hover:text-primary transition-colors"
              aria-label="Discord"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
            </a>
            <a
              href="https://www.instagram.com/drikastor3/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 hover:text-primary transition-colors"
              aria-label="Instagram"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
            </a>
            <button
              onClick={() => navigate("/termos")}
              className="text-xs text-white/70 hover:text-white transition-colors bg-transparent border-none cursor-pointer font-medium"
            >
              Termos
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
