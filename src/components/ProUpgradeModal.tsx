import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crown, Copy, Check, Loader2, QrCode } from "lucide-react";
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
}

const ProUpgradeModal = () => {
  const [open, setOpen] = useState(false);
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [pixResult, setPixResult] = useState<PixResult | null>(null);
  const [proPriceCents, setProPriceCents] = useState(2690);

  // Fetch pro price from landing_config
  useEffect(() => {
    supabase.from("landing_config").select("pro_price_cents").limit(1).single().then(({ data }) => {
      if (data?.pro_price_cents) setProPriceCents(data.pro_price_cents);
    });
  }, []);

  useEffect(() => {
    const checkPending = () => {
      const pending = sessionStorage.getItem("pending_pro_upgrade");
      if (pending === "true" && tenantId) {
        setOpen(true);
        sessionStorage.removeItem("pending_pro_upgrade");
        generatePix();
      }
    };
    checkPending();
    window.addEventListener("storage", checkPending);
    return () => window.removeEventListener("storage", checkPending);
  }, [tenantId]);

  const generatePix = async () => {
    if (!tenantId) return;
    setLoading(true);
    setPixResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-subscription-pix", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setPixResult({
        brcode: data.brcode || data.pix_code || "",
        amount: data.amount || (proPriceCents / 100).toFixed(2),
        method: data.method || "dynamic",
        provider: data.provider || null,
        qr_code_base64: data.qr_code_base64 || null,
        expires_at: data.expires_at || null,
      });
    } catch (err: any) {
      console.error("Error generating PIX:", err);
      toast({ 
        title: "Erro ao gerar PIX", 
        description: err.message || "Tente novamente",
        variant: "destructive" 
      });
    }
    setLoading(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !pixResult && !loading) {
      generatePix();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card/95 backdrop-blur-xl border-primary/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-foreground flex flex-col items-center gap-3">
            <img src={drikaLogo} alt="Drika" className="h-16 w-auto" />
            <span className="text-xl font-bold">Ativar Drika Solutions Pro</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary mb-3">
              <Crown className="h-4 w-4" /> Plano Mensal
            </div>
            <p className="text-3xl font-extrabold text-foreground">
              R$ {(proPriceCents / 100).toFixed(2).replace(".", ",")}
              <span className="text-sm font-normal text-muted-foreground">/mês</span>
            </p>
          </div>

          {loading ? (
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
                Clique abaixo para gerar o código PIX e ativar seu plano Pro.
              </p>
              <Button
                onClick={generatePix}
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
