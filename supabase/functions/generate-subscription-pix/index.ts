import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, email } = await req.json();

    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get admin PushinPay config from landing_config
    const { data: config, error: configErr } = await supabase
      .from("landing_config")
      .select("pushinpay_api_key, pushinpay_active, pro_price_cents")
      .limit(1)
      .single();

    if (configErr || !config) {
      throw new Error("Configuração de pagamento não encontrada");
    }

    if (!config.pushinpay_api_key || !config.pushinpay_active) {
      throw new Error("PushinPay não configurado. A dona precisa configurar no painel admin.");
    }

    const amountCents = config.pro_price_cents || 2690;
    const webhookUrl = `${supabaseUrl}/functions/v1/subscription-webhook`;

    // Generate PIX via PushinPay
    const res = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${config.pushinpay_api_key}`,
      },
      body: JSON.stringify({
        value: amountCents,
        webhook_url: webhookUrl,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("PushinPay error:", JSON.stringify(err));
      throw new Error(err.message || `PushinPay error: ${res.status}`);
    }

    const data = await res.json();
    const paymentId = data.id;
    const brcode = data.qr_code || "";

    // Create a subscription_payment record
    await supabase.from("subscription_payments").insert({
      tenant_id,
      plan: "pro",
      amount_cents: amountCents,
      payment_provider: "pushinpay",
      payment_id: paymentId,
      payer_email: email || null,
      status: "pending",
    });

    console.log(`Subscription PIX generated for tenant ${tenant_id}, payment ${paymentId}`);

    return new Response(
      JSON.stringify({
        success: true,
        brcode,
        qr_code_base64: data.qr_code_base64 || null,
        payment_id: paymentId,
        amount_cents: amountCents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("generate-subscription-pix error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
