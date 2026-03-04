import { useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingCart, Shield, Gavel, Crown, Zap, Check, ArrowRight, Bot, Users, Lock, Star } from "lucide-react";
import drikaLogo from "@/assets/drika_logo_crown.png";

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: ShoppingCart,
      title: "Vendas Automatizadas",
      description: "Sistema completo de loja no Discord com checkout via PIX, entrega automática de produtos, cupons de desconto e gestão de estoque em tempo real.",
      highlights: ["Checkout PIX automático", "Entrega instantânea", "Cupons e promoções", "Gestão de estoque"],
    },
    {
      icon: Shield,
      title: "Moderação Inteligente",
      description: "Proteja seu servidor com ferramentas avançadas de moderação. Automações, tickets de suporte e controle total de permissões para manter sua comunidade segura.",
      highlights: ["Sistema de tickets", "Automações", "Cargos e permissões", "Logs detalhados"],
    },
    {
      icon: Lock,
      title: "Segurança Avançada",
      description: "Anti-raid, anti-spam, whitelist de IPs e verificação de membros. Seu servidor blindado contra ataques e invasões com proteção 24/7.",
      highlights: ["Anti-raid & anti-spam", "Verificação de membros", "Whitelist de IPs", "Proteção 24/7"],
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white overflow-x-hidden">
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <img
            src={drikaLogo}
            alt="Drika Solutions"
            className="h-32 md:h-40 w-auto mx-auto mb-8 drop-shadow-[0_0_40px_hsl(330_100%_71%/0.4)] animate-fade-in"
          />

          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight animate-fade-in">
            O Bot <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">Completo</span> para
            <br />seu Servidor Discord
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-12 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            Vendas automatizadas, moderação inteligente e segurança avançada.
            Tudo que você precisa em um único painel.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <button
              onClick={() => navigate("/signup")}
              className="group px-8 py-4 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 hover:border-white/30 text-white font-semibold text-lg transition-all cursor-pointer"
            >
              <span className="flex items-center justify-center gap-2">
                <Zap className="h-5 w-5" />
                Testar Grátis — 4 dias
              </span>
              <span className="text-xs text-white/40 mt-1 block">Sem cartão de crédito</span>
            </button>
            <button
              onClick={() => navigate("/signup?plan=pro")}
              className="group px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-pink-600 hover:from-primary/90 hover:to-pink-600/90 text-white font-semibold text-lg transition-all cursor-pointer border-none shadow-[0_0_30px_rgba(255,40,73,0.3)]"
            >
              <span className="flex items-center justify-center gap-2">
                <Crown className="h-5 w-5" />
                Assinar Pro — R$ 26,90/mês
              </span>
              <span className="text-xs text-white/60 mt-1 block">Acesso completo</span>
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-3 rounded-full bg-primary/60" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary mb-4">
              <Bot className="h-4 w-4" /> Funcionalidades
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Tudo que seu servidor <span className="text-primary">precisa</span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Três pilares essenciais em uma única solução poderosa
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8 hover:border-primary/30 hover:bg-white/[0.06] transition-all duration-300"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed mb-5">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2 text-sm text-white/70">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-4 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary mb-4">
              <Star className="h-4 w-4" /> Planos
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Escolha seu <span className="text-primary">plano</span>
            </h2>
            <p className="text-white/50 text-lg">Comece grátis, evolua quando quiser</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free Plan */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white/80 mb-1">Drika Solutions Free</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">R$ 0</span>
                  <span className="text-white/40 text-sm">/ 4 dias</span>
                </div>
                <p className="text-white/40 text-sm mt-2">Teste todas as funcionalidades</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {["Painel completo", "1 servidor Discord", "Loja com checkout PIX", "Moderação básica", "Suporte via ticket", "Válido por 4 dias"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/60">
                    <Check className="h-4 w-4 text-white/30 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate("/signup")}
                className="w-full py-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 text-white font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Começar Grátis
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Pro Plan */}
            <div className="rounded-3xl border-2 border-primary/40 bg-primary/[0.05] p-8 flex flex-col relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
                  <Crown className="h-3 w-3" /> Popular
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-primary mb-1">Drika Solutions Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">R$ 26,90</span>
                  <span className="text-white/40 text-sm">/ mês</span>
                </div>
                <p className="text-white/40 text-sm mt-2">Acesso completo sem limites</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {["Tudo do plano Free", "Sem limite de tempo", "Segurança avançada", "Automações ilimitadas", "Suporte prioritário", "Atualizações exclusivas"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/80">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate("/signup?plan=pro")}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-primary to-pink-600 hover:from-primary/90 hover:to-pink-600/90 text-white font-semibold transition-all cursor-pointer border-none flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,40,73,0.2)]"
              >
                Assinar Pro
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para transformar seu servidor?
          </h2>
          <p className="text-white/50 text-lg mb-8">
            Junte-se a centenas de servidores que já usam Drika Solutions
          </p>
          <button
            onClick={() => navigate("/signup")}
            className="px-10 py-4 rounded-2xl bg-gradient-to-r from-primary to-pink-600 hover:from-primary/90 hover:to-pink-600/90 text-white font-semibold text-lg transition-all cursor-pointer border-none shadow-[0_0_30px_rgba(255,40,73,0.3)]"
          >
            Começar Agora
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={drikaLogo} alt="Drika" className="h-8 w-auto" />
            <span className="text-sm text-white/40">© 2026 Drika Solutions</span>
          </div>
          <button
            onClick={() => navigate("/termos")}
            className="text-sm text-white/40 hover:text-white/60 transition-colors bg-transparent border-none cursor-pointer"
          >
            Termos de Serviço
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
