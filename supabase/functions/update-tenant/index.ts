import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function updateDiscordBotProfile(botToken: string, updates: Record<string, any>, logoUrl?: string) {
  if (!botToken) return;

  const discordPayload: Record<string, any> = {};

  if (updates.name) {
    discordPayload.username = updates.name;
  }

  if (updates.logo_url || logoUrl) {
    const avatarUrl = updates.logo_url || logoUrl;
    try {
      const res = await fetch(avatarUrl);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const contentType = res.headers.get("content-type") || "image/png";
        discordPayload.avatar = `data:${contentType};base64,${base64}`;
      }
    } catch (e) {
      console.error("Failed to fetch avatar for Discord:", e);
    }
  }

  if (Object.keys(discordPayload).length === 0) return;

  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      method: "PATCH",
      headers: {
        "Authorization": `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(discordPayload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Discord API error:", res.status, err);
    } else {
      console.log("Discord bot profile updated successfully");
    }
  } catch (e) {
    console.error("Failed to update Discord bot profile:", e);
  }
}

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

    const allowedFields = ["name", "logo_url", "banner_url", "primary_color", "secondary_color", "bot_status", "bot_status_interval", "bot_prefix", "discord_guild_id", "bot_token_encrypted", "bot_client_id"];
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

    // Use tenant's own bot token for Discord sync
    const botToken = data.bot_token_encrypted;
    if (botToken && (safeUpdates.name || safeUpdates.logo_url)) {
      updateDiscordBotProfile(botToken, safeUpdates, data.logo_url).catch(console.error);
    }

    // Remove sensitive token from response
    const { bot_token_encrypted, ...safeData } = data;
    return new Response(JSON.stringify({ ...safeData, has_bot_token: !!bot_token_encrypted }), {
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
