import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Percent,
  Info,
  ShieldCheck,
  Send,
  HelpCircle,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WalletData {
  id?: string;
  tenant_id: string;
  balance_cents: number;
  locked_balance_cents: number;
  total_earned_cents: number;
  total_withdrawn_cents: number;
}

interface WalletTx {
  id: string;
  tenant_id: string;
  type: "deposit" | "withdrawal" | "adjustment";
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  description: string | null;
  status: "pending" | "completed" | "rejected" | "processing";
  pix_key: string | null;
  pix_key_type: string | null;
  rejection_reason: string | null;
  created_at: string;
  completed_at: string | null;
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);

export default function WalletPage() {
  const { tenantId, tenant } = useTenant();
  const queryClient = useQueryClient();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Withdrawal modal state
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pixKeyType, setPixKeyType] = useState<string>("cpf");
  const [pixKey, setPixKey] = useState("");
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  // Load wallet and transactions
  const loadWalletData = useCallback(async (isRefresh = false) => {
    if (!tenantId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("manage-wallet", {
        body: { action: "get_wallet", tenant_id: tenantId },
      });

      if (error) throw error;
      if (data) {
        setWallet(data.wallet || null);
        setTransactions(data.transactions || []);
      }
    } catch (err: any) {
      console.error("Error loading wallet:", err);
      toast({
        title: "Erro ao carregar carteira",
        description: err.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  // Realtime subscription
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`wallet-realtime-${tenantId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "wallet_transactions", filter: `tenant_id=eq.${tenantId}` },
        () => {
          loadWalletData(true);
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "wallets", filter: `tenant_id=eq.${tenantId}` },
        () => {
          loadWalletData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, loadWalletData]);

  // Pre-fill PIX key from tenant settings if available
  useEffect(() => {
    if (tenant?.pix_key && !pixKey) {
      setPixKey(tenant.pix_key);
    }
    if (tenant?.pix_key_type && pixKeyType === "cpf") {
      setPixKeyType(tenant.pix_key_type);
    }
  }, [tenant, pixKey, pixKeyType]);

  // Calculations for withdrawal preview
  const parsedAmountCents = useMemo(() => {
    if (!withdrawAmount) return 0;
    const clean = withdrawAmount.replace(/[^\d.,]/g, "").replace(",", ".");
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.round(val * 100);
  }, [withdrawAmount]);

  const platformFeeCents = useMemo(() => {
    if (parsedAmountCents <= 0) return 0;
    return Math.round(parsedAmountCents * 0.02); // 2%
  }, [parsedAmountCents]);

  const netWithdrawCents = useMemo(() => {
    return Math.max(0, parsedAmountCents - platformFeeCents);
  }, [parsedAmountCents, platformFeeCents]);

  const availableBalanceCents = wallet?.balance_cents || 0;
  const isAmountValid = parsedAmountCents >= 500 && parsedAmountCents <= availableBalanceCents;

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (parsedAmountCents < 500) {
      toast({
        title: "Valor mínimo não atingido",
        description: "O valor mínimo para solicitação de saque é de R$ 5,00.",
        variant: "destructive",
      });
      return;
    }

    if (parsedAmountCents > availableBalanceCents) {
      toast({
        title: "Saldo insuficiente",
        description: "Você não possui saldo disponível suficiente para este saque.",
        variant: "destructive",
      });
      return;
    }

    if (!pixKey.trim()) {
      toast({
        title: "Chave PIX obrigatória",
        description: "Informe a chave PIX de destino para o saque.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingWithdraw(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-wallet", {
        body: {
          action: "request_withdrawal",
          tenant_id: tenantId,
          amount_cents: parsedAmountCents,
          pix_key: pixKey.trim(),
          pix_key_type: pixKeyType,
          description: `Saque PIX (${pixKeyType.toUpperCase()}: ${pixKey.trim()})`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Solicitação de saque enviada!",
        description: `Saque de ${formatBRL(parsedAmountCents)} solicitado com sucesso. Aguardando aprovação manual.`,
      });

      setWithdrawModalOpen(false);
      setWithdrawAmount("");
      loadWalletData(true);
    } catch (err: any) {
      toast({
        title: "Falha na solicitação",
        description: err.message || "Não foi possível solicitar o saque",
        variant: "destructive",
      });
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  // Quick percentage buttons
  const setPercentageAmount = (pct: number) => {
    const amount = Math.floor((availableBalanceCents * pct) / 100);
    setWithdrawAmount((amount / 100).toFixed(2).replace(".", ","));
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;

      // Status filter
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const descMatch = tx.description?.toLowerCase().includes(q);
        const pixMatch = tx.pix_key?.toLowerCase().includes(q);
        const idMatch = tx.id.toLowerCase().includes(q);
        return descMatch || pixMatch || idMatch;
      }

      return true;
    });
  }, [transactions, typeFilter, statusFilter, search]);

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Minha Carteira
              </h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seus recebimentos de vendas, saldo disponível e solicitações de saque via PIX.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadWalletData(true)}
            disabled={refreshing || loading}
            className="gap-2 border-border/60 hover:bg-muted/50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          <Button
            onClick={() => setWithdrawModalOpen(true)}
            disabled={availableBalanceCents < 500}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
          >
            <ArrowUpRight className="h-4 w-4" />
            Solicitar Saque
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Disponível */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-emerald-950/20 shadow-md">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-400">
            <Wallet className="h-20 w-20 -mr-4 -mt-4" />
          </div>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Saldo Disponível
              </span>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight text-emerald-400">
              {formatBRL(wallet?.balance_cents || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              Livre para saque imediato a partir de R$ 5,00
            </p>
          </CardContent>
        </Card>

        {/* Saldo Em Saque (Bloqueado) */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-amber-950/20 shadow-md">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-400">
            <Clock className="h-20 w-20 -mr-4 -mt-4" />
          </div>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Em Aprovação
              </span>
              <Clock className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight text-amber-400">
              {formatBRL(wallet?.locked_balance_cents || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Saques pendentes aguardando análise manual
            </p>
          </CardContent>
        </Card>

        {/* Total Recebido (Vendas) */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-blue-950/20 shadow-md">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-400">
            <TrendingUp className="h-20 w-20 -mr-4 -mt-4" />
          </div>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Recebido
              </span>
              <ArrowDownLeft className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight text-blue-400">
              {formatBRL(wallet?.total_earned_cents || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Total acumulado em vendas concluídas
            </p>
          </CardContent>
        </Card>

        {/* Total Sacado */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-purple-950/20 shadow-md">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-purple-400">
            <ArrowUpRight className="h-20 w-20 -mr-4 -mt-4" />
          </div>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Sacado
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight text-purple-400">
              {formatBRL(wallet?.total_withdrawn_cents || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Total transferido para sua conta PIX
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Split & Rules Information Banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
            <Percent className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              Sistema de Saque & Taxa da Plataforma
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                Taxa: 2%
              </Badge>
              <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                Mínimo: R$ 5,00
              </Badge>
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              O saldo das vendas de seus produtos cai diretamente em sua carteira. Os saques são analisados manualmente
              pela administração e enviados via PIX com taxa fixa de 2% retida pela plataforma.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setWithdrawModalOpen(true)}
          disabled={availableBalanceCents < 500}
          className="whitespace-nowrap border-primary/30 text-primary hover:bg-primary/10 shrink-0"
        >
          Sacar Saldo
        </Button>
      </div>

      {/* Transaction History Section */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-primary" />
                Extrato e Histórico de Transações
              </CardTitle>
              <CardDescription>
                Acompanhe todas as entradas de vendas e solicitações de saque da sua loja.
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar transação ou chave..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-[130px] text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="deposit">Vendas (Entradas)</SelectItem>
                  <SelectItem value="withdrawal">Saques (Saídas)</SelectItem>
                  <SelectItem value="adjustment">Ajustes</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[130px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="completed">Concluídos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="rejected">Rejeitados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary opacity-60" />
              <p className="text-sm">Carregando transações da carteira...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-3 opacity-20 text-muted-foreground" />
              <p className="text-base font-semibold text-foreground">Nenhuma transação encontrada</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                {search || typeFilter !== "all" || statusFilter !== "all"
                  ? "Tente ajustar os filtros acima para encontrar transações."
                  : "Quando suas vendas forem pagas ou você solicitar um saque, os registros aparecerão aqui."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                  <tr>
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Descrição / Detalhes</th>
                    <th className="py-3 px-4 text-right">Valor Bruto</th>
                    <th className="py-3 px-4 text-right">Taxa (2%)</th>
                    <th className="py-3 px-4 text-right">Valor Líquido</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredTransactions.map((tx) => {
                    const isDeposit = tx.type === "deposit";
                    const isWithdrawal = tx.type === "withdrawal";
                    const isAdjustment = tx.type === "adjustment";

                    return (
                      <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                        {/* Data */}
                        <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </td>

                        {/* Tipo */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isDeposit && (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-medium text-xs gap-1">
                              <ArrowDownLeft className="h-3 w-3" /> Venda
                            </Badge>
                          )}
                          {isWithdrawal && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 font-medium text-xs gap-1">
                              <ArrowUpRight className="h-3 w-3" /> Saque
                            </Badge>
                          )}
                          {isAdjustment && (
                            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-medium text-xs gap-1">
                              Ajuste
                            </Badge>
                          )}
                        </td>

                        {/* Descrição */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-medium text-foreground">
                            {tx.description || (isDeposit ? "Venda de produto" : "Saque PIX")}
                          </div>
                          {tx.pix_key && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Chave PIX: <span className="font-mono text-foreground/80">{tx.pix_key}</span>
                              {tx.pix_key_type && (
                                <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                                  ({tx.pix_key_type})
                                </span>
                              )}
                            </div>
                          )}
                          {tx.rejection_reason && (
                            <div className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              Motivo: {tx.rejection_reason}
                            </div>
                          )}
                        </td>

                        {/* Valor Bruto */}
                        <td className="py-3.5 px-4 text-right text-xs font-semibold whitespace-nowrap text-foreground">
                          {isDeposit ? `+${formatBRL(tx.amount_cents)}` : `-${formatBRL(tx.amount_cents)}`}
                        </td>

                        {/* Taxa */}
                        <td className="py-3.5 px-4 text-right text-xs whitespace-nowrap text-muted-foreground">
                          {tx.fee_cents > 0 ? `-${formatBRL(tx.fee_cents)}` : "R$ 0,00"}
                        </td>

                        {/* Valor Líquido */}
                        <td className="py-3.5 px-4 text-right text-xs font-bold whitespace-nowrap">
                          {isDeposit ? (
                            <span className="text-emerald-400">+{formatBRL(tx.net_amount_cents || tx.amount_cents)}</span>
                          ) : (
                            <span className="text-foreground">{formatBRL(tx.net_amount_cents || tx.amount_cents)}</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {tx.status === "completed" && (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px]">
                              Concluído
                            </Badge>
                          )}
                          {tx.status === "pending" && (
                            <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] gap-1">
                              <Clock className="h-3 w-3" /> Em Análise
                            </Badge>
                          )}
                          {tx.status === "processing" && (
                            <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[11px] gap-1">
                              Processando
                            </Badge>
                          )}
                          {tx.status === "rejected" && (
                            <Badge className="bg-destructive/15 text-destructive border border-destructive/30 text-[11px]">
                              Rejeitado
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Solicitar Saque */}
      <Dialog open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Wallet className="h-5 w-5 text-primary" />
              Solicitar Saque PIX
            </DialogTitle>
            <DialogDescription>
              Retire seu saldo disponível para sua conta bancária via chave PIX.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleWithdrawSubmit} className="space-y-4 py-2">
            {/* Saldo banner */}
            <div className="rounded-lg bg-muted/60 border border-border/60 p-3 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Saldo Disponível:</span>
                <p className="text-lg font-bold text-emerald-400">{formatBRL(availableBalanceCents)}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-muted-foreground block">Saque Mínimo:</span>
                <span className="text-xs font-semibold text-foreground">R$ 5,00</span>
              </div>
            </div>

            {/* Valor do saque */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount" className="text-xs font-semibold">
                  Valor a Sacar (R$)
                </Label>
                <div className="flex items-center gap-1">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setPercentageAmount(pct)}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-semibold">R$</span>
                <Input
                  id="amount"
                  placeholder="0,00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="pl-9 font-semibold text-base"
                  required
                />
              </div>
            </div>

            {/* Tipo de Chave PIX */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="keyType" className="text-xs font-semibold">
                  Tipo de Chave PIX
                </Label>
                <Select value={pixKeyType} onValueChange={setPixKeyType}>
                  <SelectTrigger id="keyType" className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Chave PIX */}
              <div className="space-y-1.5">
                <Label htmlFor="pixKey" className="text-xs font-semibold">
                  Chave PIX
                </Label>
                <Input
                  id="pixKey"
                  placeholder={
                    pixKeyType === "cpf"
                      ? "000.000.000-00"
                      : pixKeyType === "cnpj"
                      ? "00.000.000/0000-00"
                      : pixKeyType === "email"
                      ? "seu@email.com"
                      : pixKeyType === "telefone"
                      ? "(00) 00000-0000"
                      : "Chave aleatória UUID"
                  }
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
            </div>

            {/* Cálculo em tempo real */}
            {parsedAmountCents > 0 && (
              <div className="rounded-xl border border-border/80 bg-card/60 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Valor Solicitado (Bruto):</span>
                  <span className="font-semibold text-foreground">{formatBRL(parsedAmountCents)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    Taxa da Plataforma (2%):
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Taxa de intermediação de 2% retida pela plataforma</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="font-semibold text-destructive">-{formatBRL(platformFeeCents)}</span>
                </div>
                <div className="border-t border-border/50 pt-2 flex justify-between items-center">
                  <span className="font-bold text-foreground">Valor Líquido a Receber:</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    {formatBRL(netWithdrawCents)}
                  </span>
                </div>
              </div>
            )}

            {/* Aviso de aprovação manual */}
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 flex items-start gap-2 text-xs text-amber-300">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                <strong>Aprovação Manual:</strong> Por motivos de segurança, cada saque passa por conferência manual
                da equipe administrativa antes de ser creditado na sua conta bancária.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWithdrawModalOpen(false)}
                disabled={submittingWithdraw}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingWithdraw || !isAmountValid || !pixKey.trim()}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {submittingWithdraw ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Confirmar Saque
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
