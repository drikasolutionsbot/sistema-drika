import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tr, getTenantLang } from "../_shared/i18n.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseEmojiFromLabel(label: string) {
  const customMatch = label.match(/^<(a?):(\w+):(\d+)>\s*/);
  if (customMatch) {
    return { emoji: customMatch[0].trim(), cleanLabel: label.slice(customMatch[0].length), isCustom: true, animated: customMatch[1] === "a", customName: customMatch[2], customId: customMatch[3] };
  }
  const unicodeMatch = label.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
  if (unicodeMatch) {
    return { emoji: unicodeMatch[1], cleanLabel: label.slice(unicodeMatch[0].length), isCustom: false, animated: false, customName: undefined, customId: undefined };
  }
  return { emoji: null, cleanLabel: label, isCustom: false, animated: false, customName: undefined, customId: undefined };
}

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

    // Get existing message_id and use external bot token
    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("ticket_message_id, ticket_channel_id")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;

    if (!botToken) {
      return new Response(JSON.stringify({ error: "Bot externo não configurado (DISCORD_BOT_TOKEN)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const colorInt = parseInt((embed_color || "#2B2D31").replace("#", ""), 16);
    const safeImageUrl = typeof image_url === "string" && image_url.trim() ? image_url.trim() : null;
    const safeThumbnailUrl = typeof thumbnail_url === "string" && thumbnail_url.trim() ? thumbnail_url.trim() : null;

    const lang = await getTenantLang(supabase, tenant_id);

    const embed: any = {
      title: title || tr(lang, "ticket_default_title"),
      description: description || tr(lang, "ticket_default_desc"),
      color: colorInt,
    };

    if (safeImageUrl) embed.image = { url: safeImageUrl };
    if (safeThumbnailUrl) embed.thumbnail = { url: safeThumbnailUrl };
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

    const rawLabel = button_label || "📩 Abrir Ticket";
    const { emoji: btnEmoji, cleanLabel: btnLabel, isCustom, customId, customName, animated } = parseEmojiFromLabel(rawLabel);

    const ticketButton: any = {
      type: 2,
      style: discordStyle,
      label: btnLabel || "Abrir Ticket",
      custom_id: `ticket_open_${tenant_id}_${channel_id}`,
    };

    if (btnEmoji) {
      if (isCustom && customId) {
        ticketButton.emoji = { id: customId, name: customName, animated: !!animated };
      } else {
        ticketButton.emoji = { name: btnEmoji };
      }
    }

    const payload: any = {
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [ticketButton],
        },
      ],
    };

    const existingMessageId = storeConfig?.ticket_message_id;
    const existingChannelId = storeConfig?.ticket_channel_id;
    let messageId: string;

    // Delete old message if exists (any channel)
    if (existingMessageId && existingChannelId) {
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

    // Always send a NEW message
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

    // Save the message_id AND channel_id for future edits
    await supabase
      .from("store_configs")
      .update({ ticket_message_id: messageId!, ticket_channel_id: channel_id })
      .eq("tenant_id", tenant_id);

    return new Response(JSON.stringify({ success: true, message_id: messageId! }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
