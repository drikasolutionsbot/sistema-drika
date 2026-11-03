import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id Ã© obrigatÃ³rio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Delete all related data in order (child tables first)
    const tables = [
      "automation_logs",
      "automations",
      "product_stock_items",
      "product_hooks",
      "product_fields",
      "orders",
      "coupons",
      "products",
      "categories",
      "channel_configs",
      "giveaway_entries",
      "giveaways",
      "protection_logs",
      "protection_settings",
      "protection_whitelist",
      "saved_embeds",
      "store_configs",
      "subscription_payments",
      "tenant_permissions",
      "tenant_roles",
      "tickets",
      "verified_members",
      "vip_members",
      "vip_plans",
      "wallet_transactions",
      "wallets",
      "webhook_logs",
      "welcome_configs",
      "affiliates",
      "payment_providers",
      "access_tokens",
      "user_roles",
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq("tenant_id", tenant_id);
      if (error) {
        // console.log(`Warning deleting from ${table}:`, error.message);
      }
    }

    // Delete the auth users associated with this tenant
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("tenant_id", tenant_id);

    if (userRoles) {
      for (const role of userRoles) {
        // Only delete if user has no other tenants
        const { data: otherRoles } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", role.user_id)
          .neq("tenant_id", tenant_id);

        if (!otherRoles || otherRoles.length === 0) {
          await supabase.auth.admin.deleteUser(role.user_id);
        }
      }
    }

    // Finally delete the tenant
    const { error: tenantError } = await supabase
      .from("tenants")
      .delete()
      .eq("id", tenant_id);

    if (tenantError) {
      console.error("Error deleting tenant:", tenantError.message);
      return new Response(JSON.stringify({ error: tenantError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("delete-tenant error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
