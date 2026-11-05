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

async function verifySuperAdminOrServiceRole(
  req: Request,
  supabase: any
): Promise<{ authorized: boolean; error?: string; user?: any; isServiceRole?: boolean }> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const apiKeyHeader = req.headers.get("apikey");

  const rawToken = (authHeader ? authHeader.replace(/^Bearer\s+/i, "") : apiKeyHeader)?.trim();
  if (!rawToken) {
    return { authorized: false, error: "Acesso não autorizado: token de autenticação ausente" };
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  // 1. Direct Service Role Key match
  if (serviceRoleKey && (rawToken === serviceRoleKey || apiKeyHeader === serviceRoleKey)) {
    return { authorized: true, isServiceRole: true };
  }

  // 2. JWT with service_role payload
  if (rawToken.includes(".")) {
    try {
      const parts = rawToken.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.role === "service_role") {
          return { authorized: true, isServiceRole: true };
        }
      }
    } catch {
      // Ignore parse failure, proceed to getUser
    }
  }

  // 3. User JWT verification
  const { data: { user }, error: authError } = await supabase.auth.getUser(rawToken);
  if (authError || !user) {
    return { authorized: false, error: "Acesso não autorizado: sessão de usuário inválida ou expirada" };
  }

  // 4. Check super_admin in user_roles
  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .maybeSingle();

  if (roleError || !roleRow) {
    return { authorized: false, error: "Acesso negado: permissão de super_admin necessária" };
  }

  return { authorized: true, user, isServiceRole: false };
}

async function verifyTenantAccessOrSuperAdmin(
  req: Request,
  supabase: any,
  tenantId: string
): Promise<{ authorized: boolean; error?: string }> {
  // 1. Admin or service_role can access any tenant wallet
  const adminCheck = await verifySuperAdminOrServiceRole(req, supabase);
  if (adminCheck.authorized) {
    return { authorized: true };
  }

  // 2. Otherwise user must own this tenant in user_roles
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const apiKeyHeader = req.headers.get("apikey");
  const rawToken = (authHeader ? authHeader.replace(/^Bearer\s+/i, "") : apiKeyHeader)?.trim();
  if (!rawToken) {
    return { authorized: false, error: "Acesso não autorizado: token ausente" };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(rawToken);
  if (authError || !user) {
    return { authorized: false, error: "Sessão inválida ou expirada" };
  }

  const { data: tenantRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!tenantRole) {
    return { authorized: false, error: "Acesso negado: você não tem permissão para esta loja/carteira" };
  }

  return { authorized: true };
}

// ─── Envia notificação rica no Discord (DM direta) para as donas/admins (@drikastore e @saradinha_) ───
async function notifyAdminsDiscordWithdrawal(opts: {
  tenantName: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  pixKey: string;
  pixKeyType: string;
  txId: string;
  isFree: boolean;
  systemUrl?: string;
}) {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!botToken) {
    console.warn("[notifyAdminsDiscordWithdrawal] DISCORD_BOT_TOKEN ausente");
    return;
  }

  // IDs dos perfis das donas/administradoras (@drikastore e @saradinha_)
  const adminDiscordIds = ["821558032554917928", "340146018689482762"];
  const formattedGross = (opts.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formattedFee = (opts.feeCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formattedNet = (opts.netCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const panelUrl = opts.systemUrl
    ? `${opts.systemUrl.replace(/\/$/, "")}/admin/carteira`
    : "https://drikahub.com/admin/carteira";

  const embed = {
    title: "💸 NOVA SOLICITAÇÃO DE SAQUE PENDENTE",
    description: `A loja **${opts.tenantName}** solicitou um saque PIX na plataforma e aguarda sua aprovação no painel.`,
    color: 0xf59e0b, // Amber Gold alert
    fields: [
      { name: "🏪 Loja / Lojista", value: opts.tenantName, inline: true },
      { name: "💰 Valor Solicitado", value: formattedGross, inline: true },
      { name: "🏷️ Taxa da Plataforma", value: opts.isFree ? "R$ 0,00 (1º Saque Grátis)" : formattedFee, inline: true },
      { name: "💵 Líquido a Transferir", value: `**${formattedNet}**`, inline: true },
      { name: "🔑 Chave PIX", value: `\`${opts.pixKey}\` (${opts.pixKeyType.toUpperCase()})`, inline: true },
      { name: "🆔 ID da Transação", value: `\`${opts.txId}\``, inline: false },
    ],
    footer: {
      text: "DRIKA HUB • Gestão Financeira & Saques",
      icon_url: "https://drikahub.com/favicon.png",
    },
    timestamp: new Date().toISOString(),
  };

  const components = [
    {
      type: 1, // ActionRow
      components: [
        {
          type: 2, // Button
          style: 5, // Link
          label: "Aprovar Saque no Painel",
          url: panelUrl,
          emoji: { name: "⚡" },
        },
      ],
    },
  ];

  for (const recipientId of adminDiscordIds) {
    try {
      // 1. Criar ou obter canal de DM com a usuária
      const dmChanRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipient_id: recipientId }),
      });

      if (!dmChanRes.ok) {
        const txt = await dmChanRes.text().catch(() => "");
        console.warn(`[notifyAdminsDiscordWithdrawal] Não foi possível abrir DM com ${recipientId}: ${dmChanRes.status} ${txt}`);
        continue;
      }

      const dmChan = await dmChanRes.json();
      if (!dmChan?.id) continue;

      // 2. Enviar mensagem na DM
      const sendRes = await fetch(`https://discord.com/api/v10/channels/${dmChan.id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          embeds: [embed],
          components,
        }),
      });

      if (!sendRes.ok) {
        const txt = await sendRes.text().catch(() => "");
        console.warn(`[notifyAdminsDiscordWithdrawal] Falha ao enviar DM para ${recipientId}: ${sendRes.status} ${txt}`);
      } else {
        console.log(`[notifyAdminsDiscordWithdrawal] Notificação de saque enviada com sucesso para ${recipientId}`);
      }
    } catch (dmErr) {
      console.error(`[notifyAdminsDiscordWithdrawal] Erro ao enviar DM para ${recipientId}:`, dmErr);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ─── CRITICAL SECURITY GATE: Lock down all admin_* actions ───
    if (typeof action === "string" && action.startsWith("admin_")) {
      const authRes = await verifySuperAdminOrServiceRole(req, supabase);
      if (!authRes.authorized) {
        return new Response(
          JSON.stringify({ error: authRes.error || "Acesso negado: permissão de super_admin necessária" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // ─── 1. Get Wallet (Client or Admin) ───
    if (action === "get_wallet") {
      const { tenant_id } = body;
      if (!tenant_id) {
        return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accessCheck = await verifyTenantAccessOrSuperAdmin(req, supabase, tenant_id);
      if (!accessCheck.authorized) {
        return new Response(JSON.stringify({ error: accessCheck.error || "Acesso negado à carteira" }), {
          status: 403,
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

      // Fetch pending orders for this tenant (awaiting payment in bot or checkout)
      const { data: pendingOrders } = await supabase
        .from("orders")
        .select("id, order_number, product_name, total_cents, status, created_at, payment_id")
        .eq("tenant_id", tenant_id)
        .eq("status", "pending_payment")
        .order("created_at", { ascending: false })
        .limit(50);

      const pendingTxs = (pendingOrders || []).map((o: any) => {
        const feeCents = Math.round((o.total_cents || 0) * 0.01);
        const netCents = (o.total_cents || 0) - feeCents;
        return {
          id: `order-pending-${o.id}`,
          tenant_id,
          type: "deposit",
          amount_cents: o.total_cents || 0,
          fee_cents: feeCents,
          net_amount_cents: netCents,
          description: `Venda Pedido #${o.order_number || String(o.id).slice(0, 8)} - ${o.product_name || "Produto"} (Aguardando Pagamento)`,
          status: "pending",
          payment_id: o.payment_id,
          pix_key: null,
          pix_key_type: null,
          rejection_reason: null,
          created_at: o.created_at,
          completed_at: null,
          is_pending_order: true,
        };
      });

      const combinedTxs = [...pendingTxs, ...(txs || [])].sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Fetch platform withdrawal rules from landing_config
      const { data: landingCfg } = await supabase
        .from("landing_config")
        .select("min_withdrawal_cents, withdrawal_fee_cents, weekly_free_withdrawals")
        .limit(1)
        .maybeSingle();

      const minWithdrawalCents = landingCfg?.min_withdrawal_cents ?? 1000;
      const withdrawalFeeCents = landingCfg?.withdrawal_fee_cents ?? 100;
      const weeklyFreeWithdrawals = landingCfg?.weekly_free_withdrawals ?? 1;

      // Start of current week (Monday 00:00:00 Brazil Time UTC-3)
      const now = new Date();
      const brTime = new Date(now.getTime() - 3 * 3600 * 1000);
      const day = brTime.getUTCDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(brTime);
      monday.setUTCDate(brTime.getUTCDate() + diffToMonday);
      monday.setUTCHours(0, 0, 0, 0);
      const startOfWeekISO = new Date(monday.getTime() + 3 * 3600 * 1000).toISOString();

      const { count: withdrawalsThisWeek } = await supabase
        .from("wallet_transactions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .eq("type", "withdrawal")
        .in("status", ["pending", "completed", "processing"])
        .gte("created_at", startOfWeekISO);

      const countWeek = withdrawalsThisWeek || 0;
      const isFreeWithdrawal = countWeek < weeklyFreeWithdrawals;

      return new Response(JSON.stringify({
        success: true,
        wallet,
        transactions: combinedTxs,
        rules: {
          min_withdrawal_cents: minWithdrawalCents,
          withdrawal_fee_cents: withdrawalFeeCents,
          weekly_free_withdrawals: weeklyFreeWithdrawals,
          withdrawals_this_week: countWeek,
          is_free_withdrawal: isFreeWithdrawal,
        },
      }), {
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

      const accessCheck = await verifyTenantAccessOrSuperAdmin(req, supabase, tenant_id);
      if (!accessCheck.authorized) {
        return new Response(JSON.stringify({ error: accessCheck.error || "Acesso negado para solicitar saque nesta loja" }), {
          status: 403,
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

      // ─── Disparar notificação Discord para os dois perfis de donas/administradoras (@drikastore e @saradinha_) ───
      try {
        const { data: tenantRow } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", tenant_id)
          .maybeSingle();

        const { data: lCfg } = await supabase
          .from("landing_config")
          .select("system_url")
          .limit(1)
          .maybeSingle();

        await notifyAdminsDiscordWithdrawal({
          tenantName: tenantRow?.name || "Loja Lojista",
          amountCents: rpcRes.amount_cents || amount_cents,
          feeCents: rpcRes.fee_cents || 0,
          netCents: rpcRes.net_amount_cents || (amount_cents - (rpcRes.fee_cents || 0)),
          pixKey: pix_key.trim(),
          pixKeyType: pix_key_type || "aleatoria",
          txId: rpcRes.tx_id || "tx-" + Date.now(),
          isFree: Boolean(rpcRes.is_free),
          systemUrl: lCfg?.system_url || "https://drikahub.com",
        });
      } catch (notifErr) {
        console.error("[manage-wallet] Erro ao enviar notificação Discord:", notifErr);
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

      // Sum collected fees from completed transactions & count completed withdrawals
      const { data: completedTxs } = await supabase
        .from("wallet_transactions")
        .select("fee_cents, type")
        .eq("status", "completed");

      let totalFeesCollectedCents = 0;
      let completedWithdrawalsCount = 0;
      for (const t of completedTxs || []) {
        totalFeesCollectedCents += t.fee_cents || 0;
        if (t.type === "withdrawal") {
          completedWithdrawalsCount += 1;
        }
      }

      // Custo operacional cobrado pela Gateway em cada saque aprovado/liquidado (R$ 0,50 por saque)
      const gatewayWithdrawalCostCents = completedWithdrawalsCount * 50;
      // Lucro Líquido Real da plataforma após deduzir os custos de gateway de cada saque aprovado
      const netProfitCents = Math.max(0, totalFeesCollectedCents - gatewayWithdrawalCostCents);

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
            completed_withdrawals_count: completedWithdrawalsCount,
            gateway_withdrawal_cost_cents: gatewayWithdrawalCostCents,
            net_profit_cents: netProfitCents,
            pending_count: (pendingTxs || []).length,
            pending_amount_cents: pendingAmountCents,
            pending_net_cents: pendingNetCents,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 4. Admin: List Withdrawals (with Tenant names & enriched Sale details) ───
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

      const withdrawals = data || [];
      const tenantIds = Array.from(new Set(withdrawals.map((w: any) => w.tenant_id).filter(Boolean)));

      const ordersMap = new Map<string, any[]>();
      const depositsMap = new Map<string, any[]>();
      const walletsMap = new Map<string, any>();

      if (tenantIds.length > 0) {
        const [ordersRes, depositsRes, walletsRes] = await Promise.all([
          supabase
            .from("orders")
            .select("id, order_number, tenant_id, discord_username, discord_user_id, product_name, total_cents, status, payment_provider, payment_id, created_at")
            .in("tenant_id", tenantIds)
            .in("status", ["paid", "delivered", "delivering"])
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("wallet_transactions")
            .select("id, tenant_id, amount_cents, net_amount_cents, fee_cents, description, payment_id, created_at")
            .in("tenant_id", tenantIds)
            .eq("type", "deposit")
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("wallets")
            .select("tenant_id, balance_cents, locked_balance_cents, total_earned_cents")
            .in("tenant_id", tenantIds),
        ]);

        (ordersRes.data || []).forEach((o: any) => {
          const list = ordersMap.get(o.tenant_id) || [];
          list.push(o);
          ordersMap.set(o.tenant_id, list);
        });

        (depositsRes.data || []).forEach((d: any) => {
          const list = depositsMap.get(d.tenant_id) || [];
          list.push(d);
          depositsMap.set(d.tenant_id, list);
        });

        (walletsRes.data || []).forEach((w: any) => {
          walletsMap.set(w.tenant_id, w);
        });
      }

      const enrichedWithdrawals = withdrawals.map((w: any) => {
        const tenantOrders = ordersMap.get(w.tenant_id) || [];
        const tenantDeposits = depositsMap.get(w.tenant_id) || [];
        const tenantWallet = walletsMap.get(w.tenant_id);

        const matchedDeposit = tenantDeposits[0] || null;
        const matchedOrder = tenantOrders.find((o: any) => o.id === matchedDeposit?.payment_id) || tenantOrders[0] || null;

        return {
          ...w,
          source_order: matchedOrder,
          source_deposit: matchedDeposit,
          recent_orders: tenantOrders.slice(0, 3),
          wallet_balance_cents: tenantWallet?.balance_cents ?? 0,
        };
      });

      return new Response(JSON.stringify({ success: true, withdrawals: enrichedWithdrawals }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 5. Admin: Approve Withdrawal ───
    if (action === "admin_approve_withdrawal") {
      const { tx_id, admin_notes, manual_approval } = body;
      if (!tx_id) {
        return new Response(JSON.stringify({ error: "tx_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Load the withdrawal transaction details
      const { data: tx, error: txErr } = await supabase
        .from("wallet_transactions")
        .select("id, tenant_id, amount_cents, net_amount_cents, pix_key, pix_key_type, status, provider, description")
        .eq("id", tx_id)
        .single();

      if (txErr || !tx) {
        return new Response(JSON.stringify({ error: "Transação não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (tx.status !== "pending") {
        return new Response(JSON.stringify({ error: `Transação já foi ${tx.status}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountToSendCents = tx.net_amount_cents && tx.net_amount_cents > 0
        ? tx.net_amount_cents
        : tx.amount_cents;

      // 2. Manual Approval Flow (PIX done manually outside or override)
      if (manual_approval) {
        const { error: approveErr } = await supabase.rpc("approve_wallet_withdrawal", {
          _tx_id: tx_id,
          _admin_notes: admin_notes
            ? `Aprovado manualmente: ${admin_notes}`.slice(0, 250)
            : (tx.description ? `${tx.description} (Manual)` : "Saque PIX aprovado manualmente"),
        });

        if (approveErr) {
          throw new Error(approveErr.message);
        }

        await supabase
          .from("wallet_transactions")
          .update({
            payment_id: "MANUAL-" + Date.now(),
          })
          .eq("id", tx_id);

        return new Response(
          JSON.stringify({
            success: true,
            tx_id,
            manual: true,
            amount_sent_cents: amountToSendCents,
            pix_key: tx.pix_key,
            status: "completed",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. Automated Gateway transfer
      if (!tx.pix_key) {
        return new Response(JSON.stringify({ error: "Chave PIX do cliente não encontrada na transação" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let providerKey = tx.provider || "misticpay";
      let pixResult: any = null;
      try {
        const withdrawRes = await fetch(`${SUPABASE_URL}/functions/v1/wallet-pix-withdraw`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({
            tenant_id: tx.tenant_id,
            amount_cents: amountToSendCents,
            pix_key: tx.pix_key,
            pix_key_type: tx.pix_key_type || "aleatoria",
            provider_key: providerKey,
            description: `Saque aprovado - ${tx.description || "Saque carteira"}`,
            existing_tx_id: tx.id,
          }),
        });

        const withdrawData = await withdrawRes.json();

        if (!withdrawRes.ok || withdrawData.error) {
          // Do NOT mark tx as rejected. Keep pending so admin can retry or approve manually!
          const errMsg = withdrawData.message || withdrawData.error || "Erro ao processar PIX no gateway";
          return new Response(
            JSON.stringify({
              error: "gateway_error",
              message: errMsg,
              can_manual_approve: true,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        pixResult = withdrawData;
      } catch (gatewayErr: any) {
        return new Response(
          JSON.stringify({
            error: "gateway_error",
            message: gatewayErr.message,
            can_manual_approve: true,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 4. Atomically release locked balance and complete transaction
      await supabase.rpc("approve_wallet_withdrawal", {
        _tx_id: tx_id,
        _admin_notes: admin_notes
          ? `Aprovado: ${admin_notes}`.slice(0, 250)
          : (tx.description || "Saque PIX aprovado"),
      });

      if (pixResult?.payment_id) {
        await supabase
          .from("wallet_transactions")
          .update({
            payment_id: pixResult.payment_id,
          })
          .eq("id", tx_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          tx_id,
          pix_payment_id: pixResult?.payment_id,
          amount_sent_cents: amountToSendCents,
          pix_key: tx.pix_key,
          status: "completed",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

      // RPC returns { success, error, refunded_cents, ... }
      if (res && !res.success) {
        return new Response(JSON.stringify({ error: res.error || "Erro ao rejeitar saque" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ...res, success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 7. Admin: List All Wallets ───
    if (action === "admin_list_wallets") {
      // 1. Fetch all tenants so every client is visible in admin
      const { data: allTenants, error: tenantsErr } = await supabase
        .from("tenants")
        .select("id, name, logo_url, plan")
        .order("created_at", { ascending: false });

      if (tenantsErr) {
        console.error("Error fetching tenants:", tenantsErr);
      }

      // 2. Fetch existing wallets
      const { data: existingWallets, error } = await supabase
        .from("wallets")
        .select("*, tenants(name, logo_url, plan)")
        .order("balance_cents", { ascending: false })
        .limit(1000);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Map existing wallets by tenant_id
      const existingMap = new Map<string, any>();
      (existingWallets || []).forEach((w: any) => {
        existingMap.set(w.tenant_id, w);
      });

      // 4. Combine: ensure every registered tenant has a wallet item
      const combinedWallets = (allTenants || []).map((t: any) => {
        const existing = existingMap.get(t.id);
        if (existing) {
          return existing;
        }
        return {
          id: `w-${t.id}`,
          tenant_id: t.id,
          balance_cents: 0,
          locked_balance_cents: 0,
          total_earned_cents: 0,
          total_withdrawn_cents: 0,
          created_at: new Date().toISOString(),
          tenants: {
            name: t.name,
            logo_url: t.logo_url,
            plan: t.plan,
          },
        };
      });

      // Sort: wallets with positive balance first, then alphabetically
      combinedWallets.sort((a: any, b: any) => {
        if (b.balance_cents !== a.balance_cents) {
          return b.balance_cents - a.balance_cents;
        }
        return (a.tenants?.name || "").localeCompare(b.tenants?.name || "");
      });

      return new Response(JSON.stringify({ success: true, wallets: combinedWallets }), {
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

    // ─── 9. Admin: Audit Sales & Inflows ───
    if (action === "admin_audit_sales") {
      const { tenant_id, search, limit = 500 } = body;

      // 1. Fetch all orders (paid, delivered, delivering AND pending — so admin sees everything in flight)
      let ordersQuery = supabase
        .from("orders")
        .select(`
          id,
          order_number,
          tenant_id,
          discord_username,
          discord_user_id,
          product_name,
          total_cents,
          status,
          payment_provider,
          payment_id,
          commission_cents,
          seller_received_cents,
          created_at,
          updated_at,
          tenants (
            id,
            name,
            logo_url,
            plan
          )
        `)
        .eq("payment_provider", "misticpay")
        .gte("created_at", "2026-11-01T00:00:00.000Z")
        .in("status", ["paid", "delivering", "delivered", "pending_payment"])
        .order("created_at", { ascending: false })
        .limit(limit);

      if (tenant_id && tenant_id !== "all") {
        ordersQuery = ordersQuery.eq("tenant_id", tenant_id);
      }

      if (search && typeof search === "string" && search.trim()) {
        const s = search.trim();
        ordersQuery = ordersQuery.or(
          `product_name.ilike.%${s}%,discord_username.ilike.%${s}%,discord_user_id.ilike.%${s}%,payment_id.ilike.%${s}%`
        );
      }

      const { data: salesOrders, error: ordersErr } = await ordersQuery;
      if (ordersErr) {
        console.error("Error fetching sales orders:", ordersErr);
      }

      // 2. Fetch wallet deposits (money credited into store balances)
      let depositsQuery = supabase
        .from("wallet_transactions")
        .select(`
          id,
          tenant_id,
          type,
          amount_cents,
          fee_cents,
          net_amount_cents,
          description,
          status,
          payment_id,
          created_at,
          completed_at,
          tenants (
            id,
            name,
            logo_url,
            plan
          )
        `)
        .eq("type", "deposit")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (tenant_id && tenant_id !== "all") {
        depositsQuery = depositsQuery.eq("tenant_id", tenant_id);
      }

      const { data: walletDeposits, error: depErr } = await depositsQuery;
      if (depErr) {
        console.error("Error fetching wallet deposits:", depErr);
      }

      // Calculate audit totals
      let totalSalesCents = 0;
      let totalSalesCount = 0;

      for (const o of salesOrders || []) {
        totalSalesCents += o.total_cents || 0;
        totalSalesCount += 1;
      }

      // If no orders yet but wallet has deposits
      if (totalSalesCents === 0 && (walletDeposits || []).length > 0) {
        for (const d of walletDeposits || []) {
          totalSalesCents += d.amount_cents || 0;
          totalSalesCount += 1;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          sales: salesOrders || [],
          deposits: walletDeposits || [],
          summary: {
            total_sales_cents: totalSalesCents,
            total_sales_count: totalSalesCount,
            total_platform_fees_cents: Math.round(totalSalesCents * 0.01),
            average_ticket_cents: totalSalesCount > 0 ? Math.round(totalSalesCents / totalSalesCount) : 0,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 8. Admin: Update Withdrawal Rules ───
    if (action === "admin_update_withdrawal_rules") {
      const { min_withdrawal_cents, withdrawal_fee_cents, weekly_free_withdrawals } = body;

      const updateData: any = {};
      if (typeof min_withdrawal_cents === "number" && min_withdrawal_cents >= 100) {
        updateData.min_withdrawal_cents = min_withdrawal_cents;
      }
      if (typeof withdrawal_fee_cents === "number" && withdrawal_fee_cents >= 0) {
        updateData.withdrawal_fee_cents = withdrawal_fee_cents;
      }
      if (typeof weekly_free_withdrawals === "number" && weekly_free_withdrawals >= 0) {
        updateData.weekly_free_withdrawals = weekly_free_withdrawals;
      }

      const { data: lcRow } = await supabase.from("landing_config").select("id").limit(1).single();
      if (!lcRow) {
        return new Response(JSON.stringify({ error: "landing_config não encontrada" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: updated, error: updateErr } = await supabase
        .from("landing_config")
        .update(updateData)
        .eq("id", lcRow.id)
        .select()
        .single();

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, updated }), {
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
