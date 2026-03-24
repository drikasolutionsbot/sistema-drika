import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Reset all tenant credits to 100
    const { data, error } = await supabase
      .from("tenant_credits")
      .update({
        credits_remaining: 100,
        last_reset_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .gte("id", "00000000-0000-0000-0000-000000000000"); // match all rows

    if (error) throw error;

    // Also insert credits for tenants that don't have a row yet
    const { data: allTenants } = await supabase
      .from("tenants")
      .select("id");

    if (allTenants && allTenants.length > 0) {
      const { data: existingCredits } = await supabase
        .from("tenant_credits")
        .select("tenant_id");

      const existingIds = new Set(
        (existingCredits || []).map((c: any) => c.tenant_id)
      );

      const missing = allTenants.filter((t: any) => !existingIds.has(t.id));

      if (missing.length > 0) {
        await supabase.from("tenant_credits").insert(
          missing.map((t: any) => ({
            tenant_id: t.id,
            credits_remaining: 100,
            daily_limit: 100,
          }))
        );
      }
    }

    console.log(`Credits reset for all tenants at ${new Date().toISOString()}`);

    return new Response(
      JSON.stringify({ success: true, message: "Credits reset to 100 for all tenants" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error resetting credits:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
