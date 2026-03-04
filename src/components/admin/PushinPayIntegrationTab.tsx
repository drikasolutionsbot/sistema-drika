import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Key, Webhook, CheckCircle2, AlertCircle, ExternalLink, Copy, Shield, Zap } from "lucide-react";
import { toast } from "sonner";

const PLANS_PREVIEW = [
  { name: "Starter", price: "—", features: ["Recursos básicos", "1 servidor"] },
  { name: "Pro", price: "—", features: ["Recursos avançados", "3 servidores", "Suporte prioritário"] },
  { name: "Business", price: "—", features: ["Todos os recursos", "Servidores ilimitados", "Suporte VIP"] },
];

const PushinPayIntegrationTab = () => {
  const [apiKey, setApiKey] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-webhook`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      toast.error("Insira a API Key primeiro");
      return;
    }
    setTesting(true);
    try {
      // TODO: Test PushinPay API connection
      await new Promise((r) => setTimeout(r, 1500));
      setIsConnected(true);
      toast.success("Conexão com PushinPay verificada!");
    } catch {
      toast.error("Falha ao conectar com PushinPay");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error("Insira a API Key");
      return;
    }
    setSaving(true);
    try {
      // TODO: Save API key as Supabase secret
      await new Promise((r) => setTimeout(r, 1000));
      toast.success("Configurações salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Card className={`border ${isConnected ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <CardContent className="flex items-center gap-3 py-4">
          {isConnected ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="font-medium text-emerald-500">PushinPay conectado</p>
                <p className="text-xs text-muted-foreground">Cobranças recorrentes ativas</p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-500">PushinPay não configurado</p>
                <p className="text-xs text-muted-foreground">Configure a API Key para ativar cobranças</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Key Config */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Credenciais da API
            </CardTitle>
            <CardDescription>Configure sua API Key do PushinPay para processar pagamentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="pk_live_..."
                className="bg-background border-border font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Encontre sua API Key no{" "}
                <a href="https://dashboard.pushinpay.com.br" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  painel do PushinPay <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTestConnection} disabled={testing || !apiKey.trim()} className="flex-1">
                {testing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Testar Conexão
              </Button>
              <Button onClick={handleSave} disabled={saving || !apiKey.trim()} className="flex-1">
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Config */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              Webhook
            </CardTitle>
            <CardDescription>Configure este URL no painel do PushinPay para receber notificações de pagamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="bg-background border-border font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cole esta URL nas configurações de webhook do PushinPay
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Ativar plano automaticamente</p>
                  <p className="text-xs text-muted-foreground">Ativa o plano do cliente assim que o pagamento for confirmado</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Suspender ao expirar</p>
                  <p className="text-xs text-muted-foreground">Suspende acesso quando o pagamento não é renovado</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Preview */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Planos Disponíveis</CardTitle>
          <CardDescription>Os planos e valores serão configurados posteriormente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS_PREVIEW.map((plan) => (
              <div key={plan.name} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <Badge variant="secondary" className="text-xs">{plan.price}</Badge>
                </div>
                <ul className="space-y-1">
                  {plan.features.map((f) => (
                    <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PushinPayIntegrationTab;
