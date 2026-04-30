// Stripe Checkout: cria uma sessão de checkout para um order existente.
// Chamado pelo bot externo quando o produto está configurado para Stripe.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPPORTED_CURRENCIES = ["BRL", "USD", "EUR"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, order_id, success_url, cancel_url } = await req.json();
    if (!tenant_id || !order_id) throw new Error("Missing tenant_id or order_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Carrega order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .eq("tenant_id", tenant_id)
      .single();
    if (orderErr || !order) throw new Error("Order not found");

    // Carrega produto p/ pegar moeda
    let currency = "BRL";
    if (order.product_id) {
      const { data: prod } = await supabase
        .from("products")
        .select("currency")
        .eq("id", order.product_id)
        .single();
      if (prod?.currency && SUPPORTED_CURRENCIES.includes(prod.currency)) {
        currency = prod.currency;
      }
    }

    // Carrega provedor Stripe ativo do tenant
    const { data: provider, error: provErr } = await supabase
      .from("payment_providers")
      .select("api_key_encrypted, secret_key_encrypted, active")
      .eq("tenant_id", tenant_id)
      .eq("provider_key", "stripe")
      .maybeSingle();
    if (provErr) throw provErr;
    if (!provider || !provider.active) throw new Error("Stripe não configurado/ativo para este tenant");

    const stripeSecretKey = provider.api_key_encrypted;
    if (!stripeSecretKey) throw new Error("Stripe Secret Key ausente");

    // Cria Checkout Session via REST API da Stripe (form-encoded)
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("payment_method_types[]", "card");
    params.append("line_items[0][price_data][currency]", currency.toLowerCase());
    params.append("line_items[0][price_data][product_data][name]", order.product_name || "Pedido");
    params.append("line_items[0][price_data][unit_amount]", String(order.total_cents));
    params.append("line_items[0][quantity]", "1");
    params.append("client_reference_id", order.id);
    params.append("metadata[order_id]", order.id);
    params.append("metadata[tenant_id]", tenant_id);
    params.append("success_url", success_url || "https://discord.com/channels/@me");
    params.append("cancel_url", cancel_url || "https://discord.com/channels/@me");

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const stripeData = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error("Stripe error:", stripeData);
      throw new Error(stripeData?.error?.message || "Stripe API error");
    }

    // Atualiza order com payment_id e provider
    await supabase
      .from("orders")
      .update({
        payment_id: stripeData.id,
        payment_provider: "stripe",
      })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: stripeData.url,
        session_id: stripeData.id,
        currency,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("stripe-create-checkout error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
