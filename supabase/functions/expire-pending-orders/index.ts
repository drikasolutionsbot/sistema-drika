import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_API = "https://discord.com/api/v10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Find all pending_payment orders older than their tenant's timeout
  // Default timeout is 30 minutes
  const { data: pendingOrders, error } = await supabase
    .from("orders")
    .select("id, order_number, product_name, discord_user_id, tenant_id, total_cents, created_at")
    .eq("status", "pending_payment");

  if (error) {
    console.error("Error fetching pending orders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    return new Response(JSON.stringify({ expired: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get store configs for timeouts + logs
  const tenantIds = [...new Set(pendingOrders.map((o: any) => o.tenant_id))];
  const { data: storeConfigs } = await supabase
    .from("store_configs")
    .select("tenant_id, payment_timeout_minutes, logs_channel_id, store_title, store_logo_url, embed_color")
    .in("tenant_id", tenantIds);

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, logo_url")
    .in("id", tenantIds);

  const configMap: Record<string, any> = {};
  for (const sc of storeConfigs || []) {
    configMap[sc.tenant_id] = sc;
  }
  const tenantMap: Record<string, any> = {};
  for (const t of tenants || []) {
    tenantMap[t.id] = t;
  }

  const now = Date.now();
  let expiredCount = 0;
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;

  for (const order of pendingOrders) {
    const timeoutMinutes = configMap[order.tenant_id]?.payment_timeout_minutes || 30;
    const createdAt = new Date(order.created_at).getTime();
    const elapsed = (now - createdAt) / 1000 / 60; // minutes

    if (elapsed >= timeoutMinutes) {
      // Expire the order
      await supabase.from("orders").update({ status: "canceled" }).eq("id", order.id);
      expiredCount++;

      if (botToken) {
        // ── Send "Pagamento expirado" log to logs channel ──
        const sc = configMap[order.tenant_id];
        const tenant = tenantMap[order.tenant_id];
        if (sc?.logs_channel_id) {
          try {
            const storeName = sc.store_title || tenant?.name || "Loja";
            const storeLogo = sc.store_logo_url || tenant?.logo_url;
            const dateStr = new Date().toLocaleDateString("pt-BR");
            const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

            await fetch(`${DISCORD_API}/channels/${sc.logs_channel_id}/messages`, {
              method: "POST",
              headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                embeds: [{
                  title: "🍃 Pagamento expirado",
                  description: `Usuário <@${order.discord_user_id}> deixou o pagamento expirar.`,
                  color: 0xED4245,
                  fields: [
                    { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
                  ],
                  footer: {
                    text: `${storeName} | ${dateStr}, ${timeStr}`,
                    icon_url: storeLogo || undefined,
                  },
                }],
              }),
            });
          } catch (logErr) {
            console.error("Failed to send expired log:", logErr);
          }
        }

        // Notify buyer via DM
        try {
          const dmCh = await fetch(`${DISCORD_API}/users/@me/channels`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ recipient_id: order.discord_user_id }),
          });
          if (dmCh.ok) {
            const ch = await dmCh.json();
            await fetch(`${DISCORD_API}/channels/${ch.id}/messages`, {
              method: "POST",
              headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                embeds: [{
                  title: "⏰ Pedido Expirado",
                  description: `Seu pedido **#${order.order_number}** (${order.product_name}) expirou por falta de pagamento.\nCaso deseje, faça uma nova compra.`,
                  color: 0xED4245,
                  timestamp: new Date().toISOString(),
                }],
              }),
            });
          }
        } catch (e) {
          console.error("DM error for expired order:", e);
        }
      }
    }
  }

  console.log(`Expired ${expiredCount} orders`);
  return new Response(JSON.stringify({ expired: expiredCount }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
