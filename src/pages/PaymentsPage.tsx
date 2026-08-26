import { CreditCard, Check, AlertCircle, Copy, Loader2, CheckCircle2, XCircle, ExternalLink, Eye, EyeOff, Zap, Upload, ShieldCheck, Key, Settings2 } from "lucide-react";
import * as forge from "node-forge";
import abacatePayIcon from "@/assets/abacatepay-icon.png";
import misticPayIcon from "@/assets/misticpay-icon.png";
import efiIcon from "@/assets/efi-icon.png";
import mercadoPagoIcon from "@/assets/mercadopago-icon.png";
import pushinPayIcon from "@/assets/pushinpay-icon.png";
import stripeIcon from "@/assets/stripe-icon.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect, useRef, useCallback } from "react";
import WebhookLogsPanel from "@/components/payments/WebhookLogsPanel";
import { GatewayTutorialDialog } from "@/components/payments/GatewayTutorialDialog";
import { GraduationCap } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKeys } from "@/i18n/translations/pt-BR";
import { motion, AnimatePresence } from "framer-motion";

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

const buildProviders = (t: TranslationKeys) => [
  {
    key: "mercadopago",
    name: "Mercado Pago",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    glow: "group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]",
    iconUrl: mercadoPagoIcon,
    docsUrl: "https://www.mercadopago.com.br/developers/pt/docs",
    fields: [
      { key: "api_key", label: "Access Token", placeholder: "APP_USR-..." },
    ],
    instructions: "Acesse Mercado Pago Developers > Suas integrações > Credenciais de produção e copie o Access Token.",
  },
  {
    key: "stripe",
    name: "Stripe",
    color: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    glow: "group-hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]",
    iconUrl: stripeIcon,
    docsUrl: "https://dashboard.stripe.com/apikeys",
    fields: [
      { key: "api_key", label: "Secret Key", placeholder: t.paymentsPage.stripeSecretPlaceholder },
      { key: "secret_key", label: "Signing Secret (Webhook)", placeholder: t.paymentsPage.stripeWebhookPlaceholder },
    ],
    instructions: t.paymentsPage.stripeInstructions,
    isStripe: true,
  },
  {
    key: "pushinpay",
    name: "PushinPay",
    color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    glow: "group-hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]",
    iconUrl: pushinPayIcon,
    docsUrl: "https://pushinpay.com.br",
    fields: [
      { key: "api_key", label: "API Token", placeholder: "pk_live_..." },
    ],
    instructions: "No painel PushinPay, vá em Configurações > API e copie o token de produção.",
  },
  {
    key: "efi",
    name: "Efí (Gerencianet)",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    glow: "group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]",
    iconUrl: efiIcon,
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
    name: "MisticPay",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    glow: "group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]",
    iconUrl: misticPayIcon,
    docsUrl: "https://docs.misticpay.com",
    fields: [
      { key: "api_key", label: "Client ID", placeholder: "seu_client_id" },
      { key: "secret_key", label: "Client Secret", placeholder: "seu_client_secret" },
    ],
    instructions: "No painel MisticPay, acesse Configurações > API e copie o Client ID e Client Secret.",
  },
  {
    key: "abacatepay",
    name: "AbacatePay",
    color: "bg-lime-500/10 text-lime-400 border-lime-500/20",
    glow: "group-hover:shadow-[0_0_20px_rgba(132,204,22,0.3)]",
    iconUrl: abacatePayIcon,
    docsUrl: "https://docs.abacatepay.com/pages/v1/introduction",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "abc_dev_... ou abc_live_..." },
    ],
    instructions: "No painel AbacatePay, acesse Integrar > API Keys e copie sua chave (use abc_live_ em produção).",
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
  stripe_webhook_secret?: string | null;
}

const PaymentsPage = () => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const providers = buildProviders(t);
  const [selectedProviderKey, setSelectedProviderKey] = useState<string | null>(null);

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
  
  // Set default selected if none selected
  useEffect(() => {
    if (!selectedProviderKey && configs.length > 0) {
      const active = configs.find(c => c.active);
      setSelectedProviderKey(active ? active.provider_key : "mercadopago");
    }
  }, [configs, selectedProviderKey]);

  const handleSave = async (providerKey: string, apiKey: string, secretKey: string, extra?: { efi_cert_pem?: string; efi_key_pem?: string; efi_pix_key?: string; stripe_webhook_secret?: string }) => {
    if (!tenantId) return;
    try {
      // Para Stripe: api_key = Secret Key, stripe_webhook_secret = Signing Secret
      // O campo secret_key do form vai como stripe_webhook_secret
      const payload: any = {
        action: "upsert",
        tenant_id: tenantId,
        provider_key: providerKey,
        api_key: apiKey,
        secret_key: providerKey === "stripe" ? null : secretKey,
        ...extra,
      };
      if (providerKey === "stripe") {
        payload.stripe_webhook_secret = secretKey || extra?.stripe_webhook_secret || null;
      }
      const data = await invokeWithRetry("manage-payment-providers", payload);
      if (data?.error) throw new Error(data.error);
      refetch();
      toast({ title: t.paymentsPage.providerSaved });
    } catch (err: any) {
      console.error("Erro ao salvar provedor:", err);
      toast({ title: t.paymentsPage.errorSaving, description: err.message, variant: "destructive" });
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
      toast({ title: t.paymentsPage.errorToggling, description: err.message, variant: "destructive" });
    }
  };

  const selectedProvider = providers.find(p => p.key === selectedProviderKey);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white mb-2">{t.paymentsPage.title}</h1>
        <p className="text-muted-foreground text-lg">{t.paymentsPage.description}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Grid de Gateways */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {providers.map(p => {
              const cfg = getConfig(p.key);
              const isActive = cfg?.active;
              const isSelected = selectedProviderKey === p.key;

              return (
                <motion.div
                  key={p.key}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedProviderKey(p.key)}
                  className={`
                    group relative cursor-pointer overflow-hidden rounded-xl border p-4 transition-all duration-300
                    flex flex-col items-center text-center gap-3 h-full
                    ${isSelected ? 'bg-card border-primary/50 shadow-md' : 'bg-background hover:bg-card border-border'}
                    ${p.glow}
                  `}
                >
                  {/* Status Indicator */}
                  <div className="absolute top-3 right-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-muted-foreground/30'}`} />
                  </div>
                  
                  {/* Icon */}
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center p-2 mb-1 ${p.color}`}>
                    {p.iconUrl ? (
                      <img src={p.iconUrl} alt={p.name} className="h-full w-full object-contain" />
                    ) : (
                      <CreditCard className="h-6 w-6" />
                    )}
                  </div>
                  
                  <span className={`font-medium transition-colors ${isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                    {p.name}
                  </span>
                  
                  {/* Selection Border */}
                  {isSelected && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-xl border-2 border-primary pointer-events-none"
                      initial={false}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Área de Configuração */}
          <AnimatePresence mode="wait">
            {selectedProvider && (
              <motion.div
                key={selectedProvider.key}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
              >
                <ProviderForm
                  provider={selectedProvider}
                  config={getConfig(selectedProvider.key)}
                  tenantId={tenantId}
                  onSave={handleSave}
                  onToggle={handleToggle}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Webhook Logs */}
      <WebhookLogsPanel />
    </div>
  );
};

type ProviderItem = ReturnType<typeof buildProviders>[number];

interface ProviderFormProps {
  provider: ProviderItem;
  config?: PaymentProvider;
  tenantId: string | null;
  onSave: (key: string, api: string, secret: string, extra?: { efi_cert_pem?: string; efi_key_pem?: string; efi_pix_key?: string }) => void;
  onToggle: (id: string, active: boolean) => void;
}

const ProviderForm = ({ provider, config, tenantId, onSave, onToggle }: ProviderFormProps) => {
  const { t } = useLanguage();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [certFileName, setCertFileName] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const isEfi = provider.key === "efi";
  const isStripe = provider.key === "stripe";

  // Build server state from config
  const serverState = {
    apiKey: config?.api_key_encrypted || "",
    secretKey: isStripe ? (config?.stripe_webhook_secret || "") : (config?.secret_key_encrypted || ""),
    efiPixKey: config?.efi_pix_key || "",
    efiCertPem: config?.efi_cert_pem || "",
    efiKeyPem: config?.efi_key_pem || "",
  };

  const storageKey = tenantId ? `draft:${tenantId}:payment-${provider.key}` : null;
  const initialized = useRef(false);

  const [formState, setFormState] = useState(serverState);

  // Initialize from localStorage or server
  useEffect(() => {
    if (!tenantId || initialized.current) return;
    initialized.current = true;
    try {
      const saved = storageKey ? localStorage.getItem(storageKey) : null;
      if (saved) {
        setFormState(JSON.parse(saved));
      } else {
        setFormState(serverState);
      }
    } catch {
      setFormState(serverState);
    }
    setCertFileName(config?.efi_cert_pem ? t.paymentsPage.certLoaded : null);
    setTestResult(null);
  }, [tenantId, config?.id]);

  // Reset when config changes (e.g. after save)
  useEffect(() => {
    if (initialized.current && config?.id) {
      // Don't overwrite draft
    }
  }, [config?.id]);

  // Auto-save draft
  useEffect(() => {
    if (!storageKey || !initialized.current) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(formState)); } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [formState, storageKey]);

  const clearDraft = useCallback(() => {
    if (storageKey) localStorage.removeItem(storageKey);
  }, [storageKey]);

  const apiKey = formState.apiKey;
  const secretKey = formState.secretKey;
  const efiPixKey = formState.efiPixKey;
  const efiCertPem = formState.efiCertPem;
  const efiKeyPem = formState.efiKeyPem;

  const setApiKey = (v: string) => setFormState(p => ({ ...p, apiKey: v }));
  const setSecretKey = (v: string) => setFormState(p => ({ ...p, secretKey: v }));
  const setEfiPixKey = (v: string) => setFormState(p => ({ ...p, efiPixKey: v }));
  const setEfiCertPem = (v: string) => setFormState(p => ({ ...p, efiCertPem: v }));
  const setEfiKeyPem = (v: string) => setFormState(p => ({ ...p, efiKeyPem: v }));

  const webhookUrl = tenantId
    ? (provider.key === "stripe"
        ? `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stripe-webhook`
        : `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/payment-webhook/${provider.key}/${tenantId}`)
    : t.paymentsPage.tenantNotConfigured;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: t.paymentsPage.copyWebhook });
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
      toast({ title: t.paymentsPage.certLoadedTitle, description: t.paymentsPage.certLoadedDesc.replace("{name}", file.name) });
    } catch (err: any) {
      console.error("P12 parse error:", err);
      toast({ title: t.paymentsPage.certError, description: err.message, variant: "destructive" });
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
        toast({ title: data?.message || t.paymentsPage.validationFailed, variant: "destructive" });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || t.paymentsPage.connectionError });
      toast({ title: t.paymentsPage.testError, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const extra = isEfi ? { efi_cert_pem: efiCertPem, efi_key_pem: efiKeyPem, efi_pix_key: efiPixKey } : undefined;
    await onSave(provider.key, apiKey, secretKey, extra);
    clearDraft();
    setSaving(false);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl shadow-xl">
      {/* Decorative background glow */}
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      
      <div className="relative p-6 sm:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/50">
          <div className="flex items-center gap-4">
            <div className={`rounded-xl p-3 flex flex-shrink-0 items-center justify-center h-16 w-16 shadow-inner ${provider.color} border bg-background/50`}>
              {provider.iconUrl ? (
                <img src={provider.iconUrl} alt={provider.name} className="h-10 w-10 object-contain drop-shadow-md" />
              ) : (
                <CreditCard className="h-8 w-8" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-xl tracking-tight">{provider.name}</h3>
                {config && (
                  <Badge variant={config.active ? "default" : "secondary"} className={config.active ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/20" : ""}>
                    {config.active ? t.paymentsPage.active : t.paymentsPage.inactive}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">{provider.instructions}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            {config && (
              <div className="flex items-center gap-2 mr-2 bg-background/50 px-3 py-1.5 rounded-full border border-border/50 shadow-sm">
                <Label htmlFor="active-toggle" className="text-sm cursor-pointer select-none">
                  Ativar
                </Label>
                <Switch id="active-toggle" checked={config.active} onCheckedChange={() => onToggle(config.id, config.active)} className="data-[state=checked]:bg-emerald-500" />
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTutorialOpen(true)}
              className="border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary shadow-sm hover:shadow transition-all"
            >
              <GraduationCap className="h-4 w-4 mr-1.5" /> Tutorial
            </Button>
            <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="bg-background shadow-sm hover:shadow transition-all">
                <ExternalLink className="h-4 w-4 mr-1.5" /> Docs
              </Button>
            </a>
          </div>
        </div>

        {/* Credentials */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Settings2 className="h-5 w-5 text-primary" />
            <h3>Credenciais de Integração</h3>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2.5">
              <Label className="text-sm font-medium">{provider.fields[0].label}</Label>
              <div className="relative group">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder={provider.fields[0].placeholder}
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setTestResult(null); }}
                  className="bg-background/50 border-border/60 focus:bg-background pr-10 font-mono text-sm shadow-sm transition-all group-hover:border-primary/50 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {provider.fields.length > 1 && (
              <div className="space-y-2.5">
                <Label className="text-sm font-medium">{provider.fields[1].label}</Label>
                <div className="relative group">
                  <Input
                    type={showSecretKey ? "text" : "password"}
                    placeholder={provider.fields[1].placeholder}
                    value={secretKey}
                    onChange={e => { setSecretKey(e.target.value); setTestResult(null); }}
                    className="bg-background/50 border-border/60 focus:bg-background pr-10 font-mono text-sm shadow-sm transition-all group-hover:border-primary/50 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Efí-specific: PIX Key + Certificate Upload */}
        {isEfi && (
          <div className="space-y-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2 border-b border-emerald-500/10 pb-3">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <span className="text-base font-medium text-emerald-100">{t.paymentsPage.pixConfig}</span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Key className="h-4 w-4 text-emerald-500/70" />
                  {t.paymentsPage.pixKey}
                </Label>
                <Input
                  placeholder={t.paymentsPage.pixKeyPlaceholder}
                  value={efiPixKey}
                  onChange={e => setEfiPixKey(e.target.value)}
                  className="bg-background/80 border-emerald-500/30 focus:border-emerald-500/60 font-mono text-sm focus:ring-emerald-500/20 shadow-sm"
                />
              </div>

              <div className="space-y-2.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Upload className="h-4 w-4 text-emerald-500/70" />
                  {t.paymentsPage.certLabel}
                </Label>
                <div className="flex items-center gap-3 h-[42px]">
                  <label className="flex-1 cursor-pointer h-full">
                    <div className={`flex items-center justify-center gap-2 rounded-md border border-dashed h-full transition-all duration-200 ${
                      certFileName 
                        ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.15)]" 
                        : "border-emerald-500/30 bg-background/50 hover:bg-emerald-500/5 hover:border-emerald-500/50"
                    }`}>
                      {certFileName ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm font-medium text-emerald-400 truncate px-2">{certFileName}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Selecionar certificado (.p12)</span>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept=".p12,.pfx,.pem"
                      onChange={handleP12Upload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
            {!certFileName && (
               <p className="text-xs text-muted-foreground mt-2">
                 {t.paymentsPage.certDesc}
               </p>
            )}
          </div>
        )}

        {/* Test Result */}
        <AnimatePresence>
          {testResult && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 mt-4 shadow-sm ${testResult.success ? "bg-emerald-500/10 border-emerald-500/20" : "bg-destructive/10 border-destructive/20"}`}>
                <div className={`p-1.5 rounded-full ${testResult.success ? "bg-emerald-500/20" : "bg-destructive/20"}`}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                </div>
                <span className={`text-sm font-medium ${testResult.success ? "text-emerald-300" : "text-destructive"}`}>
                  {testResult.message}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Webhook URL */}
        <div className="space-y-3 pt-4 border-t border-border/50">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4 text-primary" />
            {t.paymentsPage.webhookUrlLabel}
          </Label>
          <div className="flex gap-2 relative group">
            <Input
              readOnly
              value={webhookUrl}
              className="bg-background/80 border-border/60 font-mono text-xs sm:text-sm text-muted-foreground shadow-sm truncate pr-24"
            />
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={copyWebhook}
              className="absolute right-1 top-1 h-8 px-3 shadow-sm hover:shadow"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 pl-1">
            <AlertCircle className="h-3.5 w-3.5 text-primary/70" />
            {t.paymentsPage.webhookHint.replace("{name}", provider.name)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/50">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !apiKey}
            className="flex-1 sm:flex-none border-primary/20 hover:bg-primary/5 hover:border-primary/40 shadow-sm transition-all h-11"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2 text-primary" />}
            {t.paymentsPage.testConnection}
          </Button>
          <Button
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all h-11"
            onClick={handleSave}
            disabled={saving || !apiKey}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            {t.paymentsPage.saveAndActivate}
          </Button>
        </div>

        <GatewayTutorialDialog
          open={tutorialOpen}
          onOpenChange={setTutorialOpen}
          gatewayKey={provider.key}
        />
      </div>
    </div>
  );
};

export default PaymentsPage;
