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
    let guild_id = body.guild_id;

    if (!guild_id && body.tenant_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: tenant, error } = await supabase
        .from("tenants")
        .select("discord_guild_id, bot_token_encrypted")
        .eq("id", body.tenant_id)
        .single();

      if (error || !tenant?.discord_guild_id) {
        throw new Error("Could not resolve guild_id from tenant");
      }
      guild_id = tenant.discord_guild_id;
      if (tenant.bot_token_encrypted) tenantBotToken = tenant.bot_token_encrypted;
    }

    if (!guild_id) throw new Error("Missing guild_id");

    const botToken = tenantBotToken || Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) throw new Error("Bot token not configured");

    const res = await fetch(`https://discord.com/api/v10/guilds/${guild_id}/emojis`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discord API error [${res.status}]: ${text}`);
    }

    const emojis = await res.json();

    const formatted = emojis.map((e: any) => {
      const isAnimated = e.animated ?? false;
      const roleIds = Array.isArray(e.roles) ? e.roles : [];
      const available = e.available ?? true;
      const blocked = !available || roleIds.length > 0;

      return {
        id: e.id,
        name: e.name,
        animated: isAnimated,
        available,
        role_ids: roleIds,
        blocked,
        url: `https://cdn.discordapp.com/emojis/${e.id}.${isAnimated ? "gif" : "png"}`,
        formatted: isAnimated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`,
      };
    });

    return new Response(JSON.stringify(formatted), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
