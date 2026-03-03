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

    const body = await req.json();
    const { action, tenant_id } = body;
    if (!tenant_id) throw new Error("tenant_id required");

    const json = (data: any) => new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ---- SETTINGS ----
    if (action === "list_settings") {
      const { data, error } = await supabase
        .from("protection_settings")
        .select("*")
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return json(data);
    }

    if (action === "upsert_setting") {
      const { module_key, enabled, config } = body;
      const { data, error } = await supabase
        .from("protection_settings")
        .upsert(
          { tenant_id, module_key, enabled, config, updated_at: new Date().toISOString() },
          { onConflict: "tenant_id,module_key" }
        )
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    // ---- WHITELIST ----
    if (action === "list_whitelist") {
      const { data, error } = await supabase
        .from("protection_whitelist")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(data);
    }

    if (action === "add_whitelist") {
      const { type, discord_id, label } = body;
      const { data, error } = await supabase
        .from("protection_whitelist")
        .insert({ tenant_id, type, discord_id, label })
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    if (action === "remove_whitelist") {
      const { whitelist_id } = body;
      const { error } = await supabase
        .from("protection_whitelist")
        .delete()
        .eq("id", whitelist_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return json({ success: true });
    }

    // ---- LOGS ----
    if (action === "list_logs") {
      const limit = body.limit || 50;
      const { data, error } = await supabase
        .from("protection_logs")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json(data);
    }

    if (action === "clear_logs") {
      const { error } = await supabase
        .from("protection_logs")
        .delete()
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return json({ success: true });
    }

    // ---- DISCORD SYNC ----
    if (action === "sync_to_discord") {
      // Fetch all enabled settings for the tenant
      const { data: settings } = await supabase
        .from("protection_settings")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("enabled", true);

      const { data: whitelist } = await supabase
        .from("protection_whitelist")
        .select("*")
        .eq("tenant_id", tenant_id);

      // Return the full protection config for the bot to consume
      return json({
        success: true,
        protection_config: {
          settings: settings || [],
          whitelist: whitelist || [],
          synced_at: new Date().toISOString(),
        },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
