import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
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
  Eye,
  EyeOff,
  Copy,
  Check,
  CreditCard,
  Wifi,
  SlidersHorizontal,
  Sparkles,
  QrCode,
  ArrowRight,
  KeyRound,
  Save,
  CheckCheck,
  Receipt,
  FileText,
  Download,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { format, isToday, isThisWeek, isThisMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { generateWithdrawalReceiptPDF, formatPixKeyDisplay } from "@/lib/withdrawalReceiptPdf";
import drikaBannerLogo from "@/assets/logo.png";

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
  payment_id?: string | null;
  admin_notes?: string | null;
  reference_id?: string | null;
  created_at: string;
  completed_at: string | null;
  is_pending_order?: boolean;
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);

export default function WalletPage() {
  const { tenantId, tenant, refetch: refetchTenant, planAccess } = useTenant();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTab = searchParams.get("tab") || "extrato";
  const handleTabChange = (tab: string) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("tab", tab);
    setSearchParams(sp, { replace: true });
  };

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Toggle hide/show balance
  const [showBalance, setShowBalance] = useState(() => {
    return localStorage.getItem("drika_wallet_show_balance") !== "false";
  });

  const toggleShowBalance = () => {
    const next = !showBalance;
    setShowBalance(next);
    localStorage.setItem("drika_wallet_show_balance", String(next));
  };

  // Search & Filter
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [transactionsVisibleCount, setTransactionsVisibleCount] = useState(10);

  // PIX Key configuration form state (aba Minha Chave PIX)
  const [pixInput, setPixInput] = useState(tenant?.pix_key || "");
  const [pixTypeInput, setPixTypeInput] = useState(tenant?.pix_key_type || "cpf");
  const [savingPixKey, setSavingPixKey] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(!tenant?.pix_key);

  useEffect(() => {
    if (tenant?.pix_key) {
      setPixInput(tenant.pix_key);
      setIsEditingKey(false);
    } else {
      setIsEditingKey(true);
    }
    if (tenant?.pix_key_type) setPixTypeInput(tenant.pix_key_type);
  }, [tenant?.pix_key, tenant?.pix_key_type]);

  // Withdrawal modal state
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [useCustomKey, setUseCustomKey] = useState(false);
  const [modalPixKeyType, setModalPixKeyType] = useState<string>(tenant?.pix_key_type || "cpf");
  const [modalPixKey, setModalPixKey] = useState(tenant?.pix_key || "");
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  // Transaction Detail & Receipt modal state
  const [selectedDetailTx, setSelectedDetailTx] = useState<WalletTx | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalTab, setDetailModalTab] = useState<"info" | "receipt">("info");
  const [copiedDetailText, setCopiedDetailText] = useState(false);

  // Dynamic Withdrawal Rules (Saque Mínimo + 1 Free/sem + R$ 1,00 extra)
  const [withdrawalRules, setWithdrawalRules] = useState<{
    min_withdrawal_cents: number;
    withdrawal_fee_cents: number;
    weekly_free_withdrawals: number;
    withdrawals_this_week: number;
    is_free_withdrawal: boolean;
  }>({
    min_withdrawal_cents: 1000,
    withdrawal_fee_cents: 100,
    weekly_free_withdrawals: 1,
    withdrawals_this_week: 0,
    is_free_withdrawal: true,
  });

  // Copied state
  const [copiedKey, setCopiedKey] = useState(false);

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
        if (data.rules) {
          setWithdrawalRules(data.rules);
        }
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
        () => loadWalletData(true)
      )
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "wallets", filter: `tenant_id=eq.${tenantId}` },
        () => loadWalletData(true)
      )
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` },
        () => loadWalletData(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, loadWalletData]);

  // Synchronize modal key with tenant registered key
  useEffect(() => {
    if (tenant?.pix_key && !useCustomKey) {
      setModalPixKey(tenant.pix_key);
      setModalPixKeyType(tenant.pix_key_type || "cpf");
    }
  }, [tenant?.pix_key, tenant?.pix_key_type, useCustomKey]);

  // Calculations for time periods (Hoje, Esta semana, Este mês)
  const stats = useMemo(() => {
    let todayCents = 0;
    let weekCents = 0;
    let monthCents = 0;

    for (const tx of transactions) {
      if (tx.type === "deposit" && tx.status === "completed") {
        try {
          const d = parseISO(tx.created_at);
          if (isToday(d)) todayCents += tx.amount_cents;
          if (isThisWeek(d, { weekStartsOn: 1 })) weekCents += tx.amount_cents;
          if (isThisMonth(d)) monthCents += tx.amount_cents;
        } catch {}
      }
    }

    return { todayCents, weekCents, monthCents };
  }, [transactions]);

  // Save PIX Key from PIX tab
  const handleSavePixKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (!pixInput.trim()) {
      toast({
        title: "Chave PIX obrigatória",
        description: "Informe a chave PIX para salvar.",
        variant: "destructive",
      });
      return;
    }

    setSavingPixKey(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            pix_key: pixInput.trim(),
            pix_key_type: pixTypeInput,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await refetchTenant();
      setIsEditingKey(false);
      toast({
        title: "Chave PIX salva com sucesso!",
        description: "Esta chave será aplicada automaticamente em todas as suas solicitações de saque.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar chave PIX",
        description: err.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setSavingPixKey(false);
    }
  };

  // Withdrawal calculations
  const parsedAmountCents = useMemo(() => {
    if (!withdrawAmount) return 0;
    const clean = withdrawAmount.replace(/[^\d.,]/g, "").replace(",", ".");
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.round(val * 100);
  }, [withdrawAmount]);

  // Regra de Saque: 1º saque da semana é gratuito (0%). Passou de 1, taxa fixa de R$ 1,00
  const minWithdrawalCents = withdrawalRules.min_withdrawal_cents || 1000;
  const currentWithdrawalFeeCents = withdrawalRules.is_free_withdrawal
    ? 0
    : (withdrawalRules.withdrawal_fee_cents || 100);

  const netWithdrawCents = Math.max(0, parsedAmountCents - currentWithdrawalFeeCents);

  const availableBalanceCents = wallet?.balance_cents || 0;
  const effectivePixKey = useCustomKey || !tenant?.pix_key ? modalPixKey : tenant.pix_key;
  const effectivePixKeyType = useCustomKey || !tenant?.pix_key ? modalPixKeyType : (tenant.pix_key_type || "cpf");

  const isAmountValid = parsedAmountCents >= minWithdrawalCents && parsedAmountCents <= availableBalanceCents;

  // Apenas 1 saque pendente por vez: libera novo saque somente após aprovação/rejeição
  const pendingWithdrawal = useMemo(
    () =>
      transactions.find(
        (tx) => tx.type === "withdrawal" && (tx.status === "pending" || tx.status === "processing")
      ) || null,
    [transactions]
  );

  const showPendingWithdrawalError = () => {
    toast({
      title: "Você já tem 1 saque pendente",
      description: pendingWithdrawal
        ? `Seu saque de ${formatBRL(pendingWithdrawal.amount_cents)} está aguardando aprovação. Aguarde para solicitar um novo saque.`
        : "Aguarde a aprovação do saque atual para solicitar um novo.",
      variant: "destructive",
    });
  };

  const openWithdrawModal = () => {
    if (pendingWithdrawal) {
      showPendingWithdrawalError();
      return;
    }
    setWithdrawModalOpen(true);
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || submittingWithdraw) return;

    if (pendingWithdrawal) {
      showPendingWithdrawalError();
      setWithdrawModalOpen(false);
      return;
    }

    if (parsedAmountCents < minWithdrawalCents) {
      toast({
        title: "Valor mínimo de saque",
        description: `O valor mínimo para solicitar saque é de ${formatBRL(minWithdrawalCents)}.`,
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

    if (!effectivePixKey.trim()) {
      toast({
        title: "Chave PIX obrigatória",
        description: "Informe ou cadastre uma chave PIX para receber o saque.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingWithdraw(true);
    try {
      // If client didn't have a registered PIX key and wants to save it as default
      if ((!tenant?.pix_key || saveAsDefault) && effectivePixKey) {
        supabase.functions.invoke("update-tenant", {
          body: {
            tenant_id: tenantId,
            updates: {
              pix_key: effectivePixKey.trim(),
              pix_key_type: effectivePixKeyType,
            },
          },
        }).then(() => refetchTenant()).catch(() => {});
      }

      const { data, error } = await supabase.functions.invoke("manage-wallet", {
        body: {
          action: "request_withdrawal",
          tenant_id: tenantId,
          amount_cents: parsedAmountCents,
          pix_key: effectivePixKey.trim(),
          pix_key_type: effectivePixKeyType,
          description: `Saque PIX (${effectivePixKeyType.toUpperCase()}: ${effectivePixKey.trim()})`,
        },
      });

      if (error) {
        // Extrai a mensagem real retornada pela edge function (ex.: saque pendente)
        let serverMsg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const errBody = await ctx.json();
            if (errBody?.error) serverMsg = errBody.error;
          }
        } catch { /* ignore */ }
        if (/saque pendente/i.test(serverMsg || "")) {
          toast({ title: "Você já tem 1 saque pendente", description: serverMsg, variant: "destructive" });
          setWithdrawModalOpen(false);
          loadWalletData(true);
          return;
        }
        throw new Error(serverMsg);
      }
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Solicitação de saque enviada!",
        description: `Saque de ${formatBRL(parsedAmountCents)} solicitado para ${effectivePixKey.trim()}. Aguardando aprovação manual.`,
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

  const setPercentageAmount = (pct: number) => {
    const amount = Math.floor((availableBalanceCents * pct) / 100);
    setWithdrawAmount((amount / 100).toFixed(2).replace(".", ","));
  };

  const handleCopyTenantPix = () => {
    if (!tenant?.pix_key) return;
    navigator.clipboard.writeText(tenant.pix_key);
    setCopiedKey(true);
    toast({ title: "Chave PIX copiada!" });
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
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

  // Displayed transactions (progressive pagination)
  const displayedTransactions = useMemo(() => {
    if (search.trim()) {
      return filteredTransactions;
    }
    return filteredTransactions.slice(0, transactionsVisibleCount);
  }, [filteredTransactions, search, transactionsVisibleCount]);

  // Display user / tenant name
  const accountHolderName = useMemo(() => {
    return (
      tenant?.name ||
      user?.user_metadata?.full_name ||
      user?.email?.split("@")[0] ||
      "LUCAS PEREIRA DE SOUZA"
    ).toUpperCase();
  }, [tenant, user]);

  // Last 4 digits for virtual card
  const cardLastDigits = useMemo(() => {
    if (!tenantId) return "7720";
    const digits = tenantId.replace(/\D/g, "");
    return digits.length >= 4 ? digits.slice(-4) : "7720";
  }, [tenantId]);

  const handleDownloadReceipt = (tx: WalletTx) => {
    generateWithdrawalReceiptPDF({
      id: tx.id,
      tenant_id: tx.tenant_id,
      store_name: accountHolderName,
      amount_cents: tx.amount_cents,
      net_amount_cents: tx.net_amount_cents || tx.amount_cents,
      fee_cents: tx.fee_cents || 0,
      pix_key: tx.pix_key,
      pix_key_type: tx.pix_key_type,
      payment_id: tx.payment_id || null,
      admin_notes: tx.admin_notes || null,
      created_at: tx.created_at,
      completed_at: tx.completed_at || tx.created_at,
    });
    toast({
      title: "Comprovante baixado!",
      description: "O PDF oficial com a logo da Drika Hub foi gerado com sucesso.",
    });
  };

  const handleCopyReceiptText = (tx: WalletTx) => {
    const text = [
      `📄 COMPROVANTE OFICIAL DE TRANSFERÊNCIA PIX — DRIKA HUB`,
      `Status: CONCLUÍDO / LIQUIDADO`,
      `Valor Líquido Transferido: ${formatBRL(tx.net_amount_cents || tx.amount_cents)}`,
      `Favorecido / Loja: ${accountHolderName}`,
      `Chave PIX de Destino: ${formatPixKeyDisplay(tx.pix_key, tx.pix_key_type)} (${(tx.pix_key_type || "PIX").toUpperCase()})`,
      `Origem dos Recursos: Drika Hub (Caixa Central)`,
      `Gateway Processador: MisticPay / PIX Automático`,
      `ID da Transação: ${tx.id}`,
      tx.payment_id ? `ID de Liquidação PIX: ${tx.payment_id}` : null,
      `Data da Solicitação: ${format(new Date(tx.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`,
      tx.completed_at ? `Data da Efetivação: ${format(new Date(tx.completed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}` : null,
      `Autenticação Digital: ${tx.id.replace(/-/g, "").toUpperCase()}`,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text);
    setCopiedDetailText(true);
    setTimeout(() => setCopiedDetailText(false), 2000);
    toast({
      title: "Texto copiado!",
      description: "Comprovante copiado para a área de transferência.",
    });
  };

  return (
    <div className="space-y-6 w-full text-slate-100">
      {/* ─── 1. Header estilo Fintech ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-sans">
              {accountHolderName}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Verificada
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Bem-vindo de volta — resumo da sua conta hoje.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/taxas")}
            className="gap-2 border-pink-500/30 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20 hover:text-white"
          >
            <Calculator className="h-3.5 w-3.5" />
            Calculadora de Margem & Taxas
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadWalletData(true)}
            disabled={refreshing || loading}
            className="gap-2 border-slate-800 bg-[#0d1321] text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          <Button
            onClick={openWithdrawModal}
            disabled={availableBalanceCents <= 0}
            className="gap-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold shadow-lg shadow-pink-900/30 transition-all hover:scale-[1.02]"
          >
            <ArrowUpRight className="h-4 w-4" />
            Solicitar Saque
          </Button>
        </div>
      </div>

      {/* ─── Banner para Lojista em Plano Pago (Isento de Carteira / Recebimento Direto) ─── */}
      {planAccess.canUseOwnGateways && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-[#0a1628] to-[#070b14] p-4 sm:p-5 shadow-lg">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 shrink-0 mt-0.5">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Plano Pago Ativo — Suas vendas caem 100% no seu Gateway Próprio
                </h3>
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">
                  Taxa 0% Drika
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Como assinante, você não precisa de intermediação da Carteira: o valor total das suas vendas é creditado diretamente no gateway próprio configurado por você em <Link to="/settings?tab=gateways" className="underline font-semibold text-emerald-400 hover:text-emerald-300">Configurações &gt; Gateways</Link>. O saldo abaixo representa valores residuais (ex.: de quando a loja operava no Plano Free).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. Hero Card Principal (Saldo + Cartão 3D) ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-[#080d19] via-[#0b1324] to-[#070b14] p-6 md:p-8 shadow-2xl">
        {/* Glow de fundo */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-pink-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Lado Esquerdo: Saldo + Métricas */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <div className="flex items-center gap-2.5 text-xs text-slate-400 font-medium">
                <span>Saldo disponível</span>
                <button
                  type="button"
                  onClick={toggleShowBalance}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                  title={showBalance ? "Ocultar saldo" : "Mostrar saldo"}
                >
                  {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => loadWalletData(true)}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                  title="Atualizar saldo"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="mt-2 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white font-sans">
                {showBalance ? formatBRL(availableBalanceCents) : "R$ ••••••"}
              </div>
            </div>

            {/* Sub-métricas: Pendentes, Hoje, Esta semana, Este mês */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
              {/* Pendentes */}
              <div className="space-y-1">
                <span className="text-xs text-slate-400 block font-medium">Pendentes</span>
                <p className="text-base sm:text-lg font-bold text-slate-200">
                  {showBalance ? formatBRL(wallet?.locked_balance_cents || 0) : "••••"}
                </p>
              </div>

              {/* Hoje */}
              <div className="space-y-1 border-l border-slate-800/80 pl-4 sm:pl-4">
                <span className="text-xs text-slate-400 block font-medium">Hoje</span>
                <p className="text-base sm:text-lg font-bold text-slate-200">
                  {showBalance ? formatBRL(stats.todayCents) : "••••"}
                </p>
              </div>

              {/* Esta semana */}
              <div className="space-y-1 sm:border-l border-slate-800/80 sm:pl-4">
                <span className="text-xs text-slate-400 block font-medium">Esta semana</span>
                <p className="text-base sm:text-lg font-bold text-slate-200">
                  {showBalance ? formatBRL(stats.weekCents) : "••••"}
                </p>
              </div>

              {/* Este mês */}
              <div className="space-y-1 border-l border-slate-800/80 pl-4 sm:pl-4">
                <span className="text-xs text-slate-400 block font-medium">Este mês</span>
                <p className="text-base sm:text-lg font-bold text-slate-200">
                  {showBalance ? formatBRL(stats.monthCents) : "••••"}
                </p>
              </div>
            </div>

            {/* Aviso: saque pendente bloqueia novas solicitações */}
            {pendingWithdrawal && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/25 p-3.5 flex items-start sm:items-center gap-3">
                <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
                <div className="text-xs text-amber-200/90 leading-relaxed">
                  <strong className="text-white font-semibold">Você tem 1 saque pendente:</strong>{" "}
                  {formatBRL(pendingWithdrawal.amount_cents)} aguardando aprovação. Assim que for aprovado, você poderá solicitar um novo saque.
                </div>
              </div>
            )}

            {/* Banner de Status / Aprovação */}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <Clock className="h-5 w-5 text-blue-400 shrink-0 mt-0.5 sm:mt-0" />
                <div className="text-xs text-blue-200/90 leading-relaxed">
                  <strong className="text-white font-semibold">Regras de Split & Saques PIX:</strong>{" "}
                  Taxa por venda aprovada: <strong>R$ 1,00 fixo + 2%</strong>. Você tem <strong>1 saque semanal grátis</strong> (saques extras na semana: R$ 1,00 • mínimo R$ 10,00).
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/taxas")}
                className="shrink-0 text-xs font-bold text-pink-400 hover:text-pink-300 underline underline-offset-4 bg-transparent border-none cursor-pointer self-start sm:self-center"
              >
                Simular Margem →
              </button>
            </div>
          </div>

          {/* Lado Direito: Cartão 3D Virtual Estilo Fintech */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative group w-full max-w-[360px] aspect-[1.586/1] rounded-2xl p-6 bg-gradient-to-br from-white via-slate-100 to-slate-200 text-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/80 transition-all duration-500 hover:scale-[1.03] hover:-rotate-1 cursor-pointer overflow-hidden flex flex-col justify-between">
              {/* Marca d'água de ondas no cartão */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
              <div className="absolute -right-16 -top-16 w-48 h-48 bg-gradient-to-br from-blue-400/20 via-pink-400/20 to-transparent rounded-full blur-2xl pointer-events-none" />

              {/* Linha superior: Chip EMV + Ícone Contactless + Logo */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  {/* Golden Chip */}
                  <div className="w-10 h-8 rounded-md bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 border border-amber-600/40 relative shadow-sm overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-amber-800/40" />
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-amber-800/40" />
                    <div className="w-5 h-4 border border-amber-700/30 rounded-sm" />
                  </div>

                  {/* Contactless Waves */}
                  <Wifi className="h-5 w-5 text-slate-400 rotate-90" />
                </div>

                {/* Logo da Loja / DrikaHub */}
                <div className="flex items-center gap-1.5 font-black text-xs tracking-wider text-slate-800 uppercase">
                  <Sparkles className="h-4 w-4 text-pink-600" />
                  <span>DRIKA HUB</span>
                </div>
              </div>

              {/* Número do Cartão */}
              <div className="my-auto pt-2 relative z-10">
                <p className="font-mono text-lg sm:text-xl font-bold tracking-[0.22em] text-slate-700">
                  •••• •••• •••• {cardLastDigits}
                </p>
              </div>

              {/* Linha inferior: Nome + Validade + Badge Tier */}
              <div className="flex items-end justify-between relative z-10">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Titular da Conta
                  </span>
                  <p className="font-mono text-xs sm:text-sm font-bold tracking-wider text-slate-800 truncate max-w-[200px]">
                    {accountHolderName}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">
                      Validade
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700">12/30</span>
                  </div>

                  <span className="px-2 py-0.5 rounded border border-slate-300 bg-white/80 text-[10px] font-black uppercase tracking-wider text-slate-700 shadow-sm">
                    {tenant?.plan ? tenant.plan.toUpperCase() : "MEMBER"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. Segunda Linha: Distribuição de Recebimentos + Resumo da Carteira ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card: Distribuição de recebimentos */}
        <Card className="lg:col-span-6 border-slate-800/80 bg-[#0a0f1d] shadow-lg">
          <CardHeader className="pb-3 border-b border-slate-800/60">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              Distribuição de recebimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
              {/* Gráfico Donut SVG Circular */}
              <div className="sm:col-span-5 flex justify-center">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="text-slate-800/60 stroke-current"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="text-emerald-500 stroke-current"
                      strokeWidth="10"
                      strokeDasharray="251.2"
                      strokeDashoffset={wallet?.total_earned_cents ? "0" : "251.2"}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total</span>
                    <span className="text-sm font-extrabold text-white">
                      {showBalance ? formatBRL(wallet?.total_earned_cents || 0) : "••••"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista com porcentagens e valores */}
              <div className="sm:col-span-7 space-y-3.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="font-medium text-slate-200">PIX</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-white block">
                      {showBalance ? formatBRL(wallet?.total_earned_cents || 0) : "••••"}
                    </span>
                    <span className="text-[10px] text-slate-400">100.0%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                    <span className="font-medium text-slate-300">Cartão</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-white block">R$ 0,00</span>
                    <span className="text-[10px] text-slate-400">0.0%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
                    <span className="font-medium text-slate-300">Cripto</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-white block">R$ 0,00</span>
                    <span className="text-[10px] text-slate-400">0.0%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card: Dados de Saque & Chave PIX Padrão */}
        <Card className="lg:col-span-6 border-slate-800/80 bg-[#0a0f1d] shadow-lg flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-slate-800/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Percent className="h-4 w-4 text-pink-500" />
                Chave PIX de Saque & Regras
              </CardTitle>
              {withdrawalRules.is_free_withdrawal ? (
                <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                  1º Saque Semanal: Grátis (0%)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] border-amber-500/30 text-amber-400 bg-amber-500/10">
                  Saque Adicional: Taxa {formatBRL(withdrawalRules.withdrawal_fee_cents)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Chave PIX Cadastrada para Saque</span>
                <span className="font-mono text-xs font-semibold text-white">
                  {tenant?.pix_key || "Nenhuma chave cadastrada"}
                </span>
                {tenant?.pix_key_type && (
                  <span className="ml-1.5 text-[10px] uppercase text-emerald-400 font-mono">
                    ({tenant.pix_key_type})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {tenant?.pix_key ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyTenantPix}
                      className="h-8 gap-1 border-slate-700 bg-slate-900 text-xs"
                      title="Copiar Chave PIX"
                    >
                      {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTabChange("pix")}
                      className="h-8 text-xs border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200"
                    >
                      Alterar
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleTabChange("pix")}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    Cadastrar Chave
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-slate-900/60 border border-slate-800/60 p-3">
                <span className="text-slate-400 block">Total Já Sacado:</span>
                <span className="text-sm font-bold text-purple-400 mt-0.5 block">
                  {showBalance ? formatBRL(wallet?.total_withdrawn_cents || 0) : "••••"}
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/60 border border-slate-800/60 p-3">
                <span className="text-slate-400 block">Saque Mínimo:</span>
                <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                  {formatBRL(withdrawalRules.min_withdrawal_cents)}
                </span>
              </div>
            </div>

            {/* Mensagem de Transparência de Saques */}
            <div className="rounded-xl border border-blue-500/25 bg-blue-950/20 p-3 flex items-start gap-2.5 text-xs text-blue-200">
              <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-white font-semibold">Política de Transparência nos Saques:</strong>{" "}
                Você tem direito a <strong>1 saque gratuito por semana</strong>. Caso solicite saques adicionais na mesma semana ({withdrawalRules.withdrawals_this_week} já solicitado(s)), é cobrada uma taxa fixa de apenas <strong>{formatBRL(withdrawalRules.withdrawal_fee_cents)}</strong> por transferência para cobrir tarifas bancárias do PIX. O valor mínimo para saque é de <strong>{formatBRL(withdrawalRules.min_withdrawal_cents)}</strong>.
              </div>
            </div>

            <Button
              onClick={openWithdrawModal}
              disabled={availableBalanceCents <= 0}
              className="w-full gap-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold shadow-md"
            >
              <ArrowUpRight className="h-4 w-4" />
              Solicitar Novo Saque
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ─── 4. Abas: Extrato de Transações vs Minha Chave PIX ─── */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="bg-slate-900/60 p-1 border border-slate-800/80 flex flex-wrap h-auto gap-1 w-full justify-start">
          <TabsTrigger value="extrato" className="gap-2 text-xs data-[state=active]:bg-[#0a0f1d] data-[state=active]:text-white">
            <SlidersHorizontal className="h-4 w-4 text-pink-500" /> Extrato & Histórico
          </TabsTrigger>
          <TabsTrigger value="pix" className="gap-2 text-xs data-[state=active]:bg-[#0a0f1d] data-[state=active]:text-white">
            <QrCode className="h-4 w-4 text-emerald-400" /> Minha Chave PIX (Saques)
            {tenant?.pix_key && (
              <Badge className="ml-1 px-1.5 py-0 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Ativa
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: Extrato de Transações ─── */}
        <TabsContent value="extrato">
          <Card className="border-slate-800/80 bg-[#0a0f1d] shadow-lg">
            <CardHeader className="border-b border-slate-800/60 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                    <SlidersHorizontal className="h-5 w-5 text-pink-500" />
                    Extrato e Histórico de Transações
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Acompanhe todas as entradas de vendas e transferências de saque da sua conta.
                  </CardDescription>
                </div>

                {/* Filter controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Buscar transação ou chave..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-9 text-xs border-slate-800 bg-[#070b14] text-slate-200"
                    />
                  </div>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9 w-[130px] text-xs border-slate-800 bg-[#070b14] text-slate-200">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-[#0a0f1d] text-slate-200">
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="deposit">Vendas (Entradas)</SelectItem>
                      <SelectItem value="withdrawal">Saques (Saídas)</SelectItem>
                      <SelectItem value="adjustment">Ajustes</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[130px] text-xs border-slate-800 bg-[#070b14] text-slate-200">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-[#0a0f1d] text-slate-200">
                      <SelectItem value="all">Todos status</SelectItem>
                      <SelectItem value="completed">Concluídos</SelectItem>
                      <SelectItem value="pending">Em Análise</SelectItem>
                      <SelectItem value="rejected">Rejeitados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-pink-500 opacity-60" />
                  <p className="text-sm">Carregando transações da carteira...</p>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Wallet className="h-12 w-12 mx-auto mb-3 opacity-20 text-slate-500" />
                  <p className="text-base font-semibold text-white">Nenhuma transação encontrada</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    {search || typeFilter !== "all" || statusFilter !== "all"
                      ? "Tente ajustar os filtros para encontrar transações."
                      : "Quando suas vendas forem concluídas ou você solicitar um saque, os registros aparecerão aqui."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#070b14]/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/60">
                      <tr>
                        <th className="py-3 px-4">Data / Hora</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4">Descrição / Detalhes</th>
                        <th className="py-3 px-4 text-right">Valor Bruto</th>
                        <th className="py-3 px-4 text-right">Taxas Retidas</th>
                        <th className="py-3 px-4 text-right">Valor Líquido</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Ações & Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {displayedTransactions.map((tx) => {
                        const isDeposit = tx.type === "deposit";
                        const isWithdrawal = tx.type === "withdrawal";
                        const isAdjustment = tx.type === "adjustment";

                        return (
                          <tr key={tx.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                              {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {isDeposit && (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-medium text-xs gap-1">
                                  <ArrowDownLeft className="h-3 w-3" /> Venda
                                </Badge>
                              )}
                              {isWithdrawal && (
                                <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/20 font-medium text-xs gap-1">
                                  <ArrowUpRight className="h-3 w-3" /> Saque
                                </Badge>
                              )}
                              {isAdjustment && (
                                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-medium text-xs gap-1">
                                  Ajuste
                                </Badge>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="text-xs font-medium text-slate-200">
                                {tx.description || (isDeposit ? "Venda de produto" : "Saque PIX")}
                              </div>
                              {tx.pix_key && (
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Chave PIX: <span className="font-mono text-slate-300">{formatPixKeyDisplay(tx.pix_key, tx.pix_key_type)}</span>
                                  {tx.pix_key_type && (
                                    <span className="ml-1 text-[10px] uppercase text-slate-500">
                                      ({tx.pix_key_type})
                                    </span>
                                  )}
                                </div>
                              )}
                              {tx.rejection_reason && (
                                <div className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  Motivo: {tx.rejection_reason}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right text-xs font-semibold whitespace-nowrap text-slate-200">
                              {isDeposit ? `+${formatBRL(tx.amount_cents)}` : `-${formatBRL(tx.amount_cents)}`}
                            </td>

                            <td className="py-3.5 px-4 text-right text-xs whitespace-nowrap text-slate-400">
                              {tx.fee_cents > 0 ? `-${formatBRL(tx.fee_cents)}` : "R$ 0,00"}
                            </td>

                            <td className="py-3.5 px-4 text-right text-xs font-bold whitespace-nowrap">
                              {isDeposit ? (
                                <span className="text-emerald-400">+{formatBRL(tx.net_amount_cents || tx.amount_cents)}</span>
                              ) : (
                                <span className="text-white">{formatBRL(tx.net_amount_cents || tx.amount_cents)}</span>
                              )}
                            </td>

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
                                <Badge className="bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[11px]">
                                  Rejeitado
                                </Badge>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {isWithdrawal && tx.status === "completed" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedDetailTx(tx);
                                        setDetailModalTab("receipt");
                                        setDetailModalOpen(true);
                                      }}
                                      className="h-7 text-xs px-2.5 gap-1 border-pink-500/30 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20 hover:text-white"
                                      title="Ver Comprovante Oficial PIX"
                                    >
                                      <Receipt className="h-3.5 w-3.5 text-pink-400" />
                                      <span className="hidden sm:inline">Comprovante</span>
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDownloadReceipt(tx)}
                                      className="h-7 text-xs px-2 gap-1 border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white"
                                      title="Baixar Comprovante em PDF"
                                    >
                                      <Download className="h-3.5 w-3.5 text-slate-400" />
                                      <span className="hidden md:inline">PDF</span>
                                    </Button>
                                  </>
                                )}

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedDetailTx(tx);
                                    setDetailModalTab("info");
                                    setDetailModalOpen(true);
                                  }}
                                  className="h-7 text-xs px-2.5 gap-1 border-slate-800 bg-[#070b14] text-slate-300 hover:bg-slate-800 hover:text-white"
                                  title="Ver Informações e Auditoria"
                                >
                                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                                  <span>Detalhes</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginação progressiva do Extrato */}
                {filteredTransactions.length > 0 && (
                  <div className="p-3 border-t border-slate-800/60 bg-[#070b14]/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                    <div>
                      {search.trim() ? (
                        <span>
                          Encontradas <strong className="text-white">{filteredTransactions.length}</strong> transações para &quot;{search}&quot;
                        </span>
                      ) : (
                        <span>
                          Mostrando <strong className="text-white">{Math.min(transactionsVisibleCount, filteredTransactions.length)}</strong> de <strong className="text-white">{filteredTransactions.length}</strong> transações
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {filteredTransactions.length > transactionsVisibleCount && !search.trim() && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTransactionsVisibleCount((prev) => prev + 20)}
                            className="h-7 text-xs border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white"
                          >
                            Carregar mais (+20)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTransactionsVisibleCount(filteredTransactions.length)}
                            className="h-7 text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          >
                            Ver todas ({filteredTransactions.length})
                          </Button>
                        </>
                      )}
                      {transactionsVisibleCount > 10 && !search.trim() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTransactionsVisibleCount(10)}
                          className="h-7 text-xs text-slate-400 hover:text-slate-200"
                        >
                          Mostrar apenas 10
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: Minha Chave PIX para Saques ─── */}
        <TabsContent value="pix">
          <Card className="border-slate-800/80 bg-[#0a0f1d] shadow-lg">
            <CardHeader className="border-b border-slate-800/60 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                    <QrCode className="h-5 w-5 text-emerald-400" />
                    Chave PIX Cadastrada para Recebimento de Saques
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Cadastre a sua chave PIX bancária. Ela será aplicada e preenchida automaticamente sempre que você solicitar um saque.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Card de Chave Ativa (quando já cadastrada e não editando) */}
              {tenant?.pix_key && !isEditingKey ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                        <CheckCheck className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">Chave PIX Ativa</span>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-mono">
                            {tenant.pix_key_type || "CPF"}
                          </Badge>
                        </div>
                        <p className="font-mono text-base font-bold text-emerald-300 mt-1">
                          {tenant.pix_key}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Todos os saques solicitados serão enviados diretamente para esta chave bancária.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyTenantPix}
                        className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs gap-1.5"
                      >
                        {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedKey ? "Copiada!" : "Copiar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingKey(true)}
                        className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs"
                      >
                        Alterar Chave
                      </Button>
                      <Button
                        size="sm"
                        onClick={openWithdrawModal}
                        disabled={availableBalanceCents <= 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1 shadow-md"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Sacar com esta Chave
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Formulário de Cadastro / Edição da Chave PIX */
                <form onSubmit={handleSavePixKey} className="space-y-4 max-w-2xl">
                  <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-3.5 flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-200/90 leading-relaxed">
                      Informe sua chave PIX com atenção. Ao salvar, ela se tornará a sua <strong>chave padrão de recebimento</strong>, sendo automaticamente aplicada em todas as suas solicitações de saque.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label htmlFor="pixType" className="text-xs font-semibold text-slate-200">
                        Tipo de Chave PIX
                      </Label>
                      <Select value={pixTypeInput} onValueChange={setPixTypeInput}>
                        <SelectTrigger id="pixType" className="text-xs border-slate-800 bg-[#070b14] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-slate-800 bg-[#0a0f1d] text-white">
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="cnpj">CNPJ</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="telefone">Telefone</SelectItem>
                          <SelectItem value="aleatoria">Chave Aleatória (EVP)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="pixValue" className="text-xs font-semibold text-slate-200">
                        Chave PIX
                      </Label>
                      <Input
                        id="pixValue"
                        placeholder={
                          pixTypeInput === "cpf"
                            ? "000.000.000-00"
                            : pixTypeInput === "cnpj"
                            ? "00.000.000/0000-00"
                            : pixTypeInput === "email"
                            ? "seu@email.com"
                            : pixTypeInput === "telefone"
                            ? "(00) 00000-0000"
                            : "Ex: 123e4567-e89b-12d3-a456-426614174000"
                        }
                        value={pixInput}
                        onChange={(e) => setPixInput(e.target.value)}
                        className="text-xs border-slate-800 bg-[#070b14] text-white font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="submit"
                      disabled={savingPixKey || !pixInput.trim()}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                    >
                      {savingPixKey ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Salvar Chave PIX de Saque
                    </Button>

                    {tenant?.pix_key && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setPixInput(tenant.pix_key || "");
                          setPixTypeInput(tenant.pix_key_type || "cpf");
                          setIsEditingKey(false);
                        }}
                        className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── 5. Modal: Solicitar Saque ─── */}
      <Dialog open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen}>
        <DialogContent className="sm:max-w-lg border-slate-800 bg-[#0a0f1d] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
              <Wallet className="h-5 w-5 text-pink-500" />
              Solicitar Saque PIX
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Transfira seu saldo disponível para sua conta bancária via chave PIX.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleWithdrawSubmit} className="space-y-4 py-2">
            {/* Saldo banner */}
            <div className="rounded-xl bg-[#070b14] border border-slate-800 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Saldo Disponível:</span>
                <p className="text-xl font-black text-emerald-400">{formatBRL(availableBalanceCents)}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-medium">Saque Mínimo:</span>
                <span className="text-xs font-bold text-emerald-400">{formatBRL(withdrawalRules.min_withdrawal_cents)}</span>
              </div>
            </div>

            {/* Status da Cota Semanal de Saques */}
            <div className={`rounded-xl border p-3 flex items-start gap-2.5 text-xs ${
              withdrawalRules.is_free_withdrawal 
                ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200" 
                : "border-amber-500/30 bg-amber-950/20 text-amber-200"
            }`}>
              {withdrawalRules.is_free_withdrawal ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">
                {withdrawalRules.is_free_withdrawal ? (
                  <span>
                    <strong className="text-white">1º Saque Semanal Gratuito:</strong> Você tem direito a 1 saque por semana 100% isento de taxa PIX!
                  </span>
                ) : (
                  <span>
                    <strong className="text-white">Saque Adicional na Semana:</strong> Você já realizou seu saque gratuito desta semana ({withdrawalRules.withdrawals_this_week} realizado(s)). Para cobrir o custo bancário do PIX, será descontada a taxa fixa de <strong>{formatBRL(withdrawalRules.withdrawal_fee_cents)}</strong> diretamente do envio.
                  </span>
                )}
              </div>
            </div>

            {/* Valor do saque */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount" className="text-xs font-semibold text-slate-200">
                  Valor a Sacar (R$)
                </Label>
                <div className="flex items-center gap-1">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setPercentageAmount(pct)}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 hover:bg-pink-600/30 hover:text-pink-400 transition-colors text-slate-300"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-slate-400 font-semibold">R$</span>
                <Input
                  id="amount"
                  placeholder="0,00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="pl-9 font-semibold text-base border-slate-800 bg-[#070b14] text-white"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Valor mínimo para saque: <span className="text-slate-200 font-semibold">{formatBRL(withdrawalRules.min_withdrawal_cents)}</span>
                {parsedAmountCents > 0 && parsedAmountCents < withdrawalRules.min_withdrawal_cents && (
                  <span className="text-rose-400 block font-medium mt-0.5">
                    O valor digitado está abaixo do mínimo exigido ({formatBRL(withdrawalRules.min_withdrawal_cents)}).
                  </span>
                )}
              </p>
            </div>

            {/* Chave PIX de Destino */}
            {tenant?.pix_key && !useCustomKey ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Chave PIX Padrão Cadastrada
                  </span>
                  <button
                    type="button"
                    onClick={() => setUseCustomKey(true)}
                    className="text-[11px] text-slate-400 hover:text-white underline"
                  >
                    Usar outra chave
                  </button>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <p className="font-mono text-sm font-bold text-white">
                    {formatPixKeyDisplay(tenant.pix_key, tenant.pix_key_type)}
                  </p>
                  <span className="text-[10px] uppercase font-mono text-slate-400">
                    ({tenant.pix_key_type || "CPF"})
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {tenant?.pix_key && useCustomKey && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Usando chave alternativa:</span>
                    <button
                      type="button"
                      onClick={() => setUseCustomKey(false)}
                      className="text-emerald-400 hover:underline text-xs"
                    >
                      Voltar para chave cadastrada
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="keyType" className="text-xs font-semibold text-slate-200">
                      Tipo de Chave
                    </Label>
                    <Select value={modalPixKeyType} onValueChange={setModalPixKeyType}>
                      <SelectTrigger id="keyType" className="text-xs border-slate-800 bg-[#070b14] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-800 bg-[#0a0f1d] text-white">
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="aleatoria">Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pixKey" className="text-xs font-semibold text-slate-200">
                      Chave PIX
                    </Label>
                    <Input
                      id="pixKey"
                      placeholder="Chave de destino"
                      value={modalPixKey}
                      onChange={(e) => setModalPixKey(e.target.value)}
                      className="text-xs border-slate-800 bg-[#070b14] text-white"
                      required
                    />
                  </div>
                </div>

                {!tenant?.pix_key && (
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={saveAsDefault}
                      onChange={(e) => setSaveAsDefault(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-pink-600 focus:ring-0"
                    />
                    Salvar esta chave como padrão para próximos saques
                  </label>
                )}
              </div>
            )}

            {/* Cálculo em tempo real */}
            {parsedAmountCents > 0 && (
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Valor Solicitado (Bruto):</span>
                  <span className="font-semibold text-white">{formatBRL(parsedAmountCents)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span className="flex items-center gap-1">
                    Taxa de Transferência PIX:
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-slate-500 cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            {withdrawalRules.is_free_withdrawal
                              ? "1º saque semanal gratuito. A plataforma absorve 100% dos custos bancários."
                              : `A partir do 2º saque na mesma semana, é retida a taxa fixa de ${formatBRL(withdrawalRules.withdrawal_fee_cents)} para cobrir o custo bancário do PIX.`}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  {withdrawalRules.is_free_withdrawal ? (
                    <span className="font-semibold text-emerald-400">R$ 0,00 (1º da Semana Grátis)</span>
                  ) : (
                    <span className="font-semibold text-amber-400">-{formatBRL(withdrawalRules.withdrawal_fee_cents)}</span>
                  )}
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between items-center">
                  <span className="font-bold text-white">Valor Líquido a Receber no PIX:</span>
                  <span className="text-lg font-black text-emerald-400">
                    {formatBRL(netWithdrawCents)}
                  </span>
                </div>
              </div>
            )}

            {/* Aviso de aprovação manual */}
            <div className="rounded-lg bg-blue-950/30 border border-blue-500/20 p-2.5 flex items-start gap-2 text-xs text-blue-200">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
              <span>
                <strong>Aprovação Manual:</strong> O saque será transferido via PIX para sua chave bancária após conferência da administração.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWithdrawModalOpen(false)}
                disabled={submittingWithdraw}
                className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingWithdraw || !isAmountValid || !effectivePixKey.trim()}
                className="gap-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold"
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

      {/* ─── 6. Modal: Informações da Transação & Comprovante Oficial PIX ─── */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-4xl w-full border-slate-800 bg-[#070b14] text-white max-h-[92vh] p-0 overflow-hidden flex flex-col shadow-2xl">
          <DialogHeader className="p-5 border-b border-slate-800/80 bg-[#0a0f1d] shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
                  <SlidersHorizontal className="h-5 w-5 text-pink-500" />
                  {selectedDetailTx?.type === "withdrawal"
                    ? "Detalhamento de Saque PIX & Comprovante"
                    : selectedDetailTx?.type === "deposit"
                    ? "Detalhamento de Recebimento de Venda"
                    : "Detalhamento da Transação"}
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs mt-1">
                  Auditoria completa da transação com identificadores do sistema e liquidação bancária.
                </DialogDescription>
              </div>

              {selectedDetailTx && (
                <div className="flex items-center gap-2">
                  {selectedDetailTx.type === "withdrawal" ? (
                    <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/30 text-xs">
                      Saque PIX
                    </Badge>
                  ) : selectedDetailTx.type === "deposit" ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                      Venda de Produto
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs">
                      Ajuste
                    </Badge>
                  )}

                  {selectedDetailTx.status === "completed" && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                      Concluído
                    </Badge>
                  )}
                  {selectedDetailTx.status === "pending" && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                      Em Análise
                    </Badge>
                  )}
                  {selectedDetailTx.status === "processing" && (
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                      Processando
                    </Badge>
                  )}
                  {selectedDetailTx.status === "rejected" && (
                    <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-xs">
                      Rejeitado
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Modal Tab Switcher */}
            {selectedDetailTx?.type === "withdrawal" && selectedDetailTx.status === "completed" && (
              <div className="flex gap-2 pt-3 border-t border-slate-800/60 mt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDetailModalTab("info")}
                  className={cn(
                    "h-8 text-xs font-semibold gap-1.5",
                    detailModalTab === "info"
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  )}
                >
                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                  Informações & Detalhes
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDetailModalTab("receipt")}
                  className={cn(
                    "h-8 text-xs font-semibold gap-1.5",
                    detailModalTab === "receipt"
                      ? "bg-pink-600/20 text-pink-300 border border-pink-500/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  )}
                >
                  <Receipt className="h-3.5 w-3.5 text-pink-400" />
                  Comprovante Oficial PIX
                </Button>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {selectedDetailTx && detailModalTab === "receipt" && selectedDetailTx.type === "withdrawal" && selectedDetailTx.status === "completed" ? (
              <div className="space-y-4">
                {/* Voucher Card Container */}
                <div className="rounded-2xl border border-slate-700 bg-white text-slate-900 p-6 md:p-8 shadow-xl space-y-6">
                  {/* Header with Drika Hub Logo */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={drikaBannerLogo}
                        alt="Drika Hub"
                        className="h-10 w-auto object-contain"
                      />
                    </div>
                    <div className="text-left sm:text-right text-xs text-slate-500 space-y-0.5">
                      <p className="font-semibold text-slate-700">Comprovante de Transferência PIX</p>
                      <p className="text-[11px]">Saque Aprovado & Liquidado</p>
                      <p className="text-[10px] text-slate-400">
                        Emitido em: {format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  {/* Sucesso Banner */}
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3 text-emerald-900">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-sm">TRANSFERÊNCIA PIX CONCLUÍDA COM SUCESSO</p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Efetivado em:{" "}
                        {selectedDetailTx.completed_at
                          ? format(new Date(selectedDetailTx.completed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
                          : format(new Date(selectedDetailTx.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  {/* Valor Líquido Card */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-5">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      Valor Líquido Transferido via PIX
                    </span>
                    <p className="text-3xl sm:text-4xl font-black text-slate-900 mt-1 font-sans">
                      {formatBRL(selectedDetailTx.net_amount_cents || selectedDetailTx.amount_cents)}
                    </p>
                  </div>

                  {/* Detalhes da Transferência */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                    <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-800 border-b border-slate-200 uppercase tracking-wider text-[11px]">
                      Dados da Transferência PIX
                    </div>
                    <div className="divide-y divide-slate-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-1">
                        <span className="font-semibold text-slate-600">Favorecido / Loja:</span>
                        <span className="font-bold text-slate-900">{accountHolderName}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-1">
                        <span className="font-semibold text-slate-600">Chave PIX de Destino:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatPixKeyDisplay(selectedDetailTx.pix_key, selectedDetailTx.pix_key_type)}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-1">
                        <span className="font-semibold text-slate-600">Tipo de Chave:</span>
                        <span className="uppercase font-semibold text-slate-800">
                          {selectedDetailTx.pix_key_type || "CPF"}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-1">
                        <span className="font-semibold text-slate-600">Origem dos Recursos:</span>
                        <span className="font-semibold text-slate-800">Drika Hub (Caixa Central)</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-1">
                        <span className="font-semibold text-slate-600">Gateway Processador:</span>
                        <span className="font-semibold text-slate-800">MisticPay / PIX Automático</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-1">
                        <span className="font-semibold text-slate-600">ID da Transação:</span>
                        <span className="font-mono text-slate-700 text-[11px]">{selectedDetailTx.id}</span>
                      </div>
                      {selectedDetailTx.payment_id && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-1">
                          <span className="font-semibold text-slate-600">ID Liquidação PIX (Gateway):</span>
                          <span className="font-mono text-slate-700 text-[11px]">{selectedDetailTx.payment_id}</span>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-1">
                        <span className="font-semibold text-slate-600">Data e Hora da Solicitação:</span>
                        <span className="text-slate-800">
                          {format(new Date(selectedDetailTx.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé de autenticação */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center space-y-1">
                    <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                      Autenticação Digital: {selectedDetailTx.id.replace(/-/g, "").toUpperCase()}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Documento emitido eletronicamente pela plataforma Drika Hub com validade jurídica.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-4 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Valor Bruto</span>
                    <p className="text-xl font-bold text-white">
                      {formatBRL(selectedDetailTx?.amount_cents || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-4 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Taxas Retidas (Split)</span>
                    <p className="text-xl font-bold text-amber-400">
                      {selectedDetailTx?.fee_cents ? `-${formatBRL(selectedDetailTx.fee_cents)}` : "R$ 0,00"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-4 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {selectedDetailTx?.type === "withdrawal" ? "Líquido Transferido" : "Líquido Creditado"}
                    </span>
                    <p className="text-xl font-black text-emerald-400">
                      {formatBRL(selectedDetailTx?.net_amount_cents || selectedDetailTx?.amount_cents || 0)}
                    </p>
                  </div>
                </div>

                {/* Audit Details Grid */}
                <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Identificadores Técnicos & Rastreabilidade
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-[#070b14] border border-slate-800/80 gap-2">
                      <span className="text-slate-400">ID da Transação:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-200 text-[11px] break-all">{selectedDetailTx?.id}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (selectedDetailTx?.id) {
                              navigator.clipboard.writeText(selectedDetailTx.id);
                              toast({ title: "ID copiado!" });
                            }
                          }}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {selectedDetailTx?.payment_id && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-[#070b14] border border-slate-800/80 gap-2">
                        <span className="text-slate-400">ID Liquidação Gateway:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-200 text-[11px] break-all">{selectedDetailTx.payment_id}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedDetailTx.payment_id!);
                              toast({ title: "ID Gateway copiado!" });
                            }}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {selectedDetailTx?.pix_key && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-[#070b14] border border-slate-800/80 gap-2">
                        <span className="text-slate-400">Chave PIX de Destino:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-emerald-300">
                            {formatPixKeyDisplay(selectedDetailTx.pix_key, selectedDetailTx.pix_key_type)}
                          </span>
                          {selectedDetailTx.pix_key_type && (
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {selectedDetailTx.pix_key_type}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedDetailTx.pix_key!);
                              toast({ title: "Chave copiada!" });
                            }}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-[#070b14] border border-slate-800/80 gap-2">
                      <span className="text-slate-400">Data e Hora de Criação:</span>
                      <span className="text-slate-200">
                        {selectedDetailTx?.created_at
                          ? format(new Date(selectedDetailTx.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
                          : "-"}
                      </span>
                    </div>

                    {selectedDetailTx?.completed_at && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-[#070b14] border border-slate-800/80 gap-2">
                        <span className="text-slate-400">Data e Hora de Efetivação:</span>
                        <span className="text-emerald-300 font-semibold">
                          {format(new Date(selectedDetailTx.completed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </span>
                      </div>
                    )}

                    {selectedDetailTx?.rejection_reason && (
                      <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 space-y-1">
                        <span className="font-bold flex items-center gap-1.5 text-xs text-rose-400">
                          <AlertCircle className="h-4 w-4" /> Motivo da Rejeição:
                        </span>
                        <p className="text-xs">{selectedDetailTx.rejection_reason}</p>
                      </div>
                    )}

                    {selectedDetailTx?.admin_notes && (
                      <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/20 text-blue-200 space-y-1">
                        <span className="font-semibold text-xs text-blue-300">Observações Administrativas:</span>
                        <p className="text-xs text-slate-300">{selectedDetailTx.admin_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-slate-800/80 bg-[#0a0f1d] shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {selectedDetailTx?.type === "withdrawal" && selectedDetailTx.status === "completed" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleDownloadReceipt(selectedDetailTx)}
                    className="gap-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar Comprovante (PDF)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyReceiptText(selectedDetailTx)}
                    className="gap-1.5 border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
                  >
                    {copiedDetailText ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    Copiar Texto
                  </Button>
                </>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailModalOpen(false)}
              className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
