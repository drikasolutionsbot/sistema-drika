// manage-wallet — Edge function for tenant wallet and admin split/withdrawal management
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ─── 1. Get Wallet (Client or Admin) ───
    if (action === "get_wallet") {
      const { tenant_id } = body;
      if (!tenant_id) {
        return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ensure wallet row exists
      const { data: existingWallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      let wallet = existingWallet;
      if (!wallet) {
        const { data: newW } = await supabase
          .from("wallets")
          .insert({
            tenant_id,
            balance_cents: 0,
            locked_balance_cents: 0,
            total_earned_cents: 0,
            total_withdrawn_cents: 0,
          })
          .select("*")
          .single();
        wallet = newW;
      }

      // Fetch recent transactions for this tenant
      const { data: txs } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ success: true, wallet, transactions: txs || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 2. Request Withdrawal (Client) ───
    if (action === "request_withdrawal") {
      const { tenant_id, amount_cents, pix_key, pix_key_type, description } = body;
      if (!tenant_id || !amount_cents || !pix_key) {
        return new Response(JSON.stringify({ error: "Dados incompletos para solicitação de saque" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: rpcRes, error: rpcErr } = await supabase.rpc("request_wallet_withdrawal", {
        _tenant_id: tenant_id,
        _amount_cents: amount_cents,
        _pix_key: pix_key.trim(),
        _pix_key_type: pix_key_type || "aleatoria",
        _description: description || "Solicitação de Saque PIX",
      });

      if (rpcErr) {
        return new Response(JSON.stringify({ error: rpcErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!rpcRes?.success) {
        return new Response(JSON.stringify({ error: rpcRes?.error || "Erro ao processar saque" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(rpcRes), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 3. Admin: Platform Metrics ───
    if (action === "admin_metrics") {
      // Sum balances from wallets
      const { data: allWallets } = await supabase
        .from("wallets")
        .select("balance_cents, locked_balance_cents, total_earned_cents, total_withdrawn_cents");

      let totalBalanceCents = 0;
      let totalLockedCents = 0;
      let totalEarnedCents = 0;
      let totalWithdrawnCents = 0;

      for (const w of allWallets || []) {
        totalBalanceCents += w.balance_cents || 0;
        totalLockedCents += w.locked_balance_cents || 0;
        totalEarnedCents += w.total_earned_cents || 0;
        totalWithdrawnCents += w.total_withdrawn_cents || 0;
      }

      // Sum collected fees from completed transactions
      const { data: completedTxs } = await supabase
        .from("wallet_transactions")
        .select("fee_cents")
        .eq("status", "completed");

      let totalFeesCollectedCents = 0;
      for (const t of completedTxs || []) {
        totalFeesCollectedCents += t.fee_cents || 0;
      }

      // Pending withdrawals count & sum
      const { data: pendingTxs } = await supabase
        .from("wallet_transactions")
        .select("amount_cents, net_amount_cents")
        .eq("status", "pending")
        .eq("type", "withdrawal");

      let pendingAmountCents = 0;
      let pendingNetCents = 0;
      for (const p of pendingTxs || []) {
        pendingAmountCents += p.amount_cents || 0;
        pendingNetCents += p.net_amount_cents || 0;
      }

      return new Response(
        JSON.stringify({
          success: true,
          metrics: {
            total_balance_cents: totalBalanceCents,
            total_locked_cents: totalLockedCents,
            total_earned_cents: totalEarnedCents,
            total_withdrawn_cents: totalWithdrawnCents,
            total_fees_collected_cents: totalFeesCollectedCents,
            pending_count: (pendingTxs || []).length,
            pending_amount_cents: pendingAmountCents,
            pending_net_cents: pendingNetCents,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 4. Admin: List Withdrawals (with Tenant names) ───
    if (action === "admin_list_withdrawals") {
      const { status } = body; // 'pending' | 'completed' | 'rejected' | 'all'

      let query = supabase
        .from("wallet_transactions")
        .select("*, tenants(name, logo_url, plan)")
        .eq("type", "withdrawal")
        .order("created_at", { ascending: false });

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query.limit(200);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, withdrawals: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 5. Admin: Approve Withdrawal ───
    if (action === "admin_approve_withdrawal") {
      const { tx_id, admin_notes } = body;
      if (!tx_id) {
        return new Response(JSON.stringify({ error: "tx_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: res, error } = await supabase.rpc("approve_wallet_withdrawal", {
        _tx_id: tx_id,
        _admin_notes: admin_notes || null,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(res), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 6. Admin: Reject Withdrawal ───
    if (action === "admin_reject_withdrawal") {
      const { tx_id, rejection_reason } = body;
      if (!tx_id) {
        return new Response(JSON.stringify({ error: "tx_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: res, error } = await supabase.rpc("reject_wallet_withdrawal", {
        _tx_id: tx_id,
        _rejection_reason: rejection_reason || "Saque recusado pela administração",
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(res), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 7. Admin: List All Wallets ───
    if (action === "admin_list_wallets") {
      const { data, error } = await supabase
        .from("wallets")
        .select("*, tenants(name, logo_url, plan)")
        .order("balance_cents", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, wallets: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 8. Admin: Adjust Balance ───
    if (action === "admin_adjust_balance") {
      const { tenant_id, amount_cents, reason } = body;
      if (!tenant_id || amount_cents === undefined) {
        return new Response(JSON.stringify({ error: "tenant_id e amount_cents obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: res, error } = await supabase.rpc("admin_adjust_wallet", {
        _tenant_id: tenant_id,
        _amount_cents: amount_cents,
        _reason: reason || "Ajuste manual pelo administrador",
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(res), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[manage-wallet] error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
