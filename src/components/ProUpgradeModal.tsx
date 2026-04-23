import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crown, Loader2, QrCode, CheckCircle } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";
import PixQRCode from "@/components/pix/PixQRCode";

interface PixResult {
  brcode: string;
  amount: string | null;
  method: "static" | "dynamic";
  provider: string | null;
  qr_code_base64: string | null;
  expires_at: string | null;
  payment_id: string | null;
}

type PlanKey = "pro" | "master";

/**
 * Helper público para abrir o modal de upgrade.
 * Aceita "pro" (default) ou "master".
 *
 *   import { openUpgradeModal } from "@/components/ProUpgradeModal";
 *   openUpgradeModal("master");
 */
export function openUpgradeModal(plan: PlanKey = "pro") {
  sessionStorage.setItem("pending_pro_upgrade", "true");
  sessionStorage.setItem("pending_pro_upgrade_plan", plan);
  window.dispatchEvent(new Event("pending_pro_upgrade"));
}

const ProUpgradeModal = () => {
  const [open, setOpen] = useState(false);
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [pixResult, setPixResult] = useState<PixResult | null>(null);
  const [proPriceCents, setProPriceCents] = useState(2690);
  const [masterPriceCents, setMasterPriceCents] = useState(3090);
  const [planKey, setPlanKey] = useState<PlanKey>("pro");
  const [confirmed, setConfirmed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase
      .from("landing_config")
      .select("pro_price_cents, master_price_cents")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.pro_price_cents) setProPriceCents(data.pro_price_cents);
        if (data?.master_price_cents) setMasterPriceCents(data.master_price_cents);
      });
  }, []);

  useEffect(() => {
    const checkPending = () => {
      const pending = sessionStorage.getItem("pending_pro_upgrade");
      if (pending === "true" && tenantId) {
        const requested = (sessionStorage.getItem("pending_pro_upgrade_plan") as PlanKey) || "pro";
        sessionStorage.removeItem("pending_pro_upgrade");
        sessionStorage.removeItem("pending_pro_upgrade_plan");
        setPlanKey(requested);
        setOpen(true);
        generatePix(requested);
      }
    };
    checkPending();
    const handler = () => checkPending();
    window.addEventListener("pending_pro_upgrade", handler);
    return () => {
      window.removeEventListener("pending_pro_upgrade", handler);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [tenantId]);

  const startPolling = (paymentId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("check-subscription-status", {
          body: { payment_id: paymentId },
        });
        if (data?.status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          setConfirmed(true);
          toast({
            title: "Pagamento confirmado!",
            description: `Seu plano ${planKey === "master" ? "Master" : "Pro"} foi ativado.`,
          });
          // Reload after a moment to refresh plan status
          setTimeout(() => window.location.reload(), 3000);
        }
      } catch { /* ignore */ }
    }, 4000);
  };

  const generatePix = async (planOverride?: PlanKey) => {
    if (!tenantId) return;
    const plan = planOverride || planKey;
    setLoading(true);
    setPixResult(null);
    setConfirmed(false);
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      const { data, error } = await supabase.functions.invoke("generate-subscription-pix", {
        body: { tenant_id: tenantId, ref_code: null, plan },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const paymentId = data.payment_id || null;
      const fallbackPrice = plan === "master" ? masterPriceCents : proPriceCents;
      setPixResult({
        brcode: data.brcode || data.pix_code || "",
        amount: data.amount || (fallbackPrice / 100).toFixed(2),
        method: data.method || "dynamic",
        provider: data.provider || null,
        qr_code_base64: data.qr_code_base64 || null,
        expires_at: data.expires_at || null,
        payment_id: paymentId,
      });
      if (paymentId) startPolling(paymentId);
    } catch (err: any) {
      console.error("Error generating PIX:", err);
      toast({
        title: "Erro ao gerar PIX",
        description: err.message || "Tente novamente",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setPixResult(null);
      setConfirmed(false);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  };

  const isMaster = planKey === "master";
  const priceCents = isMaster ? masterPriceCents : proPriceCents;
  const planLabel = isMaster ? "Master" : "Pro";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card/95 backdrop-blur-xl border-primary/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-foreground flex flex-col items-center gap-3">
            <img src={drikaLogo} alt="Drika" className="h-16 w-auto" />
            <span className="text-xl font-bold">Ativar Drika Hub {planLabel}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary mb-3">
              <Crown className="h-4 w-4" /> Plano {planLabel} Mensal
            </div>
            <p className="text-3xl font-extrabold text-foreground">
              R$ {(priceCents / 100).toFixed(2).replace(".", ",")}
              <span className="text-sm font-normal text-muted-foreground">/mês</span>
            </p>
          </div>

          {confirmed ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
              <p className="text-lg font-bold text-emerald-400">Pagamento Confirmado!</p>
              <p className="text-sm text-muted-foreground">Recarregando painel...</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando PIX...</p>
            </div>
          ) : pixResult?.brcode ? (
            <div className="space-y-4">
              <PixQRCode
                brcode={pixResult.brcode}
                amount={pixResult.amount}
                size={200}
                method={pixResult.method}
                provider={pixResult.provider}
                qrCodeBase64={pixResult.qr_code_base64}
                expiresAt={pixResult.expires_at}
              />
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aguardando confirmação do pagamento...
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Após o pagamento, seu plano será ativado automaticamente.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setPixResult(null);
                  generatePix();
                }}
              >
                <QrCode className="h-4 w-4 mr-2" />
                Gerar Novo PIX
              </Button>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Clique abaixo para gerar o código PIX e ativar seu plano {planLabel}.
              </p>
              <Button
                onClick={() => generatePix()}
                className="w-full bg-primary hover:bg-primary/90"
                disabled={loading}
              >
                <QrCode className="h-4 w-4 mr-2" />
                Gerar PIX
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProUpgradeModal;
