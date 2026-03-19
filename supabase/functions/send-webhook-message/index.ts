import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCORD_API = "https://discord.com/api/v10";

function parseEmojiFromLabel(label: string) {
  const customMatch = label.match(/^<(a?):(\w+):(\d+)>\s*/);
  if (customMatch) {
    return {
      emoji: customMatch[0].trim(),
      cleanLabel: label.slice(customMatch[0].length),
      isCustom: true,
      animated: customMatch[1] === "a",
      customName: customMatch[2],
      customId: customMatch[3],
    };
  }
  const unicodeMatch = label.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
  if (unicodeMatch) {
    return {
      emoji: unicodeMatch[1],
      cleanLabel: label.slice(unicodeMatch[0].length),
      isCustom: false,
      animated: false,
      customName: undefined,
      customId: undefined,
    };
  }
  return { emoji: null, cleanLabel: label, isCustom: false, animated: false, customName: undefined, customId: undefined };
}

// Get or create a webhook for a channel, owned by the bot application
async function getOrCreateWebhook(channelId: string, botToken: string): Promise<{ id: string; token: string } | null> {
  try {
    // List existing webhooks for the channel
    const listRes = await fetch(`${DISCORD_API}/channels/${channelId}/webhooks`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!listRes.ok) {
      console.error("Failed to list webhooks:", listRes.status, await listRes.text());
      return null;
    }
    const webhooks = await listRes.json();
    
    // Find an existing webhook created by our bot
    const existing = webhooks.find((w: any) => w.type === 1 && w.name === "Drika Webhook");
    if (existing) {
      return { id: existing.id, token: existing.token };
    }

    // Create a new webhook
    const createRes = await fetch(`${DISCORD_API}/channels/${channelId}/webhooks`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Drika Webhook" }),
    });
    if (!createRes.ok) {
      console.error("Failed to create webhook:", createRes.status, await createRes.text());
      return null;
    }
    const newWebhook = await createRes.json();
    return { id: newWebhook.id, token: newWebhook.token };
  } catch (err) {
    console.error("Webhook error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, channel_id, content, embeds, product_id, components } = await req.json();

    if (!tenant_id) throw new Error("Missing tenant_id");
    if (!channel_id) throw new Error("Missing channel_id");
    if (!content && (!embeds || embeds.length === 0)) {
      throw new Error("Missing content or embeds");
    }

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) throw new Error("DISCORD_BOT_TOKEN not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch tenant customization (bot_name, bot_avatar_url)
    const { data: tenant } = await supabase
      .from("tenants")
      .select("bot_name, bot_avatar_url, name")
      .eq("id", tenant_id)
      .single();

    const customBotName = tenant?.bot_name || tenant?.name || undefined;
    const customAvatarUrl = tenant?.bot_avatar_url || undefined;

    // Build payload
    const payload: Record<string, any> = {};
    if (content) payload.content = content;
    if (embeds) {
      for (const embed of embeds) {
        if (embed.color === 0x2B2D31 || embed.color === 2829105) {
          delete embed.color;
        }
      }
      payload.embeds = embeds;
    }

    // If product_id is provided, add buy/variations buttons
    if (product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("auto_delivery, button_style, embed_config")
        .eq("id", product_id)
        .eq("tenant_id", tenant_id)
        .single();

      const { count: realStockCount, error: stockError } = await supabase
        .from("product_stock_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id)
        .eq("delivered", false);

      if (stockError) {
        console.error("Failed to fetch real stock count:", stockError.message);
      }

      if (embeds && embeds.length > 0) {
        embeds[0].fields = embeds[0].fields || [];
        const stockField = {
          name: "Restam",
          value: `\`${realStockCount ?? 0}\``,
          inline: true,
        };
        const existingStockFieldIndex = embeds[0].fields.findIndex(
          (field: any) => typeof field?.name === "string" && field.name.toLowerCase() === "restam"
        );
        if (existingStockFieldIndex >= 0) {
          embeds[0].fields[existingStockFieldIndex] = stockField;
        } else {
          embeds[0].fields.push(stockField);
        }
      }

      if (product?.auto_delivery && embeds && embeds.length > 0) {
        const currentDesc = embeds[0].description || "";
        if (!currentDesc.includes("Entrega Automática")) {
          embeds[0].description = `⚡ **Entrega Automática!**\n\n${currentDesc}`;
        }
      }

      const { data: fields } = await supabase
        .from("product_fields")
        .select("id")
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id);

      const hasVariations = fields && fields.length > 0;

      const styleMap: Record<string, number> = {
        primary: 1, secondary: 2, success: 3, danger: 4, link: 2, glass: 2,
      };
      const discordBuyStyle = styleMap[product?.button_style || "success"] || 3;

      const rawBuyLabel = (product?.embed_config as any)?.buy_button_label || "";
      const normalizedBuyLabel = rawBuyLabel.trim();
      const finalBuyLabel = !normalizedBuyLabel || normalizedBuyLabel.toLowerCase() === "comprar" ? "🛒 Comprar" : rawBuyLabel;
      const { emoji: btnEmoji, cleanLabel: btnLabel, isCustom, customId, customName, animated } = parseEmojiFromLabel(finalBuyLabel);

      const buyButton: any = {
        type: 2,
        style: discordBuyStyle,
        label: btnLabel || "Comprar",
        custom_id: `buy_product:${product_id}`,
      };

      if (btnEmoji) {
        if (isCustom && customId) {
          buyButton.emoji = { id: customId, name: customName, animated: !!animated };
        } else {
          buyButton.emoji = { name: btnEmoji };
        }
      }

      payload.components = [{ type: 1, components: [buyButton] }];
    } else if (components) {
      payload.components = components;
    }

    // Determine if we have interactive components (buttons with custom_id)
    const hasInteractiveComponents = payload.components?.some((row: any) =>
      row.components?.some((c: any) => c.custom_id)
    );

    let messageId: string;

    if (hasInteractiveComponents) {
      // Interactive components require Bot API - send via bot, but we can't change name/avatar
      // So we use a two-step approach: send embed via webhook, then edit to add components via bot
      // Actually, we must send via Bot API for interactive components
      const sendRes = await fetch(`${DISCORD_API}/channels/${channel_id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        console.error("Bot message failed:", sendRes.status, errText);
        throw new Error(`Discord API error: ${sendRes.status} - ${errText}`);
      }

      const message = await sendRes.json();
      messageId = message.id;
    } else {
      // No interactive components - use webhook for custom name/avatar
      const webhook = await getOrCreateWebhook(channel_id, botToken);
      
      if (webhook && (customBotName || customAvatarUrl)) {
        // Send via webhook with custom identity
        const webhookPayload: Record<string, any> = { ...payload };
        if (customBotName) webhookPayload.username = customBotName;
        if (customAvatarUrl) webhookPayload.avatar_url = customAvatarUrl;

        const sendRes = await fetch(`${DISCORD_API}/webhooks/${webhook.id}/${webhook.token}?wait=true`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });

        if (!sendRes.ok) {
          const errText = await sendRes.text();
          console.error("Webhook message failed:", sendRes.status, errText);
          throw new Error(`Discord webhook error: ${sendRes.status} - ${errText}`);
        }

        const message = await sendRes.json();
        messageId = message.id;
      } else {
        // Fallback to Bot API
        const sendRes = await fetch(`${DISCORD_API}/channels/${channel_id}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!sendRes.ok) {
          const errText = await sendRes.text();
          console.error("Bot message failed:", sendRes.status, errText);
          throw new Error(`Discord API error: ${sendRes.status} - ${errText}`);
        }

        const message = await sendRes.json();
        messageId = message.id;
      }
    }

    return new Response(JSON.stringify({ success: true, message_id: messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-webhook-message error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
