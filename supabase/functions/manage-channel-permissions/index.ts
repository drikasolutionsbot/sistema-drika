import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Discord permission bits
const PERMISSIONS = {
  VIEW_CHANNEL: BigInt(1) << BigInt(10),       // 1024
  SEND_MESSAGES: BigInt(1) << BigInt(11),       // 2048
  SEND_MESSAGES_IN_THREADS: BigInt(1) << BigInt(38),
  CONNECT: BigInt(1) << BigInt(20),             // voice
  SPEAK: BigInt(1) << BigInt(21),               // voice
  ADD_REACTIONS: BigInt(1) << BigInt(6),
  ATTACH_FILES: BigInt(1) << BigInt(15),
  READ_MESSAGE_HISTORY: BigInt(1) << BigInt(16),
  EMBED_LINKS: BigInt(1) << BigInt(14),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, tenant_id, channel_id, overwrites } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resolve guild_id and bot token from tenant
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("discord_guild_id, bot_token_encrypted")
      .eq("id", tenant_id)
      .single();

    if (!tenantData?.discord_guild_id) {
      return new Response(JSON.stringify({ error: "Servidor Discord não configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botToken = tenantData.bot_token_encrypted || Deno.env.get("DISCORD_BOT_TOKEN")!;
    const guildId = tenantData.discord_guild_id;

    // ACTION: get - Get current permission overwrites for a channel
    if (action === "get") {
      if (!channel_id) {
        return new Response(JSON.stringify({ error: "channel_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`https://discord.com/api/v10/channels/${channel_id}`, {
        headers: { Authorization: `Bot ${botToken}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        return new Response(JSON.stringify({ error: `Discord API error: ${errText}` }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const channel = await res.json();
      const permOverwrites = (channel.permission_overwrites || []).map((o: any) => ({
        id: o.id,
        type: o.type, // 0 = role, 1 = member
        allow: o.allow,
        deny: o.deny,
      }));

      return new Response(JSON.stringify({ overwrites: permOverwrites, channel_name: channel.name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: update - Set permission overwrites for roles on a channel
    if (action === "update") {
      if (!channel_id || !overwrites || !Array.isArray(overwrites)) {
        return new Response(JSON.stringify({ error: "channel_id and overwrites[] required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // overwrites format: [{ role_id, permissions: { view_channel: "allow"|"deny"|"neutral", send_messages: "allow"|"deny"|"neutral", ... } }]
      const results: any[] = [];

      for (const ow of overwrites) {
        const { role_id, permissions } = ow;
        if (!role_id || !permissions) continue;

        let allow = BigInt(0);
        let deny = BigInt(0);

        const permMap: Record<string, bigint> = {
          view_channel: PERMISSIONS.VIEW_CHANNEL,
          send_messages: PERMISSIONS.SEND_MESSAGES,
          add_reactions: PERMISSIONS.ADD_REACTIONS,
          attach_files: PERMISSIONS.ATTACH_FILES,
          read_message_history: PERMISSIONS.READ_MESSAGE_HISTORY,
          embed_links: PERMISSIONS.EMBED_LINKS,
          connect: PERMISSIONS.CONNECT,
          speak: PERMISSIONS.SPEAK,
        };

        for (const [key, bit] of Object.entries(permMap)) {
          const val = permissions[key];
          if (val === "allow") allow |= bit;
          else if (val === "deny") deny |= bit;
          // "neutral" or undefined = not set (inherit)
        }

        if (allow === BigInt(0) && deny === BigInt(0)) {
          // Delete the overwrite if everything is neutral
          const delRes = await fetch(
            `https://discord.com/api/v10/channels/${channel_id}/permissions/${role_id}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bot ${botToken}` },
            }
          );
          results.push({ role_id, action: "deleted", ok: delRes.ok || delRes.status === 404 });
        } else {
          // PUT the overwrite
          const putRes = await fetch(
            `https://discord.com/api/v10/channels/${channel_id}/permissions/${role_id}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                allow: allow.toString(),
                deny: deny.toString(),
                type: 0, // role type
              }),
            }
          );

          if (!putRes.ok) {
            const errText = await putRes.text();
            console.error(`Failed to set perms for role ${role_id}:`, errText);
            results.push({ role_id, action: "error", error: errText });
          } else {
            results.push({ role_id, action: "updated", ok: true });
          }
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: bulk_get - Get overwrites for all channels at once
    if (action === "bulk_get") {
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/channels`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );

      if (!res.ok) {
        const errText = await res.text();
        return new Response(JSON.stringify({ error: `Discord API error: ${errText}` }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const channels = await res.json();
      const channelPerms: Record<string, any[]> = {};

      for (const ch of channels) {
        if (ch.type === 0 || ch.type === 2 || ch.type === 5) {
          channelPerms[ch.id] = (ch.permission_overwrites || []).map((o: any) => ({
            id: o.id,
            type: o.type,
            allow: o.allow,
            deny: o.deny,
          }));
        }
      }

      return new Response(JSON.stringify({ channel_permissions: channelPerms }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: get, update, bulk_get" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const message = error?.message || error?.msg || (typeof error === "string" ? error : JSON.stringify(error));
    console.error("manage-channel-permissions error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
