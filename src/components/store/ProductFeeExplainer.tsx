import React, { useMemo } from "react";
import { Info, TrendingUp, AlertTriangle, ShieldCheck, Receipt, Coins } from "lucide-react";

interface ProductFeeExplainerProps {
  priceCents: number;
  currency?: string;
  className?: string;
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);

export const ProductFeeExplainer: React.FC<ProductFeeExplainerProps> = ({
  priceCents,
  currency = "BRL",
  className = "",
}) => {
  const isBRL = !currency || currency.toUpperCase() === "BRL";

  const {
    price,
    gatewayFeeCents,
    platformFeeCents,
    totalFeeCents,
    netCents,
    netPercent,
    isLowPrice,
  } = useMemo(() => {
    const price = Math.max(0, priceCents || 0);
    // Taxa Gateway fixa: R$ 0,60 (60 centavos)
    const gateway = price > 0 ? 60 : 0;
    // Taxa da plataforma: 2%
    const platform = Math.round(price * 0.02);
    const total = gateway + platform;
    const net = Math.max(0, price - total);
    const pct = price > 0 ? Math.round((net / price) * 100) : 0;

    return {
      price,
      gatewayFeeCents: gateway,
      platformFeeCents: platform,
      totalFeeCents: total,
      netCents: net,
      netPercent: pct,
      isLowPrice: price > 0 && price < 100, // Menos de R$ 1,00
    };
  }, [priceCents]);

  if (!isBRL) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border border-slate-700/60 bg-gradient-to-br from-[#0c1324] via-[#090d1a] to-[#060912] p-4 text-xs shadow-md space-y-3 ${className}`}
    >
      {/* Cabeçalho explicativo */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <Receipt className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-100 flex items-center gap-1.5">
              Detalhamento de Taxas & Recebimento Líquido
            </h4>
            <p className="text-[11px] text-slate-400">
              O comprador paga o valor exato no checkout. As taxas são deduzidas automaticamente.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/50">
          Split Transparente
        </span>
      </div>

      {/* Grid de simulação */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* 1. Preço de Vitrine */}
        <div className="rounded-lg border border-slate-800/70 bg-slate-900/50 p-2.5">
          <p className="text-[10px] text-slate-400 font-medium">Preço de Venda</p>
          <p className="text-sm font-bold text-slate-100 font-mono mt-0.5">
            {formatBRL(price)}
          </p>
          <span className="text-[9px] text-slate-500">Valor pago pelo cliente</span>
        </div>

        {/* 2. Taxa de Gateway */}
        <div className="rounded-lg border border-slate-800/70 bg-slate-900/50 p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-medium">Taxa Gateway</p>
            <span className="text-[9px] text-amber-400/90 font-semibold">Fixa</span>
          </div>
          <p className="text-sm font-bold text-amber-400 font-mono mt-0.5">
            - {formatBRL(gatewayFeeCents)}
          </p>
          <span className="text-[9px] text-slate-500">Custo de processamento PIX</span>
        </div>

        {/* 3. Taxa da Plataforma */}
        <div className="rounded-lg border border-slate-800/70 bg-slate-900/50 p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-medium">Taxa Plataforma</p>
            <span className="text-[9px] text-purple-400/90 font-semibold">2,0%</span>
          </div>
          <p className="text-sm font-bold text-purple-400 font-mono mt-0.5">
            - {formatBRL(platformFeeCents)}
          </p>
          <span className="text-[9px] text-slate-500">Intermediação Drika Hub</span>
        </div>

        {/* 4. Valor Líquido */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-emerald-400 font-medium">Você Recebe</p>
            {price > 0 && (
              <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded border border-emerald-500/20">
                {netPercent}%
              </span>
            )}
          </div>
          <p className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">
            {formatBRL(netCents)}
          </p>
          <span className="text-[9px] text-emerald-500/80">Líquido na sua carteira</span>
        </div>
      </div>

      {/* Alerta de valor muito baixo se aplicável */}
      {isLowPrice && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px]">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            <strong>Recomendação:</strong> Como a taxa fixa de gateway é de <strong>R$ 0,60</strong>, sugerimos precificar seus produtos a partir de <strong>R$ 1,00</strong> para obter uma margem saudável de lucro.
          </span>
        </div>
      )}

      {/* Rodapé informativo de garantia */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5 text-slate-300">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          Sem taxas extras para o comprador no checkout.
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <Coins className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          O valor líquido vai direto para sua Carteira no momento da aprovação.
        </span>
      </div>
    </div>
  );
};
