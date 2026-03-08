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
      const { data: tenant } = await supabase
        .from("tenants")
        .select("discord_guild_id")
        .eq("id", body.tenant_id)
        .single();
      guild_id = tenant?.discord_guild_id;
    }

    if (!guild_id) {
      return new Response(JSON.stringify({ error: "Missing guild_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) {
      return new Response(JSON.stringify({ error: "Bot token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch guild invites
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guild_id}/invites`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `Discord API error [${res.status}]: ${text}` }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invites = await res.json();

    // Aggregate invites by inviter
    const inviterMap: Record<string, {
      id: string;
      username: string;
      display_name: string;
      avatar: string | null;
      total_uses: number;
      invites: { code: string; uses: number; max_uses: number | null; channel: string | null; created_at: string; expires_at: string | null; temporary: boolean }[];
    }> = {};

    for (const inv of invites) {
      const inviter = inv.inviter;
      if (!inviter) continue;

      const key = inviter.id;
      if (!inviterMap[key]) {
        inviterMap[key] = {
          id: inviter.id,
          username: inviter.username,
          display_name: inviter.global_name || inviter.username,
          avatar: inviter.avatar
            ? `https://cdn.discordapp.com/avatars/${inviter.id}/${inviter.avatar}.png?size=64`
            : null,
          total_uses: 0,
          invites: [],
        };
      }

      inviterMap[key].total_uses += inv.uses || 0;
      inviterMap[key].invites.push({
        code: inv.code,
        uses: inv.uses || 0,
        max_uses: inv.max_uses || null,
        channel: inv.channel?.name || null,
        created_at: inv.created_at,
        expires_at: inv.expires_at || null,
        temporary: inv.temporary || false,
      });
    }

    // Sort by total_uses desc
    const sorted = Object.values(inviterMap).sort((a, b) => b.total_uses - a.total_uses);

    return new Response(JSON.stringify({ inviters: sorted, total_invites: invites.length }), {
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
