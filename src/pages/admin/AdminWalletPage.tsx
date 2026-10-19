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
import { format } from "date-fns";
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

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);

export default function AdminWalletPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [wallets, setWallets] = useState<TenantWalletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState("withdrawals");

  // Filters
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState("pending");
  const [searchWithdrawals, setSearchWithdrawals] = useState("");
  const [searchWallets, setSearchWallets] = useState("");

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

  const pendingCount = metrics?.pending_count || 0;

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  Carteira & Gestão de Saques
                </h1>
                <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                  Taxa Plataforma: 2%
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Painel central de split, controle financeiro das lojas e aprovação manual de transferências PIX.
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(true)}
          disabled={refreshing || loading}
          className="gap-2 border-border/60 hover:bg-muted/50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar Dados
        </Button>
      </div>

      {/* Global Platform Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saques Pendentes */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-amber-950/20 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Saques Pendentes
              </span>
              {pendingCount > 0 && (
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <CardTitle className="text-3xl font-black tracking-tight text-amber-400">
                {pendingCount}
              </CardTitle>
              <span className="text-xs font-semibold text-muted-foreground">
                ({formatBRL(metrics?.pending_net_cents || 0)} líquido)
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Solicitações aguardando sua conferência e envio PIX
            </p>
          </CardContent>
        </Card>

        {/* Taxas Arrecadadas (2%) */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-emerald-950/20 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Taxas da Plataforma (2%)
              </span>
              <Percent className="h-4 w-4 text-emerald-400" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight text-emerald-400">
              {formatBRL(metrics?.total_fees_collected_cents || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Lucro retido pela taxa de 2% sobre saques concluídos
            </p>
          </CardContent>
        </Card>

        {/* Saldo Total Retido nas Lojas */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-blue-950/20 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Saldo Total das Lojas
              </span>
              <Coins className="h-4 w-4 text-blue-400" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight text-blue-400">
              {formatBRL(metrics?.total_balance_cents || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Soma dos saldos disponíveis em todas as carteiras
            </p>
          </CardContent>
        </Card>

        {/* Total Já Pago em Saques */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-purple-950/20 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Já Sacado
              </span>
              <CheckCircle2 className="h-4 w-4 text-purple-400" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight text-purple-400">
              {formatBRL(metrics?.total_withdrawn_cents || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Volume total aprovado e transferido via PIX
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Saques vs Carteiras */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 border border-border/60">
          <TabsTrigger value="withdrawals" className="gap-2 relative">
            <Clock className="h-4 w-4" />
            Solicitações de Saque
            {pendingCount > 0 && (
              <Badge className="ml-1 px-1.5 py-0 text-[10px] bg-amber-500 text-black font-bold">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="wallets" className="gap-2">
            <Building className="h-4 w-4" />
            Carteiras dos Clientes ({wallets.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Solicitações de Saque */}
        <TabsContent value="withdrawals" className="space-y-4">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-400" />
                    Gerenciamento e Aprovação de Saques
                  </CardTitle>
                  <CardDescription>
                    Analise os saques solicitados pelos clientes, copie a chave PIX, faça a transferência e confirme.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative min-w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por loja ou chave PIX..."
                      value={searchWithdrawals}
                      onChange={(e) => setSearchWithdrawals(e.target.value)}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>

                  <Select value={withdrawalStatusFilter} onValueChange={setWithdrawalStatusFilter}>
                    <SelectTrigger className="h-9 w-[150px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                <div className="p-12 text-center text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary opacity-60" />
                  <p className="text-sm">Carregando solicitações de saque...</p>
                </div>
              ) : filteredWithdrawals.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-20 text-emerald-400" />
                  <p className="text-base font-semibold text-foreground">Nenhuma solicitação encontrada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {withdrawalStatusFilter === "pending"
                      ? "Não há saques pendentes de aprovação no momento."
                      : "Nenhum registro corresponde aos filtros selecionados."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                      <tr>
                        <th className="py-3 px-4">Loja / Cliente</th>
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-4">Chave PIX</th>
                        <th className="py-3 px-4 text-right">Bruto</th>
                        <th className="py-3 px-4 text-right">Taxa (2%)</th>
                        <th className="py-3 px-4 text-right">Líquido a Pagar</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredWithdrawals.map((w) => {
                        const isPending = w.status === "pending";

                        return (
                          <tr key={w.id} className="hover:bg-muted/20 transition-colors">
                            {/* Loja */}
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-xs text-foreground">
                                {w.tenants?.name || "Loja"}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                ID: {w.tenant_id.slice(0, 8)}...
                              </div>
                            </td>

                            {/* Data */}
                            <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(w.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </td>

                            {/* Chave PIX */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-semibold text-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/50">
                                  {w.pix_key}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCopyPixKey(w.pix_key || "", w.id)}
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                                <div className="text-[10px] uppercase text-muted-foreground mt-0.5">
                                  Tipo: {w.pix_key_type}
                                </div>
                              )}
                            </td>

                            {/* Bruto */}
                            <td className="py-3.5 px-4 text-right text-xs font-medium text-foreground whitespace-nowrap">
                              {formatBRL(w.amount_cents)}
                            </td>

                            {/* Taxa */}
                            <td className="py-3.5 px-4 text-right text-xs text-emerald-400 font-semibold whitespace-nowrap">
                              +{formatBRL(w.fee_cents)}
                            </td>

                            {/* Líquido */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <span className="text-sm font-extrabold text-foreground bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
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
                                <Badge className="bg-destructive/15 text-destructive border border-destructive/30 text-[11px]">
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
                                    className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5"
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
                                    className="h-8 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 text-xs px-2.5"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Rejeitar
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">
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
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Carteiras de Todos os Clientes
                  </CardTitle>
                  <CardDescription>
                    Visão geral dos saldos disponíveis, bloqueados e movimentações de cada loja cadastrada.
                  </CardDescription>
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar loja por nome ou ID..."
                    value={searchWallets}
                    onChange={(e) => setSearchWallets(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary opacity-60" />
                  <p className="text-sm">Carregando carteiras...</p>
                </div>
              ) : filteredWallets.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Building className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-base font-semibold text-foreground">Nenhuma carteira encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                      <tr>
                        <th className="py-3 px-4">Loja / Cliente</th>
                        <th className="py-3 px-4">Plano</th>
                        <th className="py-3 px-4 text-right">Saldo Disponível</th>
                        <th className="py-3 px-4 text-right">Em Aprovação</th>
                        <th className="py-3 px-4 text-right">Total Recebido</th>
                        <th className="py-3 px-4 text-right">Total Sacado</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredWallets.map((w) => (
                        <tr key={w.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-xs text-foreground">
                              {w.tenants?.name || "Loja"}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {w.tenant_id}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge variant="outline" className="text-[10px] uppercase">
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
                              className="h-8 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
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
      </Tabs>

      {/* Modal: Aprovar Saque */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              Confirmar Aprovação de Saque
            </DialogTitle>
            <DialogDescription>
              Certifique-se de que a transferência PIX foi realizada para a chave abaixo.
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loja Solicitante:</span>
                  <span className="font-bold text-foreground">{selectedTx.tenants?.name || "Loja"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chave PIX:</span>
                  <span className="font-mono font-bold text-foreground">{selectedTx.pix_key}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Bruto Solicitado:</span>
                  <span className="font-medium text-foreground">{formatBRL(selectedTx.amount_cents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxa da Plataforma (2%):</span>
                  <span className="font-bold text-emerald-400">+{formatBRL(selectedTx.fee_cents)}</span>
                </div>
                <div className="border-t border-border/60 pt-2 flex justify-between items-center">
                  <span className="font-bold text-foreground">Valor Líquido a Enviar:</span>
                  <span className="text-lg font-black text-emerald-400">
                    {formatBRL(selectedTx.net_amount_cents || selectedTx.amount_cents - selectedTx.fee_cents)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminNotes" className="text-xs font-semibold">
                  Observações / Código da Transação PIX (Opcional)
                </Label>
                <Input
                  id="adminNotes"
                  placeholder="Ex: ID EndToEnd do PIX ou comprovante"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setApproveModalOpen(false)}
                  disabled={processingAction}
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

      {/* Modal: Rejeitar Saque */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-destructive">
              <XCircle className="h-5 w-5" />
              Rejeitar Solicitação de Saque
            </DialogTitle>
            <DialogDescription>
              O saldo total será imediatamente devolvido à carteira da loja.
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                Ao rejeitar, o valor bruto de <strong>{formatBRL(selectedTx.amount_cents)}</strong> retornará
                integralmente ao saldo disponível de <strong>{selectedTx.tenants?.name || "Loja"}</strong>.
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rejectionReason" className="text-xs font-semibold">
                  Motivo da Rejeição (Visível para o cliente) *
                </Label>
                <Input
                  id="rejectionReason"
                  placeholder="Ex: Chave PIX inexistente / Dados divergentes"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectModalOpen(false)}
                  disabled={processingAction}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleRejectSubmit}
                  disabled={processingAction || !rejectionReason.trim()}
                  className="gap-2 font-semibold"
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

      {/* Modal: Ajustar Saldo Manual */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Edit3 className="h-5 w-5 text-primary" />
              Ajuste Administrativo de Saldo
            </DialogTitle>
            <DialogDescription>
              Adicione créditos ou faça débitos na carteira da loja selecionada.
            </DialogDescription>
          </DialogHeader>

          {selectedWallet && (
            <form onSubmit={handleAdjustSubmit} className="space-y-4 py-2 text-sm">
              <div className="rounded-lg bg-muted/60 p-3 flex justify-between items-center text-xs">
                <div>
                  <span className="text-muted-foreground">Loja:</span>
                  <p className="font-bold text-foreground text-sm">{selectedWallet.tenants?.name || "Loja"}</p>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">Saldo Atual:</span>
                  <p className="font-bold text-emerald-400 text-sm">{formatBRL(selectedWallet.balance_cents)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tipo de Ajuste</Label>
                  <Select value={adjustType} onValueChange={(v: "credit" | "debit") => setAdjustType(v)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Crédito (+)</SelectItem>
                      <SelectItem value="debit">Débito (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Valor (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adjustReason" className="text-xs font-semibold">
                  Justificativa / Motivo do Ajuste *
                </Label>
                <Input
                  id="adjustReason"
                  placeholder="Ex: Correção de lançamento / Bonificação"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustModalOpen(false)}
                  disabled={processingAction}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={processingAction || !adjustAmount.trim() || !adjustReason.trim()}
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
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
    </div>
  );
}
