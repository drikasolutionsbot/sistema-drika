import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      tenant_id,
      channel_id,
      title,
      description,
      button_label,
      button_style,
      embed_color,
      image_url,
      thumbnail_url,
      footer,
    } = await req.json();

    if (!tenant_id || !channel_id) {
      return new Response(JSON.stringify({ error: "tenant_id and channel_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tenant } = await supabase
      .from("tenants")
      .select("bot_token_encrypted")
      .eq("id", tenant_id)
      .single();

    const botToken = tenant?.bot_token_encrypted || Deno.env.get("DISCORD_BOT_TOKEN");

    if (!botToken) {
      return new Response(JSON.stringify({ error: "Bot token not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const colorInt = parseInt((embed_color || "#5865F2").replace("#", ""), 16);

    const embed: any = {
      title: title || "🎫 Ticket de Suporte",
      description: description || "Clique no botão abaixo para abrir um ticket.",
      color: colorInt,
    };

    if (image_url) embed.image = { url: image_url };
    if (thumbnail_url) embed.thumbnail = { url: thumbnail_url };
    if (footer) embed.footer = { text: footer };

    // Discord button styles: 1=Primary(blurple), 2=Secondary(grey), 3=Success(green), 4=Danger(red)
    const styleMap: Record<string, number> = {
      primary: 1,
      secondary: 2,
      success: 3,
      danger: 4,
      glass: 2,
      link: 2,
    };

    const discordStyle = styleMap[button_style || "glass"] || 2;

    const payload: any = {
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: discordStyle,
              label: button_label || "📩 Abrir Ticket",
              custom_id: `ticket_open_${tenant_id}_${channel_id}`,
            },
          ],
        },
      ],
    };

    const res = await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Discord API error:", errText);
      return new Response(JSON.stringify({ error: "Failed to send message", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await res.json();
    return new Response(JSON.stringify({ success: true, message_id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
