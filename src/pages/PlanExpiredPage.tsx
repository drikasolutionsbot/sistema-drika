import { useState } from "react";
import { ShieldOff, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import drikaLogo from "@/assets/drika_logo_crown.png";

const PlanExpiredPage = () => {
  const { tenant, refetch } = useTenant();
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ brcode: string; amount_cents: number } | null>(null);

  const handleRenew = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-subscription-pix", {
        body: { tenant_id: tenant.id },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao gerar pagamento");
      setPixData({ brcode: data.brcode, amount_cents: data.amount_cents });
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar pagamento. Contacte o suporte.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (pixData?.brcode) {
      navigator.clipboard.writeText(pixData.brcode);
      toast.success("Código PIX copiado!");
    }
  };

  const planLabel = tenant?.plan === "pro" ? "Pro" : "Teste Grátis (4 dias)";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden login-pattern-bg">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10" />
      <div className="relative z-20 w-full max-w-md mx-4 animate-fade-in">
        <div className="rounded-3xl border border-destructive/20 bg-[#1a1a2e]/95 backdrop-blur-xl p-8 shadow-[0_0_60px_rgba(255,40,73,0.15)] text-center">
          <img src={drikaLogo} alt="Drika Solutions" className="h-20 w-auto mx-auto mb-6 drop-shadow-[0_0_20px_hsl(330_100%_71%/0.4)]" />
          
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-destructive/20 border-2 border-destructive/40 flex items-center justify-center">
              <ShieldOff className="h-8 w-8 text-destructive" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            {tenant?.plan === "pro" ? "Assinatura Expirada" : "Período de Teste Encerrado"}
          </h1>
          <p className="text-white/60 text-sm mb-6">
            Seu plano <span className="text-primary font-semibold">{planLabel}</span> expirou. 
            O acesso ao painel foi bloqueado até a renovação.
          </p>

          {pixData ? (
            <div className="space-y-4 mb-6">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-white/80 text-xs mb-2">Copie o código PIX abaixo e pague para renovar:</p>
                <div className="bg-black/30 rounded-lg p-3 break-all text-xs text-white/90 font-mono max-h-24 overflow-y-auto">
                  {pixData.brcode}
                </div>
                <p className="text-primary text-sm font-semibold mt-2">
                  R$ {(pixData.amount_cents / 100).toFixed(2)}
                </p>
              </div>
              <Button onClick={handleCopyPix} className="w-full rounded-full" variant="outline">
                <QrCode className="h-4 w-4 mr-2" />
                Copiar código PIX
              </Button>
              <Button onClick={() => refetch()} variant="ghost" className="w-full text-white/60 text-xs">
                Já paguei — verificar status
              </Button>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              <Button
                onClick={handleRenew}
                disabled={loading}
                className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-white font-medium"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Renovar Plano Pro via PIX
              </Button>

              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-white/80 text-sm">
                  Ou entre em contato com o suporte para renovar manualmente.
                </p>
              </div>
            </div>
          )}

          <a
            href="https://wa.me/5548996915303"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-base tracking-wide cursor-pointer border-none transition-colors"
          >
            Falar com Suporte via WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
};

export default PlanExpiredPage;
