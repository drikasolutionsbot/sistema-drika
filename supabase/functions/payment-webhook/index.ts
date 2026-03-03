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
  // MP sends: { action: "payment.created", data: { id: "123" } }
  if (body?.action === "payment.created" || body?.action === "payment.updated") {
    const paymentId = body?.data?.id;
    if (!paymentId) return { handled: false, reason: "No payment ID" };

    // Get provider credentials
    const { data: provider } = await supabase
      .from("payment_providers")
      .select("api_key_encrypted")
      .eq("tenant_id", tenantId)
      .eq("provider_key", "mercadopago")
      .single();

    if (!provider?.api_key_encrypted) return { handled: false, reason: "No API key" };

    // Fetch payment details from MP API
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${provider.api_key_encrypted}` },
    });

    if (!res.ok) return { handled: false, reason: `MP API error: ${res.status}` };

    const payment = await res.json();
    const status = payment.status === "approved" ? "paid" : "pending_payment";

    // Update order if exists
    if (payment.external_reference) {
      await supabase
        .from("orders")
        .update({ status, payment_id: String(paymentId), payment_provider: "mercadopago" })
        .eq("id", payment.external_reference)
        .eq("tenant_id", tenantId);
    }

    return { handled: true, status: payment.status, payment_id: paymentId };
  }
  return { handled: false, reason: "Unknown action" };
}

async function handlePushinPay(body: any, tenantId: string, supabase: any) {
  // PushinPay sends payment confirmation
  const paymentId = body?.id || body?.payment_id;
  const status = body?.status;
  const orderId = body?.external_reference || body?.metadata?.order_id;

  if (paymentId && orderId && status === "paid") {
    await supabase
      .from("orders")
      .update({ status: "paid", payment_id: String(paymentId), payment_provider: "pushinpay" })
      .eq("id", orderId)
      .eq("tenant_id", tenantId);
    return { handled: true, status, payment_id: paymentId };
  }
  return { handled: false, reason: "Missing data or not paid" };
}

async function handleEfi(body: any, tenantId: string, supabase: any) {
  // Efí (Gerencianet) webhook
  const pix = body?.pix?.[0];
  if (pix) {
    const txid = pix.txid;
    const valor = pix.valor;
    if (txid) {
      await supabase
        .from("orders")
        .update({ status: "paid", payment_id: pix.endToEndId || txid, payment_provider: "efi" })
        .eq("id", txid)
        .eq("tenant_id", tenantId);
      return { handled: true, txid, valor };
    }
  }
  return { handled: false, reason: "No PIX data" };
}

async function handleMisticPay(body: any, tenantId: string, supabase: any) {
  const paymentId = body?.id || body?.payment_id;
  const status = body?.status;
  const orderId = body?.reference || body?.external_reference;

  if (paymentId && orderId && (status === "paid" || status === "approved")) {
    await supabase
      .from("orders")
      .update({ status: "paid", payment_id: String(paymentId), payment_provider: "misticpay" })
      .eq("id", orderId)
      .eq("tenant_id", tenantId);
    return { handled: true, status, payment_id: paymentId };
  }
  return { handled: false, reason: "Missing data or not paid" };
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
    // The edge function name is the first part, so we look for provider and tenant after
    const provider = pathParts[pathParts.length - 2];
    const tenantId = pathParts[pathParts.length - 1];

    if (!provider || !tenantId) {
      // Try from query params as fallback
      const body = await req.json();
      throw new Error("Missing provider or tenant_id in URL path. Use ?provider=xxx&tenant_id=xxx or path format.");
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

    console.log(`Webhook ${provider}/${tenantId}:`, JSON.stringify(result));

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
