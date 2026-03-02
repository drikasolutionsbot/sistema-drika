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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, tenant_id, ...params } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    switch (action) {
      case "list": {
        const { data, error } = await supabase
          .from("tenant_permissions")
          .select("*")
          .eq("tenant_id", tenant_id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "upsert": {
        const { discord_user_id, discord_username, discord_display_name, discord_avatar_url } = params;
        if (!discord_user_id) throw new Error("Missing discord_user_id");

        const { data, error } = await supabase
          .from("tenant_permissions")
          .upsert(
            {
              tenant_id,
              discord_user_id,
              discord_username,
              discord_display_name,
              discord_avatar_url,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,discord_user_id" }
          )
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        const { id, ...permUpdates } = params;
        if (!id) throw new Error("Missing id");

        const allowedKeys = [
          "can_view", "can_manage_app", "can_manage_resources",
          "can_change_server", "can_manage_permissions", "can_manage_bot_appearance",
          "can_manage_products", "can_manage_store", "can_manage_stock",
          "can_manage_protection", "can_manage_ecloud"
        ];
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const key of allowedKeys) {
          if (permUpdates[key] !== undefined) updateData[key] = permUpdates[key];
        }

        const { data, error } = await supabase
          .from("tenant_permissions")
          .update(updateData)
          .eq("id", id)
          .eq("tenant_id", tenant_id)
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { id } = params;
        if (!id) throw new Error("Missing id");

        const { error } = await supabase
          .from("tenant_permissions")
          .delete()
          .eq("id", id)
          .eq("tenant_id", tenant_id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
