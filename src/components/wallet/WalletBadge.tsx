import { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, ArrowDownLeft, ArrowUpRight, Eye, EyeOff, TrendingUp, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import WalletDepositDialog from "./WalletDepositDialog";

interface WalletData {
  balance_cents: number;
  total_earned_cents: number;
  total_withdrawn_cents: number;
}

export const WalletBadge = () => {
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [visible, setVisible] = useState(true);

  const fetchWallet = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("wallets" as any)
      .select("balance_cents, total_earned_cents, total_withdrawn_cents")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    setWallet((data as any) ?? { balance_cents: 0, total_earned_cents: 0, total_withdrawn_cents: 0 });
  };

  useEffect(() => {
    if (!tenantId) return;
    fetchWallet();

    const channel = supabase
      .channel(`wallet-badge-${tenantId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "wallets", filter: `tenant_id=eq.${tenantId}` },
        (payload: any) => {
          if (payload.new) {
            setWallet({
              balance_cents: payload.new.balance_cents ?? 0,
              total_earned_cents: payload.new.total_earned_cents ?? 0,
              total_withdrawn_cents: payload.new.total_withdrawn_cents ?? 0,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const fmt = (c: number) =>
    (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const balance = wallet?.balance_cents ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 sm:gap-2 rounded-full px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors outline-none"
          aria-label="Saldo da carteira"
        >
          <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span className="font-semibold tabular-nums">
            {visible ? fmt(balance) : "••••••"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-card border-border overflow-hidden">
        {/* Header */}
        <div className="relative p-4 bg-gradient-to-br from-emerald-500/15 via-primary/10 to-transparent border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20">
                <Wallet className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Saldo Disponível
                </p>
                <p className="text-xl font-bold text-foreground tabular-nums mt-0.5">
                  {visible ? fmt(balance) : "••••••"}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setVisible(!visible);
              }}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
              aria-label="Alternar visibilidade"
            >
              {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 p-3 border-b border-border">
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Recebido</p>
              <p className="text-xs font-bold text-foreground truncate tabular-nums">
                {visible ? fmt(wallet?.total_earned_cents ?? 0) : "••••"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500/15">
              <DollarSign className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Sacado</p>
              <p className="text-xs font-bold text-foreground truncate tabular-nums">
                {visible ? fmt(wallet?.total_withdrawn_cents ?? 0) : "••••"}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action */}
        <div className="p-3">
          <button
            onClick={() => navigate("/settings?tab=wallet&section=withdraw")}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/15 transition-all p-3 text-center"
          >
            <ArrowUpRight className="h-4 w-4 text-orange-500" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">PIX OUT</span>
            <span className="text-xs font-semibold text-foreground">Sacar</span>
          </button>
        </div>

        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/settings?tab=wallet")}
            className="w-full justify-center text-xs text-muted-foreground hover:text-foreground"
          >
            Ver carteira completa
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
