import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crown, Copy, Check, ExternalLink } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";

const ProUpgradeModal = () => {
  const [open, setOpen] = useState(false);
  const { tenant, tenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const pending = sessionStorage.getItem("pending_pro_upgrade");
    if (pending === "true" && tenantId) {
      setOpen(true);
      sessionStorage.removeItem("pending_pro_upgrade");
      generatePix();
    }
  }, [tenantId]);

  const generatePix = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pix", {
        body: {
          tenant_id: tenantId,
          amount_cents: 2690,
          description: "Drika Solutions Pro - Mensal",
        },
      });
      if (error) throw error;
      if (data?.pix_code) {
        setPixCode(data.pix_code);
      } else if (data?.qr_code_text) {
        setPixCode(data.qr_code_text);
      }
    } catch (err: any) {
      console.error("Error generating PIX:", err);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    toast({ title: "Código PIX copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <p className="text-3xl font-extrabold text-foreground">R$ 26,90<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : pixCode ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">Copie o código PIX abaixo e pague pelo seu banco:</p>
              <div className="rounded-2xl border border-primary/20 bg-muted/50 p-4">
                <code className="block text-xs font-mono text-primary break-all leading-relaxed text-center">
                  {pixCode}
                </code>
              </div>
              <button
                onClick={handleCopy}
                className={`w-full h-11 flex items-center justify-center gap-2 rounded-full font-medium text-base cursor-pointer border-none transition-all ${
                  copied
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-muted text-foreground hover:bg-accent"
                }`}
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                {copied ? "Copiado!" : "Copiar Código PIX"}
              </button>
              <p className="text-[11px] text-muted-foreground text-center">
                Após o pagamento, seu plano será ativado automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Entre em contato com nosso suporte para ativar o plano Pro via PIX.
              </p>
              <a
                href="https://wa.me/5548996915303?text=Quero%20ativar%20o%20plano%20Drika%20Solutions%20Pro"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer border-none transition-all"
              >
                <ExternalLink className="h-4 w-4" />
                Falar com Suporte
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProUpgradeModal;
