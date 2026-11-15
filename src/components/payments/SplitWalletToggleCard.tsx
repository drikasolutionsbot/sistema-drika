import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  ShieldCheck,
  Percent,
  CheckCircle2,
  ArrowRight,
  Loader2,
  CreditCard,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SplitWalletToggleCardProps {
  /** Callback executado após alternar o modo com sucesso (ex: recarregar saldo da carteira). */
  onModeChanged?: () => void;
  /** Mostra ou oculta o atalho direto para a página da Carteira / Gateways oposta. */
  contextPage?: "gateways" | "wallet";
}

function formatFeeBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Card de destaque para assinantes de Planos Pagos escolherem voluntariamente
 * entre Gateways Próprias (0% de taxa) e o Sistema de Carteira & Split Global (mesmas taxas do Free).
 */
export function SplitWalletToggleCard({
  onModeChanged,
  contextPage = "gateways",
}: SplitWalletToggleCardProps) {
  const { tenantId, planAccess, refetch } = useTenant();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<boolean | null>(null);

  const { data: splitFees } = useQuery({
    queryKey: ["landing_split_fees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("landing_config")
        .select("split_fixed_fee_cents, split_percent_fee")
        .limit(1)
        .maybeSingle();
      return {
        fixedCents: Number((data as any)?.split_fixed_fee_cents ?? 100),
        percentFee: Number((data as any)?.split_percent_fee ?? 2),
      };
    },
    staleTime: 60_000,
  });

  if (!tenantId || !planAccess.isPaid) return null;

  const isSplitEnabled = planAccess.optedInSplitWallet;
  const fixedFeeLabel = formatFeeBrl(splitFees?.fixedCents ?? 100);
  const percentFeeLabel = `${splitFees?.percentFee ?? 2}%`;

  const applyModeChange = async (enableSplit: boolean) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-payment-providers", {
        body: {
          action: "set_split_wallet",
          tenant_id: tenantId,
          enabled: enableSplit,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["payment_providers", tenantId] }),
      ]);
      onModeChanged?.();

      toast({
        title: enableSplit
          ? "Carteira & Split Global ativado!"
          : "Gateways Próprias (0% taxa) reativadas!",
        description: enableSplit
          ? `Suas próximas vendas passarão pelo Split Global (${fixedFeeLabel} + ${percentFeeLabel}) e o saldo cairá direto na sua Carteira.`
          : "Suas vendas voltaram a cair 100% direto nos seus gateways configurados, sem taxa da plataforma.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao alterar modo de recebimento",
        description: err?.message || "Não foi possível salvar sua escolha.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setConfirmTarget(null);
    }
  };

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 shadow-xl transition-all ${
          isSplitEnabled
            ? "border-cyan-500/40 bg-gradient-to-br from-cyan-950/35 via-[#0b1528] to-[#070b14]"
            : "border-primary/35 bg-gradient-to-br from-primary/12 via-[#0d1222] to-[#070b14]"
        }`}
      >
        <div
          className={`pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl ${
            isSplitEnabled ? "bg-cyan-500/15" : "bg-primary/15"
          }`}
        />

        <div className="relative z-10 space-y-4">
          {/* Header + Switch destaque */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={
                    isSplitEnabled
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-semibold gap-1.5"
                      : "bg-primary/20 text-pink-300 border border-primary/40 text-xs font-semibold gap-1.5"
                  }
                >
                  <Wallet className="h-3.5 w-3.5" />
                  {isSplitEnabled
                    ? "Carteira & Split Global ATIVO por Escolha"
                    : "Escolha do Lojista: Carteira & Split Global"}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-emerald-500/35 bg-emerald-500/10 text-emerald-300 text-[11px]"
                >
                  Seu Plano Pago continua 100% ativo
                </Badge>
              </div>

              <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {isSplitEnabled
                  ? "Você escolheu operar com a Carteira & Split Global da Drika"
                  : "Prefere não configurar gateways? Ative a Carteira & Split Global nesta conta"}
              </h3>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {isSplitEnabled ? (
                  <>
                    Suas vendas estão sendo processadas pelo nosso{" "}
                    <strong className="text-white">Sistema Split Global</strong> com taxa padrão de{" "}
                    <strong className="text-cyan-300">
                      {fixedFeeLabel} + {percentFeeLabel} por venda
                    </strong>{" "}
                    (mesma taxa do Plano Free) e o lucro líquido cai automaticamente na sua{" "}
                    <strong className="text-white">Carteira</strong> para saque via PIX. Você pode voltar para{" "}
                    <strong className="text-emerald-400">Gateways Próprias (0% taxa)</strong> a qualquer momento.
                  </>
                ) : (
                  <>
                    No Plano Pago, por padrão você usa <strong className="text-emerald-400">Gateways Próprias com 0% de taxa</strong>.
                    Se preferir praticidade sem configurar Mercado Pago, Efí ou webhooks, você pode{" "}
                    <strong className="text-white">ativar a Carteira & Split Global por escolha própria</strong> — operando
                    com a mesma taxa do Plano Free (
                    <strong className="text-pink-300">
                      {fixedFeeLabel} + {percentFeeLabel} por venda
                    </strong>
                    ) sem perder nenhum benefício do seu plano.
                  </>
                )}
              </p>
            </div>

            {/* Controle principal bem visível */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0 rounded-xl border border-white/10 bg-black/35 p-3.5 sm:p-4 w-full lg:w-auto lg:min-w-[250px]">
              <div className="flex items-center justify-between gap-4 w-full">
                <div className="text-left">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Split Global & Carteira
                  </p>
                  <p
                    className={`text-sm font-bold ${
                      isSplitEnabled ? "text-cyan-300" : "text-slate-200"
                    }`}
                  >
                    {isSplitEnabled ? "Ativado na conta" : "Desativado (0% direto)"}
                  </p>
                </div>
                <Switch
                  checked={isSplitEnabled}
                  disabled={saving}
                  onCheckedChange={(checked) => setConfirmTarget(checked)}
                  aria-label="Alternar sistema de Carteira e Split Global"
                  className="data-[state=checked]:bg-cyan-500 scale-110"
                />
              </div>

              <Button
                size="sm"
                disabled={saving}
                onClick={() => setConfirmTarget(!isSplitEnabled)}
                className={
                  isSplitEnabled
                    ? "w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    : "w-full gap-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold shadow-lg shadow-pink-900/25"
                }
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSplitEnabled ? (
                  <CreditCard className="h-4 w-4" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                {isSplitEnabled
                  ? "Voltar para Gateways Próprias (0%)"
                  : "Ativar Carteira & Split Global"}
              </Button>
            </div>
          </div>

          {/* Comparativo rápido das duas opções */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div
              className={`rounded-xl border p-3.5 text-xs space-y-1.5 transition-colors ${
                !isSplitEnabled
                  ? "border-emerald-500/40 bg-emerald-950/25"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 font-bold text-white">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <ShieldCheck className="h-4 w-4" /> Gateways Próprias (Padrão Pago)
                </span>
                {!isSplitEnabled && (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                    Em uso
                  </Badge>
                )}
              </div>
              <p className="text-slate-300">
                Taxa Drika: <strong className="text-emerald-300">0%</strong> • O dinheiro cai direto na sua conta Mercado Pago, Efí, PushinPay, AbacatePay ou Stripe.
              </p>
            </div>

            <div
              className={`rounded-xl border p-3.5 text-xs space-y-1.5 transition-colors ${
                isSplitEnabled
                  ? "border-cyan-500/45 bg-cyan-950/25"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 font-bold text-white">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <Percent className="h-4 w-4" /> Carteira & Split Global (Opcional)
                </span>
                {isSplitEnabled && (
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px]">
                    Em uso
                  </Badge>
                )}
              </div>
              <p className="text-slate-300">
                Taxa Split: <strong className="text-cyan-300">{fixedFeeLabel} + {percentFeeLabel}</strong> (igual ao Free) • Não precisa configurar gateway próprio e saca via PIX na Carteira.
              </p>
            </div>
          </div>

          {/* Rodapé de links úteis */}
          <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
            {contextPage === "gateways" && isSplitEnabled && (
              <Link
                to="/wallet"
                className="inline-flex items-center gap-1.5 font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
              >
                <Wallet className="h-3.5 w-3.5" />
                Abrir Minha Carteira & Saques
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {contextPage === "wallet" && (
              <Link
                to="/settings?tab=gateways"
                className="inline-flex items-center gap-1.5 font-semibold text-emerald-300 hover:text-emerald-200 underline underline-offset-4"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Ir para Gateways Próprias
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            <Link
              to="/taxas"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white underline underline-offset-4"
            >
              <Sparkles className="h-3.5 w-3.5 text-pink-400" />
              Ver Simulador e Tabela de Taxas
            </Link>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação explícita */}
      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent className="border-slate-800 bg-[#0b1222] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              {confirmTarget ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-cyan-400" />
                  Ativar Sistema de Carteira & Split Global?
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Voltar para Gateways Próprias (Taxa 0%)?
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 space-y-2 pt-1">
              {confirmTarget ? (
                <>
                  <span className="block">
                    Ao ativar o <strong>Split Global por sua escolha</strong>, seus novos pagamentos PIX no Discord passarão pelo gateway central da Drika com cobrança das taxas padrão:
                  </span>
                  <span className="block rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-3 py-2 text-cyan-200 font-semibold">
                    Taxa aplicada: {fixedFeeLabel} fixo + {percentFeeLabel} por venda aprovada (igual ao Plano Free).
                  </span>
                  <span className="block text-xs text-slate-400">
                    O valor líquido ficará disponível na sua Carteira para saque via PIX, e todos os recursos do seu Plano Pago continuam ativos normalmente. Você pode desativar esta opção quando quiser.
                  </span>
                </>
              ) : (
                <>
                  <span className="block">
                    Ao desativar o Split Global, suas próximas vendas passarão a usar os seus próprios gateways configurados em{" "}
                    <strong>Configurações &gt; Gateways</strong> com <strong>0% de taxa da plataforma</strong>.
                  </span>
                  <span className="block text-xs text-slate-400">
                    Certifique-se de ter pelo menos um gateway próprio ativo (ou chave PIX configurada) para não interromper as vendas do seu bot. Qualquer saldo já acumulado na Carteira continua disponível para saque.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={saving}
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                if (confirmTarget !== null) {
                  void applyModeChange(confirmTarget);
                }
              }}
              className={
                confirmTarget
                  ? "bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              }
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {confirmTarget
                ? "Confirmar e Ativar Split Global"
                : "Confirmar e Usar Gateways Próprias"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
