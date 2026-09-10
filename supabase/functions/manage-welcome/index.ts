import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const DISCORD_API = "https://discord.com/api/v10";

function hexToInt(hex: string): number {
  return parseInt((hex || "#2B2D31").replace("#", ""), 16);
}

function resolveVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_: string, key: string) => vars[key] !== undefined ? vars[key] : "{" + key + "}");
}

function buildEmbed(embedData: any, vars: Record<string, string>) {
  const embed: Record<string, any> = {};
  if (embedData.color) embed.color = hexToInt(embedData.color);
  if (embedData.title) embed.title = resolveVars(embedData.title, vars);
  if (embedData.description) embed.description = resolveVars(embedData.description, vars);
  if (embedData.thumbnail_url) {
    const url = resolveVars(embedData.thumbnail_url, vars);
    if (url && url.startsWith("http")) embed.thumbnail = { url };
  }
  if (embedData.image_url) {
    const url = resolveVars(embedData.image_url, vars);
    if (url && url.startsWith("http")) embed.image = { url };
  }
  const footerText = embedData.footer_text ? resolveVars(embedData.footer_text, vars) : "";
  const footerIcon = embedData.footer_icon_url ? resolveVars(embedData.footer_icon_url, vars) : "";
  if (footerText || footerIcon) {
    embed.footer = { text: footerText };
    if (footerIcon && footerIcon.startsWith("http")) embed.footer.icon_url = footerIcon;
  }
  if (embedData.timestamp) embed.timestamp = new Date().toISOString();
  if (Array.isArray(embedData.fields) && embedData.fields.length > 0) {
    embed.fields = embedData.fields.map((f: any) => ({
      name: resolveVars(f.name || "", vars),
      value: resolveVars(f.value || "", vars),
      inline: !!f.inline,
    }));
  }
  return embed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const { action, tenant_id } = body;
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (action === "get") {
      const { data, error } = await supabase
        .from("welcome_configs")
        .select("*")
        .eq("tenant_id", tenant_id)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify(data || {}), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upsert") {
      const { config } = body;
      if (!config) {
        return new Response(JSON.stringify({ error: "Missing config" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const payload = {
        tenant_id,
        enabled: config.enabled ?? false,
        channel_enabled: config.channel_enabled ?? true,
        channel_id: config.channel_id || null,
        dm_enabled: config.dm_enabled ?? false,
        embed_data: config.embed_data ?? {},
        dm_embed_data: config.dm_embed_data ?? {},
        auto_role_enabled: config.auto_role_enabled ?? false,
        auto_role_id: config.auto_role_id || null,
        content: config.content ?? "",
        dm_content: config.dm_content ?? "",
        goodbye_enabled: config.goodbye_enabled ?? false,
        goodbye_channel_id: config.goodbye_channel_id || null,
        goodbye_embed_data: config.goodbye_embed_data ?? {},
        goodbye_content: config.goodbye_content ?? "",
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("welcome_configs")
        .upsert(payload, { onConflict: "tenant_id" });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test") {
      const { channel_id, embed_data, content } = body;
      if (!channel_id) {
        return new Response(JSON.stringify({ error: "Missing channel_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
      if (!botToken) throw new Error("Bot nao configurado");

      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, guild_id")
        .eq("id", tenant_id)
        .maybeSingle();

      const guildId = tenant?.guild_id;
      let memberCount = "?";
      if (guildId) {
        try {
          const guildRes = await fetch(DISCORD_API + "/guilds/" + guildId + "?with_counts=true", {
            headers: { Authorization: "Bot " + botToken },
          });
          if (guildRes.ok) {
            const guild = await guildRes.json();
            memberCount = String(guild.approximate_member_count || guild.member_count || "?");
          }
        } catch (_e: any) { /* ignore */ }
      }

      const vars: Record<string, string> = {
        user: "@Usuario",
        username: "Usuario",
        userId: "000000000000000000",
        server: tenant?.name || "Meu Servidor",
        memberCount,
        avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
        serverIcon: "",
        createdAt: new Date().toLocaleDateString("pt-BR"),
        joinedAt: new Date().toLocaleDateString("pt-BR"),
      };

      const embed = buildEmbed(embed_data || {}, vars);
      const resolvedContent = content ? resolveVars(content, { ...vars, user: "<@000000000000000000>" }) : "";
      const discordPayload: Record<string, any> = { embeds: [embed] };
      if (resolvedContent) discordPayload.content = resolvedContent;

      const sendRes = await fetch(DISCORD_API + "/channels/" + channel_id + "/messages", {
        method: "POST",
        headers: {
          Authorization: "Bot " + botToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(discordPayload),
      });

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        throw new Error("Discord API error: " + sendRes.status + " - " + errText);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const message = error?.message || (typeof error === "string" ? error : JSON.stringify(error));
    console.error("manage-welcome error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
