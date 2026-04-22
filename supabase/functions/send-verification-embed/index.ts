import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { tenant_id, channel_id, title, description, button_label, button_style, embed_color, image_url } = await req.json();

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

    // Resolve tenant data + use external bot token
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("name, logo_url, verify_slug")
      .eq("id", tenant_id)
      .single();

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;

    if (!botToken) {
      return new Response(JSON.stringify({ error: "Bot externo não configurado (DISCORD_BOT_TOKEN)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build embed (template Drika fixo: título + descrição + capa)
    const colorInt = parseInt((embed_color || "#2B2D31").replace("#", ""), 16);
    const DRIKA_COVER_URL = Deno.env.get("DRIKA_COVER_URL") || "https://i.imgur.com/8QZQZ8Q.png";

    const embed: any = {
      title: "👑 Verificação",
      description: "Clique no botão abaixo para se verificar em nosso servidor.\nA verificação é necessária para liberar acesso aos canais.",
      color: colorInt,
      image: { url: DRIKA_COVER_URL },
    };

    const rawLabel = button_label || "Verificar";
    const { emoji: btnEmoji, cleanLabel: btnLabel, isCustom, customId, customName, animated } = parseEmojiFromLabel(rawLabel);

    const verifyButton: any = {
      type: 2,
      style: 5,
      label: btnLabel || "Verificar",
      url: tenant?.verify_slug
        ? `https://www.drikahub.com/verify/${tenant.verify_slug}`
        : `https://www.drikahub.com/verify/${tenant_id}`,
    };

    if (btnEmoji) {
      if (isCustom && customId) {
        verifyButton.emoji = { id: customId, name: customName, animated: !!animated };
      } else {
        verifyButton.emoji = { name: btnEmoji };
      }
    }

    const payload: any = {
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [verifyButton],
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
