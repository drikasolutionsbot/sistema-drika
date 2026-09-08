import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useMemo, type RefObject } from "react";
import { Crown, Zap, Check, ArrowRight, ShoppingCart, Shield, Lock, Users, TrendingUp, Package, ChevronDown, MessageSquare, Bot, Settings, Play, X, Copy, Loader2, Sparkles, UserPlus, Gift, ShieldCheck, MessageSquareHeart, Gem } from "lucide-react";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import QRCode from "qrcode";
import { FeedbackModal } from "@/components/landing/FeedbackModal";

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

/* ── Subscription Payment Modal ── */
const SubscriptionPaymentModal = ({
  onClose,
  priceCents,
  plan,
  planLabel,
  cycle = "monthly",
  cycleLabel = "Mensal",
  cycleDays = 30,
}: {
  onClose: () => void;
  priceCents: number;
  plan: "pro" | "master";
  planLabel: string;
  cycle?: "monthly" | "quarterly" | "semiannual";
  cycleLabel?: string;
  cycleDays?: number;
}) => {
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

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (!digits) return "";
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  // Capture ?ref=CODE from URL
  const refCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("ref") || null;
  }, []);

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
          ref_code: refCode,
          plan,
          cycle,
          cycle_days: cycleDays,
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

  const isMaster = plan === "master";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in" onClick={step === "success" ? undefined : onClose}>
      <div className="relative w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        {step !== "success" && (
          <button onClick={onClose} className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors bg-transparent border-none cursor-pointer z-20">
            <X className="h-6 w-6" />
          </button>
        )}

        {/* Glass card with gradient border */}
        <div className="relative rounded-3xl overflow-hidden">
          {/* Animated gradient border */}
          <div 
            className={`absolute -inset-[1.5px] rounded-3xl animate-pulse ${
              isMaster
                ? "bg-gradient-to-r from-pink-500 via-purple-500 to-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.4)]"
                : "bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-500 shadow-[0_0_40px_rgba(6,182,212,0.35)]"
            }`} 
            style={{ animationDuration: '2.5s' }} 
          />
          
          {/* Inner glass content */}
          <div className="relative rounded-3xl bg-black/70 backdrop-blur-2xl p-7 space-y-5">
            {/* Top glow effect */}
            <div 
              className={`absolute top-0 left-1/2 -translate-x-1/2 w-56 h-28 rounded-full blur-3xl pointer-events-none ${
                isMaster ? "bg-pink-500/25" : "bg-cyan-500/20"
              }`} 
            />

            <div className="relative text-center">
              <img 
                src={drikaLogo} 
                alt="Drika" 
                className={`h-16 w-auto mx-auto mb-3 ${
                  isMaster ? "drop-shadow-[0_0_25px_rgba(244,63,94,0.5)]" : "drop-shadow-[0_0_25px_rgba(6,182,212,0.5)]"
                }`} 
              />
              <h3 className="text-xl font-bold text-white tracking-tight">
                {step === "success"
                  ? `Conta ${isMaster ? "👑 Master" : "💎 Básico"} Ativada! 🎉`
                  : `Assinar ${isMaster ? "👑 Plano Master" : "💎 Plano Básico"}`}
              </h3>
              {step !== "success" && (
                <div className="flex flex-col items-center gap-1 mt-2.5">
                  <div className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold border shadow-sm ${
                    isMaster
                      ? "bg-pink-500/15 border-pink-500/30 text-pink-300 shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                      : "bg-cyan-500/15 border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                  }`}>
                    {isMaster ? <Crown className="h-3.5 w-3.5 text-pink-400" /> : <Gem className="h-3.5 w-3.5 text-cyan-400" />}
                    <span>Ciclo {cycleLabel} • {cycleDays} dias</span>
                  </div>
                  <span className="text-xl font-extrabold text-white">
                    R$ {(priceCents / 100).toFixed(2).replace(".", ",")}{cycle === "monthly" ? "/mês" : ""}
                  </span>
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
                  { label: "WhatsApp", type: "tel", value: whatsapp, onChange: (v: string) => setWhatsapp(formatPhone(v)), placeholder: "(00) 00000-0000", maxLength: 15 },
                ].map((field: any) => (
                  <div key={field.label}>
                    <label className="text-[11px] text-white/40 mb-1.5 block font-medium uppercase tracking-wider">{field.label}</label>
                    <input
                      type={field.type}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder={field.placeholder}
                      maxLength={field.maxLength}
                      className={`w-full h-11 rounded-xl bg-white/[0.06] border border-white/[0.08] px-4 text-sm text-white placeholder:text-white/20 outline-none focus:bg-white/[0.08] transition-all duration-300 ${
                        isMaster 
                          ? "focus:border-pink-500/50 focus:shadow-[0_0_15px_rgba(244,63,94,0.15)]" 
                          : "focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                      }`}
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
                  className={`group w-full h-12 flex items-center justify-center gap-2.5 rounded-xl text-white font-bold text-sm cursor-pointer border-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isMaster
                      ? "bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 hover:from-pink-500 hover:to-purple-500 shadow-[0_0_30px_rgba(244,63,94,0.4)] hover:shadow-[0_0_40px_rgba(244,63,94,0.6)]"
                      : "bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_40px_rgba(6,182,212,0.6)]"
                  }`}
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
                    <div className={`rounded-2xl bg-white p-3 ${
                      isMaster ? "shadow-[0_0_30px_rgba(244,63,94,0.2)]" : "shadow-[0_0_30px_rgba(6,182,212,0.2)]"
                    }`}>
                      <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
                    </div>
                  </div>
                )}
                <p className="text-xs text-white/40 text-center">Escaneie o QR Code ou copie o código abaixo:</p>
                <div className={`rounded-xl border p-3 ${
                  isMaster ? "border-pink-500/30 bg-pink-500/[0.04]" : "border-cyan-500/30 bg-cyan-500/[0.04]"
                }`}>
                  <code className={`block text-[10px] font-mono break-all leading-relaxed text-center ${
                    isMaster ? "text-pink-300" : "text-cyan-300"
                  }`}>
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
                  <Loader2 className={`h-4 w-4 animate-spin ${isMaster ? "text-pink-400" : "text-cyan-400"}`} />
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
                    Pagamento confirmado! Seu plano {plan === "master" ? "Master" : "Básico"} ({cycleLabel} • {cycleDays} dias) está ativo.
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
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<"pro" | "master">("pro");
  const [paymentCycle, setPaymentCycle] = useState<"monthly" | "quarterly" | "semiannual">("monthly");
  const [paymentPriceCents, setPaymentPriceCents] = useState<number>(1299);
  const [paymentPlanLabel, setPaymentPlanLabel] = useState<string>("Básico");
  const [paymentCycleLabel, setPaymentCycleLabel] = useState<string>("Mensal");
  const [paymentCycleDays, setPaymentCycleDays] = useState<number>(30);

  const [landingConfig, setLandingConfig] = useState<{
    stat_servers: number; stat_servers_label: string;
    stat_sales: number; stat_sales_label: string;
    stat_products: number; stat_products_label: string;
    video_url: string | null;
    pushinpay_active: boolean;
    pro_price_cents: number;
    pro_quarterly_price_cents?: number;
    pro_semiannual_price_cents?: number;
    master_price_cents: number;
    master_quarterly_price_cents?: number;
    master_semiannual_price_cents?: number;
    pro_plan_name: string;
    master_plan_name: string;
    show_pro_plan?: boolean;
    show_master_plan?: boolean;
    show_trial?: boolean;
    is_free_system?: boolean;
  } | null>(null);

  useEffect(() => {
    supabase.from("landing_config").select("*").limit(1).single().then(({ data }) => {
      if (data) setLandingConfig(data as any);
    });
  }, []);

  const handleOpenPayment = (plan: "pro" | "master", cycle: "monthly" | "quarterly" | "semiannual") => {
    const isM = plan === "master";
    const baseName = isM
      ? (landingConfig?.master_plan_name || "Master")
      : (landingConfig?.pro_plan_name || "Básico");

    let price = 0;
    let days = 30;
    let cycleTxt = "Mensal";

    if (cycle === "semiannual") {
      days = 180;
      cycleTxt = "Semestral";
      price = isM
        ? (landingConfig?.master_semiannual_price_cents || 12990)
        : (landingConfig?.pro_semiannual_price_cents || 5990);
    } else if (cycle === "quarterly") {
      days = 90;
      cycleTxt = "Trimestral";
      price = isM
        ? (landingConfig?.master_quarterly_price_cents || 7290)
        : (landingConfig?.pro_quarterly_price_cents || 3490);
    } else {
      days = 30;
      cycleTxt = "Mensal";
      price = isM
        ? (landingConfig?.master_price_cents || 2699)
        : (landingConfig?.pro_price_cents || 1299);
    }

    setPaymentPlan(plan);
    setPaymentCycle(cycle);
    setPaymentPriceCents(price);
    setPaymentPlanLabel(baseName);
    setPaymentCycleLabel(cycleTxt);
    setPaymentCycleDays(days);
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

      {/* ===== DISCORD ANNOUNCEMENT BAR ===== */}
      <a
        href="https://discord.gg/EpANWMPEKS"
        target="_blank"
        rel="noopener noreferrer"
        className="relative z-50 flex items-center justify-center gap-2 sm:gap-3 px-4 py-2 bg-[#3d102e]/90 backdrop-blur-md border-b border-[#ff6bc9]/30 hover:bg-[#4d143a] transition-colors group cursor-pointer"
      >
        {/* Discord icon */}
        <svg className="h-4 w-4 text-[#ff6bc9] shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.053a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        <span className="text-[11px] sm:text-xs text-white group-hover:text-white/80 transition-colors font-display font-extrabold tracking-wide">
          Entre no nosso servidor de suporte
        </span>
        <span className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-[#ff6bc9] border border-[#ff6bc9]/40 rounded px-2 py-0.5 group-hover:border-[#ff6bc9]/70 group-hover:text-[#ff85d4] transition-all">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Entrar
        </span>
      </a>

      {/* ===== STICKY NAV ===== */}

      <nav className="sticky top-0 z-50 bg-white/[0.03] backdrop-blur-lg border-b border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
        <div className="max-w-4xl mx-auto flex items-center justify-end px-6 h-8 sm:h-10">
          <div className="flex items-center gap-2 sm:gap-4">
            {landingConfig && !landingConfig.is_free_system && (
              <button onClick={scrollToPlans} className="text-xs text-white/70 hover:text-white font-medium bg-transparent border-none cursor-pointer transition-colors">Planos</button>
            )}
            <button onClick={() => navigate("/login")} className="text-xs text-white/70 hover:text-white font-medium bg-transparent border-none cursor-pointer transition-colors">Entrar</button>
            <button 
              onClick={() => navigate("/signup")} 
              className="text-xs px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-white text-black font-semibold cursor-pointer border-none hover:bg-white/90 transition-all"
            >
              Começar
            </button>
          </div>
        </div>
      </nav>

      {/* ===== 1. HERO ===== */}
      <section className="relative z-10 min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center max-w-2xl mx-auto -mt-16 sm:-mt-24">
          <img src={drikaLogo} alt="Drika Solutions" className="h-20 sm:h-28 md:h-40 w-auto mx-auto mb-5 drop-shadow-[0_0_40px_rgba(255,255,255,0.1)] animate-fade-in" />

          <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold font-display mb-3 leading-tight animate-fade-in drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)] text-center">
            <span className="text-white">Conheça o Bot de vendas</span>
            <br />
            <span className="text-[#ff6bc9]">mais completo para o Discord</span>
          </h1>

          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto mb-8 animate-fade-in font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] text-center leading-relaxed" style={{ animationDelay: "0.1s" }}>
            Sistema de vendas automáticas, tickets profissionais,<br className="hidden sm:block" />
            moderação, sistema de verificação de membros<br className="hidden sm:block" />
            e muito mais.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in min-h-[48px]" style={{ animationDelay: "0.2s" }}>
            {!landingConfig ? (
              <div className="flex justify-center w-full">
                <Loader2 className="h-6 w-6 text-white/50 animate-spin my-auto" />
              </div>
            ) : (
              <>
                {landingConfig.is_free_system ? (
                  <button onClick={() => navigate("/signup")} className="group px-6 py-3 rounded-full bg-white text-black font-semibold transition-all cursor-pointer border-none hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                    <span className="flex items-center justify-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Cadastre-se Grátis
                    </span>
                  </button>
                ) : (landingConfig.show_trial ?? true) ? (
                  <button onClick={() => navigate("/signup")} className="group px-6 py-3 rounded-full bg-white text-black font-semibold transition-all cursor-pointer border-none hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                    <span className="flex items-center justify-center gap-2">
                      <Zap className="h-4 w-4" />
                      Testar Grátis — 4 dias
                    </span>
                  </button>
                ) : (
                  <button onClick={() => navigate("/signup")} className="group px-6 py-3 rounded-full bg-white/10 text-white font-semibold transition-all cursor-pointer border border-white/20 hover:bg-white/20">
                    <span className="flex items-center justify-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Cadastre-se
                    </span>
                  </button>
                )}
                
                {!landingConfig.is_free_system && (
                  <button onClick={scrollToPlans} className={`group px-6 py-3 rounded-full font-semibold transition-all cursor-pointer ${
                    !(landingConfig.show_trial ?? true)
                      ? "bg-white text-black border-none hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                      : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                  }`}>
                    <span className="flex items-center justify-center gap-2">
                      <Crown className="h-4 w-4" />
                      Ver Planos
                    </span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Login link */}
          <div className="mt-6 animate-fade-in" style={{ animationDelay: "0.25s" }}>
            <button onClick={() => navigate("/login")} className="text-sm text-white/60 hover:text-white transition-colors bg-transparent border-none cursor-pointer font-medium underline underline-offset-4 decoration-white/30 hover:decoration-white/60">
              Já tenho um token — Entrar
            </button>
          </div>


        </div>
      </section>


      {/* ===== 3. FEATURES ===== */}
      <section className="relative z-10 py-4 px-4">
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
                desc: "Venda produtos digitais diretamente no Discord com pagamento via PIX e entrega instantânea.",
              },
              {
                icon: Package,
                title: "Gestão de Estoque",
                desc: "Controle total sobre seus produtos. Acompanhe a disponibilidade de forma simples e rápida.",
              },
              {
                icon: MessageSquare,
                title: "Sistema de Tickets",
                desc: "Atendimento profissional com tickets organizados. Facilite o suporte para seus clientes.",
              },
              {
                icon: Gift,
                title: "Sorteios Engajadores",
                desc: "Crie sorteios interativos para movimentar sua comunidade e atrair novos membros facilmente.",
              },
              {
                icon: ShieldCheck,
                title: "Verificação de Membros",
                desc: "Mantenha seu servidor seguro contra bots e raids com um sistema de verificação eficiente.",
              },
              {
                icon: Settings,
                title: "Painel de Controle",
                desc: "Gerencie configurações, cadastre produtos e acompanhe estatísticas em tempo real pelo painel.",
              },
            ].map((f, i) => (
              <ScrollReveal key={f.title} delay={0.1 * i}>
                <div className={`group rounded-2xl border border-white/5 bg-[#09090b]/80 p-5 transition-all duration-500 h-full hover:shadow-[0_0_30px_-5px_rgba(236,72,153,0.15)] hover:border-pink-500/30 relative overflow-hidden`}>
                  {/* Subtle pink glow inside card on hover */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500 bg-pink-500`} />
                  
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110 bg-pink-500/10 text-pink-500`}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold font-display mb-2 text-white">{f.title}</h3>
                  <p className="text-xs text-white/70 leading-relaxed">{f.desc}</p>
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
                Como <span className="text-pink-500">funciona</span>
              </h2>
              <p className="text-xs text-white/50">3 passos para começar a vender</p>
            </div>
          </ScrollReveal>
          <div className="space-y-4">
            {[
              { step: "01", icon: Bot, title: "Instale o bot", desc: "Adicione o bot Drika no seu servidor Discord com um clique." },
              { step: "02", icon: Settings, title: "Configure sua loja", desc: "Use o painel para criar produtos, definir preços e configurar pagamento PIX." },
              { step: "03", icon: ShoppingCart, title: "Comece a vender", desc: "Seus clientes compram direto no Discord. Pagamento e entrega automáticos." },
            ].map((s, i) => (
              <ScrollReveal key={s.step} delay={0.1 * i}>
                <div className="flex items-start gap-5 p-6 rounded-2xl border border-white/5 bg-[#09090b]/80 hover:border-pink-500/20 hover:bg-white/[0.02] transition-all duration-300">
                  <div className="text-xl sm:text-2xl font-bold font-display text-pink-500/20 group-hover:text-pink-500/40 transition-colors shrink-0 select-none">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold font-display mb-2 flex items-center gap-2 text-white">
                      <s.icon className="h-4 w-4 text-pink-500" />
                      {s.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed">{s.desc}</p>
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
        <SubscriptionPaymentModal
          onClose={() => setPaymentOpen(false)}
          priceCents={paymentPriceCents}
          plan={paymentPlan}
          planLabel={paymentPlanLabel}
          cycle={paymentCycle}
          cycleLabel={paymentCycleLabel}
          cycleDays={paymentCycleDays}
        />
      )}

      {/* ===== 6. PRICING ===== */}
      {landingConfig && !landingConfig.is_free_system && (
        <section id="planos" className="relative z-10 py-20 px-4">
          <div className="max-w-5xl mx-auto space-y-12">
            <ScrollReveal>
              <div className="text-center">
                <h2 className="text-2xl md:text-4xl font-extrabold font-display mb-2">
                  Escolha o plano ideal <span className="text-primary">para seu negócio</span>
                </h2>
                <p className="text-sm text-white/50 max-w-lg mx-auto">
                  Automatize vendas, suporte e entrega no Discord com máxima velocidade e segurança.
                </p>
              </div>
            </ScrollReveal>

            {/* Trial / Free (Se ativado no admin) */}
            {(landingConfig?.show_trial ?? true) && (
              <ScrollReveal delay={0.05}>
                <div className="relative rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/30 via-[#0d0d0d] to-emerald-950/20 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-12 w-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Gift className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Quer testar antes de assinar?</span>
                        <span className="rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider">
                          4 Dias Grátis
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">
                        Acesse as ferramentas básicas e configure seu bot sem custos ou dados bancários.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate("/signup")}
                    className="shrink-0 w-full sm:w-auto px-5 py-2.5 rounded-full bg-emerald-500 text-white font-semibold text-xs cursor-pointer border-none hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  >
                    Iniciar Teste Grátis <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </ScrollReveal>
            )}

            {/* ===== 1. PLANO BÁSICO ===== */}
            {(landingConfig?.show_pro_plan ?? true) && (
              <ScrollReveal delay={0.1}>
                <div className="relative rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-[#0b1424]/90 via-[#090e19]/95 to-[#060a12] p-6 sm:p-8 overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.08)]">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-cyan-500/15 to-transparent rounded-full blur-[100px] pointer-events-none" />

                  {/* Header Básico */}
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-white/[0.08]">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-2">
                        <Gem className="h-3.5 w-3.5" /> {landingConfig?.pro_plan_name || "Básico"}
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-extrabold text-white font-display">
                        💎 Plano {landingConfig?.pro_plan_name || "Básico"}
                      </h3>
                      <p className="text-xs sm:text-sm text-white/50">
                        O essencial completo para automatizar vendas e atendimento na sua comunidade Discord.
                      </p>
                    </div>

                    {/* Features inclusas */}
                    <div className="flex flex-wrap gap-2 max-w-md">
                      {[
                        "Vendas PIX automáticas",
                        "Entrega imediata de produtos",
                        "Sistema de tickets profissional",
                        "Marketplace Atacadão",
                        "Proteção anti-fraude",
                        "Painel Web com estatísticas",
                      ].map((item) => (
                        <span key={item} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/80 bg-white/[0.04] border border-white/[0.07] rounded-lg px-2.5 py-1">
                          <Check className="h-3 w-3 text-cyan-400 shrink-0" />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 3 Modais / Cards de Ciclos do Básico */}
                  <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mt-6 items-stretch">
                    {/* Mensal */}
                    <div className="rounded-2xl border border-cyan-500/20 bg-white/[0.02] p-5 flex flex-col justify-between hover:border-cyan-500/50 hover:bg-cyan-500/[0.03] transition-all duration-300">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Mensal</span>
                          <span className="text-[10px] text-white/40 font-mono">30 dias</span>
                        </div>
                        <p className="text-[11px] text-white/40 mb-4">Flexibilidade com renovação mês a mês.</p>
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-xs text-white/50">R$</span>
                          <span className="text-3xl font-extrabold text-white font-display">
                            {((landingConfig?.pro_price_cents || 1299) / 100).toFixed(2).replace(".", ",")}
                          </span>
                          <span className="text-xs text-white/40">/mês</span>
                        </div>
                        <p className="text-[10px] text-white/30 mb-5">Cobrado a cada 30 dias</p>
                      </div>
                      <button
                        onClick={() => handleOpenPayment("pro", "monthly")}
                        className="w-full py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500 hover:text-black font-semibold text-xs cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                      >
                        Assinar Mensal <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Trimestral */}
                    <div className="relative rounded-2xl border border-cyan-400/40 bg-cyan-500/[0.05] p-5 flex flex-col justify-between hover:border-cyan-400 hover:bg-cyan-500/[0.08] transition-all duration-300 shadow-[0_0_25px_rgba(6,182,212,0.1)]">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-cyan-500 text-black font-extrabold text-[9px] uppercase tracking-wider px-3 py-0.5 shadow-sm">
                          Mais Escolhido
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2 mt-1">
                          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Trimestral</span>
                          <span className="text-[10px] text-white/40 font-mono">90 dias</span>
                        </div>
                        <p className="text-[11px] text-white/40 mb-4">Economize com plano para 3 meses.</p>
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-xs text-white/50">R$</span>
                          <span className="text-3xl font-extrabold text-white font-display">
                            {((landingConfig?.pro_quarterly_price_cents || 3490) / 100).toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                        <p className="text-[10px] text-cyan-400 font-medium mb-5">
                          ~ R$ {((landingConfig?.pro_quarterly_price_cents || 3490) / 300).toFixed(2).replace(".", ",")}/mês (90 dias)
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenPayment("pro", "quarterly")}
                        className="w-full py-2.5 rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 font-bold text-xs cursor-pointer border-none transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                      >
                        Assinar Trimestral <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Semestral */}
                    <div className="relative rounded-2xl border border-cyan-500/20 bg-white/[0.02] p-5 flex flex-col justify-between hover:border-cyan-500/50 hover:bg-cyan-500/[0.03] transition-all duration-300">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-extrabold text-[9px] uppercase tracking-wider px-3 py-0.5">
                          Maior Economia
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2 mt-1">
                          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Semestral</span>
                          <span className="text-[10px] text-white/40 font-mono">180 dias</span>
                        </div>
                        <p className="text-[11px] text-white/40 mb-4">6 meses com o menor custo mensal.</p>
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-xs text-white/50">R$</span>
                          <span className="text-3xl font-extrabold text-white font-display">
                            {((landingConfig?.pro_semiannual_price_cents || 5990) / 100).toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-400 font-medium mb-5">
                          ~ R$ {((landingConfig?.pro_semiannual_price_cents || 5990) / 600).toFixed(2).replace(".", ",")}/mês (180 dias)
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenPayment("pro", "semiannual")}
                        className="w-full py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500 hover:text-black font-semibold text-xs cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                      >
                        Assinar Semestral <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            )}

            {/* ===== 2. PLANO MASTER ===== */}
            {(landingConfig?.show_master_plan ?? true) && (
              <ScrollReveal delay={0.15}>
                <div className="relative rounded-3xl border border-pink-500/30 bg-gradient-to-b from-[#1c0817]/85 via-[#130610]/95 to-[#0d0d0d] p-6 sm:p-8 overflow-hidden shadow-[0_0_60px_rgba(244,63,94,0.12)]">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-pink-500/20 via-purple-500/10 to-transparent rounded-full blur-[100px] pointer-events-none" />

                  {/* Header Master */}
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-white/[0.08]">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/15 border border-pink-500/30 px-3 py-1 text-[11px] font-bold text-pink-400 uppercase tracking-wider mb-2 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                        <Crown className="h-3.5 w-3.5 text-pink-400" /> {landingConfig?.master_plan_name || "Master"} • Sem Limites
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-extrabold text-white font-display">
                        👑 Plano {landingConfig?.master_plan_name || "Master"}
                      </h3>
                      <p className="text-xs sm:text-sm text-white/50">
                        Tudo do Básico + recursos exclusivos de escala e inteligência artificial irrestrita.
                      </p>
                    </div>

                    {/* Features exclusivas */}
                    <div className="flex flex-wrap gap-2 max-w-md">
                      {[
                        "Tudo do Plano Básico",
                        "Capa pessoal do bot por loja",
                        "Créditos de IA ilimitados",
                        "Identidade visual exclusiva",
                        "Suporte VIP prioritário",
                        "Acesso antecipado a novidades",
                      ].map((item) => (
                        <span key={item} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-pink-200/90 bg-pink-500/[0.08] border border-pink-500/20 rounded-lg px-2.5 py-1">
                          <Sparkles className="h-3 w-3 text-pink-400 shrink-0" />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 3 Modais / Cards de Ciclos do Master */}
                  <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mt-6 items-stretch">
                    {/* Mensal */}
                    <div className="rounded-2xl border border-pink-500/20 bg-white/[0.02] p-5 flex flex-col justify-between hover:border-pink-500/50 hover:bg-pink-500/[0.04] transition-all duration-300">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-pink-400 uppercase tracking-wider">Mensal</span>
                          <span className="text-[10px] text-white/40 font-mono">30 dias</span>
                        </div>
                        <p className="text-[11px] text-white/40 mb-4">Experiência Master mês a mês.</p>
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-xs text-white/50">R$</span>
                          <span className="text-3xl font-extrabold text-white font-display">
                            {((landingConfig?.master_price_cents || 2699) / 100).toFixed(2).replace(".", ",")}
                          </span>
                          <span className="text-xs text-white/40">/mês</span>
                        </div>
                        <p className="text-[10px] text-white/30 mb-5">Cobrado a cada 30 dias</p>
                      </div>
                      <button
                        onClick={() => handleOpenPayment("master", "monthly")}
                        className="w-full py-2.5 rounded-xl bg-pink-500/20 border border-pink-500/40 text-pink-300 hover:bg-pink-600 hover:text-white font-semibold text-xs cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                      >
                        Assinar Mensal <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Trimestral */}
                    <div className="relative rounded-2xl border border-pink-500/40 bg-pink-500/[0.06] p-5 flex flex-col justify-between hover:border-pink-400 hover:bg-pink-500/[0.09] transition-all duration-300 shadow-[0_0_30px_rgba(244,63,94,0.15)]">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-extrabold text-[9px] uppercase tracking-wider px-3 py-0.5 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                          Mais Popular
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2 mt-1">
                          <span className="text-xs font-bold text-pink-300 uppercase tracking-wider">Trimestral</span>
                          <span className="text-[10px] text-white/40 font-mono">90 dias</span>
                        </div>
                        <p className="text-[11px] text-white/40 mb-4">Ideal para servidores em crescimento.</p>
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-xs text-white/50">R$</span>
                          <span className="text-3xl font-extrabold text-white font-display">
                            {((landingConfig?.master_quarterly_price_cents || 7290) / 100).toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                        <p className="text-[10px] text-pink-400 font-medium mb-5">
                          ~ R$ {((landingConfig?.master_quarterly_price_cents || 7290) / 300).toFixed(2).replace(".", ",")}/mês (90 dias)
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenPayment("master", "quarterly")}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 text-white hover:opacity-95 font-bold text-xs cursor-pointer border-none transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                      >
                        Assinar Trimestral <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Semestral */}
                    <div className="relative rounded-2xl border border-pink-500/20 bg-white/[0.02] p-5 flex flex-col justify-between hover:border-pink-500/50 hover:bg-pink-500/[0.04] transition-all duration-300">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 font-extrabold text-[9px] uppercase tracking-wider px-3 py-0.5 shadow-[0_0_10px_rgba(244,63,94,0.15)]">
                          Melhor Custo-Benefício
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2 mt-1">
                          <span className="text-xs font-bold text-pink-400 uppercase tracking-wider">Semestral</span>
                          <span className="text-[10px] text-white/40 font-mono">180 dias</span>
                        </div>
                        <p className="text-[11px] text-white/40 mb-4">6 meses com a maior economia por dia.</p>
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-xs text-white/50">R$</span>
                          <span className="text-3xl font-extrabold text-white font-display">
                            {((landingConfig?.master_semiannual_price_cents || 12990) / 100).toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-400 font-medium mb-5">
                          ~ R$ {((landingConfig?.master_semiannual_price_cents || 12990) / 600).toFixed(2).replace(".", ",")}/mês (180 dias)
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenPayment("master", "semiannual")}
                        className="w-full py-2.5 rounded-xl bg-pink-500/20 border border-pink-500/40 text-pink-300 hover:bg-pink-600 hover:text-white font-semibold text-xs cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                      >
                        Assinar Semestral <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            )}
          </div>
        </section>
      )}



      {/* ===== 8. FOOTER ===== */}
      <footer className="relative z-20 border-t border-white/10 py-5 px-4">
        <ScrollReveal>
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src={drikaLogo} alt="Drika" className="h-6 w-auto" />
              <span className="text-xs text-white/70 font-medium">© 2026 Drika Solutions</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://discord.gg/SYkAabH3AK" target="_blank" rel="noopener noreferrer" className="relative z-30 cursor-pointer text-white/70 hover:text-primary transition-colors" aria-label="Discord">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              </a>
              <a href="https://www.youtube.com/@DrikaHub" target="_blank" rel="noopener noreferrer" className="relative z-30 cursor-pointer text-white/70 hover:text-primary transition-colors" aria-label="YouTube">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
              <button onClick={() => navigate("/termos")} className="relative z-30 text-xs text-white/70 hover:text-white transition-colors bg-transparent border-none cursor-pointer font-medium">
                Termos
              </button>
            </div>
          </div>
        </ScrollReveal>
      </footer>

      {/* Floating Feedback Button */}
      <button
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-6 right-6 z-[60] flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-primary to-purple-600 text-white font-bold shadow-[0_0_20px_rgba(var(--primary),0.4)] hover:scale-105 hover:shadow-[0_0_30px_rgba(var(--primary),0.6)] active:scale-95 transition-all duration-300 border border-white/20"
      >
        <MessageSquareHeart className="h-5 w-5" />
        <span className="hidden sm:inline-block">Feedback</span>
      </button>

      {/* Feedback Modal */}
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
};

export default LandingPage;
