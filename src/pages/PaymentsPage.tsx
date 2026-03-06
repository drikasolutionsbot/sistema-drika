import { CreditCard, Check, AlertCircle, Copy, Loader2, CheckCircle2, XCircle, ExternalLink, Eye, EyeOff, Zap, Upload, ShieldCheck, Key } from "lucide-react";
import * as forge from "node-forge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import WebhookLogsPanel from "@/components/payments/WebhookLogsPanel";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "krudxivcuygykoswjbbx";

// Retry helper for cold-start edge function failures
async function invokeWithRetry(fnName: string, body: any, retries = 2): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    try {
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) {
        if (i < retries) { await new Promise(r => setTimeout(r, 1500)); continue; }
        throw error;
      }
      return data;
    } catch (err) {
      if (i < retries) { await new Promise(r => setTimeout(r, 1500)); continue; }
      throw err;
    }
  }
}

const providers = [
  {
    key: "mercadopago",
    name: "Mercado Pago",
    color: "bg-blue-500/10 text-blue-400",
    docsUrl: "https://www.mercadopago.com.br/developers/pt/docs",
    fields: [
      { key: "api_key", label: "Access Token", placeholder: "APP_USR-..." },
    ],
    instructions: "Acesse Mercado Pago Developers > Suas integrações > Credenciais de produção e copie o Access Token.",
  },
  {
    key: "pushinpay",
    name: "PushinPay",
    color: "bg-orange-500/10 text-orange-400",
    docsUrl: "https://pushinpay.com.br",
    fields: [
      { key: "api_key", label: "API Token", placeholder: "pk_live_..." },
    ],
    instructions: "No painel PushinPay, vá em Configurações > API e copie o token de produção.",
  },
  {
    key: "efi",
    name: "Efí (Gerencianet)",
    color: "bg-emerald-500/10 text-emerald-400",
    docsUrl: "https://dev.efipay.com.br",
    fields: [
      { key: "api_key", label: "Client ID", placeholder: "Client_Id_..." },
      { key: "secret_key", label: "Client Secret", placeholder: "Client_Secret_..." },
    ],
    instructions: "No painel Efí, acesse API > Aplicações > Credenciais de Produção e copie Client ID e Client Secret.",
    requiresCert: true,
  },
  {
    key: "misticpay",
    name: "Mistic Pay",
    color: "bg-purple-500/10 text-purple-400",
    docsUrl: "https://misticpay.com",
    fields: [
      { key: "api_key", label: "API Token", placeholder: "mst_live_..." },
    ],
    instructions: "No painel Mistic Pay, vá em Integrações > API Keys e copie o token.",
  },
];

interface PaymentProvider {
  id: string;
  provider_key: string;
  api_key_encrypted: string | null;
  secret_key_encrypted: string | null;
  active: boolean;
  efi_cert_pem?: string | null;
  efi_key_pem?: string | null;
  efi_pix_key?: string | null;
}

const PaymentsPage = () => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery<PaymentProvider[]>({
    queryKey: ["payment-providers", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const data = await invokeWithRetry("manage-payment-providers", { action: "list", tenant_id: tenantId });
      if (data?.error) throw new Error(data.error);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["payment-providers", tenantId] });

  // Realtime subscription for payment_providers changes
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("payment-providers-realtime")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "payment_providers", filter: `tenant_id=eq.${tenantId}` },
        () => { refetch(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const getConfig = (key: string) => configs.find(c => c.provider_key === key);

  const handleSave = async (providerKey: string, apiKey: string, secretKey: string, extra?: { efi_cert_pem?: string; efi_key_pem?: string; efi_pix_key?: string }) => {
    if (!tenantId) return;
    try {
      const data = await invokeWithRetry("manage-payment-providers", {
        action: "upsert",
        tenant_id: tenantId,
        provider_key: providerKey,
        api_key: apiKey,
        secret_key: secretKey,
        ...extra,
      });
      if (data?.error) throw new Error(data.error);
      refetch();
      toast({ title: "Provedor salvo e ativado!" });
    } catch (err: any) {
      console.error("Erro ao salvar provedor:", err);
      toast({ title: "Erro ao salvar provedor", description: err.message, variant: "destructive" });
    }
  };

  const handleToggle = async (providerId: string, currentActive: boolean) => {
    // Optimistic update
    queryClient.setQueryData(["payment-providers", tenantId], (old: PaymentProvider[] | undefined) =>
      (old || []).map(p => p.id === providerId ? { ...p, active: !p.active } : p)
    );
    try {
      const data = await invokeWithRetry("manage-payment-providers", {
        action: "toggle",
        tenant_id: tenantId,
        provider_id: providerId,
      });
      if (data?.error) throw new Error(data.error);
      refetch();
    } catch (err: any) {
      // Revert optimistic update
      queryClient.setQueryData(["payment-providers", tenantId], (old: PaymentProvider[] | undefined) =>
        (old || []).map(p => p.id === providerId ? { ...p, active: currentActive } : p)
      );
      toast({ title: "Erro ao alternar provedor", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Pagamentos</h1>
        <p className="text-muted-foreground">Configure seus provedores de pagamento PIX em tempo real</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Tabs defaultValue="mercadopago">
          <TabsList className="bg-muted">
            {providers.map(p => {
              const cfg = getConfig(p.key);
              return (
                <TabsTrigger key={p.key} value={p.key} className="gap-2">
                  {p.name}
                  {cfg?.active && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {providers.map(p => (
            <TabsContent key={p.key} value={p.key}>
              <ProviderForm
                provider={p}
                config={getConfig(p.key)}
                tenantId={tenantId}
                onSave={handleSave}
                onToggle={handleToggle}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Webhook Logs */}
      <WebhookLogsPanel />
    </div>
  );
};

interface ProviderFormProps {
  provider: typeof providers[0];
  config?: PaymentProvider;
  tenantId: string | null;
  onSave: (key: string, api: string, secret: string, extra?: { efi_cert_pem?: string; efi_key_pem?: string; efi_pix_key?: string }) => void;
  onToggle: (id: string, active: boolean) => void;
}

const ProviderForm = ({ provider, config, tenantId, onSave, onToggle }: ProviderFormProps) => {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [efiPixKey, setEfiPixKey] = useState("");
  const [efiCertPem, setEfiCertPem] = useState("");
  const [efiKeyPem, setEfiKeyPem] = useState("");
  const [certFileName, setCertFileName] = useState<string | null>(null);

  const isEfi = provider.key === "efi";

  useEffect(() => {
    setApiKey(config?.api_key_encrypted || "");
    setSecretKey(config?.secret_key_encrypted || "");
    setEfiPixKey(config?.efi_pix_key || "");
    setEfiCertPem(config?.efi_cert_pem || "");
    setEfiKeyPem(config?.efi_key_pem || "");
    setCertFileName(config?.efi_cert_pem ? "Certificado carregado ✓" : null);
    setTestResult(null);
  }, [config?.id]);

  const webhookUrl = tenantId
    ? `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/payment-webhook/${provider.key}/${tenantId}`
    : "Configure o tenant primeiro";

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "Webhook URL copiada!" });
  };

  const handleP12Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const binary = forge.util.binary.raw.encode(new Uint8Array(arrayBuffer));
      const p12Asn1 = forge.asn1.fromDer(binary);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, "");

      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

      const certBagList = certBags[forge.pki.oids.certBag] || [];
      const keyBagList = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [];

      if (!certBagList.length || !keyBagList.length) {
        throw new Error("Certificado ou chave não encontrados no arquivo");
      }

      const cert = certBagList[0].cert;
      const key = keyBagList[0].key;
      if (!cert || !key) throw new Error("Conteúdo inválido");

      setEfiCertPem(forge.pki.certificateToPem(cert));
      setEfiKeyPem(forge.pki.privateKeyToPem(key));
      setCertFileName(file.name);
      toast({ title: "Certificado carregado!", description: `${file.name} convertido com sucesso` });
    } catch (err: any) {
      console.error("P12 parse error:", err);
      toast({ title: "Erro ao ler certificado", description: err.message, variant: "destructive" });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await invokeWithRetry("test-payment", {
        provider_key: provider.key,
        api_key: apiKey,
        secret_key: secretKey,
        ...(isEfi ? { cert_pem: efiCertPem, key_pem: efiKeyPem } : {}),
      });
      setTestResult(data);
      if (data?.success) {
        toast({ title: data.message });
      } else {
        toast({ title: data?.message || "Falha na validação", variant: "destructive" });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Erro na conexão" });
      toast({ title: "Erro ao testar", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const extra = isEfi ? { efi_cert_pem: efiCertPem, efi_key_pem: efiKeyPem, efi_pix_key: efiPixKey } : undefined;
    await onSave(provider.key, apiKey, secretKey, extra);
    setSaving(false);
  };

  const maskedValue = (val: string) => {
    if (!val || val.length < 8) return val;
    return val.slice(0, 4) + "••••••••" + val.slice(-4);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2.5 ${provider.color}`}>
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">{provider.name}</h3>
            <p className="text-sm text-muted-foreground">{provider.instructions}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {config && (
            <>
              <Badge variant={config.active ? "default" : "secondary"}>
                {config.active ? "Ativo" : "Inativo"}
              </Badge>
              <Switch checked={config.active} onCheckedChange={() => onToggle(config.id, config.active)} />
            </>
          )}
          <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Docs
            </Button>
          </a>
        </div>
      </div>

      {/* Credentials */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{provider.fields[0].label}</Label>
          <div className="relative">
            <Input
              type={showApiKey ? "text" : "password"}
              placeholder={provider.fields[0].placeholder}
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setTestResult(null); }}
              className="bg-muted border-none pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {provider.fields.length > 1 && (
          <div className="space-y-2">
            <Label>{provider.fields[1].label}</Label>
            <div className="relative">
              <Input
                type={showSecretKey ? "text" : "password"}
                placeholder={provider.fields[1].placeholder}
                value={secretKey}
                onChange={e => { setSecretKey(e.target.value); setTestResult(null); }}
                className="bg-muted border-none pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 ${testResult.success ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
          {testResult.success ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
          <span className={`text-sm ${testResult.success ? "text-emerald-400" : "text-destructive"}`}>
            {testResult.message}
          </span>
        </div>
      )}

      {/* Webhook URL */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          Webhook URL
        </Label>
        <div className="flex gap-2">
          <Input
            readOnly
            value={webhookUrl}
            className="bg-muted border-none font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={copyWebhook}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Cole essa URL no painel do {provider.name} para receber notificações de pagamento automaticamente
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={testing || !apiKey}
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
          Testar Conexão
        </Button>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handleSave}
          disabled={saving || !apiKey}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
          Salvar e Ativar
        </Button>
      </div>
    </div>
  );
};

export default PaymentsPage;
