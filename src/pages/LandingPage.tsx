import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Crown, Zap, Check, ArrowRight, ShoppingCart, Shield, Lock, Users, TrendingUp, Package, ChevronDown, MessageSquare, Bot, Settings, Play, X, Copy, Loader2 } from "lucide-react";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ── Scroll reveal ── */
function useScrollReveal<T extends HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("scroll-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px 50px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

const ScrollReveal = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`scroll-hidden ${className}`} style={{ transitionDelay: `${delay}s` }}>
      {children}
    </div>
  );
};

/* ── FAQ Accordion ── */
const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left text-sm font-semibold text-white/90 bg-transparent border-none cursor-pointer hover:bg-white/5 transition-colors"
      >
        {q}
        <ChevronDown className={`h-4 w-4 text-white/40 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
        <p className="px-4 pb-4 text-xs text-white/50 leading-relaxed">{a}</p>
      </div>
    </div>
  );
};

/* ── Counter animation ── */
const AnimatedCounter = ({ target, suffix = "" }: { target: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1500;
        const step = target / (duration / 16);
        let current = 0;
        const timer = setInterval(() => {
          current += step;
          if (current >= target) {
            setCount(target);
            clearInterval(timer);
          } else {
            setCount(Math.floor(current));
          }
        }, 16);
      }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
};

/* ── Video Modal ── */
const VideoModal = ({ url, onClose }: { url: string; onClose: () => void }) => {
  const getEmbedUrl = (rawUrl: string) => {
    // YouTube
    const ytMatch = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
    return rawUrl;
  };

  const isEmbed = url.includes("youtube.com") || url.includes("youtu.be");
  const embedUrl = isEmbed ? getEmbedUrl(url) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative w-full max-w-3xl mx-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors bg-transparent border-none cursor-pointer">
          <X className="h-6 w-6" />
        </button>
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video">
          {embedUrl ? (
            <iframe src={embedUrl} className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen frameBorder="0" />
          ) : (
            <video src={url} controls autoPlay className="w-full h-full object-contain" />
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Subscription Payment Modal (Pro) ── */
const SubscriptionPaymentModal = ({ onClose, priceCents }: { onClose: () => void; priceCents: number }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "pix" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [brcode, setBrcode] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSubmitForm = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Preencha email e senha");
      return;
    }
    if (password.length < 6) {
      setError("Senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-subscription-pix", {
        body: {
          tenant_id: "new_subscriber",
          email: email.trim(),
          password,
          whatsapp: whatsapp.trim() || null,
          name: name.trim() || email.split("@")[0],
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      if (data?.brcode) {
        setBrcode(data.brcode);
        setPaymentId(data.payment_id);
        setStep("pix");
        startPolling(data.payment_id);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao gerar pagamento");
    }
    setLoading(false);
  };

  const startPolling = (pid: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("check-subscription-status", {
          body: { payment_id: pid },
        });
        if (data?.status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          setToken(data.token || null);
          setTenantName(data.tenant_name || null);
          setStep("success");
        }
      } catch { /* ignore polling errors */ }
    }, 3000);
  };

  const handleCopy = () => {
    if (!brcode) return;
    navigator.clipboard.writeText(brcode);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setTokenCopied(true);
    toast.success("Token copiado!");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={step === "success" ? undefined : onClose}>
      <div className="relative w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        {step !== "success" && (
          <button onClick={onClose} className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors bg-transparent border-none cursor-pointer">
            <X className="h-6 w-6" />
          </button>
        )}
        <div className="rounded-2xl border border-white/10 bg-[#1a1a2e]/95 backdrop-blur-xl p-6 space-y-4">
          <div className="text-center">
            <img src={drikaLogo} alt="Drika" className="h-14 w-auto mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">
              {step === "success" ? "Conta Pro Ativada! 🎉" : "Assinar Drika Solutions Pro"}
            </h3>
            {step !== "success" && (
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary mt-2">
                <Crown className="h-4 w-4" /> R$ {(priceCents / 100).toFixed(2).replace(".", ",")}/mês
              </div>
            )}
          </div>

          {/* Step 1: Registration Form */}
          {step === "form" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Nome da Loja</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Minha Loja"
                  className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Senha *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">WhatsApp</label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {error && <p className="text-xs text-red-400 text-center">{error}</p>}

              <button
                onClick={handleSubmitForm}
                disabled={loading}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-white text-black font-semibold text-sm cursor-pointer border-none hover:bg-white/90 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Gerar Pagamento PIX
              </button>
            </div>
          )}

          {/* Step 2: PIX Payment */}
          {step === "pix" && brcode && (
            <div className="space-y-3">
              <p className="text-sm text-white/50 text-center">Copie o código PIX e pague pelo seu banco:</p>
              <div className="rounded-2xl border border-primary/20 bg-black/40 p-4">
                <code className="block text-xs font-mono text-primary break-all leading-relaxed text-center">
                  {brcode}
                </code>
              </div>
              <button
                onClick={handleCopy}
                className={`w-full h-11 flex items-center justify-center gap-2 rounded-full font-medium text-base cursor-pointer border-none transition-all ${
                  copied
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                {copied ? "Copiado!" : "Copiar Código PIX"}
              </button>
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-xs text-white/40">Aguardando confirmação do pagamento...</p>
              </div>
            </div>
          )}

          {/* Step 3: Success - Token */}
          {step === "success" && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                  <Check className="h-8 w-8 text-emerald-400" />
                </div>
                <p className="text-sm text-white/70">
                  Pagamento confirmado! Seu plano Pro de 30 dias está ativo.
                </p>
                {tenantName && (
                  <p className="text-xs text-white/40 mt-1">Loja: <span className="text-white/70 font-medium">{tenantName}</span></p>
                )}
              </div>

              {token && (
                <div className="space-y-2">
                  <label className="text-xs text-white/50 block text-center">Seu Token de Acesso</label>
                  <div className="rounded-2xl border border-emerald-500/20 bg-black/40 p-4">
                    <code className="block text-xs font-mono text-emerald-400 break-all leading-relaxed text-center">
                      {token}
                    </code>
                  </div>
                  <button
                    onClick={handleCopyToken}
                    className={`w-full h-11 flex items-center justify-center gap-2 rounded-full font-medium text-base cursor-pointer border-none transition-all ${
                      tokenCopied
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {tokenCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    {tokenCopied ? "Token Copiado!" : "Copiar Token"}
                  </button>
                  <p className="text-[11px] text-white/30 text-center">
                    ⚠️ Guarde seu token! Use-o para acessar o painel.
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  onClose();
                  navigate("/login");
                }}
                disabled={!tokenCopied}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-white text-black font-semibold text-sm cursor-pointer border-none hover:bg-white/90 transition-all disabled:opacity-30"
              >
                <ArrowRight className="h-4 w-4" />
                Ir para o Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [videoOpen, setVideoOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [landingConfig, setLandingConfig] = useState<{
    stat_servers: number; stat_servers_label: string;
    stat_sales: number; stat_sales_label: string;
    stat_products: number; stat_products_label: string;
    video_url: string | null;
    pushinpay_active: boolean;
    pro_price_cents: number;
  } | null>(null);

  useEffect(() => {
    supabase.from("landing_config").select("*").limit(1).single().then(({ data }) => {
      if (data) setLandingConfig(data as any);
    });
  }, []);
  const handleProClick = () => {
    if (landingConfig?.pushinpay_active) {
      setPaymentOpen(true);
    } else {
      navigate("/signup?plan=pro");
    }
  };

  const scrollToPlans = () => {
    document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen text-white overflow-x-hidden relative bg-black">
      {/* Cascading pattern background */}
      <div className="absolute inset-0 z-0 landing-pattern-bg opacity-90" />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      {/* Center glow */}
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,_rgba(29,78,216,0.1)_0%,_transparent_60%)]" />

      {/* ===== STICKY NAV ===== */}
      <nav className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <img src={drikaLogo} alt="Drika" className="h-7 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <button onClick={scrollToPlans} className="text-xs text-white/60 hover:text-white font-medium bg-transparent border-none cursor-pointer transition-colors">Planos</button>
            <button onClick={() => navigate("/login")} className="text-xs text-white/60 hover:text-white font-medium bg-transparent border-none cursor-pointer transition-colors">Entrar</button>
            <button onClick={() => navigate("/signup")} className="text-xs px-4 py-1.5 rounded-full bg-white text-black font-semibold cursor-pointer border-none hover:bg-white/90 transition-all">Começar</button>
          </div>
        </div>
      </nav>

      {/* ===== 1. HERO ===== */}
      <section className="relative z-10 min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center max-w-2xl mx-auto">
          <img src={drikaLogo} alt="Drika Solutions" className="h-28 md:h-40 w-auto mx-auto mb-5 drop-shadow-[0_0_40px_rgba(255,255,255,0.1)] animate-fade-in" />

          <h1 className="text-3xl md:text-5xl font-extrabold font-display mb-3 leading-tight animate-fade-in drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)]">
            Seu servidor Discord
            <br />
            <span className="text-white/90 drop-shadow-none">no próximo nível</span>
          </h1>

          <p className="text-sm md:text-base text-white/70 max-w-md mx-auto mb-8 animate-fade-in font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" style={{ animationDelay: "0.1s" }}>
            Vendas, moderação e segurança — tudo em um único bot.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <button onClick={() => navigate("/signup")} className="group px-6 py-3 rounded-full bg-white text-black font-semibold transition-all cursor-pointer border-none hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <span className="flex items-center justify-center gap-2">
                <Zap className="h-4 w-4" />
                Testar Grátis — 4 dias
              </span>
            </button>
            <button onClick={scrollToPlans} className="group px-6 py-3 rounded-full bg-white/10 text-white font-semibold transition-all cursor-pointer border border-white/20 hover:bg-white/20">
              <span className="flex items-center justify-center gap-2">
                <Crown className="h-4 w-4" />
                Ver Planos
              </span>
            </button>
          </div>

          {/* Login link */}
          <div className="mt-6 animate-fade-in" style={{ animationDelay: "0.25s" }}>
            <button onClick={() => navigate("/login")} className="text-sm text-white/60 hover:text-white transition-colors bg-transparent border-none cursor-pointer font-medium underline underline-offset-4 decoration-white/30 hover:decoration-white/60">
              Já tenho um token — Entrar
            </button>
          </div>

          {/* Social proof */}
          <div className="mt-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <p className="text-xs text-white/40 font-medium">
              Usado por <span className="text-white font-bold">+120 servidores</span> no Discord
            </p>
          </div>
        </div>
      </section>

      {/* ===== 2. SOCIAL PROOF STATS ===== */}
      <section className="relative z-10 py-8 px-4">
        <ScrollReveal>
          <div className="max-w-2xl mx-auto grid grid-cols-3 gap-4">
            {[
              { icon: Users, value: landingConfig?.stat_servers ?? 120, suffix: "+", label: landingConfig?.stat_servers_label ?? "Servidores ativos" },
              { icon: TrendingUp, value: landingConfig?.stat_sales ?? 500, suffix: "+", label: landingConfig?.stat_sales_label ?? "Vendas processadas" },
              { icon: Package, value: landingConfig?.stat_products ?? 1200, suffix: "+", label: landingConfig?.stat_products_label ?? "Produtos entregues" },
            ].map((s) => (
              <div key={s.label} className="text-center p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <s.icon className="h-5 w-5 text-white/60 mx-auto mb-2" />
                <div className="text-xl md:text-2xl font-extrabold font-display text-white">
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </div>
                <p className="text-[10px] text-white/40 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* ===== 3. FEATURES ===== */}
      <section className="relative z-10 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold font-display mb-2">
                Tudo que seu servidor <span className="text-white">precisa</span>
              </h2>
              <p className="text-xs text-white/40">Três pilares em uma única solução</p>
            </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                icon: ShoppingCart,
                title: "Vendas Automáticas",
                desc: "Venda produtos digitais automaticamente. Pagamento via PIX e entrega instantânea no ticket.",
              },
              {
                icon: Shield,
                title: "Moderação Completa",
                desc: "Sistema de tickets, automações inteligentes e controle total de cargos e permissões.",
              },
              {
                icon: Lock,
                title: "Segurança 24/7",
                desc: "Anti-raid, anti-spam e verificação de membros. Seu servidor blindado contra ataques.",
              },
            ].map((f, i) => (
              <ScrollReveal key={f.title} delay={0.1 * i}>
                <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300 h-full">
                  <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <f.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold font-display mb-2">{f.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 4. HOW IT WORKS ===== */}
      <section className="relative z-10 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold font-display mb-2">
                Como <span className="text-white">funciona</span>
              </h2>
              <p className="text-xs text-white/40">3 passos para começar a vender</p>
            </div>
          </ScrollReveal>
          <div className="space-y-4">
            {[
              { step: "1", icon: Bot, title: "Instale o bot", desc: "Adicione o bot Drika no seu servidor Discord com um clique." },
              { step: "2", icon: Settings, title: "Configure sua loja", desc: "Use o painel para criar produtos, definir preços e configurar pagamento PIX." },
              { step: "3", icon: ShoppingCart, title: "Comece a vender", desc: "Seus clientes compram direto no Discord. Pagamento e entrega automáticos." },
            ].map((s, i) => (
              <ScrollReveal key={s.step} delay={0.1 * i}>
                <div className="flex items-start gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-white/20 transition-all">
                  <div className="h-10 w-10 rounded-full bg-white text-black flex items-center justify-center shrink-0 font-extrabold font-display text-sm">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-display mb-1 flex items-center gap-2">
                      <s.icon className="h-4 w-4 text-white/60" />
                      {s.title}
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 5. BOT PREVIEW — VIDEO ===== */}
      <section className="relative z-10 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold font-display mb-2">
                Veja o bot <span className="text-white">funcionando</span>
              </h2>
              <p className="text-xs text-white/40">Assista como é simples vender no Discord</p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            {landingConfig?.video_url ? (
              <button
                onClick={() => setVideoOpen(true)}
                className="group w-full aspect-video rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden relative cursor-pointer hover:border-white/20 transition-all duration-300 bg-transparent"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="h-7 w-7 text-black ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <span className="text-xs text-white/50 font-medium">Clique para assistir</span>
                </div>
              </button>
            ) : (
              <div className="w-full aspect-video rounded-2xl border border-white/10 bg-white/[0.02] flex items-center justify-center">
                <p className="text-sm text-white/30">Vídeo em breve</p>
              </div>
            )}
          </ScrollReveal>
        </div>
      </section>

      {/* Video Modal */}
      {videoOpen && landingConfig?.video_url && (
        <VideoModal url={landingConfig.video_url} onClose={() => setVideoOpen(false)} />
      )}

      {/* Subscription Payment Modal */}
      {paymentOpen && (
        <SubscriptionPaymentModal onClose={() => setPaymentOpen(false)} priceCents={landingConfig?.pro_price_cents || 2690} />
      )}

      {/* ===== 6. PRICING ===== */}
      <section className="relative z-10 py-12 px-4">
        <div className="max-w-xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold font-display mb-2">
                Escolha seu <span className="text-white">plano</span>
              </h2>
              <p className="text-xs text-white/40">Comece grátis, evolua quando quiser</p>
            </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-6 pt-4 overflow-visible">
            {/* Free */}
            <ScrollReveal>
              <div className="pricing-card group relative h-full transition-all duration-300 hover:scale-[1.03] bg-[#111]">
                <div className="relative z-10 p-5 flex flex-col h-full">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Teste Grátis</h3>
                  <div className="text-2xl font-extrabold font-display mb-0.5 text-white">4 dias</div>
                  <p className="text-xs text-white/40 mb-4">para experimentar tudo</p>
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {["Painel completo", "Bot no seu servidor", "Vendas automáticas", "Sem cartão"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                        <Check className="h-3 w-3 text-white/40 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="pricing-card-label rounded-[.5rem_2rem] p-3 transition-all duration-500 hover:translate-x-1 hover:[transform:perspective(100px)_translateX(7px)_rotateX(3deg)_rotateY(3deg)]">
                    <button onClick={() => navigate("/signup")} className="w-full py-2 rounded-full bg-white text-black hover:bg-white/90 font-semibold transition-all cursor-pointer border-none flex items-center justify-center gap-2 text-sm">
                      Começar <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Pro */}
            <ScrollReveal delay={0.15}>
              <div className="pricing-card pricing-card--pro group relative h-full transition-all duration-300 hover:scale-[1.03] scale-[1.02] pt-4 bg-[#111] border border-white/20">
                {/* Popular badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-1.5 text-[11px] font-bold text-black uppercase tracking-wider whitespace-nowrap">
                    <Crown className="h-3 w-3" /> Popular
                  </span>
                </div>
                <div className="relative z-10 p-5 pt-3 flex flex-col h-full">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Pro</h3>
                  <div className="text-2xl font-extrabold font-display mb-0.5 text-white">R$ {((landingConfig?.pro_price_cents || 2690) / 100).toFixed(2).replace(".", ",")}</div>
                  <p className="text-xs text-white/40 mb-4">por mês</p>
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {["Tudo do Free", "Sem limite de tempo", "Segurança avançada", "Suporte prioritário"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                        <Check className="h-3 w-3 text-white shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="pricing-card-label rounded-[.5rem_2rem] p-3 transition-all duration-500 hover:translate-x-1 hover:[transform:perspective(100px)_translateX(7px)_rotateX(3deg)_rotateY(3deg)]">
                     <button onClick={handleProClick} className="w-full py-2 rounded-full bg-white text-black hover:bg-white/90 font-semibold transition-all cursor-pointer border-none flex items-center justify-center gap-2 text-sm">
                      Assinar Pro <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ===== 7. FAQ ===== */}
      <section className="relative z-10 py-12 px-4">
        <div className="max-w-xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold font-display mb-2">
                Perguntas <span className="text-white">frequentes</span>
              </h2>
            </div>
          </ScrollReveal>
          <div className="space-y-3">
            {[
              { q: "Preciso de cartão de crédito para testar?", a: "Não! O plano Free é 100% gratuito por 4 dias. Sem cartão, sem compromisso." },
              { q: "O bot funciona em qualquer servidor?", a: "Sim, funciona em qualquer servidor Discord. Basta adicionar o bot e configurar pelo painel." },
              { q: "Como funciona o pagamento PIX?", a: "Quando um cliente compra no seu servidor, o bot gera automaticamente um QR Code PIX. Após o pagamento, a entrega é feita instantaneamente." },
              { q: "Posso cancelar a qualquer momento?", a: "Sim, sem multa e sem burocracia. Você pode cancelar o plano Pro quando quiser." },
              { q: "O que acontece quando o plano Free expira?", a: "Após os 4 dias, o bot para de funcionar. Você pode assinar o plano Pro para continuar usando sem limites." },
            ].map((faq, i) => (
              <ScrollReveal key={i} delay={0.05 * i}>
                <FaqItem q={faq.q} a={faq.a} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 8. FOOTER ===== */}
      <ScrollReveal>
        <footer className="relative z-10 border-t border-white/10 py-5 px-4">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src={drikaLogo} alt="Drika" className="h-6 w-auto" />
              <span className="text-xs text-white/70 font-medium">© 2026 Drika Solutions</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://discord.gg/gArgCX55Ry" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-primary transition-colors" aria-label="Discord">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              </a>
              <a href="https://www.instagram.com/drikastor3/" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-primary transition-colors" aria-label="Instagram">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
              </a>
              <button onClick={() => navigate("/termos")} className="text-xs text-white/70 hover:text-white transition-colors bg-transparent border-none cursor-pointer font-medium">
                Termos
              </button>
            </div>
          </div>
        </footer>
      </ScrollReveal>
    </div>
  );
};

export default LandingPage;
