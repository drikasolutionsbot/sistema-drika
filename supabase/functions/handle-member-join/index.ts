import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tr, getTenantLang } from "../_shared/i18n.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCORD_API = "https://discord.com/api/v10";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { tenant_id, event, member } = body;

    if (!tenant_id || !event || !member) {
      throw new Error("tenant_id, event, and member are required");
    }

    const userId = member.user?.id || member.id;
    const username = member.user?.username || member.username || "usuário";
    const avatar = member.user?.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${member.user.avatar}.png?size=256`
      : null;

    // Get tenant info + use external bot token
    const { data: tenant } = await supabase
      .from("tenants")
      .select("discord_guild_id, name, logo_url")
      .eq("id", tenant_id)
      .single();

    if (!tenant?.discord_guild_id) throw new Error("Tenant not configured");
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;
    if (!botToken) throw new Error("Bot externo não configurado (DISCORD_BOT_TOKEN)");
    const guildId = tenant.discord_guild_id;
    const lang = await getTenantLang(supabase, tenant_id);

    // Get welcome config
    const { data: config } = await supabase
      .from("welcome_configs")
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!config) {
      return json({ success: true, message: "No welcome config found, skipping" });
    }

    const results: string[] = [];

    // Get guild info for member count
    let memberCount = "?";
    try {
      const guildRes = await fetch(`${DISCORD_API}/guilds/${guildId}?with_counts=true`, {
        headers: { Authorization: `Bot ${botToken}` },
      });
      if (guildRes.ok) {
        const guild = await guildRes.json();
        memberCount = guild.approximate_member_count?.toString() || "?";
      }
    } catch {}

    const replaceVars = (text: string): string => {
      if (!text) return text;
      return text
        .replace(/\{user\}/g, `<@${userId}>`)
        .replace(/\{username\}/g, username)
        .replace(/\{userId\}/g, userId)
        .replace(/\{server\}/g, tenant.name || "servidor")
        .replace(/\{memberCount\}/g, memberCount)
        .replace(/\{avatar\}/g, avatar || "")
        .replace(/\{serverIcon\}/g, tenant.logo_url || "")
        .replace(/\{createdAt\}/g, new Date(Number(BigInt(userId) >> BigInt(22)) + 1420070400000).toLocaleDateString("pt-BR"))
        .replace(/\{joinedAt\}/g, new Date().toLocaleDateString("pt-BR"));
    };

    // ─── MEMBER JOIN ─────────────────────────────
    if (event === "GUILD_MEMBER_ADD") {

      // 1. Auto Role
      if (config.auto_role_enabled && config.auto_role_id) {
        try {
          const res = await fetch(
            `${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${config.auto_role_id}`,
            { method: "PUT", headers: { Authorization: `Bot ${botToken}` } }
          );
          if (res.ok || res.status === 204) {
            results.push("auto_role: assigned");
          } else {
            const err = await res.text();
            results.push(`auto_role: failed (${res.status}) ${err}`);
          }
        } catch (e: any) {
          results.push(`auto_role: error - ${e.message}`);
        }
      }

      // 2. Welcome message in channel
      if (config.enabled && config.channel_enabled && config.channel_id) {
        try {
          const embed = buildEmbed(config.embed_data, replaceVars, tenant, lang);
          const payload: any = { embeds: [embed] };
          if (config.content) payload.content = replaceVars(config.content);

          const res = await fetch(`${DISCORD_API}/channels/${config.channel_id}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          results.push(res.ok ? "welcome_channel: sent" : `welcome_channel: failed (${res.status})`);
        } catch (e: any) {
          results.push(`welcome_channel: error - ${e.message}`);
        }
      }

      // 3. Welcome DM
      if (config.enabled && config.dm_enabled) {
        try {
          // Open DM channel
          const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ recipient_id: userId }),
          });
          if (dmRes.ok) {
            const dm = await dmRes.json();
            const embed = buildEmbed(config.dm_embed_data, replaceVars, tenant, lang);
            const payload: any = { embeds: [embed] };
            if (config.dm_content) payload.content = replaceVars(config.dm_content);

            const res = await fetch(`${DISCORD_API}/channels/${dm.id}/messages`, {
              method: "POST",
              headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            results.push(res.ok ? "welcome_dm: sent" : `welcome_dm: failed (${res.status})`);
          } else {
            results.push(`welcome_dm: cant_open_dm (${dmRes.status})`);
          }
        } catch (e: any) {
          results.push(`welcome_dm: error - ${e.message}`);
        }
      }
    }

    // ─── MEMBER LEAVE ─────────────────────────────
    if (event === "GUILD_MEMBER_REMOVE") {
      if (config.goodbye_enabled && config.goodbye_channel_id) {
        try {
          const embed = buildEmbed(config.goodbye_embed_data, replaceVars, tenant, lang);
          const payload: any = { embeds: [embed] };
          if (config.goodbye_content) payload.content = replaceVars(config.goodbye_content);

          const res = await fetch(`${DISCORD_API}/channels/${config.goodbye_channel_id}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          results.push(res.ok ? "goodbye: sent" : `goodbye: failed (${res.status})`);
        } catch (e: any) {
          results.push(`goodbye: error - ${e.message}`);
        }
      }
    }

    return json({ success: true, event, user_id: userId, results });
  } catch (err: any) {
    console.error("handle-member-join error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildEmbed(embedData: any, replaceVars: (t: string) => string, tenant: any): any {
  if (!embedData) return {};

  const embed: any = {
    color: parseInt((embedData.color || "#2B2D31").replace("#", ""), 16),
    title: "👋 Bem-vindo(a)!",
    description: replaceVars("Olá **{username}**, seja bem-vindo(a) ao **{server}**! 🥳\n\nVocê é nosso membro **#{memberCount}**. Aproveite sua estadia!"),
  };

  if (embedData.image_url) embed.image = { url: replaceVars(embedData.image_url) };
  if (embedData.thumbnail_url) embed.thumbnail = { url: replaceVars(embedData.thumbnail_url) };
  if (embedData.footer_text) {
    embed.footer = { text: replaceVars(embedData.footer_text) };
    if (embedData.footer_icon_url) embed.footer.icon_url = replaceVars(embedData.footer_icon_url);
  }
  if (embedData.timestamp) embed.timestamp = new Date().toISOString();
  if (embedData.fields?.length) {
    embed.fields = embedData.fields.map((f: any) => ({
      name: replaceVars(f.name),
      value: replaceVars(f.value),
      inline: f.inline ?? false,
    }));
  }

  return embed;
}
