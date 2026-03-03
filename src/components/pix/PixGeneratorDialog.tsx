import { useState } from "react";
import { QrCode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import PixQRCode from "./PixQRCode";

interface PixGeneratorDialogProps {
  productName?: string;
  amountCents?: number;
  trigger?: React.ReactNode;
}

const PixGeneratorDialog = ({ productName, amountCents, trigger }: PixGeneratorDialogProps) => {
  const { tenantId } = useTenant();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brcode, setBrcode] = useState("");
  const [amount, setAmount] = useState(amountCents ? (amountCents / 100).toFixed(2) : "");
  const [customAmount, setCustomAmount] = useState(amountCents ? (amountCents / 100).toFixed(2) : "");

  const handleGenerate = async () => {
    if (!tenantId) return;
    setLoading(true);
    setBrcode("");
    try {
      const cents = Math.round(parseFloat(customAmount || "0") * 100);
      const { data, error } = await supabase.functions.invoke("generate-pix", {
        body: {
          tenant_id: tenantId,
          amount_cents: cents > 0 ? cents : undefined,
          product_name: productName,
          tx_id: `PIX${Date.now()}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBrcode(data.brcode);
      setAmount(data.amount || null);
    } catch (err: any) {
      toast({ title: "Erro ao gerar PIX", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <QrCode className="h-4 w-4 mr-1.5" /> Gerar PIX
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Gerar PIX {productName && `— ${productName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {!brcode ? (
            <>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00 (deixe vazio para valor livre)"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  className="bg-muted border-none font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Deixe vazio para gerar um PIX sem valor definido
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
                  <><QrCode className="h-4 w-4 mr-2" /> Gerar QR Code PIX</>
                )}
              </Button>
            </>
          ) : (
            <>
              <PixQRCode brcode={brcode} amount={amount} size={220} />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setBrcode(""); setAmount(""); }}
              >
                Gerar Novo
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PixGeneratorDialog;
