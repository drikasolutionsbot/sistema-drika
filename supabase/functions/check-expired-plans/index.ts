import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if suspend_on_expire is enabled
    const { data: config } = await supabase
      .from("landing_config")
      .select("suspend_on_expire")
      .limit(1)
      .single();

    if (config?.suspend_on_expire === false) {
      console.log("suspend_on_expire is disabled, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "suspend_on_expire disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    // Find all tenants with expired plans that are still set to pro or free
    const { data: expired, error } = await supabase
      .from("tenants")
      .select("id, name, plan, plan_expires_at")
      .not("plan_expires_at", "is", null)
      .lte("plan_expires_at", now)
      .not("plan", "eq", "expired");

    if (error) throw error;

    let suspended = 0;

    for (const tenant of expired || []) {
      await supabase
        .from("tenants")
        .update({ plan: "expired", updated_at: now })
        .eq("id", tenant.id);
      suspended++;
      console.log(`Suspended tenant ${tenant.id} (${tenant.name}) - plan was ${tenant.plan}, expired at ${tenant.plan_expires_at}`);
    }

    console.log(`check-expired-plans: suspended=${suspended} tenants`);

    return new Response(
      JSON.stringify({ success: true, suspended }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("check-expired-plans error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
