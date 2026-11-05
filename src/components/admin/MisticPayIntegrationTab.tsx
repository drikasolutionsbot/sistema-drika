import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Webhook,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Zap,
  Loader2,
  Info,
  Wallet,
  RefreshCw,
  Sliders,
  DollarSign,
  Percent,
  Calculator,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";

const parseNumericValue = (val: string): number => {
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9.,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) || num < 0 ? 0 : num;
};

const formatMoney = (cents: number): string => {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const MisticPayIntegrationTab = () => {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);

  // Dynamic Split Fees (Configuradas pela dona da plataforma)
  const [fixedFee, setFixedFee] = useState("1,00"); // Taxa Fixa em R$ (ex: "1,00")
  const [percentFee, setPercentFee] = useState("2,00"); // Taxa Percentual em % (ex: "2,00")

  // Interactive Live Simulator
  const [simAmount, setSimAmount] = useState("50,00");

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

        if (typeof d.split_fixed_fee_cents === "number") {
          setFixedFee((d.split_fixed_fee_cents / 100).toFixed(2).replace(".", ","));
        }
        if (d.split_percent_fee !== null && d.split_percent_fee !== undefined) {
          setPercentFee(Number(d.split_percent_fee).toFixed(2).replace(".", ","));
        }
      }
      setLoading(false);
    };
    load();
    fetchBalance();
  }, []);

  // Split simulation calculation in real time
  const simulation = useMemo(() => {
    const totalNum = parseNumericValue(simAmount);
    const totalCents = Math.round(totalNum * 100);

    const fixedNum = parseNumericValue(fixedFee);
    const fixedCents = Math.round(fixedNum * 100);

    const pctNum = parseNumericValue(percentFee);
    const pctCents = Math.round((totalCents * pctNum) / 100);

    const totalRetainedCents = fixedCents + pctCents;
    const sellerNetCents = Math.max(0, totalCents - totalRetainedCents);
    const effectivePct = totalCents > 0 ? ((totalRetainedCents / totalCents) * 100).toFixed(1) : "0.0";

    return {
      totalCents,
      fixedCents,
      pctNum,
      pctCents,
      totalRetainedCents,
      sellerNetCents,
      effectivePct,
    };
  }, [simAmount, fixedFee, percentFee]);

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

    const fixedCents = Math.round(parseNumericValue(fixedFee) * 100);
    const pctNum = Number(parseNumericValue(percentFee).toFixed(2));

    setSaving(true);
    try {
      const { error } = await supabase
        .from("landing_config")
        .update({
          misticpay_client_id: clientId.trim(),
          misticpay_client_secret: clientSecret.trim(),
          misticpay_active: true,
          split_fixed_fee_cents: fixedCents,
          split_percent_fee: pctNum,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", configId);

      if (error) throw error;
      setIsConnected(true);
      await logAudit("config_updated", "config", configId, "MisticPay Gateway Integration", {
        client_id: clientId.slice(0, 10) + "...",
        split_fixed_fee_cents: fixedCents,
        split_percent_fee: pctNum,
      });

      const fixedFormatted = (fixedCents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const pctFormatted = pctNum.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      });

      toast.success(
        `Configurações salvas! Taxa de R$ ${fixedFormatted} + ${pctFormatted}% aplicada no sistema imediatamente.`
      );
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
      {/* Status da Integração */}
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

      {/* CONFIGURAÇÃO DINÂMICA DE TAXAS (SPLIT DA DONA) */}
      <Card className="bg-card border-purple-500/30 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <CardHeader className="pb-4 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Sliders className="h-5 w-5 text-purple-400" />
                Taxas de Intermediação & Split da Plataforma
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-1">
                Defina o valor fixo (R$) e a porcentagem (%) que a dona retém a cada venda realizada pelas lojas integradas.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-purple-500/40 bg-purple-500/10 text-purple-300 font-mono text-xs w-fit">
              <Sparkles className="h-3 w-3 mr-1 text-purple-400" />
              Taxa Base: R$ {fixedFee || "0,00"} + {percentFee || "0"}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          {/* Inputs de Taxa Fixa e Taxa Percentual */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 rounded-xl border border-border/80 bg-background/50 p-4">
              <Label className="text-sm font-semibold flex items-center justify-between text-slate-200">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  Taxa Fixa por Venda (R$)
                </span>
                <span className="text-[11px] font-normal text-muted-foreground font-mono">
                  {Math.round(parseNumericValue(fixedFee) * 100)} centavos
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  R$
                </span>
                <Input
                  type="text"
                  value={fixedFee}
                  onChange={(e) => setFixedFee(e.target.value)}
                  placeholder="1,00"
                  className="pl-10 font-mono text-base font-bold bg-background border-border"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Valor fixo em reais deduzido de cada pedido aprovado (ex: digite <strong>1,00</strong> para R$ 1,00).
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-border/80 bg-background/50 p-4">
              <Label className="text-sm font-semibold flex items-center justify-between text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Percent className="h-4 w-4 text-purple-400" />
                  Taxa Percentual (%)
                </span>
                <span className="text-[11px] font-normal text-muted-foreground font-mono">
                  {Number(parseNumericValue(percentFee)).toFixed(2)}%
                </span>
              </Label>
              <div className="relative">
                <Input
                  type="text"
                  value={percentFee}
                  onChange={(e) => setPercentFee(e.target.value)}
                  placeholder="2,00"
                  className="pr-10 font-mono text-base font-bold bg-background border-border"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  %
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Porcentagem retida sobre o valor total do pedido (ex: digite <strong>2,00</strong> para 2,00%).
              </p>
            </div>
          </div>

          {/* SIMULADOR INTERATIVO EM TEMPO REAL */}
          <div className="rounded-xl border border-purple-500/20 bg-[#080d1a] p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Calculator className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Simulador de Split em Tempo Real</h4>
                  <p className="text-[11px] text-slate-400">
                    Veja exatamente a divisão aplicada entre o lucro da dona e a carteira do lojista.
                  </p>
                </div>
              </div>

              {/* Botões rápidos de exemplo */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500 uppercase font-semibold mr-1">Exemplos:</span>
                {["20,00", "50,00", "100,00", "250,00"].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSimAmount(preset)}
                    className={`h-7 px-2 text-xs font-mono ${
                      simAmount === preset
                        ? "border-purple-500 text-purple-300 bg-purple-500/20"
                        : "border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white"
                    }`}
                  >
                    R$ {preset}
                  </Button>
                ))}
              </div>
            </div>

            {/* Input para valor customizado de teste */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Label className="text-xs text-slate-300 font-medium shrink-0">
                Valor de Teste do Pedido (PIX):
              </Label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                <Input
                  type="text"
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  placeholder="50,00"
                  className="pl-9 h-8 text-xs font-mono font-bold bg-background border-slate-700 w-36"
                />
              </div>
            </div>

            {/* Grid dos 4 blocos da divisão */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                  1. Entrada Bruta (PIX)
                </span>
                <p className="text-lg font-black font-mono text-slate-100">
                  {formatMoney(simulation.totalCents)}
                </p>
                <p className="text-[10px] text-slate-500">
                  Cai 100% no seu caixa central
                </p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                  2. Taxa Fixa
                </span>
                <p className="text-lg font-black font-mono text-amber-400">
                  - {formatMoney(simulation.fixedCents)}
                </p>
                <p className="text-[10px] text-slate-500">
                  Taxa fixa retida pela plataforma
                </p>
              </div>

              <div className="rounded-lg border border-purple-500/20 bg-purple-950/20 p-3 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-purple-300 font-semibold block">
                  3. Taxa Percentual ({simulation.pctNum}%)
                </span>
                <p className="text-lg font-black font-mono text-purple-300">
                  - {formatMoney(simulation.pctCents)}
                </p>
                <p className="text-[10px] text-purple-400/80">
                  Calculado sobre {formatMoney(simulation.totalCents)}
                </p>
              </div>

              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-3 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold block">
                  4. Lucro da Dona (Meu Lucro)
                </span>
                <p className="text-lg font-black font-mono text-emerald-300">
                  + {formatMoney(simulation.totalRetainedCents)}
                </p>
                <p className="text-[10px] text-emerald-400/80">
                  {simulation.effectivePct}% retido para a dona
                </p>
              </div>
            </div>

            {/* Repasse Líquido ao Lojista */}
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-cyan-200">
                    Repasse Líquido para o Lojista (Carteira Interna):
                  </p>
                  <p className="text-[11px] text-cyan-400/80">
                    O lojista recebe este saldo livre e pode solicitar saque PIX para a chave cadastrada dele.
                  </p>
                </div>
              </div>
              <p className="text-xl font-black font-mono text-cyan-300 sm:text-right">
                {formatMoney(simulation.sellerNetCents)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chaves de Acesso API */}
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
                  <strong className="text-slate-200">TRANSACTION.CREATE</strong>,{" "}
                  <strong className="text-slate-200">TRANSACTION.READ</strong>,{" "}
                  <strong className="text-slate-200">BALANCE.READ</strong> e{" "}
                  <strong className="text-slate-200">WITHDRAW.CREATE</strong>.
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

        {/* Webhook Central */}
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
                <li>A plataforma retém as taxas configuradas acima e credita o restante na carteira interna do lojista.</li>
                <li>Quando o lojista solicitar saque, a MisticPay envia o PIX automático de saída (cash-out) diretamente para a conta dele!</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botões de Ação */}
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
          Salvar Configurações (Chaves & Taxas)
        </Button>
      </div>
    </div>
  );
};

export default MisticPayIntegrationTab;
