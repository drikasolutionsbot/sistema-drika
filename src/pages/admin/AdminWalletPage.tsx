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
  const [auditProviderFilter, setAuditProviderFilter] = useState("all");
  const [selectedAuditSale, setSelectedAuditSale] = useState<SalesAuditItem | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [copiedAuditId, setCopiedAuditId] = useState<string | null>(null);
  const [auditVisibleCount, setAuditVisibleCount] = useState(10);

  // Approval Modal
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WithdrawalItem | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processingAction, setProcessingAction] = useState(false);

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

  useEffect(() => {
    loadData();
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

  // Handle Approve
  const handleApproveSubmit = async () => {
    if (!selectedTx) return;
    setProcessingAction(true);

    try {
      const { data, error } = await supabase.functions.invoke("manage-wallet", {
        body: {
          action: "admin_approve_withdrawal",
          tx_id: selectedTx.id,
          admin_notes: adminNotes.trim() || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Saque aprovado com sucesso!",
        description: `O saque de ${formatBRL(selectedTx.net_amount_cents)} foi marcado como concluído.`,
      });

      setApproveModalOpen(false);
      setSelectedTx(null);
      setAdminNotes("");
      loadData(true);
    } catch (err: any) {
      toast({
        title: "Erro ao aprovar saque",
        description: err.message,
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

      toast({
        title: "Saque rejeitado!",
        description: "O valor bruto foi devolvido ao saldo disponível da loja.",
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

  // Calculations for total cash in vault
  const totalInVaultCents = useMemo(() => {
    if (!metrics) return 0;
    // Total in vault = saldo disponível dos clientes + saldo retido em saques pendentes + taxas lucradas
    return (
      (metrics.total_balance_cents || 0) +
      (metrics.total_locked_cents || 0) +
      (metrics.total_fees_collected_cents || 0)
    );
  }, [metrics]);

  // Projected future platform fees from existing available balances
  const projectedFutureFeesCents = useMemo(() => {
    if (!metrics?.total_balance_cents) return 0;
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
    return filteredAuditSales.slice(0, auditVisibleCount);
  }, [filteredAuditSales, auditVisibleCount]);

  // Unique payment providers found in sales for the filter dropdown
  const availableProviders = useMemo(() => {
    const set = new Set<string>();
    auditSales.forEach((s) => {
      if (s.payment_provider) set.add(s.payment_provider);
    });
    return Array.from(set);
  }, [auditSales]);

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

        <div className="flex items-center gap-2">
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

      {/* ─── 2. Hero Card Principal (Total em Caixa + Cartão 3D Master) ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-[#080d19] via-[#0b1324] to-[#070b14] p-6 md:p-8 shadow-2xl">
        {/* Glow de fundo */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Lado Esquerdo: Saldo Total em Caixa + Métricas Detalhadas */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <div className="flex items-center gap-2.5 text-xs text-slate-400 font-medium">
                <span>Total em Caixa da Plataforma (Custódia + Lucro)</span>
                <button
                  type="button"
                  onClick={toggleShowBalance}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                  title={showBalance ? "Ocultar valores" : "Mostrar valores"}
                >
                  {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => loadData(true)}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                  title="Atualizar"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="mt-2 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white font-sans">
                {showBalance ? formatBRL(totalInVaultCents) : "R$ ••••••"}
              </div>
            </div>

            {/* Sub-métricas: A Pagar, Saldo Lojas, Lucro 2%, Total Já Pago */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
              {/* A Pagar (Saques Pendentes) */}
              <div className="space-y-1">
                <span className="text-xs text-amber-400 block font-semibold flex items-center gap-1">
                  A Pagar (Saques)
                  {pendingCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      {pendingCount}
                    </span>
                  )}
                </span>
                <p className="text-base sm:text-lg font-bold text-amber-400">
                  {showBalance ? formatBRL(metrics?.pending_net_cents || 0) : "••••"}
                </p>
                <span className="text-[10px] text-slate-500 block">Líquido a transferir</span>
              </div>

              {/* Saldo das Lojas */}
              <div className="space-y-1 border-l border-slate-800/80 pl-4 sm:pl-4">
                <span className="text-xs text-slate-400 block font-medium">Saldo das Lojas</span>
                <p className="text-base sm:text-lg font-bold text-slate-200">
                  {showBalance ? formatBRL(metrics?.total_balance_cents || 0) : "••••"}
                </p>
                <span className="text-[10px] text-slate-500 block">Livre para saque</span>
              </div>

              {/* Lucro Plataforma (2%) */}
              <div className="space-y-1 sm:border-l border-slate-800/80 sm:pl-4">
                <span className="text-xs text-emerald-400 block font-semibold">Lucro Plataforma</span>
                <p className="text-base sm:text-lg font-bold text-emerald-400">
                  {showBalance ? formatBRL(metrics?.total_fees_collected_cents || 0) : "••••"}
                </p>
                <span className="text-[10px] text-slate-500 block">Taxas de 2% retidas</span>
              </div>

              {/* Total Já Pago */}
              <div className="space-y-1 border-l border-slate-800/80 pl-4 sm:pl-4">
                <span className="text-xs text-purple-400 block font-medium">Total Já Pago</span>
                <p className="text-base sm:text-lg font-bold text-purple-300">
                  {showBalance ? formatBRL(metrics?.total_withdrawn_cents || 0) : "••••"}
                </p>
                <span className="text-[10px] text-slate-500 block">Volume liquidado</span>
              </div>
            </div>

            {/* Banner de Status / Operações */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-3.5 flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                <div className="text-xs text-amber-200/90 leading-relaxed">
                  <strong className="text-white font-semibold">
                    {pendingCount > 0 ? `${pendingCount} saque(s) aguardando sua aprovação!` : "Nenhum saque pendente no momento."}
                  </strong>{" "}
                  Taxa ativa de 2% retida pela plataforma. Projeção de taxas futuras sobre saldo atual das lojas:{" "}
                  <strong className="text-emerald-400">{formatBRL(projectedFutureFeesCents)}</strong>.
                </div>
              </div>

              {pendingCount > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    setActiveTab("withdrawals");
                    setWithdrawalStatusFilter("pending");
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs shrink-0"
                >
                  Revisar Saques
                </Button>
              )}
            </div>
          </div>

          {/* Lado Direito: Cartão 3D Virtual Estilo Fintech Master */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative group w-full max-w-[360px] aspect-[1.586/1] rounded-2xl p-6 bg-gradient-to-br from-white via-slate-100 to-slate-200 text-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/80 transition-all duration-500 hover:scale-[1.03] hover:-rotate-1 cursor-pointer overflow-hidden flex flex-col justify-between">
              {/* Marca d'água */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
              <div className="absolute -right-16 -top-16 w-48 h-48 bg-gradient-to-br from-amber-400/20 via-pink-400/20 to-transparent rounded-full blur-2xl pointer-events-none" />

              {/* Top Row: Chip + Contactless + Brand */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  {/* Golden Chip */}
                  <div className="w-10 h-8 rounded-md bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 border border-amber-600/40 relative shadow-sm overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-amber-800/40" />
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-amber-800/40" />
                    <div className="w-5 h-4 border border-amber-700/30 rounded-sm" />
                  </div>

                  <Wifi className="h-5 w-5 text-slate-400 rotate-90" />
                </div>

                <div className="flex items-center gap-1.5 font-black text-xs tracking-wider text-slate-800 uppercase">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span>DRIKA PLATFORM</span>
                </div>
              </div>

              {/* Card Number */}
              <div className="my-auto pt-2 relative z-10">
                <p className="font-mono text-lg sm:text-xl font-bold tracking-[0.22em] text-slate-700">
                  •••• •••• •••• 0001
                </p>
              </div>

              {/* Bottom Row */}
              <div className="flex items-end justify-between relative z-10">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Titular da Plataforma
                  </span>
                  <p className="font-mono text-xs sm:text-sm font-bold tracking-wider text-slate-800 truncate max-w-[200px]">
                    ADMINISTRADOR MASTER
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">
                      Validade
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700">12/30</span>
                  </div>

                  <span className="px-2 py-0.5 rounded border border-slate-300 bg-white/80 text-[10px] font-black uppercase tracking-wider text-slate-800 shadow-sm">
                    MASTER
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. Segunda Linha: Distribuição de Fundos + Resumo de Liquidez ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card: Distribuição de Fundos (estilo Imagem 3) */}
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
                    <span className="font-medium text-slate-200">Lucro Retido (2%)</span>
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

        {/* Card: Resumo de Liquidez & Faturamento */}
        <Card className="lg:col-span-6 border-slate-800/80 bg-[#0a0f1d] shadow-lg flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-slate-800/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Resumo Geral de Faturamento & Lojas
              </CardTitle>
              <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-400">
                Taxa Plataforma: 2%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3.5 space-y-1">
                <span className="text-slate-400 block">Total Transacionado em Vendas:</span>
                <span className="text-base font-extrabold text-blue-400 block">
                  {showBalance ? formatBRL(metrics?.total_earned_cents || 0) : "••••"}
                </span>
                <span className="text-[10px] text-slate-500">Volume bruto de todos os lojistas</span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3.5 space-y-1">
                <span className="text-slate-400 block">Total de Lojas Cadastradas:</span>
                <span className="text-base font-extrabold text-white block">
                  {wallets.length} lojas
                </span>
                <span className="text-[10px] text-slate-500">Lojas ativas na plataforma</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3.5 space-y-1">
                <span className="text-slate-400 block">Projeção de Taxas a Receber:</span>
                <span className="text-base font-extrabold text-emerald-400 block">
                  {showBalance ? formatBRL(projectedFutureFeesCents) : "••••"}
                </span>
                <span className="text-[10px] text-slate-500">2% sobre saldos em carteira</span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3.5 space-y-1">
                <span className="text-slate-400 block">Total Já Pago em Saques:</span>
                <span className="text-base font-extrabold text-purple-300 block">
                  {showBalance ? formatBRL(metrics?.total_withdrawn_cents || 0) : "••••"}
                </span>
                <span className="text-[10px] text-slate-500">PIX transferidos com sucesso</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── 4. Tabs: Solicitações de Saque (A Pagar) vs Carteiras das Lojas ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-900/60 p-1 border border-slate-800/80">
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
            Entradas de Vendas (Auditoria) ({auditSales.length || auditDeposits.length})
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
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#070b14]/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/60">
                      <tr>
                        <th className="py-3 px-4">Loja / Cliente</th>
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
                      {filteredWithdrawals.map((w) => {
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
                                    className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 shadow-sm"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Aprovar
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
                                <span className="text-[11px] text-slate-500">
                                  {w.completed_at
                                    ? format(new Date(w.completed_at), "dd/MM HH:mm")
                                    : "Finalizado"}
                                </span>
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
                      {filteredWallets.map((w) => (
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
                  {showBalance ? formatBRL(auditSummary?.total_sales_cents || 0) : "••••"}
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
                  {auditSummary?.total_sales_count || auditSales.length}
                </span>
                <span className="text-[10px] text-slate-500">Pedidos pagos e comprovados</span>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <ShoppingBag className="h-6 w-6" />
              </div>
            </Card>

            <Card className="border-slate-800/80 bg-[#0a0f1d] p-4 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Taxas Retidas (2%)</span>
                <span className="text-xl font-extrabold text-purple-400 block font-mono">
                  {showBalance ? formatBRL(auditSummary?.total_platform_fees_cents || 0) : "••••"}
                </span>
                <span className="text-[10px] text-slate-500">Lucro líquido da plataforma</span>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Percent className="h-6 w-6" />
              </div>
            </Card>

            <Card className="border-slate-800/80 bg-[#0a0f1d] p-4 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Ticket Médio</span>
                <span className="text-xl font-extrabold text-amber-400 block font-mono">
                  {showBalance ? formatBRL(auditSummary?.average_ticket_cents || 0) : "••••"}
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

                  {/* Filtro por Gateway */}
                  {availableProviders.length > 0 && (
                    <Select value={auditProviderFilter} onValueChange={setAuditProviderFilter}>
                      <SelectTrigger className="h-9 w-[140px] text-xs border-slate-800 bg-[#070b14] text-slate-200">
                        <SelectValue placeholder="Gateway" />
                      </SelectTrigger>
                      <SelectContent className="border-slate-800 bg-[#0a0f1d] text-slate-200">
                        <SelectItem value="all">Todos Gateways</SelectItem>
                        {availableProviders.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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
                          <th className="py-3 px-3 text-right whitespace-nowrap">Taxa (2%)</th>
                          <th className="py-3 px-3 text-right whitespace-nowrap">Líquido Loja</th>
                          <th className="py-3 px-3 text-center whitespace-nowrap">Gateway</th>
                          <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                          <th className="py-3 px-3 text-center whitespace-nowrap">Auditoria</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {displayedAuditSales.map((sale) => {
                          const feeCents = Math.round(sale.total_cents * 0.02);
                          const netCents = sale.total_cents - feeCents;

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
                                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase gap-1 font-semibold">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {sale.status === "delivered" ? "Entregue" : "Pago"}
                                </Badge>
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
                        {filteredAuditSales.length > auditVisibleCount && (
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
                        {auditVisibleCount > 10 && (
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

      {/* ─── 5. Modal: Aprovar Saque ─── */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent className="sm:max-w-md border-slate-800 bg-[#0a0f1d] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              Confirmar Aprovação de Saque
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Certifique-se de que a transferência PIX foi realizada para a chave abaixo.
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Loja Solicitante:</span>
                  <span className="font-bold text-white">{selectedTx.tenants?.name || "Loja"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Chave PIX:</span>
                  <span className="font-mono font-bold text-white">{selectedTx.pix_key}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Valor Bruto Solicitado:</span>
                  <span className="font-medium text-slate-300">{formatBRL(selectedTx.amount_cents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Taxa da Plataforma (2%):</span>
                  <span className="font-bold text-emerald-400">+{formatBRL(selectedTx.fee_cents)}</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between items-center">
                  <span className="font-bold text-white">Valor Líquido a Enviar:</span>
                  <span className="text-lg font-black text-amber-400">
                    {formatBRL(selectedTx.net_amount_cents || selectedTx.amount_cents - selectedTx.fee_cents)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminNotes" className="text-xs font-semibold text-slate-200">
                  Observações / Código da Transação PIX (Opcional)
                </Label>
                <Input
                  id="adminNotes"
                  placeholder="Ex: ID EndToEnd do PIX ou comprovante"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="text-xs border-slate-800 bg-[#070b14] text-white"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setApproveModalOpen(false)}
                  disabled={processingAction}
                  className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleApproveSubmit}
                  disabled={processingAction}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {processingAction ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirmar Pagamento Realizado
                </Button>
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
                    <span className="text-slate-400">Taxa Intermediação Plataforma (2%):</span>
                    <span className="font-mono font-bold text-purple-400">
                      +{formatBRL(Math.round(selectedAuditSale.total_cents * 0.02))}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-slate-800/80 pt-1.5">
                    <span className="font-semibold text-slate-200">Crédito Líquido na Carteira da Loja:</span>
                    <span className="font-mono font-bold text-white">
                      {formatBRL(selectedAuditSale.total_cents - Math.round(selectedAuditSale.total_cents * 0.02))}
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
Taxa 2%: ${formatBRL(Math.round(selectedAuditSale.total_cents * 0.02))}
Líquido Loja: ${formatBRL(selectedAuditSale.total_cents - Math.round(selectedAuditSale.total_cents * 0.02))}
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
