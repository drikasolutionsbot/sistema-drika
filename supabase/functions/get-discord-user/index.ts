import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) throw new Error("Missing user_id");

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetch(`https://discord.com/api/v10/users/${user_id}`, {
      headers: { Authorization: `Bot ${botToken}` }
    });

    if (!res.ok) {
      throw new Error(`Discord API error: ${res.status}`);
    }

    const userData = await res.json();
    
    let avatarUrl = null;
    if (userData.avatar) {
      const ext = userData.avatar.startsWith("a_") ? "gif" : "png";
      avatarUrl = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.${ext}?size=256`;
    } else {
      const defaultAvatarIndex = (BigInt(userData.id) >> 22n) % 6n;
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
    }

    return new Response(JSON.stringify({ avatarUrl, username: userData.username }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
