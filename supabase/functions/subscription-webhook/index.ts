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
    const body = await req.json();
    console.log("Subscription webhook received:", JSON.stringify(body));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Efí sends: { pix: [{ txid, valor, horario, endToEndId, ... }] }
    const pixArray = body?.pix;
    if (!pixArray || !Array.isArray(pixArray) || pixArray.length === 0) {
      // Fallback: try legacy PushinPay format
      const paymentId = body?.id || body?.payment_id;
      if (!paymentId) {
        return new Response(JSON.stringify({ success: true, ignored: true, reason: "No PIX data" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Legacy lookup by payment_id
      return await processByPaymentId(supabase, String(paymentId));
    }

    // Process Efí PIX notifications
    for (const pix of pixArray) {
      const txid = pix.txid;
      if (!txid) continue;

      // Find subscription by payment_id (txid)
      const { data: subPayment, error: subErr } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("payment_id", txid)
        .single();

      if (subErr || !subPayment) {
        console.log("No matching subscription for txid:", txid);
        continue;
      }

      if (subPayment.status === "paid") {
        console.log("Already processed:", txid);
        continue;
      }

      await activateSubscription(supabase, subPayment);
      console.log(`Efí PIX confirmed for tenant ${subPayment.tenant_id}, txid ${txid}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("subscription-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processByPaymentId(supabase: any, paymentId: string) {
  const { data: subPayment, error: subErr } = await supabase
    .from("subscription_payments")
    .select("*")
    .eq("payment_id", paymentId)
    .single();

  if (subErr || !subPayment) {
    return new Response(JSON.stringify({ success: true, ignored: true, reason: "No matching subscription" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (subPayment.status === "paid") {
    return new Response(JSON.stringify({ success: true, already_processed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await activateSubscription(supabase, subPayment);

  return new Response(
    JSON.stringify({ success: true, tenant_id: subPayment.tenant_id, plan: "pro" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function activateSubscription(supabase: any, subPayment: any) {
  const { data: config } = await supabase
    .from("landing_config")
    .select("auto_activate_plan")
    .limit(1)
    .single();

  const autoActivate = config?.auto_activate_plan !== false;

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  await supabase
    .from("subscription_payments")
    .update({
      status: "paid",
      paid_at: now.toISOString(),
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", subPayment.id);

  if (autoActivate) {
    await supabase
      .from("tenants")
      .update({
        plan: "pro",
        plan_started_at: now.toISOString(),
        plan_expires_at: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", subPayment.tenant_id);

    console.log(`Subscription activated for tenant ${subPayment.tenant_id} until ${periodEnd.toISOString()}`);
  }
}
