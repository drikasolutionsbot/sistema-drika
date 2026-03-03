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
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
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

  // Get store configs for timeouts
  const tenantIds = [...new Set(pendingOrders.map((o: any) => o.tenant_id))];
  const { data: storeConfigs } = await supabase
    .from("store_configs")
    .select("tenant_id, payment_timeout_minutes")
    .in("tenant_id", tenantIds);

  const timeoutMap: Record<string, number> = {};
  for (const sc of storeConfigs || []) {
    timeoutMap[sc.tenant_id] = sc.payment_timeout_minutes || 30;
  }

  const now = Date.now();
  let expiredCount = 0;

  for (const order of pendingOrders) {
    const timeoutMinutes = timeoutMap[order.tenant_id] || 30;
    const createdAt = new Date(order.created_at).getTime();
    const elapsed = (now - createdAt) / 1000 / 60; // minutes

    if (elapsed >= timeoutMinutes) {
      // Expire the order
      await supabase.from("orders").update({ status: "canceled" }).eq("id", order.id);
      expiredCount++;

      // Notify buyer via DM
      if (botToken) {
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
