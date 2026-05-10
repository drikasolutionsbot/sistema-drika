import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import PixQRCode from "@/components/pix/PixQRCode";

interface Props {
  trigger?: React.ReactNode;
  onCredited?: () => void;
}

interface DepositResult {
  tx_id: string;
  brcode: string;
  qr_code_base64: string | null;
  amount: string;
  provider: string | null;
  expires_at: string | null;
}

const WalletDepositDialog = ({ trigger, onCredited }: Props) => {
  const { tenantId } = useTenant();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DepositResult | null>(null);
  const [paid, setPaid] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!result?.tx_id || paid) return;
    const tick = async () => {
      try {
        const { data } = await supabase.functions.invoke("wallet-pix-deposit", {
          body: { tenant_id: tenantId, tx_id: result.tx_id, action: "check" },
        });
        if (data?.status === "completed") {
          setPaid(true);
          toast({ title: "Depósito recebido!", description: "Saldo creditado na carteira." });
          onCredited?.();
        }
      } catch {/* ignore */}
    };
    pollRef.current = window.setInterval(tick, 4000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [result?.tx_id, paid, tenantId, onCredited]);

  const handleGenerate = async () => {
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!cents || cents <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-pix-deposit", {
        body: { tenant_id: tenantId, amount_cents: cents },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (err: any) {
      toast({ title: "Erro ao gerar PIX", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setPaid(false);
    setAmount("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2 bg-emerald-500/90 hover:bg-emerald-500 text-white border-none">
            <ArrowDownLeft className="h-4 w-4" /> Depositar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-emerald-400" />
            Depositar via PIX
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {!result ? (
            <>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-muted border-none font-mono text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Será gerado um PIX dinâmico via gateway ativo. O saldo é creditado automaticamente após o pagamento.
                </p>
              </div>
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando...</>
                ) : (
                  <>Gerar PIX</>
                )}
              </Button>
            </>
          ) : paid ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-14 w-14 text-emerald-400" />
              <p className="text-foreground font-semibold">Pagamento confirmado!</p>
              <p className="text-sm text-muted-foreground">Saldo creditado na carteira.</p>
              <Button variant="outline" className="mt-2" onClick={() => setOpen(false)}>
                Fechar
              </Button>
            </div>
          ) : (
            <>
              <PixQRCode
                brcode={result.brcode}
                amount={result.amount}
                size={220}
                method="dynamic"
                provider={result.provider}
                qrCodeBase64={result.qr_code_base64}
                expiresAt={result.expires_at}
              />
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Aguardando pagamento...
              </div>
              <Button variant="outline" className="w-full" onClick={reset}>
                Gerar outro
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletDepositDialog;
