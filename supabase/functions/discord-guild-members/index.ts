import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { guild_id, query, limit = 20 } = await req.json();
    if (!guild_id) throw new Error("Missing guild_id");

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) throw new Error("Bot token not configured");

    // Discord Search Members endpoint (requires query param, min 1 char)
    const searchQuery = query?.trim() || "";
    
    let url: string;
    if (searchQuery.length > 0) {
      // Use search endpoint for filtering
      url = `https://discord.com/api/v10/guilds/${guild_id}/members/search?query=${encodeURIComponent(searchQuery)}&limit=${limit}`;
    } else {
      // List members (no filter)
      url = `https://discord.com/api/v10/guilds/${guild_id}/members?limit=${limit}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discord API error [${res.status}]: ${text}`);
    }

    const members = await res.json();

    const mapped = members.map((m: any) => ({
      id: m.user.id,
      username: m.user.username,
      displayName: m.nick || m.user.global_name || m.user.username,
      avatar: m.user.avatar
        ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=64`
        : null,
      bot: m.user.bot || false,
    })).filter((m: any) => !m.bot);

    return new Response(JSON.stringify(mapped), {
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
