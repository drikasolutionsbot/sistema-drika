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
    const paymentId = body?.id || body?.payment_id;
    const status = body?.status;

    console.log("Subscription webhook received:", JSON.stringify(body));

    if (!paymentId) {
      return new Response(JSON.stringify({ success: true, ignored: true, reason: "No payment ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find the subscription payment by payment_id
    const { data: subPayment, error: subErr } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("payment_id", String(paymentId))
      .single();

    if (subErr || !subPayment) {
      console.log("No matching subscription_payment for payment_id:", paymentId);
      return new Response(JSON.stringify({ success: true, ignored: true, reason: "No matching subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already processed
    if (subPayment.status === "paid") {
      console.log("Already processed:", paymentId);
      return new Response(JSON.stringify({ success: true, already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as paid
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30); // 30 days

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

    // Activate the tenant's plan
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

    return new Response(
      JSON.stringify({ success: true, tenant_id: subPayment.tenant_id, plan: "pro", expires_at: periodEnd.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("subscription-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
