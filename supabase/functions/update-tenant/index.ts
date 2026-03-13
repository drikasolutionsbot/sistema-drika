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
    const { tenant_id, updates } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");
    if (!updates || Object.keys(updates).length === 0) {
      throw new Error("No updates provided");
    }

    const allowedFields = ["name", "logo_url", "banner_url", "primary_color", "secondary_color", "bot_status", "bot_status_interval", "bot_prefix", "discord_guild_id", "ecloud_custom_url", "verify_enabled", "verify_redirect_url", "verify_role_id", "verify_channel_id", "verify_logs_channel_id", "verify_title", "verify_description", "verify_button_label", "verify_embed_color", "verify_image_url", "verify_button_style", "pix_key", "pix_key_type"];
    const safeUpdates: Record<string, string> = {};
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      throw new Error("No valid fields to update");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("tenants")
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq("id", tenant_id)
      .select()
      .single();

    if (error) throw error;

    // If name was updated, also rename the Discord guild
    if (safeUpdates.name && data.discord_guild_id) {
      try {
        const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
        if (botToken) {
          const renameRes = await fetch(
            `https://discord.com/api/v10/guilds/${data.discord_guild_id}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ name: safeUpdates.name }),
            }
          );
          if (!renameRes.ok) {
            const errBody = await renameRes.text();
            console.error("Discord guild rename failed:", renameRes.status, errBody);
          }
        }
      } catch (discordErr) {
        console.error("Discord guild rename error:", discordErr);
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
