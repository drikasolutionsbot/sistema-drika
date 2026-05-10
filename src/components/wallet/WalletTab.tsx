import { useState, useEffect, useMemo } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { formatDistanceToNow, subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import "./wallet-card.css";
import WalletDepositDialog from "./WalletDepositDialog";

interface WalletData {
  balance_cents: number;
  total_earned_cents: number;
  total_withdrawn_cents: number;
}

interface Transaction {
  id: string;
  type: string;
  amount_cents: number;
  description: string | null;
  status: string;
  pix_key: string | null;
  created_at: string;
}

interface PixOutProvider {
  id: string;
  provider_key: string;
  active: boolean;
  pix_out_enabled: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  efi: "Efí (Gerencianet)",
  lofypay: "LofyPay",
  misticpay: "MisticPay",
  mercadopago: "Mercado Pago",
  pushinpay: "PushinPay",
  abacatepay: "AbacatePay",
  stripe: "Stripe",
};

// Only these gateways have automated PIX OUT support
const PIX_OUT_CAPABLE = new Set(["efi", "lofypay", "misticpay"]);

export const WalletTab = () => {
  const { tenantId } = useTenant();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [providers, setProviders] = useState<PixOutProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPix, setWithdrawPix] = useState("");
  const [withdrawProvider, setWithdrawProvider] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    setLoading(true);
    const [walletRes, txRes, provRes] = await Promise.all([
      supabase
        .from("wallets" as any)
        .select("balance_cents, total_earned_cents, total_withdrawn_cents")
        .eq("tenant_id", tenantId!)
        .maybeSingle(),
      supabase
        .from("wallet_transactions" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("payment_providers" as any)
        .select("id, provider_key, active, pix_out_enabled")
        .eq("tenant_id", tenantId!),
    ]);

    setWallet((walletRes.data as any) ?? { balance_cents: 0, total_earned_cents: 0, total_withdrawn_cents: 0 });
    setTransactions(((txRes.data as any) ?? []) as Transaction[]);
    const provs = ((provRes.data as any) ?? []) as PixOutProvider[];
    setProviders(provs);
    // Auto-select first enabled gateway if not set
    const firstEnabled = provs.find((p) => p.active && p.pix_out_enabled);
    if (firstEnabled && !withdrawProvider) setWithdrawProvider(firstEnabled.provider_key);
    setLoading(false);
  };

  const togglePixOut = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("payment_providers" as any)
      .update({ pix_out_enabled: !current } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, pix_out_enabled: !current } : p)));
  };

  const enabledProviders = providers.filter((p) => p.active && p.pix_out_enabled);

  const handleWithdraw = async () => {
    const amountCents = Math.round(parseFloat(withdrawAmount.replace(",", ".")) * 100);
    if (!amountCents || amountCents <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    if (!withdrawPix.trim()) {
      toast({ title: "Informe a chave PIX", variant: "destructive" });
      return;
    }
    if (!withdrawProvider) {
      toast({ title: "Selecione um gateway de saída", variant: "destructive" });
      return;
    }
    if (wallet && amountCents > wallet.balance_cents) {
      toast({ title: "Saldo insuficiente", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-pix-withdraw", {
        body: {
          tenant_id: tenantId,
          amount_cents: amountCents,
          pix_key: withdrawPix.trim(),
          provider_key: withdrawProvider,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);

      toast({ title: "Saque enviado!", description: "PIX disparado pelo gateway. Saldo debitado." });
      setWithdrawAmount("");
      setWithdrawPix("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao sacar", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };


  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const weeklyBars = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return { date: format(d, "yyyy-MM-dd"), label: format(d, "EEE", { locale: ptBR }).charAt(0).toUpperCase() + format(d, "EEE", { locale: ptBR }).slice(1, 3), total: 0 };
    });

    transactions
      .filter((t) => t.type === "deposit" && t.status === "completed")
      .forEach((t) => {
        const key = t.created_at.slice(0, 10);
        const day = days.find((d) => d.date === key);
        if (day) day.total += t.amount_cents;
      });

    const max = Math.max(...days.map((d) => d.total), 1);
    return days.map((d) => ({ ...d, pct: Math.max((d.total / max) * 100, 8) }));
  }, [transactions]);

  const { thisMonth, lastMonth, changePercent } = useMemo(() => {
    const now = new Date();
    const thisMonthKey = format(now, "yyyy-MM");
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
    const lastMonthKey = format(lastMonthDate, "yyyy-MM");

    let tm = 0, lm = 0;
    transactions
      .filter((t) => t.type === "deposit" && t.status === "completed")
      .forEach((t) => {
        const m = t.created_at.slice(0, 7);
        if (m === thisMonthKey) tm += t.amount_cents;
        if (m === lastMonthKey) lm += t.amount_cents;
      });

    const pct = lm > 0 ? ((tm - lm) / lm) * 100 : tm > 0 ? 100 : 0;
    return { thisMonth: tm, lastMonth: lm, changePercent: pct };
  }, [transactions]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---- Premium Income Card ---- */}
      <div className="wallet-card-wrapper">
        <div className="wallet-card">
          <div className="wallet-card-top">
            <div className="wallet-card-header">
              <div className="flex items-center gap-3">
                <div className="wallet-icon-ring">
                  <Wallet className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium tracking-wider uppercase">Receita</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="wallet-amount">
                      {balanceVisible ? fmt(thisMonth) : "••••••"}
                    </span>
                    {changePercent !== 0 && (
                      <span className={`wallet-change ${changePercent >= 0 ? "positive" : "negative"}`}>
                        {changePercent >= 0 ? "↑" : "↓"} {Math.abs(changePercent).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setBalanceVisible(!balanceVisible)}
                className="wallet-toggle-eye"
              >
                {balanceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>

            {lastMonth > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1 ml-[52px]">
                Comparado a {fmt(lastMonth)} mês passado
              </p>
            )}

            <div className="wallet-stats-row">
              <div className="wallet-stat">
                <div className="wallet-stat-icon bg-emerald-500/20">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Recebido</p>
                  <p className="text-sm font-bold text-foreground">{balanceVisible ? fmt(wallet?.total_earned_cents ?? 0) : "••••"}</p>
                </div>
              </div>
              <div className="wallet-stat">
                <div className="wallet-stat-icon bg-orange-500/20">
                  <DollarSign className="h-3.5 w-3.5 text-orange-400" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Sacado</p>
                  <p className="text-sm font-bold text-foreground">{balanceVisible ? fmt(wallet?.total_withdrawn_cents ?? 0) : "••••"}</p>
                </div>
              </div>
              <div className="wallet-stat">
                <div className="wallet-stat-icon bg-primary/20">
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo</p>
                  <p className="text-sm font-bold text-foreground">{balanceVisible ? fmt(wallet?.balance_cents ?? 0) : "••••"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="wallet-chart">
            {weeklyBars.map((bar, i) => (
              <div key={bar.date} className="wallet-bar-col">
                <div
                  className="wallet-bar"
                  style={{
                    height: `${bar.pct}%`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                >
                  {bar.total > 0 && (
                    <span className="wallet-bar-value">{fmt(bar.total)}</span>
                  )}
                </div>
                <span className="wallet-bar-label">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Quick Actions: PIX IN / OUT ---- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <WalletDepositDialog
          onCredited={fetchData}
          trigger={
            <button className="group relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5 text-left transition-all hover:border-emerald-500/50 hover:shadow-[0_0_40px_-10px_hsl(var(--primary)/0.15)] hover:-translate-y-0.5">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl transition-all group-hover:bg-emerald-500/20" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/30 group-hover:scale-110 transition-transform">
                  <ArrowDownLeft className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.15em]">PIX IN</p>
                    <span className="h-1 w-1 rounded-full bg-emerald-400/40" />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Entrada</p>
                  </div>
                  <p className="text-base font-semibold text-foreground leading-tight">Depositar via PIX</p>
                  <p className="text-xs text-muted-foreground mt-1">Crédito instantâneo após pagamento</p>
                </div>
                <ArrowDownLeft className="h-4 w-4 text-emerald-400/40 group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
            </button>
          }
        />
        <button
          onClick={() => document.getElementById("wallet-withdraw-section")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          className="group relative overflow-hidden rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent p-5 text-left transition-all hover:border-orange-500/50 hover:shadow-[0_0_40px_-10px_hsl(var(--primary)/0.15)] hover:-translate-y-0.5"
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl transition-all group-hover:bg-orange-500/20" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 ring-1 ring-orange-500/30 group-hover:scale-110 transition-transform">
              <ArrowUpRight className="h-5 w-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-bold text-orange-400 uppercase tracking-[0.15em]">PIX OUT</p>
                <span className="h-1 w-1 rounded-full bg-orange-400/40" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saída</p>
              </div>
              <p className="text-base font-semibold text-foreground leading-tight">Solicitar Saque</p>
              <p className="text-xs text-muted-foreground mt-1">Processado em até 24h pelo admin</p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-orange-400/40 group-hover:text-orange-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
        </button>
      </div>

      {/* ---- Withdraw Form ---- */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/50 backdrop-blur-sm" id="wallet-withdraw-section">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />

        <div className="relative p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 ring-1 ring-orange-500/25">
                <ArrowUpRight className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <h3 className="text-foreground font-display font-semibold text-sm">Solicitar Saque</h3>
                <p className="text-[11px] text-muted-foreground">Disponível: <span className="font-mono font-semibold text-foreground">{fmt(wallet?.balance_cents ?? 0)}</span></p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/5 px-2.5 py-1 text-[10px] font-medium text-orange-400 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
              PIX
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-semibold">Valor (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono pointer-events-none">R$</span>
                <Input
                  placeholder="0,00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="wallet-input font-mono text-lg pl-10"
                />
              </div>
              <div className="flex gap-1.5 pt-1">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      const val = ((wallet?.balance_cents ?? 0) * pct) / 100 / 100;
                      setWithdrawAmount(val.toFixed(2).replace(".", ","));
                    }}
                    className="flex-1 rounded-md border border-border bg-muted/40 hover:bg-orange-500/10 hover:border-orange-500/30 hover:text-orange-400 text-[10px] font-semibold py-1.5 transition-colors text-muted-foreground"
                  >
                    {pct === 100 ? "MAX" : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-semibold">Chave PIX para receber</Label>
              <Input
                placeholder="CPF, email, telefone ou chave aleatória"
                value={withdrawPix}
                onChange={(e) => setWithdrawPix(e.target.value)}
                className="wallet-input font-mono"
              />
              <p className="text-[10px] text-muted-foreground pt-1 leading-relaxed">
                A chave precisa estar registrada no banco em seu nome.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-5 pt-5 border-t border-border/60">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Saques são processados pelo administrador em até 24h.
            </p>
            <Button onClick={handleWithdraw} disabled={submitting} size="lg" className="gap-2 gradient-pink border-none text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              Solicitar Saque
            </Button>
          </div>
        </div>
      </div>


      {/* ---- Transaction History ---- */}
      <div className="wallet-section">
        <div className="wallet-section-header mb-4">
          <div className="wallet-section-icon">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-foreground font-display font-semibold text-sm">Histórico de Transações</h3>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Nenhuma transação ainda
          </p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="wallet-tx-row">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    tx.type === "deposit" ? "bg-emerald-500/15" : "bg-orange-500/15"
                  }`}>
                    {tx.type === "deposit" ? (
                      <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-orange-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {tx.type === "deposit" ? "Depósito" : "Saque"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {tx.description || "—"} · {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${tx.type === "deposit" ? "text-emerald-400" : "text-orange-400"}`}>
                    {tx.type === "deposit" ? "+" : "−"}{fmt(tx.amount_cents)}
                  </span>
                  <span className={`wallet-tx-badge ${
                    tx.status === "completed" ? "completed" : tx.status === "pending" ? "pending" : "rejected"
                  }`}>
                    {tx.status === "completed" ? "Concluído" : tx.status === "pending" ? "Pendente" : "Rejeitado"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
