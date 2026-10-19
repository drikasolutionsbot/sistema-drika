import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Key, Webhook, CheckCircle2, AlertCircle, ExternalLink, Copy, Loader2, Shield, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";

const COLDPAYMENTS_BASE = "https://coldpayments.com/api/v1";

const ColdPaymentsIntegrationTab = () => {
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-webhook/coldpayments/central`;

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("landing_config")
        .select("*")
        .limit(1)
        .single();
      if (data) {
        setConfigId(data.id);
        const d = data as any;
        if (d.coldpayments_api_key) setApiKey(d.coldpayments_api_key);
        if (d.coldpayments_webhook_secret) setWebhookSecret(d.coldpayments_webhook_secret);
        setIsConnected(d.coldpayments_active || false);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  const handleToggleActive = async (checked: boolean) => {
    if (!configId) return;
    setTogglingActive(true);
    try {
      const { error } = await supabase
        .from("landing_config")
        .update({ coldpayments_active: checked, updated_at: new Date().toISOString() } as any)
        .eq("id", configId);
      if (error) throw error;
      setIsConnected(checked);
      toast.success(checked ? "ColdPayments ativado como gateway central!" : "ColdPayments desativado!");
    } catch {
      toast.error("Erro ao alterar status");
    } finally {
      setTogglingActive(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      toast.error("Insira a API Key antes de testar");
      return;
    }
    setTesting(true);
    try {
      // Test by listing payments (lightweight GET endpoint)
      const res = await fetch(`${COLDPAYMENTS_BASE}/payments?limit=1`, {
        headers: {
          "X-API-Key": apiKey.trim(),
          "Content-Type": "application/json",
        },
      });
      if (res.ok || res.status === 200 || res.status === 204) {
        toast.success("✅ Conexão com ColdPayments bem-sucedida!");
      } else if (res.status === 401) {
        toast.error("API Key inválida ou sem permissão.");
      } else if (res.status === 403) {
        toast.error("Escopo insuficiente — verifique as permissões da API Key.");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(`Erro ${res.status}: ${err.message || "Falha ao conectar"}`);
      }
    } catch (e: any) {
      toast.error(`Erro de rede: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!configId) return;
    if (!apiKey.trim()) {
      toast.error("API Key obrigatória");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("landing_config")
        .update({
          coldpayments_api_key: apiKey.trim(),
          coldpayments_webhook_secret: webhookSecret.trim() || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", configId);
      if (error) throw error;
      await logAudit("update", "landing_config", configId, { coldpayments_api_key: "[REDACTED]" });
      toast.success("ColdPayments configurado com sucesso!");
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-500/15 flex items-center justify-center">
                <Zap className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <CardTitle className="text-base">ColdPayments</CardTitle>
                <CardDescription>Gateway Central — PIX, Cartão e Cripto</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isConnected ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Ativo
                </Badge>
              ) : (
                <Badge className="bg-muted text-muted-foreground border-border gap-1">
                  <AlertCircle className="h-3 w-3" /> Inativo
                </Badge>
              )}
              <div className="flex items-center gap-2">
                <Label htmlFor="cp-toggle" className="text-sm text-muted-foreground">
                  {togglingActive ? <Loader2 className="h-4 w-4 animate-spin" /> : (isConnected ? "Desativar" : "Ativar")}
                </Label>
                <Switch
                  id="cp-toggle"
                  checked={isConnected}
                  onCheckedChange={handleToggleActive}
                  disabled={togglingActive || !apiKey}
                />
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* API Key */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="h-4 w-4 text-sky-400" />
            Credenciais da API
          </CardTitle>
          <CardDescription>
            Acesse{" "}
            <a
              href="https://coldpayments.com/dashboard/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              Dashboard → API Keys <ExternalLink className="h-3 w-3" />
            </a>{" "}
            e crie uma chave com os escopos <code className="text-xs bg-muted px-1 rounded">payments:write</code> e{" "}
            <code className="text-xs bg-muted px-1 rounded">withdrawals:write</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-apikey">Secret Key (sk_live_...)</Label>
            <Input
              id="cp-apikey"
              type="password"
              placeholder="sk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          <Separator />

          {/* Webhook Secret */}
          <div className="space-y-2">
            <Label htmlFor="cp-wh-secret" className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-amber-400" />
              Webhook Secret (HMAC)
            </Label>
            <p className="text-xs text-muted-foreground">
              Opcional mas recomendado — valida a assinatura <code className="bg-muted px-1 rounded">X-Coldpayments-Signature</code> dos eventos recebidos.
            </p>
            <div className="relative">
              <Input
                id="cp-wh-secret"
                type={showSecret ? "text" : "password"}
                placeholder="Seu webhook secret do ColdPayments"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="font-mono text-sm pr-16"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || !apiKey.trim()}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Testar Conexão
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !apiKey.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Webhook className="h-4 w-4 text-sky-400" />
            Configuração do Webhook
          </CardTitle>
          <CardDescription>
            Registre esta URL em{" "}
            <a
              href="https://coldpayments.com/dashboard/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              Dashboard → Webhooks <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL de Webhook</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={webhookUrl}
                className="font-mono text-xs text-muted-foreground"
              />
              <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Eventos que devem ser habilitados:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                <code>payment.paid</code> — Pagamento PIX/cartão confirmado
              </li>
            </ul>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
            <p className="text-xs text-amber-400 font-medium">⚠️ Importante: Assinatura HMAC</p>
            <p className="text-xs text-muted-foreground mt-1">
              O sistema valida o cabeçalho <code className="bg-muted px-1 rounded">X-Coldpayments-Signature</code> automaticamente quando o Webhook Secret está configurado.
              Certifique-se de copiar o secret exatamente como aparece no painel da ColdPayments.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">Endpoints Integrados</CardTitle>
          <CardDescription>Funcionalidades disponíveis via ColdPayments como gateway central</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { method: "POST", path: "/payments", desc: "Criar cobrança PIX (modo Split ativo)" },
              { method: "GET",  path: "/payments/:id", desc: "Verificar status do pagamento" },
              { method: "POST", path: "/payments/:id/cancel", desc: "Cancelar cobrança pendente" },
              { method: "POST", path: "/withdrawals", desc: "Saque PIX automático via Carteira" },
            ].map(({ method, path, desc }) => (
              <div key={path} className="flex items-start gap-3 py-1.5 border-b border-border last:border-0">
                <Badge
                  variant="outline"
                  className={`text-xs shrink-0 font-mono ${method === "POST" ? "text-emerald-400 border-emerald-500/30" : "text-blue-400 border-blue-500/30"}`}
                >
                  {method}
                </Badge>
                <code className="text-xs text-muted-foreground font-mono">{path}</code>
                <span className="text-xs text-muted-foreground ml-auto text-right">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ColdPaymentsIntegrationTab;
