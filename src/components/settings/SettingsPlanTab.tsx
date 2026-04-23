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
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isExpired = tenant.plan === "expired" || (tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date());
  const isFree = tenant.plan === "free" || !tenant.plan;
  const canUpgrade = isFree || isExpired;

  // Fetch pro price from landing_config
  useEffect(() => {
    supabase.from("landing_config").select("pro_price_cents").limit(1).single().then(({ data }) => {
      if (data?.pro_price_cents) setProPriceCents(data.pro_price_cents);
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

  const handleUpgrade = async () => {
    if (!tenantId) return;
    setLoading(true);
    setPaymentConfirmed(false);
    try {
      const { data, error } = await supabase.functions.invoke("generate-subscription-pix", {
        body: { tenant_id: tenantId },
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

        {/* Subscribe button inside plan card */}
        {canUpgrade && (
          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full gradient-pink text-primary-foreground border-none gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
            Assine o Plano Pro
          </Button>
        )}
      </div>

      {/* Upgrade section */}
      {canUpgrade && (
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Atualizar para Pro</h4>
              <p className="text-xs text-muted-foreground">Acesso completo a todas as funcionalidades</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-3xl font-extrabold text-foreground">R$ {(proPriceCents / 100).toFixed(2).replace(".", ",")}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
          </div>

          {pixCode && !pixExpired ? (
            <div className="space-y-3">
              {/* Timer */}
              <div className={`flex items-center justify-center gap-2 rounded-lg py-2 px-3 ${
                secondsLeft <= 120 ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-400"
              }`}>
                <Clock className="h-4 w-4" />
                <span className="text-sm font-mono font-semibold">{formatTime(secondsLeft)}</span>
                <span className="text-xs">para pagar</span>
              </div>

              {qrCodeBase64 && (
                <div className="flex justify-center">
                  <img
                    src={qrCodeBase64}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-xl border border-border"
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground text-center">Copie o código PIX e pague pelo seu banco:</p>
              <div className="rounded-xl border border-primary/20 bg-muted/50 p-4">
                <code className="block text-xs font-mono text-primary break-all leading-relaxed text-center">
                  {pixCode}
                </code>
              </div>
              <button
                onClick={handleCopy}
                className={`w-full h-11 flex items-center justify-center gap-2 rounded-full font-medium text-base cursor-pointer border-none transition-all ${
                  copied ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-foreground hover:bg-accent"
                }`}
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                {copied ? "Copiado!" : "Copiar Código PIX"}
              </button>
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Verificando pagamento automaticamente...
                  </p>
                </div>
                <Button 
                  onClick={handleManualCheck} 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-muted-foreground"
                  disabled={checkingStatus}
                >
                  {checkingStatus ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Já paguei — verificar agora
                </Button>
              </div>
            </div>
          ) : pixExpired ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 rounded-lg py-3 px-3 bg-destructive/10 text-destructive">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-semibold">PIX expirado</span>
              </div>
              <p className="text-xs text-muted-foreground text-center">O tempo para pagamento acabou. Gere um novo código.</p>
              <Button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full h-11 rounded-full gradient-pink text-primary-foreground border-none hover:opacity-90"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
                Gerar novo PIX
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full h-11 rounded-full gradient-pink text-primary-foreground border-none hover:opacity-90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
              {isExpired ? "Renovar Plano Pro via PIX" : "Ativar Plano Pro via PIX"}
            </Button>
          )}

          <a
            href="https://wa.me/5548996915303?text=Quero%20ativar%20o%20plano%20Pro"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ou fale com o suporte
          </a>
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
