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
    const body = await req.json();
    let guild_id = body.guild_id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let botToken: string | null = null;

    if (body.tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("discord_guild_id, bot_token_encrypted")
        .eq("id", body.tenant_id)
        .single();
      if (!guild_id) guild_id = tenant?.discord_guild_id;
      botToken = tenant?.bot_token_encrypted || null;
    }

    if (!guild_id) {
      return new Response(JSON.stringify({ error: "Missing guild_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!botToken) {
      botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;
    }

    if (!botToken) {
      return new Response(JSON.stringify({ channels: [], categories: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guild_id}/channels`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `Discord API error [${res.status}]: ${text}` }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channels = await res.json();

    const textChannels = channels
      .filter((c: any) => c.type === 0)
      .map((c: any) => ({ id: c.id, name: c.name, parent_id: c.parent_id, position: c.position }))
      .sort((a: any, b: any) => a.position - b.position);

    const categories = channels
      .filter((c: any) => c.type === 4)
      .map((c: any) => ({ id: c.id, name: c.name, position: c.position }))
      .sort((a: any, b: any) => a.position - b.position);

    return new Response(JSON.stringify({ channels: textChannels, categories }), {
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
