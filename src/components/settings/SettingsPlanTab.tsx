import { useState, useEffect, useCallback, useRef } from "react";
import { Sparkles, Crown, Loader2, Copy, Check, ExternalLink, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getPlanInfo } from "@/lib/plans";

interface Props {
  tenant: any;
  tenantId: string | null;
  refetchTenant: () => void;
}

const PIX_EXPIRATION_SECONDS = 15 * 60; // 15 minutes
const POLL_INTERVAL_MS = 8000; // Poll every 8 seconds

const SettingsPlanTab = ({ tenant, tenantId, refetchTenant }: Props) => {
  const [loading, setLoading] = useState(false);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pixExpired, setPixExpired] = useState(false);
  const [proPriceCents, setProPriceCents] = useState(2690);
  const [masterPriceCents, setMasterPriceCents] = useState(3090);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "master">("pro");
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isExpired = tenant.plan === "expired" || (tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date());
  const isFree = tenant.plan === "free" || !tenant.plan;
  const canUpgrade = isFree || isExpired;

  // Fetch prices from landing_config
  useEffect(() => {
    supabase.from("landing_config").select("pro_price_cents, master_price_cents").limit(1).single().then(({ data }) => {
      if (data?.pro_price_cents) setProPriceCents(data.pro_price_cents);
      if (data?.master_price_cents) setMasterPriceCents(data.master_price_cents);
    });
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Start polling when we have a paymentId
  const startPolling = useCallback((pid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription-status", {
          body: { payment_id: pid },
        });
        if (error) return;
        
        if (data?.status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPaymentConfirmed(true);
          setPixCode(null);
          toast({ title: "🎉 Pagamento confirmado!", description: "Seu plano Pro foi ativado com sucesso!" });
          refetchTenant();
        }
      } catch {
        // Silent fail, will retry
      }
    };

    // Immediate first check
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [refetchTenant]);

  const handleUpgrade = async (planType: "pro" | "master" = "pro") => {
    if (!tenantId) return;
    setLoading(true);
    setPaymentConfirmed(false);
    setSelectedPlan(planType);
    try {
      const { data, error } = await supabase.functions.invoke("generate-subscription-pix", {
        body: { tenant_id: tenantId, plan: planType },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Erro ao gerar PIX");
      setPixCode(data.brcode || data.qr_code || "");
      setQrCodeBase64(data.qr_code_base64 || null);
      setSecondsLeft(PIX_EXPIRATION_SECONDS);
      setPixExpired(false);
      
      const pid = data.payment_id;
      setPaymentId(pid);
      
      // Start auto-polling for payment confirmation
      if (pid) {
        startPolling(pid);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!pixCode || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setPixExpired(true);
          // Stop polling when expired
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pixCode, secondsLeft > 0]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleCopy = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    toast({ title: "Código PIX copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualCheck = async () => {
    if (!paymentId) {
      refetchTenant();
      return;
    }
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription-status", {
        body: { payment_id: paymentId },
      });
      if (error) throw error;
      
      if (data?.status === "paid") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setPaymentConfirmed(true);
        setPixCode(null);
        toast({ title: "🎉 Pagamento confirmado!", description: "Seu plano Pro foi ativado!" });
        refetchTenant();
      } else {
        toast({ title: "Aguardando pagamento", description: "O pagamento ainda não foi identificado. Tente novamente em alguns segundos." });
      }
    } catch {
      toast({ title: "Erro ao verificar", variant: "destructive" });
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="wallet-section">
      <div className="wallet-section-header mb-5">
        <div className="wallet-section-icon">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-foreground font-display font-semibold text-sm">Plano Atual</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Detalhes da sua assinatura</p>
        </div>
      </div>

      {/* Payment confirmed banner */}
      {paymentConfirmed && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 mb-4 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">Pagamento confirmado!</p>
            <p className="text-xs text-muted-foreground">Seu plano Pro está ativo por 30 dias.</p>
          </div>
        </div>
      )}

      {/* Plan info card */}
      <div className="rounded-xl bg-muted/50 border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold text-gradient-pink capitalize">
              {isExpired ? "Expirado" : tenant.plan === "master" ? "Master" : tenant.plan === "pro" ? "Pro" : "Free (Trial)"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Plano ativo</p>
          </div>
          <span className={`wallet-tx-badge ${isExpired ? "failed" : "completed"}`}>
            {isExpired ? "Expirado" : "Ativo"}
          </span>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          {tenant.plan_started_at && (
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Início</p>
              <p className="text-sm font-medium text-foreground mt-1">
                {new Date(tenant.plan_started_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
          )}
          {tenant.plan_expires_at && (
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Expira em</p>
              <p className={`text-sm font-medium mt-1 ${new Date(tenant.plan_expires_at) < new Date() ? "text-destructive" : "text-emerald-400"}`}>
                {new Date(tenant.plan_expires_at).toLocaleDateString("pt-BR")}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {(() => {
                  const diff = Math.ceil((new Date(tenant.plan_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  if (diff < 0) return `Expirou há ${Math.abs(diff)} dia(s)`;
                  if (diff === 0) return "Expira hoje";
                  return `Faltam ${diff} dia(s)`;
                })()}
              </p>
            </div>
          )}
        </div>

        {/* Subscribe button inside plan card - hidden in favor of cards below */}
      </div>

      {/* Upgrade section (Plans side by side) */}
      {canUpgrade && !pixCode && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 relative overflow-hidden shadow-2xl">
            {/* Logo */}
            <img src="/logo.png" alt="Drika Hub" className="h-10 mb-4 object-contain opacity-90 drop-shadow-md" />
            
            <div className="text-center mb-6 z-10">
              <h4 className="text-lg font-bold text-white">Escolha o seu plano</h4>
              <p className="text-xs text-white/60 mt-1">Acesso completo a todas as funcionalidades da plataforma</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full z-10">
              {/* Pro Plan */}
              <div className="relative rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col items-center hover:bg-white/10 transition-colors">
                <Crown className="h-6 w-6 text-pink-500 mb-2" />
                <h5 className="text-base font-bold text-white">Plano Pro</h5>
                <p className="text-2xl font-extrabold text-white my-3">
                  R$ {(proPriceCents / 100).toFixed(2).replace(".", ",")}
                  <span className="text-xs font-normal text-white/60">/mês</span>
                </p>
                <Button
                  onClick={() => handleUpgrade("pro")}
                  disabled={loading}
                  className="w-full rounded-full bg-pink-600 hover:bg-pink-700 text-white border-none h-11 transition-all"
                >
                  {loading && selectedPlan === "pro" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
                  Ativar Pro
                </Button>
              </div>

              {/* Master Plan */}
              <div className="relative rounded-xl border border-purple-500/30 bg-purple-500/10 p-5 flex flex-col items-center hover:bg-purple-500/20 transition-colors shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                <div className="absolute -top-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                  Recomendado
                </div>
                <Crown className="h-6 w-6 text-purple-400 mb-2" />
                <h5 className="text-base font-bold text-white">Plano Master</h5>
                <p className="text-2xl font-extrabold text-white my-3">
                  R$ {(masterPriceCents / 100).toFixed(2).replace(".", ",")}
                  <span className="text-xs font-normal text-white/60">/mês</span>
                </p>
                <Button
                  onClick={() => handleUpgrade("master")}
                  disabled={loading}
                  className="w-full rounded-full bg-purple-600 hover:bg-purple-700 text-white border-none h-11 transition-all"
                >
                  {loading && selectedPlan === "master" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
                  Ativar Master
                </Button>
              </div>
            </div>
            
            {/* Background glow effects */}
            <div className="absolute top-1/2 -left-10 w-32 h-32 bg-pink-500/20 rounded-full blur-[60px] pointer-events-none" />
            <div className="absolute bottom-0 -right-10 w-32 h-32 bg-purple-500/20 rounded-full blur-[60px] pointer-events-none" />
          </div>
        </div>
      )}

      {/* PIX Payment Section */}
      {canUpgrade && pixCode && (
        <div className="mt-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-6 space-y-4">
          <div className="flex flex-col items-center justify-center mb-4">
            <h4 className="text-lg font-bold text-white">Pagamento do Plano {selectedPlan === "master" ? "Master" : "Pro"}</h4>
            <p className="text-2xl font-extrabold text-white mt-1">R$ {((selectedPlan === "master" ? masterPriceCents : proPriceCents) / 100).toFixed(2).replace(".", ",")}</p>
          </div>

          {!pixExpired ? (
            <div className="space-y-4">
              {/* Timer */}
              <div className={`flex items-center justify-center gap-2 rounded-lg py-2 px-3 mx-auto w-fit ${
                secondsLeft <= 120 ? "bg-destructive/20 text-red-400" : "bg-amber-500/20 text-amber-400"
              }`}>
                <Clock className="h-4 w-4" />
                <span className="text-sm font-mono font-semibold">{formatTime(secondsLeft)}</span>
                <span className="text-xs">para pagar</span>
              </div>

              {qrCodeBase64 && (
                <div className="flex justify-center my-4">
                  <div className="bg-white p-3 rounded-2xl">
                    <img
                      src={qrCodeBase64}
                      alt="QR Code PIX"
                      className="w-48 h-48"
                    />
                  </div>
                </div>
              )}
              
              <p className="text-sm text-white/80 text-center">Copie o código PIX e pague pelo seu banco:</p>
              
              <div className="rounded-xl border border-white/10 bg-black/40 p-4 relative group">
                <code className="block text-xs font-mono text-white break-all leading-relaxed text-center">
                  {pixCode}
                </code>
              </div>
              
              <button
                onClick={handleCopy}
                className={`w-full h-12 flex items-center justify-center gap-2 rounded-full font-medium text-base cursor-pointer border-none transition-all ${
                  copied ? "bg-emerald-500 text-white" : "bg-white text-black hover:bg-white/90"
                }`}
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                {copied ? "Copiado!" : "Copiar Código PIX"}
              </button>
              
              <div className="flex flex-col items-center gap-3 pt-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <p className="text-xs text-white/60">
                    Verificando pagamento automaticamente...
                  </p>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <Button 
                    onClick={handleManualCheck} 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-white/50 hover:text-white"
                    disabled={checkingStatus}
                  >
                    {checkingStatus ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Já paguei
                  </Button>
                  <span className="text-white/20">|</span>
                  <Button 
                    onClick={() => setPixCode(null)} 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-white/50 hover:text-white"
                  >
                    Trocar plano
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 rounded-lg py-3 px-3 bg-destructive/20 text-red-400 mx-auto w-fit">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-semibold">PIX expirado</span>
              </div>
              <p className="text-xs text-white/60 text-center">O tempo para pagamento acabou. Gere um novo código.</p>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => setPixCode(null)}
                  variant="outline"
                  className="w-full h-11 rounded-full border-white/20 text-white hover:bg-white/10"
                >
                  Voltar
                </Button>
                <Button
                  onClick={() => handleUpgrade(selectedPlan)}
                  disabled={loading}
                  className={`w-full h-11 rounded-full text-white border-none hover:opacity-90 ${selectedPlan === 'master' ? 'bg-purple-600' : 'bg-pink-600'}`}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
                  Gerar novo PIX
                </Button>
              </div>
            </div>
          )}

          <div className="pt-4 mt-4 border-t border-white/10 flex justify-center">
            <a
              href={`https://wa.me/5548996915303?text=Quero%20ativar%20o%20plano%20${selectedPlan === 'master' ? 'Master' : 'Pro'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ou fale com o suporte
            </a>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="rounded-xl bg-muted/50 border border-border p-4 text-center">
          <p className="text-lg font-bold text-foreground">∞</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Produtos</p>
        </div>
        <div className="rounded-xl bg-muted/50 border border-border p-4 text-center">
          <p className="text-lg font-bold text-foreground">∞</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Vendas</p>
        </div>
        <div className="rounded-xl bg-muted/50 border border-border p-4 text-center">
          <p className="text-lg font-bold text-foreground">24/7</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Suporte</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPlanTab;
