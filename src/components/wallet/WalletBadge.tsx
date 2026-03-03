import { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const WalletBadge = () => {
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const fetchBalance = async () => {
      const { data } = await supabase.
      from("wallets" as any).
      select("balance_cents").
      eq("tenant_id", tenantId).
      maybeSingle();
      setBalance((data as any)?.balance_cents ?? 0);
    };

    fetchBalance();

    // Realtime updates
    const channel = supabase.
    channel(`wallet-${tenantId}`).
    on(
      "postgres_changes" as any,
      {
        event: "*",
        schema: "public",
        table: "wallets",
        filter: `tenant_id=eq.${tenantId}`
      },
      (payload: any) => {
        if (payload.new?.balance_cents !== undefined) {
          setBalance(payload.new.balance_cents);
        }
      }
    ).
    subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const formatted = balance !== null ?
  (balance / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) :
  "—";

  return null;
};