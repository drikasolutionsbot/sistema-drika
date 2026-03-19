

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Discord channel types
const CHANNEL_TYPES: Record<string, number> = {
  text: 0,
  voice: 2,
  category: 4,
  announcement: 5,
  stage: 13,
  forum: 15,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guild_id, name, type, parent_id, topic, tenant_id } = await req.json();

    if (!guild_id || !name) {
      return new Response(JSON.stringify({ error: "guild_id e name são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sempre usar bot externo 24h
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;

    if (!botToken) {
      return new Response(JSON.stringify({ error: "Bot externo não configurado (DISCORD_BOT_TOKEN)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channelType = typeof type === "number" ? type : (CHANNEL_TYPES[type] ?? 0);

    const body: Record<string, unknown> = {
      name: name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "").substring(0, 100),
      type: channelType,
    };

    if (parent_id) body.parent_id = parent_id;
    if (topic) body.topic = String(topic).substring(0, 1024);

    const discordRes = await fetch(
      `https://discord.com/api/v10/guilds/${guild_id}/channels`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!discordRes.ok) {
      const errBody = await discordRes.text();
      console.error("Discord API error:", discordRes.status, errBody);
      return new Response(
        JSON.stringify({ error: `Discord API retornou ${discordRes.status}`, details: errBody }),
        { status: discordRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const channel = await discordRes.json();

    return new Response(
      JSON.stringify({ success: true, channel: { id: channel.id, name: channel.name, type: channel.type, parent_id: channel.parent_id } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error creating channel:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
