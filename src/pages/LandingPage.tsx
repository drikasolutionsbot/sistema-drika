import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Crown, Zap, Check, ArrowRight, ShoppingCart, Shield, Lock, Users, TrendingUp, Package, ChevronDown, MessageSquare, Bot, Settings, Play, X, Copy, Loader2, Sparkles } from "lucide-react";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import QRCode from "qrcode";

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
  const [qrSvg, setQrSvg] = useState<string>("");
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
      if (fnError) {
        // Try to extract the real error message from the response body
        let errMsg = "Erro ao gerar pagamento";
        try {
          if (fnError.context?.body) {
            const text = await new Response(fnError.context.body).text();
            const parsed = JSON.parse(text);
            if (parsed?.error) errMsg = parsed.error;
          }
        } catch {}
        if (errMsg === "Erro ao gerar pagamento" && fnError.message) errMsg = fnError.message;
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);
      if (data?.brcode) {
        setBrcode(data.brcode);
        setPaymentId(data.payment_id);
        // Generate QR code SVG
        try {
          const svg = await QRCode.toString(data.brcode, { type: "svg", width: 180, margin: 2, color: { dark: "#000000", light: "#ffffff" }, errorCorrectionLevel: "M" });
          setQrSvg(svg);
        } catch {}
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in" onClick={step === "success" ? undefined : onClose}>
      <div className="relative w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        {step !== "success" && (
          <button onClick={onClose} className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors bg-transparent border-none cursor-pointer z-20">
            <X className="h-6 w-6" />
          </button>
        )}

        {/* Glass card with gradient border */}
        <div className="relative rounded-3xl overflow-hidden">
          {/* Animated gradient border */}
          <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-primary/60 via-white/10 to-primary/30 animate-pulse" style={{ animationDuration: '3s' }} />
          
          {/* Inner glass content */}
          <div className="relative rounded-3xl bg-black/60 backdrop-blur-2xl p-7 space-y-5">
            {/* Top glow effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative text-center">
              <img src={drikaLogo} alt="Drika" className="h-16 w-auto mx-auto mb-3 drop-shadow-[0_0_20px_rgba(255,0,100,0.3)]" />
              <h3 className="text-xl font-bold text-white tracking-tight">
                {step === "success" ? "Conta Pro Ativada! 🎉" : "Assinar Drika Hub Pro"}
              </h3>
              {step !== "success" && (
                <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 px-5 py-2 text-sm font-semibold text-primary mt-3 shadow-[0_0_15px_rgba(255,0,100,0.15)]">
                  <Crown className="h-4 w-4" /> R$ {(priceCents / 100).toFixed(2).replace(".", ",")}/mês
                </div>
              )}
            </div>

            {/* Step 1: Registration Form */}
            {step === "form" && (
              <div className="relative space-y-3">
                {[
                  { label: "Nome da Loja", type: "text", value: name, onChange: (v: string) => setName(v), placeholder: "Minha Loja" },
                  { label: "Email *", type: "email", value: email, onChange: (v: string) => setEmail(v), placeholder: "seu@email.com" },
                  { label: "Senha *", type: "password", value: password, onChange: (v: string) => setPassword(v), placeholder: "Mínimo 6 caracteres" },
                  { label: "WhatsApp", type: "text", value: whatsapp, onChange: (v: string) => setWhatsapp(v), placeholder: "(00) 00000-0000" },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="text-[11px] text-white/40 mb-1.5 block font-medium uppercase tracking-wider">{field.label}</label>
                    <input
                      type={field.type}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full h-11 rounded-xl bg-white/[0.06] border border-white/[0.08] px-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40 focus:bg-white/[0.08] focus:shadow-[0_0_15px_rgba(255,0,100,0.08)] transition-all duration-300"
                    />
                  </div>
                ))}

                {error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5">
                    <p className="text-xs text-red-400 text-center font-medium">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleSubmitForm}
                  disabled={loading}
                  className="group w-full h-12 flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white font-semibold text-sm cursor-pointer border-none hover:shadow-[0_0_30px_rgba(255,0,100,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />}
                  Gerar Pagamento PIX
                </button>
              </div>
            )}

            {/* Step 2: PIX Payment */}
            {step === "pix" && brcode && (
              <div className="space-y-4">
                {/* QR Code */}
                {qrSvg && (
                  <div className="flex justify-center">
                    <div className="rounded-2xl bg-white p-3 shadow-[0_0_30px_rgba(255,0,100,0.1)]">
                      <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
                    </div>
                  </div>
                )}
                <p className="text-xs text-white/40 text-center">Escaneie o QR Code ou copie o código abaixo:</p>
                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
                  <code className="block text-[10px] font-mono text-primary break-all leading-relaxed text-center">
                    {brcode}
                  </code>
                </div>
                <button
                  onClick={handleCopy}
                  className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl font-medium text-sm cursor-pointer border transition-all duration-300 ${
                    copied
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                      : "bg-white/[0.06] text-white hover:bg-white/[0.1] border-white/[0.08]"
                  }`}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
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
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-400/5 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
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
                    <label className="text-[11px] text-white/40 block text-center font-medium uppercase tracking-wider">Seu Token de Acesso</label>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                      <code className="block text-xs font-mono text-emerald-400 break-all leading-relaxed text-center">
                        {token}
                      </code>
                    </div>
                    <button
                      onClick={handleCopyToken}
                      className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl font-medium text-sm cursor-pointer border transition-all duration-300 ${
                        tokenCopied
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                          : "bg-white/[0.06] text-white hover:bg-white/[0.1] border-white/[0.08]"
                      }`}
                    >
                      {tokenCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {tokenCopied ? "Token Copiado!" : "Copiar Token"}
                    </button>
                    <p className="text-[10px] text-white/25 text-center">
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
                  className="group w-full h-12 flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white font-semibold text-sm cursor-pointer border-none hover:shadow-[0_0_30px_rgba(255,0,100,0.3)] transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  Ir para o Login
                </button>
              </div>
            )}
          </div>
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
    setPaymentOpen(true);
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
      <section id="planos" className="relative z-10 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-extrabold font-display mb-2">
                Escolha o plano ideal <span className="text-primary">para você</span>
              </h2>
              <p className="text-sm text-white/50">Soluções flexíveis para negócios em crescimento</p>
            </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-5 items-start">
            {/* Trial / Free */}
            <ScrollReveal>
              <div className="relative rounded-2xl border border-white/10 bg-[#0d0d0d] p-6 flex flex-col h-full transition-all duration-300 hover:border-white/20">
                <span className="inline-flex self-start items-center rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold px-3 py-1 mb-4 uppercase tracking-wider">Gratuito</span>
                <h3 className="text-xl font-extrabold font-display text-white mb-1">Trial</h3>
                <p className="text-xs text-white/40 mb-5">Teste todas as funcionalidades por 4 dias gratuitamente.</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-xs text-white/50">R$</span>
                  <span className="text-4xl font-extrabold font-display text-white">0</span>
                  <span className="text-xs text-white/40">/4 dias</span>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {[
                    "Sistema de vendas completo",
                    "Bot no seu servidor Discord",
                    "Vendas automáticas via PIX",
                    "Sistema de tickets",
                    "Personalização básica",
                    "Todas as funcionalidades inclusas",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-white/60">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-xs text-white/30">
                    <Crown className="h-3.5 w-3.5 text-white/20 shrink-0 mt-0.5" />
                    <span>Marketplace Atacadão <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full ml-1">PRO</span></span>
                  </li>
                </ul>
                <button onClick={() => navigate("/signup")} className="w-full py-2.5 rounded-full bg-emerald-500 text-white font-semibold text-sm cursor-pointer border-none hover:bg-emerald-400 transition-all flex items-center justify-center gap-2">
                  Testar Grátis <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </ScrollReveal>

            {/* Pro / Start */}
            <ScrollReveal delay={0.1}>
              <div className="relative rounded-2xl border border-primary/40 bg-[#0d0d0d] p-6 flex flex-col h-full transition-all duration-300 hover:border-primary/60 shadow-[0_0_40px_rgba(168,85,247,0.08)]">
                {/* Recommended badge */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-[10px] font-bold text-white uppercase tracking-wider whitespace-nowrap shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                    <Sparkles className="h-3 w-3" /> Recomendado
                  </span>
                </div>
                <span className="inline-flex self-start items-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-3 py-1 mb-4 uppercase tracking-wider mt-2">Mais Popular</span>
                <h3 className="text-xl font-extrabold font-display text-white mb-1">Pro</h3>
                <p className="text-xs text-white/40 mb-5">Solução completa para vendas e atendimento no Discord.</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-[10px] text-white/40">a partir de</span>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-xs text-white/50">R$</span>
                  <span className="text-4xl font-extrabold font-display text-white">{((landingConfig?.pro_price_cents || 2690) / 100).toFixed(2).replace(".", ",")}</span>
                  <span className="text-xs text-white/40">/mês</span>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {[
                    "Sistema de vendas completo",
                    "Entrega automática de produtos",
                    "Sistema de ticket profissional",
                    "Proteção anti-fraude avançada",
                    "Personalização completa",
                    "Verificação OAuth2",
                    "Marketplace Atacadão",
                    "Suporte prioritário",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-white/60">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={handleProClick} className="w-full py-2.5 rounded-full bg-primary text-white font-semibold text-sm cursor-pointer border-none hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                  Começar Agora <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </ScrollReveal>

            {/* Enterprise */}
            <ScrollReveal delay={0.2}>
              <div className="relative rounded-2xl border border-white/10 bg-[#0d0d0d] p-6 flex flex-col h-full transition-all duration-300 hover:border-white/20">
                <span className="inline-flex self-start items-center rounded-full bg-white/10 text-white/50 text-[10px] font-semibold px-3 py-1 mb-4 uppercase tracking-wider">Em Desenvolvimento</span>
                <h3 className="text-xl font-extrabold font-display text-white mb-1">Enterprise</h3>
                <p className="text-xs text-white/40 mb-5">Recursos avançados para grandes servidores e empresas.</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-2xl font-extrabold font-display text-white/40">Em breve</span>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {[
                    "Todos os recursos do Pro",
                    "Múltiplos bots por servidor",
                    "API personalizada",
                    "White-label completo",
                    "Suporte dedicado 24/7",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-white/40">
                      <Check className="h-3.5 w-3.5 text-white/30 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button disabled className="w-full py-2.5 rounded-full bg-white/5 text-white/40 font-semibold text-sm cursor-not-allowed border border-white/10 flex items-center justify-center gap-2">
                  Em Breve
                </button>
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
