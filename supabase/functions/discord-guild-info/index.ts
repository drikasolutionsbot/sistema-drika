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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let tenantBotToken: string | null = null;

    // If tenant_id provided, resolve guild_id and bot token
    if (body.tenant_id) {
      const { data: tenant, error } = await supabase
        .from("tenants")
        .select("discord_guild_id, bot_token_encrypted")
        .eq("id", body.tenant_id)
        .single();

      if (error || !tenant?.discord_guild_id) {
        throw new Error("Could not resolve guild_id from tenant");
      }
      if (!guild_id) guild_id = tenant.discord_guild_id;
      tenantBotToken = tenant.bot_token_encrypted || null;
    }

    if (!guild_id) throw new Error("Missing guild_id");

    const botToken = tenantBotToken;
    if (!botToken) {
      // Return empty defaults when bot token is not configured
      return new Response(
        JSON.stringify({
          id: guild_id,
          name: null,
          icon: null,
          member_count: 0,
          presence_count: 0,
          roles: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch guild info
    const res = await fetch(`https://discord.com/api/v10/guilds/${guild_id}?with_counts=true`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discord API error [${res.status}]: ${text}`);
    }

    const guild = await res.json();

    // Also fetch roles
    const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guild_id}/roles`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    let roles: any[] = [];
    if (rolesRes.ok) {
      roles = await rolesRes.json();
    } else {
      await rolesRes.text(); // consume body
    }

    return new Response(
      JSON.stringify({
        id: guild.id,
        name: guild.name,
        icon: guild.icon
          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
          : null,
        member_count: guild.approximate_member_count ?? guild.member_count ?? 0,
        presence_count: guild.approximate_presence_count ?? 0,
        roles,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
