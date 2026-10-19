import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  SlidersHorizontal,
  Coins,
  DollarSign,
  TrendingUp,
  Percent,
  Building,
  ChevronRight,
  ShieldAlert,
  Shield,
  Edit3,
  Eye,
  EyeOff,
  Sparkles,
  Wifi,
  CreditCard,
  Send,
  AlertCircle,
  PiggyBank,
  ArrowRight,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Hash,
  FileText,
  ExternalLink,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlatformMetrics {
  total_balance_cents: number;
  total_locked_cents: number;
  total_earned_cents: number;
  total_withdrawn_cents: number;
  total_fees_collected_cents: number;
  pending_count: number;
  pending_amount_cents: number;
  pending_net_cents: number;
}

interface WithdrawalItem {
  id: string;
  tenant_id: string;
  type: string;
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  description: string | null;
  status: "pending" | "completed" | "rejected";
  pix_key: string | null;
  pix_key_type: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  created_at: string;
  completed_at: string | null;
  tenants?: {
    name: string;
    logo_url: string | null;
    plan: string;
  } | null;
  source_order?: {
    id: string;
    order_number?: number;
    tenant_id: string;
    discord_username: string | null;
    discord_user_id: string | null;
    product_name: string;
    total_cents: number;
    status: string;
    payment_provider: string | null;
    payment_id: string | null;
    created_at: string;
  } | null;
  source_deposit?: {
    id: string;
    amount_cents: number;
    net_amount_cents: number;
    fee_cents: number;
    description: string | null;
    payment_id: string | null;
    created_at: string;
  } | null;
  recent_orders?: any[];
  wallet_balance_cents?: number;
}

interface TenantWalletItem {
  id: string;
  tenant_id: string;
  balance_cents: number;
  locked_balance_cents: number;
  total_earned_cents: number;
  total_withdrawn_cents: number;
  updated_at: string;
  tenants?: {
    name: string;
    logo_url: string | null;
    plan: string;
  } | null;
}

export interface SalesAuditItem {
  id: string;
  order_number?: number;
  tenant_id: string;
  discord_username: string | null;
  discord_user_id: string | null;
  product_name: string;
  total_cents: number;
  status: string;
  payment_provider: string | null;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
  tenants?: {
    id: string;
    name: string;
    logo_url: string | null;
    plan: string;
  } | null;
}

export interface WalletDepositItem {
  id: string;
  tenant_id: string;
  type: string;
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  description: string | null;
  status: string;
  payment_id: string | null;
  created_at: string;
  completed_at: string | null;
  tenants?: {
    id: string;
    name: string;
    logo_url: string | null;
    plan: string;
  } | null;
}

export interface AuditSummary {
  total_sales_cents: number;
  total_sales_count: number;
  total_platform_fees_cents: number;
  average_ticket_cents: number;
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);

export default function AdminWalletPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [wallets, setWallets] = useState<TenantWalletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Toggle hide/show balance
  const [showBalance, setShowBalance] = useState(() => {
    return localStorage.getItem("drika_admin_show_balance") !== "false";
  });

  const toggleShowBalance = () => {
    const next = !showBalance;
    setShowBalance(next);
    localStorage.setItem("drika_admin_show_balance", String(next));
  };

  // Active Tab
  const [activeTab, setActiveTab] = useState("withdrawals");

  // Filters
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState("pending");
  const [searchWithdrawals, setSearchWithdrawals] = useState("");
  const [searchWallets, setSearchWallets] = useState("");

  // Audit state
  const [auditSales, setAuditSales] = useState<SalesAuditItem[]>([]);
  const [auditDeposits, setAuditDeposits] = useState<WalletDepositItem[]>([]);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [searchAudit, setSearchAudit] = useState("");
  const [auditStoreFilter, setAuditStoreFilter] = useState("all");
  // Audit provider is always coldpayments (the only split gateway on the platform)
  const auditProviderFilter = "coldpayments";
  const [selectedAuditSale, setSelectedAuditSale] = useState<SalesAuditItem | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [copiedAuditId, setCopiedAuditId] = useState<string | null>(null);
  const [auditVisibleCount, setAuditVisibleCount] = useState(10);
  const [walletsVisibleCount, setWalletsVisibleCount] = useState(20);
  const [withdrawalsVisibleCount, setWithdrawalsVisibleCount] = useState(10);
  const [splitWalletEnabled, setSplitWalletEnabled] = useState(true);
  const [savingSplit, setSavingSplit] = useState(false);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WithdrawalItem | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processingAction, setProcessingAction] = useState(false);
  const [gatewayErrorAlert, setGatewayErrorAlert] = useState<string | null>(null);

  // Rejection Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<TenantWalletItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"credit" | "debit">("credit");
  const [adjustReason, setAdjustReason] = useState("");

  // Copied PIX Key indicator
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Load all admin data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Metrics
      const mRes = await supabase.functions.invoke("manage-wallet", {
        body: { action: "admin_metrics" },
      });
      if (mRes.data?.metrics) setMetrics(mRes.data.metrics);

      // 2. Withdrawals
      const wRes = await supabase.functions.invoke("manage-wallet", {
        body: { action: "admin_list_withdrawals", status: "all" },
      });
      if (wRes.data?.withdrawals) setWithdrawals(wRes.data.withdrawals);

      // 3. Wallets
      const wlRes = await supabase.functions.invoke("manage-wallet", {
        body: { action: "admin_list_wallets" },
      });
      if (wlRes.data?.wallets) setWallets(wlRes.data.wallets);

      // 4. Audit Sales & Inflows
      const aRes = await supabase.functions.invoke("manage-wallet", {
        body: { action: "admin_audit_sales" },
      });
      if (aRes.data) {
        setAuditSales(aRes.data.sales || []);
        setAuditDeposits(aRes.data.deposits || []);
        setAuditSummary(aRes.data.summary || null);
      }

      // 5. Split Wallet Mode
      const sRes = await supabase.functions.invoke("manage-gateway-settings", {
        body: { action: "get_split_mode" },
      });
      if (sRes.data && typeof sRes.data.enabled === "boolean") {
        setSplitWalletEnabled(sRes.data.enabled);
      }
    } catch (err: any) {
      console.error("Error loading admin wallet data:", err);
      toast({
        title: "Erro ao carregar dados",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Handle Toggle Split Mode
  const handleToggleSplit = async (newVal: boolean) => {
    setSavingSplit(true);
    try {
      const res = await supabase.functions.invoke("manage-gateway-settings", {
        body: { action: "set_split_mode", enabled: newVal },
      });
      if (res.error) throw res.error;
      setSplitWalletEnabled(newVal);
      toast({
        title: newVal ? "Modo Split & Carteira ATIVADO" : "Modo Split DESATIVADO",
        description: newVal
          ? "O Bot Externo e o Checkout agora operam exclusivamente com a Gateway Central da Plataforma."
          : "O Bot Externo agora opera com as gateways avulsas configuradas pelos lojistas.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao alternar modo split",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingSplit(false);
    }
  };

  useEffect(() => {
    loadData();

    // Realtime: auto-refresh when orders are created or updated, or wallet transactions change
    const channel = supabase
      .channel("admin-wallet-realtime")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "orders" },
        () => loadData()
      )
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "wallet_transactions" },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // Handle Copy PIX Key
  const handleCopyPixKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    toast({ title: "Chave PIX copiada!", description: key });
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  // Handle Copy text in Audit Modal
  const handleCopyAuditText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAuditId(id);
    toast({ title: "Copiado para a área de transferência!", description: text });
    setTimeout(() => setCopiedAuditId(null), 2500);
  };

  // Handle Copy full withdrawal audit report
  const handleCopyWithdrawalReport = (tx: WithdrawalItem) => {
    const report = `--- COMPROVANTE & REVISÃO DE SAQUE ---
Loja: ${tx.tenants?.name || "Loja"} (${tx.tenant_id})
Data do Saque: ${format(new Date(tx.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
Status: ${tx.status.toUpperCase()}

PRODUTO & VENDA DE ORIGEM:
Loja: ${tx.tenants?.name || "Loja"}
Produto: ${tx.source_order?.product_name || "Venda Loja"}
Pedido: #${tx.source_order?.order_number || tx.source_order?.id?.slice(0, 8) || "—"}
Comprador Discord: ${tx.source_order?.discord_username ? `@${tx.source_order.discord_username}` : "—"}
Entrada Bruta da Venda: ${formatBRL(tx.source_order?.total_cents || tx.amount_cents)}
Taxas Retidas na Venda: ${formatBRL(tx.source_deposit?.fee_cents ?? (tx.source_order?.commission_cents ?? 0))}
Crédito na Carteira: ${formatBRL(tx.source_deposit?.net_amount_cents || tx.amount_cents)}

DADOS DO PAGAMENTO PIX:
Bruto Solicitado: ${formatBRL(tx.amount_cents)}
Taxa Saque Plataforma (2%): ${formatBRL(tx.fee_cents)}
LÍQUIDO A PAGAR: ${formatBRL(tx.net_amount_cents || tx.amount_cents - tx.fee_cents)}
Chave PIX: ${tx.pix_key} (${tx.pix_key_type?.toUpperCase() || "PIX"})

ID Saque: ${tx.id}
ID Gateway / Transação: ${tx.source_order?.payment_id || tx.payment_id || "—"}
--------------------------------------`;
    navigator.clipboard.writeText(report);
    toast({
      title: "Relatório de Revisão Copiado!",
      description: "O resumo detalhado foi copiado para a área de transferência.",
    });
  };

  // Handle Approve (automated gateway PIX or manual)
  const handleApproveSubmit = async (manual = false) => {
    if (!selectedTx) return;
    setProcessingAction(true);
    setGatewayErrorAlert(null);

    try {
      const res = await supabase.functions.invoke("manage-wallet", {
        body: {
          action: "admin_approve_withdrawal",
          tx_id: selectedTx.id,
          admin_notes: adminNotes.trim() || undefined,
          manual_approval: manual,
        },
      });

      if (res.error) {
        let msg = res.error.message;
        try {
          const body = await res.error.context?.json();
          if (body?.message) msg = body.message;
          else if (body?.error) msg = body.error;
        } catch { /* fallback */ }
        throw new Error(msg);
      }

      if (res.data?.error) {
        throw new Error(res.data.message || res.data.error);
      }

      toast({
        title: manual ? "Saque aprovado manualmente!" : "Saque aprovado e PIX enviado!",
        description: manual
          ? `O saque de ${formatBRL(selectedTx.net_amount_cents || selectedTx.amount_cents)} foi registrado como concluído.`
          : `O PIX de ${formatBRL(selectedTx.net_amount_cents || selectedTx.amount_cents)} foi transferido com sucesso pela ColdPayments.`,
      });

      setApproveModalOpen(false);
      setSelectedTx(null);
      setAdminNotes("");
      setGatewayErrorAlert(null);
      loadData(true);
    } catch (err: any) {
      console.error("Approve error:", err);
      const msg = err.message || "Erro ao aprovar saque";
      setGatewayErrorAlert(msg);
      toast({
        title: "Erro ao aprovar saque",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setProcessingAction(false);
    }
  };

  // Handle Reject
  const handleRejectSubmit = async () => {
    if (!selectedTx) return;
    if (!rejectionReason.trim()) {
      toast({
        title: "Motivo obrigatório",
        description: "Informe a justificativa da rejeição para o cliente.",
        variant: "destructive",
      });
      return;
    }

    setProcessingAction(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-wallet", {
        body: {
          action: "admin_reject_withdrawal",
          tx_id: selectedTx.id,
          rejection_reason: rejectionReason.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const refundedCents = data?.refunded_cents || selectedTx.amount_cents;
      toast({
        title: "Saque rejeitado!",
        description: `O valor de ${formatBRL(refundedCents)} foi devolvido ao saldo disponível da loja.`,
      });

      setRejectModalOpen(false);
      setSelectedTx(null);
      setRejectionReason("");
      loadData(true);
    } catch (err: any) {
      toast({
        title: "Erro ao rejeitar saque",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setProcessingAction(false);
    }
  };

  // Handle Manual Balance Adjustment
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWallet) return;

    const clean = adjustAmount.replace(/[^\d.,]/g, "").replace(",", ".");
    const val = parseFloat(clean);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }

    const cents = Math.round(val * 100);
    const finalCents = adjustType === "debit" ? -cents : cents;

    setProcessingAction(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-wallet", {
        body: {
          action: "admin_adjust_balance",
          tenant_id: selectedWallet.tenant_id,
          amount_cents: finalCents,
          reason: adjustReason.trim() || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Saldo ajustado com sucesso!",
        description: `${adjustType === "credit" ? "Crédito" : "Débito"} de ${formatBRL(cents)} realizado.`,
      });

      setAdjustModalOpen(false);
      setSelectedWallet(null);
      setAdjustAmount("");
      setAdjustReason("");
      loadData(true);
    } catch (err: any) {
      toast({
        title: "Erro ao ajustar saldo",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setProcessingAction(false);
    }
  };

  // ── Meu Lucro: R$0,60 gateway fixo + 2% plataforma retidos na venda (pode sacar)
  const platformProfitCents = useMemo(() => metrics?.total_fees_collected_cents || 0, [metrics]);

  // ── Saldo comprometido: dinheiro dos clientes que ainda está na plataforma
  // (saldo livre nas carteiras + em saque bloqueado aguardando PIX)
  const clientsCommittedCents = useMemo(() => {
    return (metrics?.total_balance_cents || 0) + (metrics?.total_locked_cents || 0);
  }, [metrics]);

  // ── Total físico custodiado pela plataforma
  const totalInVaultCents = useMemo(() => platformProfitCents + clientsCommittedCents, [platformProfitCents, clientsCommittedCents]);

  // ── Projeção de taxas futuras com base nos saldos disponíveis (R$0,60 + 2% por saque)
  const projectedFutureFeesCents = useMemo(() => {
    if (!metrics?.total_balance_cents) return 0;
    // Estimativa: 2% de plataforma sobre o saldo disponível
    return Math.round(metrics.total_balance_cents * 0.02);
  }, [metrics]);

  // Donut chart percentages
  const distributionPercentages = useMemo(() => {
    const total = totalInVaultCents || 1;
    const clientBalancePct = Math.round(((metrics?.total_balance_cents || 0) / total) * 100);
    const pendingPct = Math.round(((metrics?.total_locked_cents || 0) / total) * 100);
    const feesPct = Math.max(0, 100 - clientBalancePct - pendingPct);
    return { clientBalancePct, pendingPct, feesPct };
  }, [totalInVaultCents, metrics]);

  // Filtered Withdrawals
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      if (withdrawalStatusFilter !== "all" && w.status !== withdrawalStatusFilter) {
        return false;
      }
      if (searchWithdrawals.trim()) {
        const q = searchWithdrawals.toLowerCase();
        const tenantName = w.tenants?.name?.toLowerCase() || "";
        const pixKey = w.pix_key?.toLowerCase() || "";
        const desc = w.description?.toLowerCase() || "";
        return tenantName.includes(q) || pixKey.includes(q) || desc.includes(q) || w.id.includes(q);
      }
      return true;
    });
  }, [withdrawals, withdrawalStatusFilter, searchWithdrawals]);

  // Displayed Withdrawals (progressive pagination)
  const displayedWithdrawals = useMemo(() => {
    if (searchWithdrawals.trim()) {
      return filteredWithdrawals;
    }
    return filteredWithdrawals.slice(0, withdrawalsVisibleCount);
  }, [filteredWithdrawals, searchWithdrawals, withdrawalsVisibleCount]);

  // Filtered Wallets
  const filteredWallets = useMemo(() => {
    return wallets.filter((w) => {
      if (searchWallets.trim()) {
        const q = searchWallets.toLowerCase();
        const tenantName = w.tenants?.name?.toLowerCase() || "";
        return tenantName.includes(q) || w.tenant_id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [wallets, searchWallets]);

  // Displayed Wallets (progressive pagination)
  const displayedWallets = useMemo(() => {
    if (searchWallets.trim()) {
      return filteredWallets;
    }
    return filteredWallets.slice(0, walletsVisibleCount);
  }, [filteredWallets, searchWallets, walletsVisibleCount]);

  // Filtered Audit Sales
  const filteredAuditSales = useMemo(() => {
    return auditSales.filter((item) => {
      if (auditStoreFilter !== "all" && item.tenant_id !== auditStoreFilter) {
        return false;
      }
      if (
        auditProviderFilter !== "all" &&
        (item.payment_provider || "").toLowerCase() !== auditProviderFilter.toLowerCase()
      ) {
        return false;
      }
      if (searchAudit.trim()) {
        const q = searchAudit.toLowerCase();
        const storeName = (item.tenants?.name || "").toLowerCase();
        const productName = (item.product_name || "").toLowerCase();
        const discordUser = (item.discord_username || "").toLowerCase();
        const discordId = (item.discord_user_id || "").toLowerCase();
        const orderNum = String(item.order_number || "").toLowerCase();
        const paymentId = (item.payment_id || "").toLowerCase();
        const orderId = (item.id || "").toLowerCase();

        return (
          storeName.includes(q) ||
          productName.includes(q) ||
          discordUser.includes(q) ||
          discordId.includes(q) ||
          orderNum.includes(q) ||
          paymentId.includes(q) ||
          orderId.includes(q)
        );
      }
      return true;
    });
  }, [auditSales, auditStoreFilter, auditProviderFilter, searchAudit]);

  // Reset pagination to 10 when user filters or searches
  useEffect(() => {
    setAuditVisibleCount(10);
  }, [searchAudit, auditStoreFilter, auditProviderFilter]);

  // Paginated/progressive slice
  const displayedAuditSales = useMemo(() => {
    if (searchAudit.trim()) {
      return filteredAuditSales;
    }
    return filteredAuditSales.slice(0, auditVisibleCount);
  }, [filteredAuditSales, searchAudit, auditVisibleCount]);


  // Dynamic metrics for the ColdPayments audit view
  const auditMetrics = useMemo(() => {
    const paidSales = filteredAuditSales.filter(
      (s) => s.status === "paid" || s.status === "delivered" || s.status === "delivering"
    );
    const totalPaidCents = paidSales.reduce((acc, s) => acc + (s.total_cents || 0), 0);
    const allVolumeCents = filteredAuditSales.reduce((acc, s) => acc + (s.total_cents || 0), 0);
    const paidCount = paidSales.length;
    const totalCount = filteredAuditSales.length;
    const feesCents = paidSales.reduce(
      (acc, s) =>
        acc +
        (s.commission_cents != null
          ? s.commission_cents
          : s.total_cents
          ? 60 + Math.round(s.total_cents * 0.02)
          : 0),
      0
    );
    const avgTicket = paidCount > 0 ? Math.round(totalPaidCents / paidCount) : totalCount > 0 ? Math.round(allVolumeCents / totalCount) : 0;
    return {
      total_sales_cents: totalPaidCents > 0 ? totalPaidCents : allVolumeCents,
      total_sales_count: paidCount > 0 ? paidCount : totalCount,
      total_platform_fees_cents: feesCents,
      average_ticket_cents: avgTicket,
    };
  }, [filteredAuditSales]);

  const pendingCount = metrics?.pending_count || 0;

  return (
    <div className="space-y-6 w-full text-slate-100">
      {/* ─── 1. Header estilo Fintech ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-sans uppercase">
              ADMINISTRAÇÃO FINANCEIRA & SPLIT
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Modo Master Admin
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Gestão central de liquidez, fluxo de caixa e aprovação de saques.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Master Switch Split & Carteira */}
          <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all ${
            splitWalletEnabled
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-amber-500/10 border-amber-500/30 text-amber-300"
          }`}>
            <div className="flex flex-col text-right">
              <span className="text-[11px] font-bold leading-tight flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${splitWalletEnabled ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                {splitWalletEnabled ? "Split & Carteira: ATIVO" : "Split: DESATIVADO"}
              </span>
              <span className="text-[9px] text-slate-400">
                {splitWalletEnabled ? "Central (1% taxa)" : "Gateways dos lojistas"}
              </span>
            </div>
            <Switch
              checked={splitWalletEnabled}
              disabled={savingSplit}
              onCheckedChange={handleToggleSplit}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="gap-2 border-slate-800 bg-[#0d1321] text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar Dados
          </Button>
        </div>
      </div>

      {/* ─── 2. CARDS FINANCEIROS: Lucro Admin + Comprometido Clientes + KPIs ─── */}

      {/* Linha 1: Os 3 cards principais de caixa */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card: Meu Lucro (Plataforma pode sacar) */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 via-[#0b1324] to-[#070b14] p-5 shadow-lg">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/80 flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5" />
                Meu Lucro (Sacar para mim)
              </p>
              <p className="mt-2 text-3xl font-black text-emerald-400 font-mono tracking-tight">
                {showBalance ? formatBRL(platformProfitCents) : "R$ ••••"}
              </p>
              <p className="mt-1.5 text-[10px] text-slate-400">R$ 0,60 fixo + 2% da plataforma retidos a cada venda</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/20">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-500/10 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Projeção próximas taxas:</span>
            <span className="font-semibold text-emerald-400">{formatBRL(projectedFutureFeesCents)}</span>
          </div>
        </div>

        {/* Card: Saldo Comprometido (dinheiro dos clientes) */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-[#0b1324] to-[#070b14] p-5 shadow-lg">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/80 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                Saldo Comprometido (Clientes)
              </p>
              <p className="mt-2 text-3xl font-black text-amber-400 font-mono tracking-tight">
                {showBalance ? formatBRL(clientsCommittedCents) : "R$ ••••"}
              </p>
              <p className="mt-1.5 text-[10px] text-slate-400">Dinheiro dos clientes que você guarda (não é seu)</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/20">
              <Shield className="h-5 w-5 text-amber-400" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-amber-500/10 text-[11px] text-slate-400 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Livre p/ saque: <span className="text-white font-semibold ml-1">{showBalance ? formatBRL(metrics?.total_balance_cents || 0) : "••••"}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Bloqueado: <span className="text-amber-300 font-semibold ml-1">{showBalance ? formatBRL(metrics?.total_locked_cents || 0) : "••••"}</span>
            </span>
          </div>
        </div>

        {/* Card: Total em Custódia + Saques Pendentes */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900/80 via-[#0b1324] to-[#070b14] p-5 shadow-lg">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                Total em Custódia
              </p>
              <p className="mt-2 text-3xl font-black text-white font-mono tracking-tight">
                {showBalance ? formatBRL(totalInVaultCents) : "R$ ••••"}
              </p>
              <p className="mt-1.5 text-[10px] text-slate-400">Lucro + saldo dos clientes juntos</p>
            </div>
            <button
              type="button"
              onClick={toggleShowBalance}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={showBalance ? "Ocultar valores" : "Mostrar valores"}
            >
              {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/50 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <p className="text-slate-500">A Pagar (PIX)</p>
              <p className="font-bold text-rose-400">{showBalance ? formatBRL(metrics?.pending_net_cents || 0) : "••••"}</p>
            </div>
            <div>
              <p className="text-slate-500">Já Pago (Total)</p>
              <p className="font-bold text-purple-300">{showBalance ? formatBRL(metrics?.total_withdrawn_cents || 0) : "••••"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Linha 2: KPIs + Alertas de Saques */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* KPIs de Faturamento */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3.5 space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Faturamento Total</p>
            <p className="text-sm font-extrabold text-blue-400">{showBalance ? formatBRL(metrics?.total_earned_cents || 0) : "••••"}</p>
            <p className="text-[10px] text-slate-600">Volume bruto de vendas</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3.5 space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Lojas Cadastradas</p>
            <p className="text-sm font-extrabold text-white">{wallets.length}</p>
            <p className="text-[10px] text-slate-600">Com carteira ativa</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3.5 space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Saques Pendentes</p>
            <p className="text-sm font-extrabold text-amber-400">{pendingCount}</p>
            <p className="text-[10px] text-slate-600">Aguardando PIX</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3.5 space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Taxa da Plataforma</p>
            <p className="text-sm font-extrabold text-emerald-400">2%</p>
            <p className="text-[10px] text-slate-600">Sobre cada saque</p>
          </div>
        </div>

        {/* Alerta de saques pendentes */}
        <div className="lg:col-span-4 flex">
          <div className={`flex-1 rounded-xl border p-4 flex flex-col justify-between ${
            pendingCount > 0
              ? "border-amber-500/30 bg-amber-950/20"
              : "border-emerald-500/20 bg-emerald-950/10"
          }`}>
            <div className="flex items-start gap-3">
              {pendingCount > 0 ? (
                <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs">
                <p className={`font-bold ${pendingCount > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                  {pendingCount > 0 ? `${pendingCount} saque(s) aguardando aprovação` : "Nenhum saque pendente"}
                </p>
                <p className="text-slate-400 mt-0.5">Total líquido a transferir: <span className="text-white font-semibold">{showBalance ? formatBRL(metrics?.pending_net_cents || 0) : "••••"}</span></p>
              </div>
            </div>
            {pendingCount > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  setActiveTab("withdrawals");
                  setWithdrawalStatusFilter("pending");
                  const firstPending = withdrawals.find((w) => w.status === "pending");
                  if (firstPending) {
                    setSelectedTx(firstPending);
                    setApproveModalOpen(true);
                  }
                }}
                className="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
              >
                <Eye className="h-4 w-4" />
                Revisar e Aprovar Saques ({pendingCount})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. Distribuição de Fundos + Detalhamento de Lucro ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card: Distribuição de Fundos */}
        <Card className="lg:col-span-6 border-slate-800/80 bg-[#0a0f1d] shadow-lg">
          <CardHeader className="pb-3 border-b border-slate-800/60">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              Distribuição de Fundos em Caixa
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
                    {/* Fatias */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="text-emerald-500 stroke-current"
                      strokeWidth="10"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * distributionPercentages.clientBalancePct) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total</span>
                    <span className="text-xs sm:text-sm font-extrabold text-white">
                      {showBalance ? formatBRL(totalInVaultCents) : "••••"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista com porcentagens e valores */}
              <div className="sm:col-span-7 space-y-3.5">
                {/* Saldo Livre dos Clientes */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="font-medium text-slate-200">Saldo Livre (Lojas)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-white block">
                      {showBalance ? formatBRL(metrics?.total_balance_cents || 0) : "••••"}
                    </span>
                    <span className="text-[10px] text-slate-400">{distributionPercentages.clientBalancePct}%</span>
                  </div>
                </div>

                {/* A Pagar (Saques Pendentes) */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="font-medium text-slate-200">A Pagar (Saques)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-amber-400 block">
                      {showBalance ? formatBRL(metrics?.pending_net_cents || 0) : "••••"}
                    </span>
                    <span className="text-[10px] text-slate-400">{distributionPercentages.pendingPct}%</span>
                  </div>
                </div>

                {/* Lucro Retido da Plataforma (2%) */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
                    <span className="font-medium text-slate-200">Lucro Retido (R$0,60 + 2%)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-purple-300 block">
                      {showBalance ? formatBRL(metrics?.total_fees_collected_cents || 0) : "••••"}
                    </span>
                    <span className="text-[10px] text-slate-400">{distributionPercentages.feesPct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card: Detalhamento de Lucro Admin */}
        <Card className="lg:col-span-6 border-emerald-500/20 bg-[#0a0f1d] shadow-lg">
          <CardHeader className="pb-3 border-b border-slate-800/60">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Detalhamento do Lucro da Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-3">
            {/* Lucro atual confirmado */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase text-emerald-400/70 font-semibold tracking-wider">Lucro Confirmado (Já Ganho)</p>
                  <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
                    {showBalance ? formatBRL(platformProfitCents) : "R$ ••••"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">R$ 0,60 gateway + 2% plataforma retidos a cada venda</p>
                </div>
                <Coins className="h-8 w-8 text-emerald-400/40" />
              </div>
            </div>

            {/* Projeção futura */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3.5 space-y-1">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Projeção (Próximos saques)</p>
                <p className="text-sm font-extrabold text-emerald-300">
                  {showBalance ? formatBRL(projectedFutureFeesCents) : "••••"}
                </p>
                <p className="text-[10px] text-slate-500">2% plataforma sobre saldos livres</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3.5 space-y-1">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Faturado (Vendas)</p>
                <p className="text-sm font-extrabold text-blue-400">
                  {showBalance ? formatBRL(metrics?.total_earned_cents || 0) : "••••"}
                </p>
                <p className="text-[10px] text-slate-500">Volume bruto de lojistas</p>
              </div>
            </div>

            {/* Resumo de saques */}
            <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3.5 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <p className="text-slate-400">Saques já liquidados (PIX enviados):</p>
                <p className="font-extrabold text-purple-300">{showBalance ? formatBRL(metrics?.total_withdrawn_cents || 0) : "••••"}</p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-slate-400">Taxa acumulada nesses saques:</p>
                <p className="font-extrabold text-emerald-400">{showBalance ? formatBRL(platformProfitCents) : "••••"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── 4. Tabs: Solicitações de Saque (A Pagar) vs Carteiras das Lojas ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-900/60 p-1 border border-slate-800/80 flex flex-wrap h-auto gap-1 w-full justify-start">
          <TabsTrigger value="withdrawals" className="gap-2 relative data-[state=active]:bg-[#0a0f1d] text-xs">
            <Clock className="h-4 w-4" />
            Solicitações de Saque (A Pagar)
            {pendingCount > 0 && (
              <Badge className="ml-1 px-1.5 py-0 text-[10px] bg-amber-500 text-black font-bold animate-pulse">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="wallets" className="gap-2 data-[state=active]:bg-[#0a0f1d] text-xs">
            <Building className="h-4 w-4" />
            Carteiras dos Clientes ({wallets.length})
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2 data-[state=active]:bg-[#0a0f1d] text-xs">
            <Receipt className="h-4 w-4 text-emerald-400" />
            Entradas de Vendas (Auditoria) ({filteredAuditSales.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Solicitações de Saque (A Pagar) */}
        <TabsContent value="withdrawals" className="space-y-4">
          <Card className="border-slate-800/80 bg-[#0a0f1d] shadow-lg">
            <CardHeader className="border-b border-slate-800/60 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                    <Clock className="h-5 w-5 text-amber-400" />
                    Gerenciamento & Aprovação de Saques (A Pagar)
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Analise os saques solicitados pelos clientes, copie a chave PIX, faça a transferência e confirme.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative min-w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Buscar por loja ou chave PIX..."
                      value={searchWithdrawals}
                      onChange={(e) => setSearchWithdrawals(e.target.value)}
                      className="pl-8 h-9 text-xs border-slate-800 bg-[#070b14] text-slate-200"
                    />
                  </div>

                  <Select value={withdrawalStatusFilter} onValueChange={setWithdrawalStatusFilter}>
                    <SelectTrigger className="h-9 w-[150px] text-xs border-slate-800 bg-[#070b14] text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-[#0a0f1d] text-slate-200">
                      <SelectItem value="pending">Apenas Pendentes</SelectItem>
                      <SelectItem value="completed">Concluídos</SelectItem>
                      <SelectItem value="rejected">Rejeitados</SelectItem>
                      <SelectItem value="all">Todos os Saques</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-pink-500 opacity-60" />
                  <p className="text-sm">Carregando solicitações de saque...</p>
                </div>
              ) : filteredWithdrawals.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-20 text-emerald-400" />
                  <p className="text-base font-semibold text-white">Nenhuma solicitação encontrada</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {withdrawalStatusFilter === "pending"
                      ? "Não há saques pendentes de aprovação no momento."
                      : "Nenhum registro corresponde aos filtros selecionados."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#070b14]/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/60">
                      <tr>
                        <th className="py-3 px-4">Loja / Solicitante</th>
                        <th className="py-3 px-4">Origem / Venda Auditada</th>
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-4">Chave PIX</th>
                        <th className="py-3 px-4 text-right">Bruto Solicitado</th>
                        <th className="py-3 px-4 text-right">Taxa (2%) Lucro</th>
                        <th className="py-3 px-4 text-right">Líquido a Pagar</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {displayedWithdrawals.map((w) => {
                        const isPending = w.status === "pending";

                        return (
                          <tr key={w.id} className="hover:bg-slate-900/40 transition-colors">
                            {/* Loja */}
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-xs text-white">
                                {w.tenants?.name || "Loja"}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                ID: {w.tenant_id.slice(0, 8)}...
                              </div>
                              {typeof w.wallet_balance_cents === "number" && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Saldo: <span className="text-emerald-400 font-semibold">{formatBRL(w.wallet_balance_cents)}</span>
                                </div>
                              )}
                            </td>

                            {/* Origem / Venda Auditada */}
                            <td className="py-3.5 px-4">
                              {w.source_order ? (
                                <div className="space-y-1 max-w-[210px]">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-xs text-white truncate max-w-[130px]" title={w.source_order.product_name}>
                                      {w.source_order.product_name}
                                    </span>
                                    <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0 font-mono">
                                      #{w.source_order.order_number || w.source_order.id.slice(0, 6)}
                                    </Badge>
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                                    {w.source_order.discord_username && (
                                      <span className="text-blue-300 font-mono bg-blue-500/10 px-1 py-0.2 rounded">
                                        @{w.source_order.discord_username}
                                      </span>
                                    )}
                                    <span className="text-slate-500">•</span>
                                    <span className="text-emerald-400 font-semibold">
                                      +{formatBRL(w.source_order.total_cents)}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-500 italic">
                                  Saldo consolidado
                                </div>
                              )}
                            </td>

                            {/* Data */}
                            <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                              {format(new Date(w.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </td>

                            {/* Chave PIX */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-semibold text-white bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                                  {w.pix_key}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCopyPixKey(w.pix_key || "", w.id)}
                                  className="h-7 w-7 text-slate-400 hover:text-white"
                                  title="Copiar Chave PIX"
                                >
                                  {copiedKeyId === w.id ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                              {w.pix_key_type && (
                                <div className="text-[10px] uppercase text-slate-500 mt-0.5">
                                  Tipo: {w.pix_key_type}
                                </div>
                              )}
                            </td>

                            {/* Bruto */}
                            <td className="py-3.5 px-4 text-right text-xs font-medium text-slate-300 whitespace-nowrap">
                              {formatBRL(w.amount_cents)}
                            </td>

                            {/* Taxa 2% Lucro */}
                            <td className="py-3.5 px-4 text-right text-xs text-emerald-400 font-semibold whitespace-nowrap">
                              +{formatBRL(w.fee_cents)}
                            </td>

                            {/* Líquido a Pagar */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <span className="text-sm font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                                {formatBRL(w.net_amount_cents || w.amount_cents - w.fee_cents)}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {w.status === "pending" && (
                                <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] gap-1">
                                  <Clock className="h-3 w-3" /> Aguardando
                                </Badge>
                              )}
                              {w.status === "completed" && (
                                <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px]">
                                  Concluído
                                </Badge>
                              )}
                              {w.status === "rejected" && (
                                <Badge className="bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[11px]">
                                  Rejeitado
                                </Badge>
                              )}
                            </td>

                            {/* Ações */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedTx(w);
                                      setApproveModalOpen(true);
                                    }}
                                    className="h-8 gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold px-3 shadow-md shadow-emerald-950/40"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Revisar & Aprovar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedTx(w);
                                      setRejectModalOpen(true);
                                    }}
                                    className="h-8 gap-1 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs px-2.5"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Rejeitar
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedTx(w);
                                      setApproveModalOpen(true);
                                    }}
                                    className="h-7 text-[11px] gap-1 text-slate-300 hover:text-white hover:bg-slate-800/60 px-2"
                                  >
                                    <FileText className="h-3 w-3 text-blue-400" />
                                    Ver Revisão
                                  </Button>
                                  <span className="text-[10px] text-slate-500">
                                    {w.completed_at
                                      ? format(new Date(w.completed_at), "dd/MM HH:mm")
                                      : "Finalizado"}
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginação progressiva de Saques */}
                {filteredWithdrawals.length > 0 && (
                  <div className="p-3 border-t border-slate-800/60 bg-[#070b14]/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                    <div>
                      {searchWithdrawals.trim() ? (
                        <span>
                          Encontrados <strong className="text-white">{filteredWithdrawals.length}</strong> saques para &quot;{searchWithdrawals}&quot;
                        </span>
                      ) : (
                        <span>
                          Mostrando <strong className="text-white">{Math.min(withdrawalsVisibleCount, filteredWithdrawals.length)}</strong> de <strong className="text-white">{filteredWithdrawals.length}</strong> saques
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {filteredWithdrawals.length > withdrawalsVisibleCount && !searchWithdrawals.trim() && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setWithdrawalsVisibleCount((prev) => prev + 20)}
                            className="h-7 text-xs border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white"
                          >
                            Carregar mais (+20)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setWithdrawalsVisibleCount(filteredWithdrawals.length)}
                            className="h-7 text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          >
                            Ver todos ({filteredWithdrawals.length})
                          </Button>
                        </>
                      )}
                      {withdrawalsVisibleCount > 10 && !searchWithdrawals.trim() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setWithdrawalsVisibleCount(10)}
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

        {/* Tab 2: Todas as Carteiras das Lojas */}
        <TabsContent value="wallets" className="space-y-4">
          <Card className="border-slate-800/80 bg-[#0a0f1d] shadow-lg">
            <CardHeader className="border-b border-slate-800/60 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                    <Building className="h-5 w-5 text-emerald-400" />
                    Detalhamento de Saldo por Loja
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Visão geral dos saldos disponíveis, bloqueados em saque e faturamento de cada loja cadastrada.
                  </CardDescription>
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Buscar loja por nome ou ID..."
                    value={searchWallets}
                    onChange={(e) => setSearchWallets(e.target.value)}
                    className="pl-8 h-9 text-xs border-slate-800 bg-[#070b14] text-slate-200"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-pink-500 opacity-60" />
                  <p className="text-sm">Carregando carteiras...</p>
                </div>
              ) : filteredWallets.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Building className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-base font-semibold text-white">Nenhuma carteira encontrada</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#070b14]/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/60">
                        <tr>
                          <th className="py-3 px-4">Loja / Cliente</th>
                          <th className="py-3 px-4">Plano</th>
                          <th className="py-3 px-4 text-right">Saldo Disponível</th>
                          <th className="py-3 px-4 text-right">Em Saque (Bloqueado)</th>
                          <th className="py-3 px-4 text-right">Total Recebido</th>
                          <th className="py-3 px-4 text-right">Total Já Sacado</th>
                          <th className="py-3 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {displayedWallets.map((w) => (
                          <tr key={w.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-xs text-white">
                                {w.tenants?.name || "Loja"}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {w.tenant_id}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge variant="outline" className="text-[10px] uppercase border-slate-700">
                                {w.tenants?.plan || "free"}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-xs text-emerald-400">
                              {formatBRL(w.balance_cents)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium text-xs text-amber-400">
                              {formatBRL(w.locked_balance_cents || 0)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium text-xs text-blue-400">
                              {formatBRL(w.total_earned_cents)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium text-xs text-purple-400">
                              {formatBRL(w.total_withdrawn_cents)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedWallet(w);
                                  setAdjustAmount("");
                                  setAdjustReason("");
                                  setAdjustModalOpen(true);
                                }}
                                className="h-8 text-xs gap-1 border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-200"
                              >
                                <Edit3 className="h-3 w-3" />
                                Ajustar Saldo
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Barra de Paginação / Carregar Mais para Carteiras */}
                  {filteredWallets.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-800/60 bg-[#070b14]/50">
                      <div className="text-xs text-slate-400">
                        Exibindo <span className="font-semibold text-white">{displayedWallets.length}</span> de{" "}
                        <span className="font-semibold text-white">{filteredWallets.length}</span> carteiras de lojas
                        {searchWallets && <span className="text-emerald-400 font-medium"> (filtradas por busca)</span>}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {filteredWallets.length > walletsVisibleCount && !searchWallets && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setWalletsVisibleCount((prev) => Math.min(prev + 20, filteredWallets.length))
                              }
                              className="h-8 text-xs border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-medium"
                            >
                              Carregar mais (+20)
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setWalletsVisibleCount(filteredWallets.length)}
                              className="h-8 text-xs border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-medium"
                            >
                              Ver todas ({filteredWallets.length})
                            </Button>
                          </>
                        )}
                        {walletsVisibleCount > 20 && !searchWallets && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setWalletsVisibleCount(20)}
                            className="h-8 text-xs text-slate-400 hover:text-white"
                          >
                            Mostrar apenas 20
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

        {/* Tab 3: Auditoria de Vendas & Entradas de Caixa */}
        <TabsContent value="audit" className="space-y-4">
          {/* Métricas Rápidas da Auditoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-800/80 bg-[#0a0f1d] p-4 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Total Entrado em Caixa</span>
                <span className="text-xl font-extrabold text-emerald-400 block font-mono">
                  {showBalance ? formatBRL(auditMetrics.total_sales_cents) : "••••"}
                </span>
                <span className="text-[10px] text-slate-500">Volume bruto de todas as vendas</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Coins className="h-6 w-6" />
              </div>
            </Card>

            <Card className="border-slate-800/80 bg-[#0a0f1d] p-4 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Vendas Concluídas</span>
                <span className="text-xl font-extrabold text-white block font-mono">
                  {auditMetrics.total_sales_count}
                </span>
                <span className="text-[10px] text-slate-500">Pedidos pagos e comprovados</span>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <ShoppingBag className="h-6 w-6" />
              </div>
            </Card>

            <Card className="border-slate-800/80 bg-[#0a0f1d] p-4 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Total Taxas Retidas</span>
                <span className="text-xl font-extrabold text-purple-400 block font-mono">
                  {showBalance ? formatBRL(auditMetrics.total_platform_fees_cents) : "••••"}
                </span>
                <span className="text-[10px] text-slate-500">Gateway + taxa da plataforma</span>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Percent className="h-6 w-6" />
              </div>
            </Card>

            <Card className="border-slate-800/80 bg-[#0a0f1d] p-4 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Ticket Médio</span>
                <span className="text-xl font-extrabold text-amber-400 block font-mono">
                  {showBalance ? formatBRL(auditMetrics.average_ticket_cents) : "••••"}
                </span>
                <span className="text-[10px] text-slate-500">Valor médio por transação</span>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <TrendingUp className="h-6 w-6" />
              </div>
            </Card>
          </div>

          {/* Tabela de Vendas Auditadas */}
          <Card className="border-slate-800/80 bg-[#0a0f1d] shadow-lg">
            <CardHeader className="border-b border-slate-800/60 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                    <Receipt className="h-5 w-5 text-emerald-400" />
                    Auditoria de Entradas & Vendas da Plataforma
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Comprovante de todas as entradas de dinheiro no caixa via gateway global e vendas dos lojistas via Discord Bot.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                  <div className="relative w-full sm:w-[260px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Buscar loja, produto, Discord, ID..."
                      value={searchAudit}
                      onChange={(e) => setSearchAudit(e.target.value)}
                      className="pl-8 h-9 text-xs border-slate-800 bg-[#070b14] text-slate-200 w-full"
                    />
                  </div>

                  {/* Filtro por Loja */}
                  <Select value={auditStoreFilter} onValueChange={setAuditStoreFilter}>
                    <SelectTrigger className="h-9 w-[150px] text-xs border-slate-800 bg-[#070b14] text-slate-200">
                      <SelectValue placeholder="Todas as Lojas" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-[#0a0f1d] text-slate-200">
                      <SelectItem value="all">Todas as Lojas</SelectItem>
                      {wallets.map((w) => (
                        <SelectItem key={w.tenant_id} value={w.tenant_id}>
                          {w.tenants?.name || w.tenant_id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Gateway fixo: ColdPayments (Split) */}
                  <div className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-slate-800 bg-[#070b14] text-xs text-emerald-400 font-semibold whitespace-nowrap">
                    <Zap className="h-3.5 w-3.5" />
                    ColdPayments (Split)
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-emerald-400 opacity-60" />
                  <p className="text-sm">Carregando auditoria de vendas...</p>
                </div>
              ) : filteredAuditSales.length === 0 && auditDeposits.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20 text-slate-500" />
                  <p className="text-base font-semibold text-white">Nenhuma venda auditada encontrada</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Assim que os clientes realizarem compras pelo bot ou checkout, os comprovantes de entrada de dinheiro aparecerão listados aqui em tempo real.
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[920px]">
                      <thead className="bg-[#070b14]/90 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
                        <tr>
                          <th className="py-3 px-3 whitespace-nowrap">Data / Hora</th>
                          <th className="py-3 px-3">Loja / Vendedor</th>
                          <th className="py-3 px-3">Produto & Pedido</th>
                          <th className="py-3 px-3">Comprador Discord</th>
                          <th className="py-3 px-3 text-right whitespace-nowrap">Entrada Bruta</th>
                          <th className="py-3 px-3 text-right whitespace-nowrap">Taxas Retidas</th>
                          <th className="py-3 px-3 text-right whitespace-nowrap">Líquido Loja</th>
                          <th className="py-3 px-3 text-center whitespace-nowrap">Gateway</th>
                          <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                          <th className="py-3 px-3 text-center whitespace-nowrap">Auditoria</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {displayedAuditSales.map((sale) => {
                          const feeCents =
                            sale.commission_cents != null
                              ? sale.commission_cents
                              : sale.total_cents
                              ? 60 + Math.round(sale.total_cents * 0.02)
                              : 0;
                          const netCents =
                            sale.seller_received_cents != null
                              ? sale.seller_received_cents
                              : Math.max(0, sale.total_cents - feeCents);

                          return (
                            <tr key={sale.id} className="hover:bg-slate-900/40 transition-colors">
                              <td className="py-3 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
                                {sale.created_at
                                  ? format(parseISO(sale.created_at), "dd/MM/yy HH:mm", { locale: ptBR })
                                  : "—"}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-xs text-white">
                                  {sale.tenants?.name || "Loja Desconhecida"}
                                </div>
                                <span className="text-[10px] text-slate-500 uppercase">
                                  {sale.tenants?.plan || "Plano Ativo"}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-xs text-slate-200">
                                  {sale.product_name || "Produto Digital"}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                                  <Hash className="h-3 w-3 text-slate-500" />
                                  {sale.order_number ? `Pedido #${sale.order_number}` : sale.id.slice(0, 8)}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-mono text-xs text-blue-300">
                                  {sale.discord_username ? `@${sale.discord_username}` : "Discord User"}
                                </div>
                                {sale.discord_user_id && (
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    ID: {sale.discord_user_id}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-extrabold text-xs text-emerald-400 font-mono whitespace-nowrap">
                                +{formatBRL(sale.total_cents)}
                              </td>
                              <td className="py-3 px-3 text-right font-semibold text-xs text-purple-400 font-mono whitespace-nowrap">
                                +{formatBRL(feeCents)}
                              </td>
                              <td className="py-3 px-3 text-right font-medium text-xs text-slate-300 font-mono whitespace-nowrap">
                                {formatBRL(netCents)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Badge variant="outline" className="text-[10px] uppercase font-mono border-slate-700 bg-slate-900/60 text-slate-300">
                                  {sale.payment_provider || "PIX Global"}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-center">
                                {sale.status === "pending" || sale.status === "pending_payment" ? (
                                  <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] uppercase gap-1 font-semibold">
                                    <Clock className="h-3 w-3" />
                                    Aguardando
                                  </Badge>
                                ) : (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase gap-1 font-semibold">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {sale.status === "delivered" ? "Entregue" : "Pago"}
                                  </Badge>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedAuditSale(sale);
                                    setAuditModalOpen(true);
                                  }}
                                  className="h-7 text-xs px-2.5 gap-1 border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-200"
                                >
                                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                                  Comprovante
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Barra de Paginação / Carregar Mais */}
                  {filteredAuditSales.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-800/60 bg-[#070b14]/50">
                      <div className="text-xs text-slate-400">
                        Exibindo <span className="font-semibold text-white">{displayedAuditSales.length}</span> de{" "}
                        <span className="font-semibold text-white">{filteredAuditSales.length}</span> vendas auditadas
                        {searchAudit && <span className="text-emerald-400 font-medium"> (filtradas por busca)</span>}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {filteredAuditSales.length > auditVisibleCount && !searchAudit.trim() && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setAuditVisibleCount((prev) => Math.min(prev + 20, filteredAuditSales.length))
                              }
                              className="h-8 text-xs border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-medium"
                            >
                              Carregar mais (+20)
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAuditVisibleCount(filteredAuditSales.length)}
                              className="h-8 text-xs border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-medium"
                            >
                              Ver todas ({filteredAuditSales.length})
                            </Button>
                          </>
                        )}
                        {auditVisibleCount > 10 && !searchAudit.trim() && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAuditVisibleCount(10)}
                            className="h-8 text-xs text-slate-400 hover:text-white"
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
      </Tabs>

      {/* ─── 5. Modal: Revisão & Auditoria Completa de Saque ─── */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent className="sm:max-w-2xl border-slate-800 bg-[#0a0f1d] text-white max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
              <Receipt className="h-5 w-5 text-amber-400" />
              Revisão & Auditoria de Saque
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Conferência contábil da venda do produto, dados bancários do lojista e autorização de pagamento PIX.
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4 py-2 text-xs">
              {/* Status Header */}
              <div className={`rounded-xl border p-3.5 flex items-center justify-between ${
                selectedTx.status === "pending"
                  ? "border-amber-500/30 bg-amber-950/20"
                  : selectedTx.status === "completed"
                  ? "border-emerald-500/30 bg-emerald-950/20"
                  : "border-rose-500/30 bg-rose-950/20"
              }`}>
                <div className="flex items-center gap-2">
                  {selectedTx.status === "pending" ? (
                    <Clock className="h-4 w-4 text-amber-400" />
                  ) : selectedTx.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400" />
                  )}
                  <span className="font-semibold text-white">
                    {selectedTx.status === "pending"
                      ? "Saque Aguardando Aprovação (A Pagar)"
                      : selectedTx.status === "completed"
                      ? "Saque Aprovado & Transferido via PIX"
                      : "Saque Rejeitado"}
                  </span>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-mono tracking-wider">
                  {selectedTx.source_order?.payment_provider || selectedTx.provider || "COLDPAYMENTS"}
                </Badge>
              </div>

              {/* Informações da Loja & Comprador (2 colunas) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3 space-y-1">
                  <span className="text-[10px] uppercase text-slate-500 font-semibold block">Loja Solicitante</span>
                  <p className="font-bold text-white text-xs truncate">
                    {selectedTx.tenants?.name || "Loja"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    ID: {selectedTx.tenant_id}
                  </p>
                  {typeof selectedTx.wallet_balance_cents === "number" && (
                    <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                      Saldo Atual em Carteira: <span className="font-bold text-emerald-400">{formatBRL(selectedTx.wallet_balance_cents)}</span>
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3 space-y-1">
                  <span className="text-[10px] uppercase text-slate-500 font-semibold block">Comprador Discord (Origem)</span>
                  <p className="font-bold text-blue-300 text-xs truncate font-mono">
                    {selectedTx.source_order?.discord_username ? `@${selectedTx.source_order.discord_username}` : "Usuário Discord"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    ID: {selectedTx.source_order?.discord_user_id || "—"}
                  </p>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                    Origem: <span className="text-slate-300 font-medium">Discord Bot / Checkout</span>
                  </p>
                </div>
              </div>

              {/* Origem dos Fundos: Auditoria da Venda do Produto */}
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Produto Vendido:</span>
                    <span className="font-bold text-white text-sm flex items-center gap-1.5">
                      <ShoppingBag className="h-4 w-4 text-emerald-400" />
                      {selectedTx.source_order?.product_name || "Venda do Lojista"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Número do Pedido:</span>
                    <span className="font-mono font-bold text-amber-400 text-xs">
                      {selectedTx.source_order?.order_number ? `#${selectedTx.source_order.order_number}` : (selectedTx.source_order?.id ? `#${selectedTx.source_order.id.slice(0, 8)}` : "—")}
                    </span>
                  </div>
                </div>

                {/* Split Contábil da Venda */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Entrada Bruta no Caixa Gateway:</span>
                    <span className="font-mono font-extrabold text-emerald-400 text-sm">
                      +{formatBRL(selectedTx.source_order?.total_cents || selectedTx.source_deposit?.amount_cents || selectedTx.amount_cents)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Taxa Intermediação Plataforma (1%):</span>
                    <span className="font-mono font-bold text-purple-400">
                      +{formatBRL(Math.round(((selectedTx.source_order?.total_cents || selectedTx.source_deposit?.amount_cents || selectedTx.amount_cents) * 0.01)))}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-slate-800/80 pt-1.5">
                    <span className="font-semibold text-slate-200">Crédito Líquido que entrou na Carteira:</span>
                    <span className="font-mono font-bold text-white">
                      {formatBRL(selectedTx.source_deposit?.net_amount_cents || (selectedTx.source_order?.total_cents ? selectedTx.source_order.total_cents - Math.round(selectedTx.source_order.total_cents * 0.01) : selectedTx.amount_cents))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detalhes do Saque a Pagar via PIX */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 space-y-3">
                <span className="text-[10px] uppercase text-amber-400 font-bold tracking-wider block">
                  Conferência do Saque a Pagar
                </span>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Valor Bruto Solicitado:</span>
                    <span className="font-medium text-slate-300">{formatBRL(selectedTx.amount_cents)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Taxa de Saque Plataforma (2%):</span>
                    <span className="font-bold text-emerald-400">+{formatBRL(selectedTx.fee_cents)}</span>
                  </div>
                  <div className="border-t border-slate-800/80 pt-2 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-white block text-sm">Líquido a Transferir:</span>
                      <span className="text-[10px] text-slate-400">Valor exato enviado via PIX</span>
                    </div>
                    <span className="text-xl font-black text-amber-400 bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-lg">
                      {formatBRL(selectedTx.net_amount_cents || selectedTx.amount_cents - selectedTx.fee_cents)}
                    </span>
                  </div>
                </div>

                {/* Chave PIX Destino em destaque */}
                <div className="pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs font-semibold">Chave PIX de Destino:</span>
                    <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Tipo: {selectedTx.pix_key_type || "CPF"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between bg-[#070b14] border border-slate-800 rounded-lg p-2.5">
                    <span className="font-mono font-bold text-sm text-white select-all">
                      {selectedTx.pix_key}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyPixKey(selectedTx.pix_key || "", `modal-${selectedTx.id}`)}
                      className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                    >
                      {copiedKeyId === `modal-${selectedTx.id}` ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400 mr-1" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Copiar Chave
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Identificadores Técnicos da Transação */}
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3.5 space-y-2">
                <span className="text-[10px] uppercase text-slate-500 font-semibold block">
                  Identificadores Técnicos & Rastreabilidade
                </span>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">ID da Solicitação de Saque:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-200 max-w-[200px] truncate">{selectedTx.id}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleCopyAuditText(selectedTx.id, "tx-id")}
                        className="h-6 w-6 text-slate-400 hover:text-white"
                        title="Copiar ID do Saque"
                      >
                        {copiedAuditId === "tx-id" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  {selectedTx.source_order?.id && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">ID do Pedido de Origem:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-200 max-w-[200px] truncate">{selectedTx.source_order.id}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopyAuditText(selectedTx.source_order!.id, "order-id")}
                          className="h-6 w-6 text-slate-400 hover:text-white"
                          title="Copiar ID do Pedido"
                        >
                          {copiedAuditId === "order-id" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  {(selectedTx.source_order?.payment_id || selectedTx.payment_id) && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">ID Gateway / Transação:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-200 max-w-[200px] truncate">
                          {selectedTx.source_order?.payment_id || selectedTx.payment_id}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopyAuditText(selectedTx.source_order?.payment_id || selectedTx.payment_id!, "pay-id")}
                          className="h-6 w-6 text-slate-400 hover:text-white"
                          title="Copiar ID do Pagamento"
                        >
                          {copiedAuditId === "pay-id" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Data e Hora do Saque:</span>
                    <span className="font-mono text-slate-300">
                      {format(parseISO(selectedTx.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Alerta de Erro na Gateway (se houver tentativa com erro) */}
              {gatewayErrorAlert && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-300 text-xs">Falha no Disparo Automático via Gateway</p>
                      <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">{gatewayErrorAlert}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#070b14]/70 p-2.5 rounded-lg">
                    <span className="text-[11px] text-slate-300">
                      Caso já tenha realizado o PIX pelo seu banco, aprove manualmente:
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleApproveSubmit(true)}
                      disabled={processingAction}
                      className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 shadow-sm"
                    >
                      {processingAction ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      )}
                      Aprovar Manualmente Agora
                    </Button>
                  </div>
                </div>
              )}

              {/* Informação sobre transferência automática */}
              {selectedTx.status === "pending" && !gatewayErrorAlert && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3 flex items-start gap-2.5">
                  <Zap className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-300 leading-relaxed">
                    <strong>Transferência Automática PIX:</strong> Ao confirmar a aprovação, a gateway <strong>ColdPayments</strong> enviará exatamente <strong>{formatBRL(selectedTx.net_amount_cents || selectedTx.amount_cents - selectedTx.fee_cents)}</strong> de forma instantânea para a chave PIX informada.
                  </p>
                </div>
              )}

              {/* Observações / Notas do Admin (se pendente) */}
              {selectedTx.status === "pending" && (
                <div className="space-y-1.5">
                  <Label htmlFor="adminNotes" className="text-xs font-semibold text-slate-200">
                    Observações Administrativas (Opcional)
                  </Label>
                  <Input
                    id="adminNotes"
                    placeholder="Ex: Pagamento autorizado após auditoria do pedido #3464"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="text-xs border-slate-800 bg-[#070b14] text-white"
                  />
                </div>
              )}

              <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2 sm:justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCopyWithdrawalReport(selectedTx)}
                  className="w-full sm:w-auto text-xs border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar Relatório Completo
                </Button>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  {selectedTx.status === "pending" ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setApproveModalOpen(false);
                          setRejectModalOpen(true);
                        }}
                        disabled={processingAction}
                        className="text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                      >
                        Rejeitar Saque
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleApproveSubmit(true)}
                        disabled={processingAction}
                        title="Marca como aprovado e debita a carteira sem acionar a gateway (use se o PIX foi feito pelo banco)"
                        className="text-xs border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                      >
                        Aprovar Manualmente
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleApproveSubmit(false)}
                        disabled={processingAction}
                        className="text-xs gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-md shadow-emerald-950/40"
                      >
                        {processingAction ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Enviar PIX Automático ({formatBRL(selectedTx.net_amount_cents || selectedTx.amount_cents - selectedTx.fee_cents)})
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setApproveModalOpen(false)}
                      className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
                    >
                      Concluir / Fechar
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── 6. Modal: Rejeitar Saque ─── */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md border-slate-800 bg-[#0a0f1d] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-rose-500">
              <XCircle className="h-5 w-5" />
              Rejeitar Solicitação de Saque
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              O saldo total será imediatamente devolvido à carteira da loja.
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-lg bg-rose-950/30 border border-rose-500/20 p-3 text-xs text-rose-200">
                Ao rejeitar, o valor bruto de <strong>{formatBRL(selectedTx.amount_cents)}</strong> retornará
                integralmente ao saldo disponível de <strong>{selectedTx.tenants?.name || "Loja"}</strong>.
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rejectionReason" className="text-xs font-semibold text-slate-200">
                  Motivo da Rejeição (Visível para o cliente) *
                </Label>
                <Input
                  id="rejectionReason"
                  placeholder="Ex: Chave PIX inexistente / Dados divergentes"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="text-xs border-slate-800 bg-[#070b14] text-white"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectModalOpen(false)}
                  disabled={processingAction}
                  className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleRejectSubmit}
                  disabled={processingAction || !rejectionReason.trim()}
                  className="gap-2 font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {processingAction ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Confirmar Rejeição e Estornar Saldo
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── 7. Modal: Ajustar Saldo Manual ─── */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent className="sm:max-w-md border-slate-800 bg-[#0a0f1d] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
              <Edit3 className="h-5 w-5 text-emerald-400" />
              Ajuste Administrativo de Saldo
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Adicione créditos ou faça débitos na carteira da loja selecionada.
            </DialogDescription>
          </DialogHeader>

          {selectedWallet && (
            <form onSubmit={handleAdjustSubmit} className="space-y-4 py-2 text-sm">
              <div className="rounded-lg bg-[#070b14] border border-slate-800 p-3 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400">Loja:</span>
                  <p className="font-bold text-white text-sm">{selectedWallet.tenants?.name || "Loja"}</p>
                </div>
                <div className="text-right">
                  <span className="text-slate-400">Saldo Atual:</span>
                  <p className="font-bold text-emerald-400 text-sm">{formatBRL(selectedWallet.balance_cents)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">Tipo de Ajuste</Label>
                  <Select value={adjustType} onValueChange={(v: "credit" | "debit") => setAdjustType(v)}>
                    <SelectTrigger className="text-xs border-slate-800 bg-[#070b14] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-[#0a0f1d] text-white">
                      <SelectItem value="credit">Crédito (+)</SelectItem>
                      <SelectItem value="debit">Débito (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">Valor (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="text-xs font-semibold border-slate-800 bg-[#070b14] text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adjustReason" className="text-xs font-semibold text-slate-200">
                  Justificativa / Motivo do Ajuste *
                </Label>
                <Input
                  id="adjustReason"
                  placeholder="Ex: Correção de lançamento / Bonificação"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="text-xs border-slate-800 bg-[#070b14] text-white"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustModalOpen(false)}
                  disabled={processingAction}
                  className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={processingAction || !adjustAmount.trim() || !adjustReason.trim()}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {processingAction ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Aplicar Ajuste
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── 8. Modal: Detalhes & Comprovante de Auditoria da Venda ─── */}
      <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
        <DialogContent className="sm:max-w-2xl border-slate-800 bg-[#0a0f1d] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
              <Receipt className="h-5 w-5 text-emerald-400" />
              Comprovante & Auditoria de Entrada
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Conferência contábil do pagamento e divisão (split) do saldo entre loja e plataforma.
            </DialogDescription>
          </DialogHeader>

          {selectedAuditSale && (
            <div className="space-y-4 py-2 text-xs">
              {/* Status Header */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="font-semibold text-white">Venda Confirmada & Auditada</span>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-mono">
                  {selectedAuditSale.payment_provider || "PIX"}
                </Badge>
              </div>

              {/* Informações da Loja & Comprador */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3 space-y-1">
                  <span className="text-[10px] uppercase text-slate-500 font-semibold block">Loja Vendedora</span>
                  <p className="font-bold text-white text-xs truncate">
                    {selectedAuditSale.tenants?.name || "Loja"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    ID: {selectedAuditSale.tenant_id}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3 space-y-1">
                  <span className="text-[10px] uppercase text-slate-500 font-semibold block">Comprador Discord</span>
                  <p className="font-bold text-blue-300 text-xs truncate font-mono">
                    {selectedAuditSale.discord_username ? `@${selectedAuditSale.discord_username}` : "Usuário Discord"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    ID: {selectedAuditSale.discord_user_id || "—"}
                  </p>
                </div>
              </div>

              {/* Detalhes do Pedido & Split Financeiro */}
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Produto:</span>
                    <span className="font-bold text-white text-sm">
                      {selectedAuditSale.product_name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Número do Pedido:</span>
                    <span className="font-mono font-bold text-amber-400 text-xs">
                      {selectedAuditSale.order_number ? `#${selectedAuditSale.order_number}` : selectedAuditSale.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Divisão do Dinheiro (Split) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Entrada Bruta no Caixa:</span>
                    <span className="font-mono font-extrabold text-emerald-400 text-sm">
                      +{formatBRL(selectedAuditSale.total_cents)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Taxa Intermediação Plataforma (1%):</span>
                    <span className="font-mono font-bold text-purple-400">
                      +{formatBRL(Math.round(selectedAuditSale.total_cents * 0.01))}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-slate-800/80 pt-1.5">
                    <span className="font-semibold text-slate-200">Crédito Líquido na Carteira da Loja:</span>
                    <span className="font-mono font-bold text-white">
                      {formatBRL(selectedAuditSale.total_cents - Math.round(selectedAuditSale.total_cents * 0.01))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dados Técnicos de Pagamento */}
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3.5 space-y-2">
                <span className="text-[10px] uppercase text-slate-500 font-semibold block">
                  Identificadores Técnicos da Transação
                </span>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">ID do Pedido:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-200 max-w-[200px] truncate">{selectedAuditSale.id}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleCopyAuditText(selectedAuditSale.id, "order-id")}
                        className="h-6 w-6 text-slate-400 hover:text-white"
                        title="Copiar ID"
                      >
                        {copiedAuditId === "order-id" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  {selectedAuditSale.payment_id && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">ID Gateway / Transação:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-200 max-w-[200px] truncate">{selectedAuditSale.payment_id}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopyAuditText(selectedAuditSale.payment_id!, "pay-id")}
                          className="h-6 w-6 text-slate-400 hover:text-white"
                          title="Copiar ID do Pagamento"
                        >
                          {copiedAuditId === "pay-id" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Data e Hora do Registro:</span>
                    <span className="font-mono text-slate-300">
                      {selectedAuditSale.created_at
                        ? format(parseISO(selectedAuditSale.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const report = `--- COMPROVANTE DE AUDITORIA ---
Loja: ${selectedAuditSale.tenants?.name || "Loja"}
Pedido: #${selectedAuditSale.order_number || selectedAuditSale.id.slice(0, 8)}
Produto: ${selectedAuditSale.product_name}
Cliente: @${selectedAuditSale.discord_username || "desconhecido"} (${selectedAuditSale.discord_user_id || "N/A"})
Valor Bruto: ${formatBRL(selectedAuditSale.total_cents)}
Taxa 1%: ${formatBRL(Math.round(selectedAuditSale.total_cents * 0.01))}
Líquido Loja: ${formatBRL(selectedAuditSale.total_cents - Math.round(selectedAuditSale.total_cents * 0.01))}
Gateway: ${selectedAuditSale.payment_provider || "PIX"}
ID Transação: ${selectedAuditSale.payment_id || selectedAuditSale.id}
Data: ${selectedAuditSale.created_at}`;
                    handleCopyAuditText(report, "full-report");
                  }}
                  className="border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs gap-1.5"
                >
                  {copiedAuditId === "full-report" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedAuditId === "full-report" ? "Relatório Copiado!" : "Copiar Relatório"}
                </Button>

                <Button
                  type="button"
                  onClick={() => setAuditModalOpen(false)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                >
                  Concluir
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
