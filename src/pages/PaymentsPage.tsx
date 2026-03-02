import { CreditCard, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantQuery } from "@/hooks/useSupabaseQuery";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

const providers = [
  { key: "mercadopago", name: "Mercado Pago", color: "bg-blue-500/10 text-blue-400" },
  { key: "misticpay", name: "Mistic Pay", color: "bg-purple-500/10 text-purple-400" },
  { key: "efi", name: "Efí", color: "bg-emerald-500/10 text-emerald-400" },
  { key: "pushinpay", name: "PushinPay", color: "bg-orange-500/10 text-orange-400" },
];

interface PaymentProvider {
  id: string;
  provider_key: string;
  api_key_encrypted: string | null;
  secret_key_encrypted: string | null;
  active: boolean;
}

const PaymentsPage = () => {
  const { tenantId } = useTenant();
  const { data: configs = [], isLoading, refetch } = useTenantQuery<PaymentProvider>("payment-providers", "payment_providers");

  const getConfig = (key: string) => configs.find(c => c.provider_key === key);

  const handleSave = async (providerKey: string, apiKey: string, secretKey: string) => {
    if (!tenantId) return;
    const existing = getConfig(providerKey);
    if (existing) {
      await (supabase as any).from("payment_providers").update({ api_key_encrypted: apiKey, secret_key_encrypted: secretKey, active: true }).eq("id", existing.id);
    } else {
      await (supabase as any).from("payment_providers").insert({ tenant_id: tenantId, provider_key: providerKey, api_key_encrypted: apiKey, secret_key_encrypted: secretKey, active: true });
    }
    refetch();
    toast({ title: "Provedor salvo com sucesso" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Pagamentos</h1>
        <p className="text-muted-foreground">Configure seus provedores de pagamento PIX</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Tabs defaultValue="mercadopago">
          <TabsList className="bg-muted">
            {providers.map(p => <TabsTrigger key={p.key} value={p.key}>{p.name}</TabsTrigger>)}
          </TabsList>

          {providers.map(p => (
            <TabsContent key={p.key} value={p.key}>
              <ProviderForm provider={p} config={getConfig(p.key)} onSave={handleSave} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

const ProviderForm = ({ provider, config, onSave }: { provider: any; config?: PaymentProvider; onSave: (key: string, api: string, secret: string) => void }) => {
  const [apiKey, setApiKey] = useState(config?.api_key_encrypted || "");
  const [secretKey, setSecretKey] = useState(config?.secret_key_encrypted || "");

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${provider.color}`}>
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">{provider.name}</h3>
          <p className="text-sm text-muted-foreground">Configure as credenciais de acesso</p>
        </div>
        {config?.active && <span className="ml-auto rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">Ativo</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>API Key / Token</Label>
          <Input type="password" placeholder="••••••••••••••••" value={apiKey} onChange={e => setApiKey(e.target.value)} className="bg-muted border-none" />
        </div>
        <div className="space-y-2">
          <Label>Secret Key</Label>
          <Input type="password" placeholder="••••••••••••••••" value={secretKey} onChange={e => setSecretKey(e.target.value)} className="bg-muted border-none" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Webhook URL</Label>
        <div className="flex gap-2">
          <Input readOnly value={`https://api.drikasolutions.com/webhooks/${provider.key}`} className="bg-muted border-none font-mono text-xs" />
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`https://api.drikasolutions.com/webhooks/${provider.key}`); toast({ title: "Copiado!" }); }}>Copiar</Button>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />Configure essa URL no painel do {provider.name}
        </p>
      </div>

      <div className="flex gap-3">
        <Button className="gradient-pink text-primary-foreground border-none hover:opacity-90" onClick={() => onSave(provider.key, apiKey, secretKey)}>
          <Check className="mr-2 h-4 w-4" /> Salvar
        </Button>
        <Button variant="outline">Testar Conexão</Button>
      </div>
    </div>
  );
};

export default PaymentsPage;
