import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Shield,
  FileText,
  Calculator,
  Wallet,
  Percent,
  CheckCircle2,
  Zap,
  ArrowRight,
  Copy,
  Check,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  HelpCircle,
  Lock,
  Sparkles,
  RefreshCw,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";
import { toast } from "sonner";

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const FIXED_FEE_BRL = 1.0; // R$ 1,00 fixo por venda aprovada
const PERCENT_FEE = 2.0; // 2% por venda aprovada
const EXTRA_WITHDRAW_FEE_BRL = 1.0; // R$ 1,00 a partir do 2º saque na semana
const MIN_WITHDRAW_BRL = 10.0; // R$ 10,00 saque mínimo

const TermsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine default tab based on URL (/taxas or ?tab=...)
  const initialTab = useMemo(() => {
    const tabParam = searchParams.get("tab");
    if (location.pathname === "/taxas" || tabParam === "taxas" || tabParam === "calculadora") {
      return "fees";
    }
    if (tabParam === "saques") return "withdrawals";
    return "terms";
  }, [location.pathname, searchParams]);

  const [activeTab, setActiveTab] = useState<"fees" | "terms" | "withdrawals">(initialTab);

  useEffect(() => {
    if (location.pathname === "/taxas") {
      setActiveTab("fees");
    }
  }, [location.pathname]);

  const handleTabChange = (tab: "fees" | "terms" | "withdrawals") => {
    setActiveTab(tab);
    if (location.pathname === "/termos") {
      setSearchParams(tab === "terms" ? {} : { tab: tab === "fees" ? "taxas" : "saques" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Calculator State ──
  const [calcMode, setCalcMode] = useState<"forward" | "reverse">("forward");

  // Forward mode: Seller knows Sale Price & Product Cost -> wants to see Net Wallet Credit & Profit Margin
  const [salePriceInput, setSalePriceInput] = useState<string>("47,50");
  const [productCostInput, setProductCostInput] = useState<string>("15,00");
  const [monthlySalesCount, setMonthlySalesCount] = useState<number>(30);

  // Reverse mode: Seller knows Product Cost & Desired Profit -> wants to know Ideal Sale Price to charge
  const [revCostInput, setRevCostInput] = useState<string>("25,00");
  const [revTargetProfitInput, setRevTargetProfitInput] = useState<string>("20,00");
  const [copiedPrice, setCopiedPrice] = useState(false);

  const parseCurrencyInput = (raw: string): number => {
    if (!raw) return 0;
    const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  };

  // Forward calculations
  const forwardResults = useMemo(() => {
    const grossPrice = parseCurrencyInput(salePriceInput);
    const productCost = parseCurrencyInput(productCostInput);

    const fixedFee = grossPrice > 0 ? FIXED_FEE_BRL : 0;
    const percentFee = grossPrice > 0 ? Number((grossPrice * (PERCENT_FEE / 100)).toFixed(2)) : 0;
    const totalPlatformFee = Number((fixedFee + percentFee).toFixed(2));
    const netWalletCredit = Math.max(0, Number((grossPrice - totalPlatformFee).toFixed(2)));
    const netProfit = Number((netWalletCredit - productCost).toFixed(2));

    const effectiveFeePct = grossPrice > 0 ? (totalPlatformFee / grossPrice) * 100 : 0;
    const profitMarginPct = grossPrice > 0 ? (netProfit / grossPrice) * 100 : 0;
    const markupPct = productCost > 0 ? (netProfit / productCost) * 100 : 0;

    // Bar percentages (clamped 0..100)
    const feeShare = grossPrice > 0 ? Math.min(100, Math.max(0, (totalPlatformFee / grossPrice) * 100)) : 0;
    const costShare = grossPrice > 0 ? Math.min(100 - feeShare, Math.max(0, (productCost / grossPrice) * 100)) : 0;
    const profitShare = Math.max(0, 100 - feeShare - costShare);

    return {
      grossPrice,
      productCost,
      fixedFee,
      percentFee,
      totalPlatformFee,
      netWalletCredit,
      netProfit,
      effectiveFeePct,
      profitMarginPct,
      markupPct,
      feeShare,
      costShare,
      profitShare,
      monthlyGross: grossPrice * monthlySalesCount,
      monthlyFees: totalPlatformFee * monthlySalesCount,
      monthlyWallet: netWalletCredit * monthlySalesCount,
      monthlyProfit: netProfit * monthlySalesCount,
    };
  }, [salePriceInput, productCostInput, monthlySalesCount]);

  // Reverse calculations:
  // NetReceived = GrossPrice - 1.00 - 0.02 * GrossPrice = 0.98 * GrossPrice - 1.00
  // We want NetReceived = Cost + TargetProfit
  // => 0.98 * GrossPrice = Cost + TargetProfit + 1.00
  // => GrossPrice = (Cost + TargetProfit + 1.00) / 0.98
  const reverseResults = useMemo(() => {
    const cost = parseCurrencyInput(revCostInput);
    const targetProfit = parseCurrencyInput(revTargetProfitInput);
    const desiredNetInWallet = cost + targetProfit;

    const suggestedPrice =
      desiredNetInWallet > 0
        ? Math.ceil(((desiredNetInWallet + FIXED_FEE_BRL) / (1 - PERCENT_FEE / 100)) * 100) / 100
        : 0;

    const fixedFee = suggestedPrice > 0 ? FIXED_FEE_BRL : 0;
    const percentFee = suggestedPrice > 0 ? Number((suggestedPrice * (PERCENT_FEE / 100)).toFixed(2)) : 0;
    const totalFee = Number((fixedFee + percentFee).toFixed(2));
    const actualNetWallet = Math.max(0, Number((suggestedPrice - totalFee).toFixed(2)));
    const actualProfit = Number((actualNetWallet - cost).toFixed(2));
    const marginPct = suggestedPrice > 0 ? (actualProfit / suggestedPrice) * 100 : 0;

    return {
      cost,
      targetProfit,
      desiredNetInWallet,
      suggestedPrice,
      fixedFee,
      percentFee,
      totalFee,
      actualNetWallet,
      actualProfit,
      marginPct,
    };
  }, [revCostInput, revTargetProfitInput]);

  const handleCopySuggestedPrice = () => {
    const formatted = reverseResults.suggestedPrice.toFixed(2).replace(".", ",");
    navigator.clipboard.writeText(formatted);
    setCopiedPrice(true);
    toast.success(`Preço sugerido (R$ ${formatted}) copiado!`);
    setTimeout(() => setCopiedPrice(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#05070e] text-white relative overflow-x-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-1/4 w-[450px] h-[450px] bg-purple-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[140px]" />
      </div>

      {/* Top Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#05070e]/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2 text-white/70 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar ao Início</span>
            </Button>
            <div className="h-5 w-px bg-white/10 hidden sm:block" />
            <div
              onClick={() => navigate("/")}
              className="flex items-center gap-2 cursor-pointer"
            >
              <img src={drikaLogo} alt="Drika Hub" className="h-8 w-auto" />
              <span className="font-display font-extrabold text-sm sm:text-base tracking-tight text-white">
                DRIKA <span className="text-pink-500">HUB</span>
              </span>
            </div>
          </div>

          {/* Quick Navigation Pills */}
          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleTabChange("fees")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                activeTab === "fees"
                  ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.35)]"
                  : "bg-transparent text-white/60 hover:text-white"
              }`}
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Taxas & Calculadora</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("withdrawals")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                activeTab === "withdrawals"
                  ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.35)]"
                  : "bg-transparent text-white/60 hover:text-white"
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Regras de Saque</span>
              <span className="md:hidden">Saques</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("terms")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                activeTab === "terms"
                  ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.35)]"
                  : "bg-transparent text-white/60 hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Termos de Uso</span>
              <span className="sm:hidden">Termos</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        {/* Hero Banner */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Central de Transparência, Taxas & Termos Oficiais</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display tracking-tight leading-tight">
            {activeTab === "fees" && (
              <>
                Taxas Claras &{" "}
                <span className="bg-gradient-to-r from-pink-400 via-rose-400 to-purple-400 bg-clip-text text-transparent">
                  Calculadora de Margem
                </span>
              </>
            )}
            {activeTab === "withdrawals" && (
              <>
                Como Funcionam os{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Saques & Carteira PIX
                </span>
              </>
            )}
            {activeTab === "terms" && (
              <>
                Termos de Serviço &{" "}
                <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                  Política de Taxas
                </span>
              </>
            )}
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Na Drika Hub todas as vendas são processadas 100% via{" "}
            <strong className="text-white">Carteira Digital Integrada com Split PIX Automático</strong>. Sem letras
            miúdas, sem mensalidades ocultas de gateway e com simulação em tempo real do seu lucro.
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1: TAXAS & CALCULADORA DE MARGEM
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "fees" && (
          <div className="space-y-10 animate-fade-in">
            {/* 1. Cards de Resumo das Taxas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Taxa de Venda */}
              <div className="relative rounded-3xl border border-pink-500/30 bg-gradient-to-b from-[#170916]/90 to-[#0a0d18]/90 p-6 overflow-hidden shadow-[0_0_40px_rgba(236,72,153,0.1)]">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-pink-500/15 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-pink-500/15 border border-pink-500/30 text-pink-300">
                    Por Venda Aprovada
                  </span>
                  <div className="h-10 w-10 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
                    <Percent className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                  Taxa de Split PIX (Checkout)
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-white font-display">R$ 1,00</span>
                  <span className="text-xl sm:text-2xl font-extrabold text-pink-400">+ 2%</span>
                </div>
                <p className="mt-3 text-xs text-slate-300 leading-relaxed">
                  Composta por <strong className="text-white">R$ 1,00 de taxa base fixa</strong> +{" "}
                  <strong className="text-pink-300">2% sobre o valor da venda</strong>. Descontada automaticamente no
                  ato da aprovação do pagamento PIX.
                </p>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Gerar QR Code PIX não pago é 100% GRÁTIS</span>
                </div>
              </div>

              {/* Card 2: Taxa de Saque */}
              <div className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-[#071914]/90 to-[#0a0d18]/90 p-6 overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.1)]">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    Cash-Out PIX
                  </span>
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Wallet className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                  Taxa de Saque da Carteira
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-display">GRÁTIS</span>
                  <span className="text-xs font-bold text-slate-300">1º da semana</span>
                </div>
                <p className="mt-3 text-xs text-slate-300 leading-relaxed">
                  Você tem direito a <strong className="text-emerald-400">1 saque 100% gratuito por semana</strong>.
                  Caso solicite saques extras na mesma semana, a taxa é de apenas{" "}
                  <strong className="text-white">R$ 1,00 fixo</strong> por envio.
                </p>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] text-slate-300 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Valor mínimo por solicitação de saque: R$ 10,00</span>
                </div>
              </div>

              {/* Card 3: Liquidação & Comprovante */}
              <div className="relative rounded-3xl border border-blue-500/30 bg-gradient-to-b from-[#081226]/90 to-[#0a0d18]/90 p-6 overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.1)]">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/15 border border-blue-500/30 text-blue-300">
                    100% Integrado
                  </span>
                  <div className="h-10 w-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Zap className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                  Crédito & Transferência
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white font-display">Instantâneo</span>
                </div>
                <p className="mt-3 text-xs text-slate-300 leading-relaxed">
                  Assim que seu cliente paga no Discord, o produto é entregue na hora e o{" "}
                  <strong className="text-white">valor líquido já entra na sua Carteira</strong> pronto para saque via
                  chave PIX (CPF, CNPJ, E-mail, Telefone ou Aleatória).
                </p>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] text-blue-300 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Comprovante PDF Oficial + Aviso no Discord</span>
                </div>
              </div>
            </div>

            {/* 2. CALCULADORA DE MARGEM E PRECIFICAÇÃO */}
            <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#0d1222]/95 to-[#080b14]/95 p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider">
                    <Calculator className="h-4 w-4" />
                    <span>Simulador Oficial do Lojista</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white">
                    Calculadora de Margem, Taxas & Preço Ideal
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Descubra exatamente quanto cai na sua carteira em cada venda ou calcule por quanto vender para ter o
                    lucro desejado.
                  </p>
                </div>

                {/* Mode Switcher */}
                <div className="flex items-center bg-[#060911] border border-white/10 p-1.5 rounded-2xl self-start">
                  <button
                    type="button"
                    onClick={() => setCalcMode("forward")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-none ${
                      calcMode === "forward"
                        ? "bg-pink-600 text-white shadow-lg shadow-pink-600/30"
                        : "bg-transparent text-slate-400 hover:text-white"
                    }`}
                  >
                    Quanto vou receber?
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcMode("reverse")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-none ${
                      calcMode === "reverse"
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                        : "bg-transparent text-slate-400 hover:text-white"
                    }`}
                  >
                    Por quanto devo vender?
                  </button>
                </div>
              </div>

              {/* ── MODO 1: QUANTO VOU RECEBER E LUCRAR ── */}
              {calcMode === "forward" ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Inputs Column */}
                  <div className="lg:col-span-5 space-y-5">
                    {/* Preço de Venda */}
                    <div className="rounded-2xl border border-white/10 bg-[#070a12] p-5 space-y-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                        <span>1. Preço de Venda do Produto (R$)</span>
                        <span className="text-[11px] text-pink-400 font-normal">Valor pago pelo cliente</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                          R$
                        </span>
                        <input
                          type="text"
                          value={salePriceInput}
                          onChange={(e) => setSalePriceInput(e.target.value)}
                          placeholder="47,50"
                          className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.05] border border-white/15 text-lg font-extrabold text-white font-mono outline-none focus:border-pink-500 transition-all"
                        />
                      </div>

                      {/* Quick Presets */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">
                          Valores rápidos para testar:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {["10,00", "25,00", "47,50", "50,00", "100,00", "250,00"].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setSalePriceInput(preset)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer border transition-all ${
                                salePriceInput === preset
                                  ? "bg-pink-500/20 border-pink-500/50 text-pink-300"
                                  : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.07]"
                              }`}
                            >
                              R$ {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Custo do Produto */}
                    <div className="rounded-2xl border border-white/10 bg-[#070a12] p-5 space-y-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                        <span>2. Custo do Produto / Estoque (R$)</span>
                        <span className="text-[11px] text-slate-400 font-normal">Opcional</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                          R$
                        </span>
                        <input
                          type="text"
                          value={productCostInput}
                          onChange={(e) => setProductCostInput(e.target.value)}
                          placeholder="0,00"
                          className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.05] border border-white/15 text-lg font-extrabold text-white font-mono outline-none focus:border-pink-500 transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Quanto você paga pelo produto no fornecedor (deixe <code className="text-slate-300">0,00</code>{" "}
                        se o produto for 100% próprio).
                      </p>
                    </div>

                    {/* Quantidade de Vendas no Mês */}
                    <div className="rounded-2xl border border-white/10 bg-[#070a12] p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          3. Simular Volume Mensal
                        </label>
                        <span className="px-2.5 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs font-mono font-bold">
                          {monthlySalesCount} {monthlySalesCount === 1 ? "venda" : "vendas"}/mês
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={200}
                        value={monthlySalesCount}
                        onChange={(e) => setMonthlySalesCount(Number(e.target.value))}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        {[1, 10, 30, 50, 100, 200].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setMonthlySalesCount(n)}
                            className="hover:text-pink-400 cursor-pointer bg-transparent border-none text-[10px] text-slate-400"
                          >
                            {n}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Results Column */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* Detalhamento do Split por Venda */}
                    <div className="rounded-2xl border border-white/10 bg-[#070a12] p-6 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Detalhamento do Split por Venda
                        </span>
                        <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                          Total Taxa Split: {formatBRL(forwardResults.totalPlatformFee)} (
                          {forwardResults.effectiveFeePct.toFixed(1)}%)
                        </span>
                      </div>

                      {/* 4 blocos iguais ao painel */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-white/10 bg-[#0b101d] p-3.5">
                          <span className="text-[11px] text-slate-400 block">Entrada Bruta</span>
                          <p className="text-base font-extrabold text-emerald-400 font-mono mt-1">
                            +{formatBRL(forwardResults.grossPrice)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#0b101d] p-3.5">
                          <span className="text-[11px] text-slate-400 block">Taxa Base Fixa (R$)</span>
                          <p className="text-base font-extrabold text-amber-400 font-mono mt-1">
                            -{formatBRL(forwardResults.fixedFee)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#0b101d] p-3.5">
                          <span className="text-[11px] text-slate-400 block">Taxa Split (2%)</span>
                          <p className="text-base font-extrabold text-purple-400 font-mono mt-1">
                            -{formatBRL(forwardResults.percentFee)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                          <span className="text-[11px] text-emerald-300 font-semibold block">Cai na Carteira</span>
                          <p className="text-base font-black text-white font-mono mt-1">
                            {formatBRL(forwardResults.netWalletCredit)}
                          </p>
                        </div>
                      </div>

                      {/* Resultado de Lucro & Margem Real */}
                      <div className="rounded-2xl border border-pink-500/25 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-emerald-500/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-xs uppercase tracking-wider font-bold text-pink-300 block">
                            Seu Lucro Líquido Real por Venda (após taxas e custo)
                          </span>
                          <div className="text-3xl sm:text-4xl font-black font-mono text-white">
                            {formatBRL(forwardResults.netProfit)}
                          </div>
                          <p className="text-xs text-slate-300">
                            Crédito na Carteira ({formatBRL(forwardResults.netWalletCredit)}) − Custo do Produto (
                            {formatBRL(forwardResults.productCost)})
                          </p>
                        </div>

                        <div className="flex sm:flex-col items-end justify-between gap-2 shrink-0">
                          <div
                            className={`px-3.5 py-2 rounded-xl border text-right ${
                              forwardResults.profitMarginPct >= 25
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                : forwardResults.profitMarginPct > 0
                                ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                : "bg-red-500/15 border-red-500/30 text-red-300"
                            }`}
                          >
                            <span className="text-[10px] uppercase font-bold block opacity-80">Margem Líquida</span>
                            <span className="text-xl font-black font-mono">
                              {forwardResults.profitMarginPct.toFixed(1)}%
                            </span>
                          </div>
                          {forwardResults.productCost > 0 && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              ROI s/ custo: <strong className="text-white">{forwardResults.markupPct.toFixed(0)}%</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Barra Visual de Composição */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Composição do valor pago pelo cliente:</span>
                          <span className="font-mono text-white">{formatBRL(forwardResults.grossPrice)} (100%)</span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden flex border border-white/10">
                          <div
                            style={{ width: `${forwardResults.profitShare}%` }}
                            className="bg-emerald-500 transition-all duration-300"
                            title="Lucro Líquido"
                          />
                          <div
                            style={{ width: `${forwardResults.costShare}%` }}
                            className="bg-blue-500 transition-all duration-300"
                            title="Custo do Produto"
                          />
                          <div
                            style={{ width: `${forwardResults.feeShare}%` }}
                            className="bg-pink-500 transition-all duration-300"
                            title="Taxa Drika Hub (R$ 1,00 + 2%)"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-300 pt-1">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            Lucro Líquido ({forwardResults.profitShare.toFixed(1)}%)
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                            Custo do Produto ({forwardResults.costShare.toFixed(1)}%)
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-pink-500" />
                            Taxa Drika Hub ({forwardResults.feeShare.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Projeção de Volume Mensal */}
                    <div className="rounded-2xl border border-white/10 bg-[#070a12] p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <TrendingUp className="h-4 w-4 text-emerald-400" />
                          Projeção para {monthlySalesCount} {monthlySalesCount === 1 ? "venda" : "vendas"} no mês
                        </span>
                        <span className="text-[11px] text-emerald-400 font-medium">1º saque semanal grátis</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
                          <span className="text-[11px] text-slate-400 block">Faturamento Bruto</span>
                          <span className="text-base font-bold text-white font-mono">
                            {formatBRL(forwardResults.monthlyGross)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
                          <span className="text-[11px] text-slate-400 block">Total Creditado na Carteira</span>
                          <span className="text-base font-bold text-emerald-400 font-mono">
                            {formatBRL(forwardResults.monthlyWallet)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5">
                          <span className="text-[11px] text-emerald-300 font-semibold block">Lucro Líquido no Bolso</span>
                          <span className="text-base font-black text-white font-mono">
                            {formatBRL(forwardResults.monthlyProfit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── MODO 2: CALCULADORA REVERSA (POR QUANTO DEVO VENDER?) ── */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-5 space-y-5">
                    <div className="rounded-2xl border border-white/10 bg-[#070a12] p-5 space-y-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                        1. Qual o Custo do seu Produto? (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                          R$
                        </span>
                        <input
                          type="text"
                          value={revCostInput}
                          onChange={(e) => setRevCostInput(e.target.value)}
                          placeholder="25,00"
                          className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.05] border border-white/15 text-lg font-extrabold text-white font-mono outline-none focus:border-purple-500 transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Se não houver custo de aquisição, digite <code className="text-slate-200">0,00</code>.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#070a12] p-5 space-y-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                        2. Quanto você quer LUCRAR limpo por venda? (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                          R$
                        </span>
                        <input
                          type="text"
                          value={revTargetProfitInput}
                          onChange={(e) => setRevTargetProfitInput(e.target.value)}
                          placeholder="20,00"
                          className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.05] border border-white/15 text-lg font-extrabold text-white font-mono outline-none focus:border-purple-500 transition-all"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {["10,00", "15,00", "20,00", "35,00", "50,00", "100,00"].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setRevTargetProfitInput(val)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer border transition-all ${
                              revTargetProfitInput === val
                                ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                                : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
                            }`}
                          >
                            +R$ {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-7 space-y-5">
                    <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/30 via-[#070a12] to-pink-950/20 p-6 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-purple-300 block">
                            Preço Recomendado para Cadastrar na Loja
                          </span>
                          <div className="text-4xl sm:text-5xl font-black font-mono text-white mt-1">
                            {formatBRL(reverseResults.suggestedPrice)}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Já inclui a recomposição exata da Taxa Fixa (R$ 1,00) + Split (2%)
                          </p>
                        </div>

                        <Button
                          onClick={handleCopySuggestedPrice}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2 self-start sm:self-center"
                        >
                          {copiedPrice ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedPrice ? "Preço Copiado!" : "Copiar Preço"}
                        </Button>
                      </div>

                      {/* Prova Real da Conta */}
                      <div className="space-y-2.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                          Prova Real da Conta (Centavo por Centavo):
                        </span>
                        <div className="rounded-xl border border-white/10 bg-[#0b101d] p-4 space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Cliente paga no PIX:</span>
                            <span className="font-mono font-bold text-white">
                              {formatBRL(reverseResults.suggestedPrice)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Taxa Base Fixa Drika Hub:</span>
                            <span className="font-mono font-semibold text-amber-400">
                              - {formatBRL(reverseResults.fixedFee)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Taxa Percentual Split (2%):</span>
                            <span className="font-mono font-semibold text-purple-400">
                              - {formatBRL(reverseResults.percentFee)}
                            </span>
                          </div>
                          <div className="h-px bg-white/10 my-1" />
                          <div className="flex justify-between text-sm">
                            <span className="text-emerald-300 font-semibold">Crédito Líquido na sua Carteira:</span>
                            <span className="font-mono font-extrabold text-emerald-400">
                              {formatBRL(reverseResults.actualNetWallet)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Menos seu Custo do Produto:</span>
                            <span className="font-mono text-slate-300">- {formatBRL(reverseResults.cost)}</span>
                          </div>
                          <div className="h-px bg-white/10 my-1" />
                          <div className="flex justify-between text-sm">
                            <span className="text-white font-bold">Seu Lucro Limpo Garantido:</span>
                            <span className="font-mono font-black text-pink-400">
                              {formatBRL(reverseResults.actualProfit)} ({reverseResults.marginPct.toFixed(1)}% de margem)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Tabela de Exemplos Práticos */}
            <div className="rounded-3xl border border-white/10 bg-[#080c17]/90 p-6 sm:p-8 space-y-5">
              <div className="space-y-1">
                <h3 className="text-xl font-bold font-display text-white">
                  Exemplos Práticos de Vendas no Split Automático
                </h3>
                <p className="text-xs sm:text-sm text-slate-400">
                  Veja na prática como funciona a aplicação da regra <strong className="text-white">R$ 1,00 fixo + 2%</strong> em diferentes faixas de preço:
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4">Valor do Produto</th>
                      <th className="py-3 px-4">Taxa Base Fixa</th>
                      <th className="py-3 px-4">Taxa Split (2%)</th>
                      <th className="py-3 px-4">Total da Taxa</th>
                      <th className="py-3 px-4 text-right text-emerald-400">Creditado na Carteira</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {[15, 30, 47.5, 50, 100, 250].map((price) => {
                      const fixed = 1.0;
                      const pct = Number((price * 0.02).toFixed(2));
                      const totalFee = Number((fixed + pct).toFixed(2));
                      const net = Number((price - totalFee).toFixed(2));
                      return (
                        <tr key={price} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-bold text-white">{formatBRL(price)}</td>
                          <td className="py-3.5 px-4 text-amber-400">-{formatBRL(fixed)}</td>
                          <td className="py-3.5 px-4 text-purple-400">-{formatBRL(pct)}</td>
                          <td className="py-3.5 px-4 text-slate-300">-{formatBRL(totalFee)}</td>
                          <td className="py-3.5 px-4 text-right font-extrabold text-emerald-400">{formatBRL(net)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 2: REGRAS DE SAQUE & LIQUIDAÇÃO PIX
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "withdrawals" && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-white/10 bg-[#080c17] p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Política de Saques Semanais</h3>
                    <p className="text-xs text-slate-400">Transparência total para transferir seu saldo via PIX</p>
                  </div>
                </div>
                <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">1º Saque da Semana Grátis (R$ 0,00):</strong> Todo lojista tem
                      direito a 1 saque totalmente isento de taxa a cada ciclo de 7 dias.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Saques Extras na Mesma Semana ({formatBRL(EXTRA_WITHDRAW_FEE_BRL)}):</strong>{" "}
                      Caso deseje realizar mais de um saque dentro do mesmo período de 7 dias, é cobrada apenas uma taxa
                      fixa de <strong className="text-white">R$ 1,00</strong> para cobrir o custo de liquidação PIX SPI.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Valor Mínimo de Saque ({formatBRL(MIN_WITHDRAW_BRL)}):</strong> Você
                      pode solicitar a transferência a qualquer momento a partir de R$ 10,00 acumulados em carteira.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#080c17] p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Fluxo de Liquidação & Segurança</h3>
                    <p className="text-xs text-slate-400">Rastreabilidade bancária de ponta a ponta</p>
                  </div>
                </div>
                <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-pink-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Chave PIX Flexível:</strong> Cadastre ou altere sua chave PIX (CPF,
                      CNPJ, E-mail, Telefone ou Chave Aleatória) diretamente na aba Carteira do seu painel.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-pink-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Conferência Antifraude Rápida:</strong> Para proteger as lojas e a
                      plataforma contra fraudes ou MED indevido, os saques passam por validação de segurança e são
                      enviados via PIX automático diretamente para sua conta.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-pink-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Comprovante Oficial em PDF:</strong> Cada saque liquidado gera um
                      comprovante bancário em PDF com ID de transação e notificação automática no seu Discord.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 3: TERMOS DE SERVIÇO & POLÍTICA DE TAXAS COMPLETA
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "terms" && (
          <div className="space-y-6 animate-fade-in">
            {/* Banner Resumo com atalho para a Calculadora */}
            <div className="rounded-3xl border border-pink-500/30 bg-gradient-to-r from-pink-950/40 via-[#0b1020] to-purple-950/40 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-pink-400">
                  Resumo Rápido de Taxas (Vigência 2026)
                </span>
                <h3 className="text-lg font-bold text-white">
                  Taxa de Split PIX: R$ 1,00 fixo + 2% por venda aprovada • 1º Saque Semanal Grátis
                </h3>
                <p className="text-xs text-slate-300">
                  Quer simular quanto você recebe em cada produto ou calcular seu preço ideal de venda?
                </p>
              </div>
              <Button
                onClick={() => handleTabChange("fees")}
                className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold gap-2 shrink-0"
              >
                <Calculator className="h-4 w-4" />
                Abrir Calculadora de Margem
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <section className="rounded-2xl border border-white/10 bg-[#080c17] p-6 space-y-3">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <Shield className="h-5 w-5 text-pink-500" />
                  1. Aceitação dos Termos e Objeto
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Ao criar uma conta, vincular seu servidor Discord ou utilizar qualquer ferramenta da plataforma{" "}
                  <strong className="text-white">Drika Hub / Drika Solutions</strong> ("Plataforma"), você ("Lojista" ou
                  "Usuário") concorda integralmente com estes Termos de Serviço e com a Política Oficial de Taxas e
                  Liquidação. Caso não concorde com qualquer disposição aqui prevista, você não deverá utilizar os
                  serviços.
                </p>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#080c17] p-6 space-y-3">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <Wallet className="h-5 w-5 text-pink-500" />
                  2. Carteira Digital Integrada e Sistema 100% via Split PIX
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  A Drika Hub opera sob o modelo de <strong className="text-white">Carteira Digital Integrada</strong>.
                  Todas as vendas realizadas através do bot de vendas no Discord são processadas pelo gateway central
                  homologado da Plataforma via PIX:
                </p>
                <ul className="text-sm text-slate-300 space-y-2 list-disc pl-5">
                  <li>
                    O Lojista não precisa contratar gateways externos nem configurar credenciais de API bancárias para
                    vender.
                  </li>
                  <li>
                    Assim que o comprador final efetua o pagamento do QR Code PIX no Discord, o sistema identifica a
                    confirmação em tempo real, realiza a entrega automática do produto digital e credita o saldo líquido
                    instantaneamente na Carteira Drika Hub do Lojista.
                  </li>
                </ul>
              </section>

              <section className="rounded-2xl border border-pink-500/25 bg-[#0b0f1d] p-6 space-y-3">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <Percent className="h-5 w-5 text-pink-400" />
                  3. Estrutura Oficial de Taxas e Transparência Financeira
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  A Drika Hub preza pela clareza absoluta em todas as tarifas operacionais:
                </p>
                <ul className="text-sm text-slate-300 space-y-2 list-disc pl-5">
                  <li>
                    <strong className="text-white">Taxa de Intermediação e Split por Venda Aprovada:</strong> Para cada
                    transação paga com sucesso no checkout PIX do bot, é retida automaticamente a{" "}
                    <strong className="text-pink-400">Taxa Base Fixa de R$ 1,00 (um real)</strong> acrescida da{" "}
                    <strong className="text-pink-400">Taxa Percentual de 2% (dois por cento)</strong> sobre o valor bruto
                    do pedido.
                  </li>
                  <li>
                    <strong className="text-white">Isenção na Geração de Cobranças:</strong> A simples geração de QR
                    Codes PIX que não venham a ser pagos (pedidos pendentes, cancelados ou expirados) tem custo{" "}
                    <strong className="text-emerald-400">R$ 0,00 (gratuito)</strong>.
                  </li>
                  <li>
                    <strong className="text-white">Taxa de Saque da Carteira (PIX Cash-Out):</strong> O Lojista possui{" "}
                    <strong className="text-emerald-400">1 (um) saque gratuito por semana</strong> (a cada janela de 7
                    dias corridos). Caso solicite saques adicionais dentro do mesmo período de 7 dias, incidirá uma taxa
                    fixa de <strong className="text-white">R$ 1,00 (um real)</strong> por saque adicional para cobertura
                    de custos bancários do Sistema de Pagamentos Instantâneos (SPI).
                  </li>
                  <li>
                    <strong className="text-white">Valor Mínimo de Saque:</strong> O saldo disponível poderá ser sacado a
                    partir do valor mínimo de <strong className="text-white">R$ 10,00 (dez reais)</strong>.
                  </li>
                </ul>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#080c17] p-6 space-y-3">
                <h2 className="text-lg font-bold text-white">
                  4. Processamento de Saques, Conferência e Comprovantes
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Ao solicitar um saque na aba Carteira, o valor solicitado fica reservado ("Em processamento") até a
                  efetivação da transferência PIX para a chave cadastrada pelo Lojista. É de inteira responsabilidade do
                  Lojista informar corretamente os dados de sua chave PIX (CPF, CNPJ, E-mail, Telefone ou Chave
                  Aleatória). Após a liquidação bancária, a transferência no PIX é irreversível e um comprovante oficial
                  em PDF com identificador da transação fica disponível no painel.
                </p>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#080c17] p-6 space-y-3">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  5. Prevenção a Fraudes, Disputas e MED (Mecanismo Especial de Devolução PIX)
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Para manter a segurança do ecossistema e cumprir as normas do Banco Central do Brasil:
                </p>
                <ul className="text-sm text-slate-300 space-y-2 list-disc pl-5">
                  <li>
                    Caso uma venda sofra bloqueio cautelar, contestação bancária ou abertura de{" "}
                    <strong className="text-white">MED (Mecanismo Especial de Devolução)</strong> por parte do banco do
                    comprador final sob suspeita de fraude ou golpe, o valor correspondente poderá ser retido ou
                    estornado do saldo da Carteira do Lojista.
                  </li>
                  <li>
                    É estritamente proibido utilizar a loja para comercializar produtos fraudulentos, conteúdos ilícitos,
                    golpes (scam), vendas falsas para lavagem de valores ou produtos não entregues. Contas com índice
                    anormal de disputas/MED terão os saques bloqueados preventivamente para auditoria e poderão ser
                    banidas permanentemente.
                  </li>
                </ul>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#080c17] p-6 space-y-3">
                <h2 className="text-lg font-bold text-white">6. Responsabilidade sobre Produtos e Atendimento</h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  A Drika Hub fornece exclusivamente a tecnologia SaaS de automação de vendas, gestão de estoque e
                  intermediação tecnológica de pagamentos. O Lojista é o único e exclusivo responsável pela origem,
                  qualidade, licitude, garantia e suporte pós-venda dos produtos ou serviços comercializados em seu
                  servidor Discord, isentando a Drika Hub de responsabilidade solidária sobre relações de consumo entre o
                  Lojista e seus compradores finais.
                </p>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#080c17] p-6 space-y-3">
                <h2 className="text-lg font-bold text-white">7. Planos de Assinatura, Conta e Disponibilidade</h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Os planos de assinatura da Plataforma (Básico e Master, nos ciclos Mensal, Trimestral ou Semestral)
                  concedem licença de uso das ferramentas contratadas pelo período escolhido. O acesso ao painel é
                  realizado via autenticação oficial do Discord (OAuth2) ou Token de Acesso exclusivo, sendo o Lojista
                  responsável pela segurança de suas credenciais. A Plataforma busca operar com disponibilidade contínua
                  24/7, sujeita a manutenções técnicas ou oscilações externas da API do Discord e da rede bancária PIX.
                </p>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#080c17] p-6 space-y-3">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <Lock className="h-5 w-5 text-emerald-400" />
                  8. Privacidade, Proteção de Dados (LGPD) e Suporte Oficial
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Coletamos apenas os dados estritamente necessários para operação da loja, emissão de cobranças PIX,
                  prevenção a fraudes e transferência de saques, em conformidade com a Lei Geral de Proteção de Dados
                  (Lei nº 13.709/2018). Para dúvidas jurídicas, financeiras ou suporte técnico, utilize nosso servidor
                  oficial de suporte no Discord ou a aba Suporte dentro do painel.
                </p>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TermsPage;
