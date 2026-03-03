import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Copy, Check, Loader2, QrCode as QrCodeIcon, Zap, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface PixQRCodeProps {
  brcode: string;
  amount?: string | null;
  size?: number;
  method?: "static" | "dynamic";
  provider?: string | null;
  qrCodeBase64?: string | null;
  expiresAt?: string | null;
}

const PixQRCode = ({ brcode, amount, size = 200, method, provider, qrCodeBase64, expiresAt }: PixQRCodeProps) => {
  const [svgData, setSvgData] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (qrCodeBase64) {
      setLoading(false);
      setSvgData("");
      return;
    }
    if (!brcode) return;
    setLoading(true);
    QRCode.toString(brcode, {
      type: "svg",
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((svg) => {
        setSvgData(svg);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brcode, size, qrCodeBase64]);

  const handleCopy = () => {
    navigator.clipboard.writeText(brcode);
    setCopied(true);
    toast({ title: "PIX Copia e Cola copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (!brcode) return null;

  const providerLabel: Record<string, string> = {
    mercadopago: "Mercado Pago",
    pushinpay: "PushinPay",
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Method badge */}
      {method && (
        <Badge variant={method === "dynamic" ? "default" : "secondary"} className="gap-1.5">
          {method === "dynamic" ? <Zap className="h-3 w-3" /> : <Key className="h-3 w-3" />}
          {method === "dynamic"
            ? `PIX Dinâmico — ${providerLabel[provider || ""] || provider}`
            : "PIX Estático — Chave PIX"}
        </Badge>
      )}

      {/* QR Code */}
      <div className="rounded-xl bg-white p-4 shadow-lg">
        {loading ? (
          <div className="flex items-center justify-center" style={{ width: size, height: size }}>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : qrCodeBase64 ? (
          <img
            src={qrCodeBase64.startsWith("data:") ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`}
            alt="QR Code PIX"
            width={size}
            height={size}
          />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: svgData }} />
        )}
      </div>

      {/* Amount */}
      {amount && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Valor</p>
          <p className="text-xl font-bold text-foreground">R$ {amount}</p>
        </div>
      )}

      {/* Expiration */}
      {expiresAt && (
        <p className="text-xs text-muted-foreground">
          Expira em: {new Date(expiresAt).toLocaleString("pt-BR")}
        </p>
      )}

      {/* Copy Paste */}
      <div className="w-full max-w-sm space-y-2">
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
          <QrCodeIcon className="h-3 w-3" />
          PIX Copia e Cola
        </p>
        <div className="relative">
          <div className="rounded-lg bg-muted px-3 py-2 pr-20 font-mono text-xs break-all max-h-16 overflow-y-auto">
            {brcode}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="absolute right-1 top-1"
            onClick={handleCopy}
          >
            {copied ? (
              <><Check className="h-3.5 w-3.5 mr-1" /> Copiado</>
            ) : (
              <><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PixQRCode;
