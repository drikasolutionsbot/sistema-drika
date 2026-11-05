import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Key, Webhook, CheckCircle2, AlertCircle, ExternalLink, Copy, Zap, Loader2, Info, Wallet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";

const MisticPayIntegrationTab = () => {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);

  // Balance query
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-webhook/misticpay/central`;

  const fetchBalance = async () => {
    setLoadingBalance(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-gateway-balance", {
        body: { tenant_id: "central", provider_key: "misticpay" },
      });
      if (error) throw error;
      if (typeof data?.balance_cents === "number") {
        setBalanceCents(data.balance_cents);
      }
    } catch (err: any) {
      console.warn("Could not fetch MisticPay balance:", err);
    } finally {
      setLoadingBalance(false);
    }
  };

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
        if (d.misticpay_client_id) setClientId(d.misticpay_client_id);
        if (d.misticpay_client_secret) setClientSecret(d.misticpay_client_secret);
        setIsConnected(d.misticpay_active || false);
      }
      setLoading(false);
    };
    load();
    fetchBalance();
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
        .update({ misticpay_active: checked, updated_at: new Date().toISOString() } as any)
        .eq("id", configId);
      if (error) throw error;
      setIsConnected(checked);
      toast.success(checked ? "MisticPay ativada como Gateway Central!" : "MisticPay desativada!");
    } catch {
      toast.error("Erro ao alterar status");
    } finally {
      setTogglingActive(false);
    }
  };

  const handleTestConnection = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Informe o Client ID e Client Secret");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-payment", {
        body: {
          provider_key: "misticpay",
          api_key: clientId.trim(),
          secret_key: clientSecret.trim(),
        },
      });
      if (error) throw error;
      if (data?.success) {
        setIsConnected(true);
        toast.success(data.message || "Conexão validada com sucesso!");
        fetchBalance();
      } else {
        setIsConnected(false);
        toast.error(data?.message || "Falha na validação com MisticPay");
      }
    } catch (err: any) {
      toast.error("Falha ao conectar com MisticPay: " + (err.message || ""));
      setIsConnected(false);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Preencha o Client ID e o Client Secret");
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
          misticpay_client_id: clientId.trim(),
          misticpay_client_secret: clientSecret.trim(),
          misticpay_active: true,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", configId);

      if (error) throw error;
      setIsConnected(true);
      await logAudit("config_updated", "config", configId, "MisticPay Gateway Integration", {
        client_id: clientId.slice(0, 10) + "...",
      });
      toast.success("Credenciais da MisticPay salvas com sucesso!");
      fetchBalance();
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Erro ao salvar: " + (err.message || "Verifique permissões"));
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
      <Card className={`border ${isConnected ? "border-purple-500/30 bg-purple-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-purple-400" />
                <div>
                  <p className="font-medium text-purple-400">MisticPay ativa (Gateway Central & Split)</p>
                  <p className="text-xs text-muted-foreground">
                    Processando entradas PIX das lojas, taxas da plataforma e saques automáticos
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-500">MisticPay inativa</p>
                  <p className="text-xs text-muted-foreground">
                    Ative e configure as credenciais para processar pagamentos na Gateway Central
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{isConnected ? "Ativo" : "Inativo"}</span>
            <Switch checked={isConnected} onCheckedChange={handleToggleActive} disabled={togglingActive} />
          </div>
        </CardContent>
      </Card>

      {/* Saldo em Tempo Real na Conta MisticPay */}
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo Disponível na MisticPay (Caixa Central)</p>
              <p className="text-xl font-bold font-mono text-purple-300">
                {balanceCents !== null
                  ? `R$ ${(balanceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  : "—"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBalance}
            disabled={loadingBalance}
            className="text-xs border-slate-800 bg-slate-900/60"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingBalance ? "animate-spin text-purple-400" : ""}`} />
            Atualizar Saldo
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5 text-purple-400" />
              Chaves de Acesso (API)
            </CardTitle>
            <CardDescription>
              Configuração das credenciais MisticPay obtidas em API &gt; Chaves de Acesso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client ID (Public Key)</Label>
              <Input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="pk_e54d3a3710a67259447a3d33be2267ec"
                className="bg-background border-border font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Chave identificadora pública da sua API na MisticPay.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Client Secret (Secret Key)</Label>
              <Input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="bg-background border-border font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Chave secreta de autenticação utilizada para assinatura e operações seguras.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Certifique-se de que a Chave de Acesso no painel da MisticPay possui os escopos:{" "}
                  <strong className="text-slate-200">TRANSACTION_CREATE</strong>,{" "}
                  <strong className="text-slate-200">TRANSACTION_READ</strong>,{" "}
                  <strong className="text-slate-200">BALANCE_READ</strong> e{" "}
                  <strong className="text-slate-200">WITHDRAW_CREATE</strong>.
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-1">
              Obtenha suas credenciais no{" "}
              <a
                href="https://app.misticpay.com"
                target="_blank"
                rel="noreferrer"
                className="text-purple-400 hover:underline inline-flex items-center gap-1 font-medium"
              >
                painel MisticPay <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Webhook className="h-5 w-5 text-purple-400" />
              Webhook Central da Plataforma
            </CardTitle>
            <CardDescription>
              Cadastre esta URL na MisticPay para confirmação automática instantânea dos PIX
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="bg-background border-border font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopyWebhook} title="Copiar URL">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cole este endereço no campo <strong>URL do Webhook</strong> ao criar ou editar a Chave de Acesso na MisticPay.
              </p>
            </div>

            <Separator />

            <div className="rounded-lg border border-purple-500/20 bg-purple-950/20 p-3 space-y-2">
              <span className="text-xs font-semibold text-purple-300 block">Como funciona o Split Central:</span>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                <li>O cliente paga o PIX gerado via MisticPay.</li>
                <li>O dinheiro entra 100% no seu caixa central da MisticPay.</li>
                <li>A plataforma retém as taxas (ex: 1% de intermediação) e credita o restante na carteira interna do lojista.</li>
                <li>Quando o lojista solicitar saque, a MisticPay envia o PIX automático de saída (cash-out) diretamente para a conta dele!</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={testing || !clientId.trim() || !clientSecret.trim()}
          className="flex-1"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
          Testar Conexão com MisticPay
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !clientId.trim() || !clientSecret.trim()}
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
};

export default MisticPayIntegrationTab;
