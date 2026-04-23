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

    // Find all tenants with expired plans that are still set to pro/master/free
    const { data: expired, error } = await supabase
      .from("tenants")
      .select("id, name, plan, plan_expires_at, bot_banner_url")
      .not("plan_expires_at", "is", null)
      .lte("plan_expires_at", now)
      .not("plan", "eq", "expired");

    if (error) throw error;

    let suspended = 0;
    let bannersCleared = 0;

    for (const tenant of expired || []) {
      const updates: Record<string, any> = { plan: "expired", updated_at: now };

      // Master perk: custom bot banner. When plan expires, revoke it so the
      // bot falls back to the global banner automatically (bot externo já
      // trata bot_banner_url null usando o global_bot_banner_url).
      if (tenant.plan === "master" && tenant.bot_banner_url) {
        updates.bot_banner_url = null;
        bannersCleared++;
      }

      await supabase.from("tenants").update(updates).eq("id", tenant.id);
      suspended++;
      console.log(
        `Suspended tenant ${tenant.id} (${tenant.name}) - plan was ${tenant.plan}, expired at ${tenant.plan_expires_at}` +
          (updates.bot_banner_url === null && tenant.bot_banner_url ? " [banner cleared]" : "")
      );
    }

    console.log(`check-expired-plans: suspended=${suspended} bannersCleared=${bannersCleared}`);

    return new Response(
      JSON.stringify({ success: true, suspended, bannersCleared }),
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
