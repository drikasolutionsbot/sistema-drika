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

export const WalletTab = () => {
  const { tenantId } = useTenant();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPix, setWithdrawPix] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    setLoading(true);
    const [walletRes, txRes] = await Promise.all([
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
    ]);

    setWallet((walletRes.data as any) ?? { balance_cents: 0, total_earned_cents: 0, total_withdrawn_cents: 0 });
    setTransactions(((txRes.data as any) ?? []) as Transaction[]);
    setLoading(false);
  };

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
    if (wallet && amountCents > wallet.balance_cents) {
      toast({ title: "Saldo insuficiente", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("wallet_transactions" as any)
        .insert({
          tenant_id: tenantId,
          type: "withdrawal",
          amount_cents: amountCents,
          description: "Saque via PIX",
          status: "pending",
          pix_key: withdrawPix.trim(),
        } as any);

      if (error) throw error;

      toast({ title: "Saque solicitado!", description: "Aguardando aprovação do administrador." });
      setWithdrawAmount("");
      setWithdrawPix("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao solicitar saque", description: err.message, variant: "destructive" });
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

      {/* ---- Withdraw Form ---- */}
      <div className="wallet-section">
        <div className="wallet-section-header">
          <div className="wallet-section-icon">
            <ArrowUpRight className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-foreground font-display font-semibold text-sm">Solicitar Saque</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Valor (R$)</Label>
            <Input
              placeholder="0,00"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="wallet-input font-mono text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Chave PIX para receber</Label>
            <Input
              placeholder="CPF, email, telefone ou chave aleatória"
              value={withdrawPix}
              onChange={(e) => setWithdrawPix(e.target.value)}
              className="wallet-input font-mono"
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <p className="text-[11px] text-muted-foreground">
            Saques são processados pelo administrador em até 24h.
          </p>
          <Button onClick={handleWithdraw} disabled={submitting} className="gap-2 gradient-pink border-none text-primary-foreground hover:opacity-90">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            Sacar
          </Button>
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
