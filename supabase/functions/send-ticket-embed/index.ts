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

    // Get tenant bot token and existing message_id
    const { data: tenant } = await supabase
      .from("tenants")
      .select("bot_token_encrypted")
      .eq("id", tenant_id)
      .single();

    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("ticket_message_id, ticket_channel_id")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

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

    const existingMessageId = storeConfig?.ticket_message_id;
    const existingChannelId = storeConfig?.ticket_channel_id;
    let messageId: string;
    let edited = false;

    // If channel changed, delete old message first
    if (existingMessageId && existingChannelId && existingChannelId !== channel_id) {
      try {
        await fetch(
          `https://discord.com/api/v10/channels/${existingChannelId}/messages/${existingMessageId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bot ${botToken}` },
          }
        );
        console.log("Deleted old ticket embed from channel", existingChannelId);
      } catch (err) {
        console.log("Failed to delete old message, continuing:", err);
      }
    }

    // Try to EDIT existing message if same channel
    if (existingMessageId && existingChannelId === channel_id) {
      const editRes = await fetch(
        `https://discord.com/api/v10/channels/${channel_id}/messages/${existingMessageId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (editRes.ok) {
        const result = await editRes.json();
        messageId = result.id;
        edited = true;
      } else {
        console.log("Edit failed, sending new message. Status:", editRes.status);
      }
    }

    // Send NEW message if no existing or edit failed
    if (!edited) {
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
      messageId = result.id;
    }

    // Save the message_id AND channel_id for future edits
    await supabase
      .from("store_configs")
      .update({ ticket_message_id: messageId!, ticket_channel_id: channel_id })
      .eq("tenant_id", tenant_id);

    return new Response(JSON.stringify({ success: true, message_id: messageId!, edited }), {
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
