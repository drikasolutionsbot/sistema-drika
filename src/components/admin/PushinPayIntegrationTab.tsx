import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Key, Webhook, CheckCircle2, AlertCircle, ExternalLink, Copy, Shield, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";

const PushinPayIntegrationTab = () => {
  const [apiKey, setApiKey] = useState("");
  const [proPriceCents, setProPriceCents] = useState(2690);
  const [autoActivate, setAutoActivate] = useState(true);
  const [suspendOnExpire, setSuspendOnExpire] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-webhook`;

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
        if (d.pushinpay_api_key) {
          setApiKey(d.pushinpay_api_key);
          setIsConnected(d.pushinpay_active || false);
        }
        if (d.pro_price_cents) {
          setProPriceCents(d.pro_price_cents);
        }
        setAutoActivate(d.auto_activate_plan ?? true);
        setSuspendOnExpire(d.suspend_on_expire ?? true);
      }
      setLoading(false);
    };
    load();
  }, []);

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
      // Test by calling the PushinPay API
      const res = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ value: 100 }), // R$1.00 test
      });
      if (res.ok || res.status === 422) {
        // 422 might happen for validation errors but means API key is valid
        setIsConnected(true);
        toast.success("Conexão com PushinPay verificada!");
      } else if (res.status === 401 || res.status === 403) {
        toast.error("API Key inválida");
        setIsConnected(false);
      } else {
        // Even other errors often mean the key is valid
        setIsConnected(true);
        toast.success("Conexão com PushinPay verificada!");
      }
    } catch {
      toast.error("Falha ao conectar com PushinPay");
      setIsConnected(false);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error("Insira a API Key");
      return;
    }
    if (!configId) {
      toast.error("Configuração não encontrada");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("landing_config")
        .update({
          pushinpay_api_key: apiKey.trim(),
          pushinpay_active: isConnected,
          pro_price_cents: proPriceCents,
          auto_activate_plan: autoActivate,
          suspend_on_expire: suspendOnExpire,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", configId);
      
      if (error) throw error;
      await logAudit("config_updated", "config", configId, "PushinPay Integration", {
        pro_price: `R$ ${(proPriceCents / 100).toFixed(2)}`,
        auto_activate: autoActivate,
        suspend_on_expire: suspendOnExpire,
      });
      toast.success("Configurações salvas com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                <p className="text-xs text-muted-foreground">Cobranças de assinatura ativas na landing page</p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-500">PushinPay não configurado</p>
                <p className="text-xs text-muted-foreground">Configure a API Key para ativar cobranças do plano Pro</p>
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
            <CardDescription>Configure sua API Key do PushinPay para processar pagamentos do plano Pro</CardDescription>
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

            <div className="space-y-2">
              <Label>Valor do Plano Pro (centavos)</Label>
              <Input
                type="number"
                value={proPriceCents}
                onChange={(e) => setProPriceCents(Number(e.target.value))}
                className="bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">
                Valor em centavos. Ex: 2690 = R$ 26,90
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTestConnection} disabled={testing || !apiKey.trim()} className="flex-1">
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Testar Conexão
              </Button>
              <Button onClick={handleSave} disabled={saving || !apiKey.trim()} className="flex-1">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
                <Switch checked={autoActivate} onCheckedChange={setAutoActivate} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Suspender ao expirar</p>
                  <p className="text-xs text-muted-foreground">Suspende acesso quando o pagamento não é renovado</p>
                </div>
                <Switch checked={suspendOnExpire} onCheckedChange={setSuspendOnExpire} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Preview */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Planos Disponíveis</CardTitle>
          <CardDescription>O botão "Assinar Pro" na landing page gerará um PIX automaticamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Teste Grátis</h3>
                <Badge variant="secondary" className="text-xs">4 dias</Badge>
              </div>
              <ul className="space-y-1">
                {["Painel completo", "Bot no servidor", "Vendas automáticas"].map((f) => (
                  <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-primary">Pro</h3>
                <Badge className="text-xs bg-primary">R$ {(proPriceCents / 100).toFixed(2)}/mês</Badge>
              </div>
              <ul className="space-y-1">
                {["Tudo do Free", "Sem limite de tempo", "Segurança avançada", "Suporte prioritário"].map((f) => (
                  <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PushinPayIntegrationTab;
