import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Provider-specific webhook handlers ────────────────────────────
async function handleMercadoPago(body: any, tenantId: string, supabase: any) {
  const action = body?.action;
  if (!action?.startsWith("payment.")) return { handled: false, reason: "Not a payment event" };

  const paymentId = body?.data?.id;
  if (!paymentId) return { handled: false, reason: "No payment ID" };

  const { data: provider } = await supabase
    .from("payment_providers")
    .select("api_key_encrypted")
    .eq("tenant_id", tenantId)
    .eq("provider_key", "mercadopago")
    .single();

  if (!provider?.api_key_encrypted) return { handled: false, reason: "No API key" };

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${provider.api_key_encrypted}` },
  });

  if (!res.ok) return { handled: false, reason: `MP API error: ${res.status}` };

  const payment = await res.json();

  let orderStatus: string;
  switch (payment.status) {
    case "approved": orderStatus = "paid"; break;
    case "pending": case "in_process": case "authorized": orderStatus = "pending_payment"; break;
    case "cancelled": case "refunded": case "charged_back": orderStatus = "canceled"; break;
    default: orderStatus = "pending_payment";
  }

  if (payment.external_reference) {
    const orderId = payment.external_reference.replace(/^order_/, "");
    await supabase
      .from("orders")
      .update({ status: orderStatus, payment_id: String(paymentId), payment_provider: "mercadopago" })
      .eq("id", orderId)
      .eq("tenant_id", tenantId);

    return { handled: true, order_status: orderStatus, payment_id: paymentId, order_id: orderId };
  }

  return { handled: false, reason: "No external_reference" };
}

async function handlePushinPay(body: any, tenantId: string, supabase: any) {
  // PushinPay webhook payload may vary - extract payment ID
  const paymentId = body?.id || body?.payment_id || body?.transaction_id;
  const status = body?.status;

  console.log(`PushinPay webhook: paymentId=${paymentId}, status=${status}, body=${JSON.stringify(body)}`);

  if (!paymentId) return { handled: false, reason: "No payment ID in webhook" };

  // Accept various "paid" statuses from PushinPay
  const isPaid = status === "paid" || status === "completed" || status === "approved";
  if (!isPaid) return { handled: false, reason: `Status not paid: ${status}` };

  // Look up order by payment_id (stored when PIX was generated)
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, status")
    .eq("payment_id", String(paymentId))
    .eq("tenant_id", tenantId)
    .single();

  if (orderErr || !order) {
    // Fallback: try external_reference or metadata
    const extRef = body?.external_reference || body?.metadata?.order_id;
    if (extRef) {
      const orderId = extRef.replace(/^order_/, "");
      await supabase
        .from("orders")
        .update({ status: "paid", payment_id: String(paymentId), payment_provider: "pushinpay" })
        .eq("id", orderId)
        .eq("tenant_id", tenantId);
      return { handled: true, order_status: "paid", payment_id: paymentId, order_id: orderId };
    }
    console.error(`PushinPay: No order found for payment_id=${paymentId} in tenant=${tenantId}`);
    return { handled: false, reason: "Order not found by payment_id" };
  }

  if (order.status === "paid" || order.status === "delivered") {
    return { handled: false, reason: "Order already processed" };
  }

  await supabase
    .from("orders")
    .update({ status: "paid", payment_provider: "pushinpay" })
    .eq("id", order.id)
    .eq("tenant_id", tenantId);

  return { handled: true, order_status: "paid", payment_id: paymentId, order_id: order.id };
}

async function handleEfi(body: any, tenantId: string, supabase: any) {
  const pix = body?.pix?.[0];
  if (!pix) return { handled: false, reason: "No PIX data" };

  const txid = pix.txid;
  const endToEndId = pix.endToEndId;

  console.log(`Efí webhook: txid=${txid}, endToEndId=${endToEndId}, body=${JSON.stringify(body)}`);

  if (!txid && !endToEndId) return { handled: false, reason: "No txid or endToEndId" };

  // Look up order by payment_id (txid or endToEndId stored during PIX generation)
  let order = null;

  if (txid) {
    const { data } = await supabase
      .from("orders")
      .select("id, status")
      .eq("payment_id", txid)
      .eq("tenant_id", tenantId)
      .single();
    order = data;
  }

  if (!order && endToEndId) {
    const { data } = await supabase
      .from("orders")
      .select("id, status")
      .eq("payment_id", endToEndId)
      .eq("tenant_id", tenantId)
      .single();
    order = data;
  }

  // Fallback: try txid as order ID directly (legacy)
  if (!order && txid) {
    const { data } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", txid)
      .eq("tenant_id", tenantId)
      .single();
    order = data;
  }

  if (!order) {
    console.error(`Efí: No order found for txid=${txid} endToEndId=${endToEndId} in tenant=${tenantId}`);
    return { handled: false, reason: "Order not found" };
  }

  if (order.status === "paid" || order.status === "delivered") {
    return { handled: false, reason: "Order already processed" };
  }

  await supabase
    .from("orders")
    .update({ status: "paid", payment_id: endToEndId || txid, payment_provider: "efi" })
    .eq("id", order.id)
    .eq("tenant_id", tenantId);

  return { handled: true, order_status: "paid", payment_id: endToEndId || txid, order_id: order.id };
}

async function handleMisticPay(body: any, tenantId: string, supabase: any) {
  // MisticPay webhook: { transactionId, status, value, transactionType, ... }
  const transactionId = body?.transactionId;
  const status = body?.status;
  const transactionType = body?.transactionType;

  console.log(`MisticPay webhook: txId=${transactionId}, status=${status}, type=${transactionType}, body=${JSON.stringify(body)}`);

  if (!transactionId) return { handled: false, reason: "No transactionId in webhook" };
  
  // Only process deposit (cashin) webhooks
  if (transactionType && transactionType !== "DEPOSITO") {
    return { handled: false, reason: `Not a deposit: ${transactionType}` };
  }

  // Only process completed payments
  if (status !== "COMPLETO") return { handled: false, reason: `Status not COMPLETO: ${status}` };

  // Look up order by payment_id (transactionId stored during PIX generation)
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, status")
    .eq("payment_id", String(transactionId))
    .eq("tenant_id", tenantId)
    .single();

  if (orderErr || !order) {
    console.error(`MisticPay: No order found for transactionId=${transactionId} in tenant=${tenantId}`);
    return { handled: false, reason: "Order not found by payment_id" };
  }

  if (order.status === "paid" || order.status === "delivered") {
    return { handled: false, reason: "Order already processed" };
  }

  await supabase
    .from("orders")
    .update({ status: "paid", payment_provider: "misticpay" })
    .eq("id", order.id)
    .eq("tenant_id", tenantId);

  return { handled: true, order_status: "paid", payment_id: transactionId, order_id: order.id };
}

// ─── Main handler ──────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    
    // Expected path: /payment-webhook/{provider_key}/{tenant_id}
    const provider = pathParts[pathParts.length - 2];
    const tenantId = pathParts[pathParts.length - 1];

    if (!provider || !tenantId) {
      throw new Error("Missing provider or tenant_id in URL path.");
    }

    const body = await req.json();
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify tenant exists
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .single();

    if (tenantErr || !tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;
    const eventType = body?.action || body?.event || body?.type || "unknown";

    switch (provider) {
      case "mercadopago":
        result = await handleMercadoPago(body, tenantId, supabase);
        break;
      case "pushinpay":
        result = await handlePushinPay(body, tenantId, supabase);
        break;
      case "efi":
        result = await handleEfi(body, tenantId, supabase);
        break;
      case "misticpay":
        result = await handleMisticPay(body, tenantId, supabase);
        break;
      default:
        result = { handled: false, reason: `Unknown provider: ${provider}` };
    }

    // Log webhook
    try {
      await supabase.from("webhook_logs").insert({
        tenant_id: tenantId,
        provider_key: provider,
        event_type: eventType,
        payload: body,
        result,
        status: result?.handled ? "processed" : "ignored",
      });
    } catch (logErr) {
      console.error("Failed to log webhook:", logErr);
    }

    console.log(`Webhook ${provider}/${tenantId}:`, JSON.stringify(result));

    // If payment was confirmed, trigger auto-delivery
    if (result?.handled && result?.order_status === "paid") {
      const orderId = result.order_id;

      if (orderId) {
        try {
          // Call deliver-order function
          const deliverRes = await fetch(
            `${supabaseUrl}/functions/v1/deliver-order`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                order_id: orderId,
                tenant_id: tenantId,
              }),
            }
          );
          const deliverResult = await deliverRes.json();
          console.log("Auto-delivery result:", JSON.stringify(deliverResult));

          // Trigger order_paid automations
          try {
            const { data: paidOrder } = await supabase
              .from("orders")
              .select("order_number, product_name, discord_user_id, discord_username, total_cents")
              .eq("id", orderId)
              .single();

            if (paidOrder) {
              await fetch(`${supabaseUrl}/functions/v1/execute-automation`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
                body: JSON.stringify({
                  tenant_id: tenantId,
                  trigger_type: "order_paid",
                  trigger_data: {
                    discord_user_id: paidOrder.discord_user_id,
                    discord_username: paidOrder.discord_username,
                    order_id: orderId,
                    order_number: paidOrder.order_number,
                    product_name: paidOrder.product_name,
                    total_cents: paidOrder.total_cents,
                  },
                }),
              });
              console.log("Automation order_paid triggered");
            }
          } catch (autoErr) {
            console.error("Automation trigger failed:", autoErr);
          }
        } catch (deliverErr) {
          console.error("Auto-delivery failed:", deliverErr);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("payment-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
