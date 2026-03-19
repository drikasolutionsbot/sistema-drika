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
    const { tenant_id, updates, guild_icon_base64 } = body;
    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resolve tenant guild and use external bot token único
    const { data: tenantInfo } = await supabase
      .from("tenants")
      .select("discord_guild_id")
      .eq("id", tenant_id)
      .single();

    const tenantBotToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;

    // Handle guild icon update (separate flow)
    if (guild_icon_base64) {
      if (!tenantInfo?.discord_guild_id) throw new Error("No Discord guild linked");
      if (!tenantBotToken) throw new Error("Bot externo não configurado (DISCORD_BOT_TOKEN)");

      const iconRes = await fetch(
        `https://discord.com/api/v10/guilds/${tenantInfo.discord_guild_id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bot ${tenantBotToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ icon: guild_icon_base64 }),
        }
      );
      if (!iconRes.ok) {
        const errBody = await iconRes.text();
        console.error("Discord guild icon update failed:", iconRes.status, errBody);
        throw new Error("Falha ao atualizar ícone no Discord");
      }
      console.log("Discord guild icon updated successfully");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      throw new Error("No updates provided");
    }

    const allowedFields = ["name", "logo_url", "banner_url", "primary_color", "secondary_color", "bot_status", "bot_status_interval", "bot_prefix", "bot_name", "bot_avatar_url", "discord_guild_id", "ecloud_custom_url", "verify_enabled", "verify_redirect_url", "verify_role_id", "verify_channel_id", "verify_logs_channel_id", "verify_title", "verify_description", "verify_button_label", "verify_embed_color", "verify_image_url", "verify_button_style", "pix_key", "pix_key_type"];
    const safeUpdates: Record<string, string> = {};
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      throw new Error("No valid fields to update");
    }

    // Validate discord_guild_id when connecting a new server
    if (safeUpdates.discord_guild_id && safeUpdates.discord_guild_id !== "null") {
      const guildId = safeUpdates.discord_guild_id;

      // Check format
      if (!/^\d{17,20}$/.test(guildId)) {
        throw new Error("ID do servidor inválido. Deve conter 17-20 dígitos.");
      }

      // Check if already claimed by another tenant
      const { data: existingTenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("discord_guild_id", guildId)
        .neq("id", tenant_id)
        .maybeSingle();

      if (existingTenant) {
        throw new Error("Este servidor já está vinculado a outra loja.");
      }

      // Verify bot is in the server using tenant's bot token
      if (tenantBotToken) {
        const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
          headers: { Authorization: `Bot ${tenantBotToken}` },
        });
        if (!guildRes.ok) {
          if (guildRes.status === 404 || guildRes.status === 403) {
            throw new Error("O bot não está neste servidor. Adicione o bot primeiro.");
          }
        }
      }
    }

    const { data, error } = await supabase
      .from("tenants")
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq("id", tenant_id)
      .select()
      .single();

    if (error) throw error;

    // If name was updated, also rename the Discord guild
    if (safeUpdates.name && data.discord_guild_id) {
      // Re-read bot token in case it was just updated
      const effectiveBotToken = safeUpdates.bot_token_encrypted || data.bot_token_encrypted || tenantBotToken;
      console.log("Attempting Discord guild rename to:", safeUpdates.name, "for guild:", data.discord_guild_id);
      try {
        if (effectiveBotToken) {
          const renameRes = await fetch(
            `https://discord.com/api/v10/guilds/${data.discord_guild_id}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bot ${effectiveBotToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ name: safeUpdates.name }),
            }
          );
          const resBody = await renameRes.text();
          console.log("Discord guild rename response:", renameRes.status, resBody);
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
