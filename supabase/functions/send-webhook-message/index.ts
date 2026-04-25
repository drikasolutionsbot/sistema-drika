import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tr, normLang, type Lang } from "../_shared/i18n.ts";

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

// Get bot user id to ensure we only reuse webhooks owned by the same bot/application
async function getBotUserId(botToken: string): Promise<string | null> {
  try {
    const meRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (!meRes.ok) {
      console.error("Failed to fetch bot identity:", meRes.status, await meRes.text());
      return null;
    }

    const me = await meRes.json();
    return me?.id ?? null;
  } catch (err) {
    console.error("Bot identity error:", err);
    return null;
  }
}

// Get or create a webhook for a channel, owned by the current bot/application
async function getOrCreateWebhook(channelId: string, botToken: string, botUserId: string | null): Promise<{ id: string; token: string } | null> {
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

    // Reuse only webhook created by the same bot/app (prevents routing interactions to wrong app)
    const existing = webhooks.find((w: any) =>
      w.type === 1 &&
      w.name === "Drika Webhook" &&
      !!w.token &&
      (!!botUserId ? w.user?.id === botUserId : true)
    );

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

async function sendBotMessage(channelId: string, botToken: string, payload: Record<string, any>): Promise<string> {
  const sendRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text();
    throw new Error(`Discord API error: ${sendRes.status} - ${errText}`);
  }

  const message = await sendRes.json();
  return message.id;
}

async function deleteTrackedProductMessage(msg: any, botToken: string) {
  try {
    if (msg.webhook_id && msg.webhook_token) {
      await fetch(`${DISCORD_API}/webhooks/${msg.webhook_id}/${msg.webhook_token}/messages/${msg.message_id}`, {
        method: "DELETE",
      });
      return;
    }

    await fetch(`${DISCORD_API}/channels/${msg.channel_id}/messages/${msg.message_id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });
  } catch (err) {
    console.error(`Failed to delete old product message ${msg.message_id}:`, err);
  }
}

// ── Build product embed payload (shared between post & sync) ──
async function buildProductPayload(
  supabase: any,
  tenant_id: string,
  product_id: string,
  botToken: string,
  tenant: any,
  storeConfig: any,
) {
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", product_id)
    .eq("tenant_id", tenant_id)
    .single();

  if (!product) throw new Error("Produto não encontrado");

  const embedConfig = product.embed_config && typeof product.embed_config === "object" ? product.embed_config : {};
  const productColor = embedConfig.color;
  const storeColor = storeConfig?.embed_color;
  const finalColor = productColor || storeColor || "#2B2D31";
  const isDefaultColor = !finalColor || finalColor === "#2B2D31";
  const lang: Lang = normLang(tenant?.language);

  // Delivery badge
  const showDeliveryBadge = embedConfig.show_delivery_badge !== false;
  let deliveryLine = "";
  if (showDeliveryBadge) {
    if (product.auto_delivery) {
      deliveryLine = (embedConfig.delivery_auto_text || tr(lang, "delivery_auto")) + "\n\n";
    } else {
      deliveryLine = (embedConfig.delivery_manual_text || tr(lang, "delivery_manual")) + "\n\n";
    }
  }

  const embed: Record<string, any> = {
    title: product.name,
    description: `${deliveryLine}${product.description || ""}`,
    fields: [],
  };

  // Price field
  if (embedConfig.show_price !== false) {
    const priceLabel = embedConfig.price_label || tr(lang, "price_label");
    embed.fields.push({
      name: `**${priceLabel}**`,
      value: `\`R$ ${(product.price_cents / 100).toFixed(2).replace(".", ",")}\``,
      inline: true,
    });
  }

  // Stock count
  const { count: realStockCount } = await supabase
    .from("product_stock_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", product_id)
    .eq("tenant_id", tenant_id)
    .eq("delivered", false);

  // Stock field
  if (embedConfig.show_stock_field !== false) {
    const stockLabel = embedConfig.stock_label || tr(lang, "stock_label");
    embed.fields.push({
      name: stockLabel,
      value: `\`${realStockCount ?? 0}\``,
      inline: true,
    });
  }

  // Footer
  if (embedConfig.show_footer !== false) {
    const stock = realStockCount ?? 0;
    const localeMap: Record<Lang, string> = { "pt-BR": "pt-BR", en: "en-US", de: "de-DE" };
    const dateStr = new Date().toLocaleString(localeMap[lang]);
    let footerText: string;
    if (stock > 0 && embedConfig.footer_available_text) {
      footerText = embedConfig.footer_available_text
        .replace(/\{loja\}/gi, tenant?.name || "Loja")
        .replace(/\{data\}/gi, dateStr);
    } else if (stock <= 0 && embedConfig.footer_unavailable_text) {
      footerText = embedConfig.footer_unavailable_text
        .replace(/\{loja\}/gi, tenant?.name || "Loja")
        .replace(/\{data\}/gi, dateStr);
    } else if (embedConfig.footer_text) {
      footerText = embedConfig.footer_text
        .replace(/\{loja\}/gi, tenant?.name || "Loja")
        .replace(/\{data\}/gi, dateStr);
    } else {
      footerText = `${tenant?.name || "Loja"} • ${dateStr}`;
    }
    embed.footer = { text: footerText };
  }

  if (!isDefaultColor) {
    embed.color = parseInt(finalColor.replace("#", ""), 16);
  }
  if (product.banner_url) {
    embed.image = { url: product.banner_url };
  }
  if (product.icon_url) embed.thumbnail = { url: product.icon_url };

  // Button
  const styleMap: Record<string, number> = {
    primary: 1, secondary: 2, success: 3, danger: 4, link: 2, glass: 2,
  };
  const discordBuyStyle = styleMap[product.button_style || "success"] || 3;
  const rawBuyLabel = embedConfig.buy_button_label || "";
  const normalizedBuyLabel = rawBuyLabel.trim();
  const defaultBuyEmoji = tr(lang, "buy_emoji");
  const defaultBuyText = tr(lang, "buy");
  const finalBuyLabel = !normalizedBuyLabel || normalizedBuyLabel.toLowerCase() === "comprar" || normalizedBuyLabel.toLowerCase() === "buy" || normalizedBuyLabel.toLowerCase() === "kaufen" ? defaultBuyEmoji : rawBuyLabel;
  const { emoji: btnEmoji, cleanLabel: btnLabel, isCustom, customId, customName, animated } = parseEmojiFromLabel(finalBuyLabel);

  const buyButton: any = {
    type: 2,
    style: discordBuyStyle,
    label: btnLabel || defaultBuyText,
    custom_id: `buy_product:${product_id}`,
  };

  if (btnEmoji) {
    if (isCustom && customId) {
      buyButton.emoji = { id: customId, name: customName, animated: !!animated };
    } else {
      buyButton.emoji = { name: btnEmoji };
    }
  }

  // Fields (variations) check
  const { data: fields } = await supabase
    .from("product_fields")
    .select("id")
    .eq("product_id", product_id)
    .eq("tenant_id", tenant_id);

  const payload: Record<string, any> = {
    embeds: [embed],
    components: [{ type: 1, components: [buyButton] }],
  };

  return payload;
}

// ── Sync all posted messages for a product ──
async function syncProductMessages(
  supabase: any,
  tenant_id: string,
  product_id: string,
  botToken: string,
) {
  // Fetch tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("bot_name, bot_avatar_url, banner_url, name, language")
    .eq("id", tenant_id)
    .single();

  // Fetch store config
  const { data: storeConfig } = await supabase
    .from("store_configs")
    .select("embed_color")
    .eq("tenant_id", tenant_id)
    .single();

  const payload = await buildProductPayload(supabase, tenant_id, product_id, botToken, tenant, storeConfig);

  // Fetch all tracked messages for this product
  const { data: messages, error: msgError } = await supabase
    .from("product_messages")
    .select("*")
    .eq("tenant_id", tenant_id)
    .eq("product_id", product_id);

  if (msgError) throw new Error("Erro ao buscar mensagens: " + msgError.message);
  if (!messages || messages.length === 0) {
    return { synced: 0, total: 0, message: "Nenhuma mensagem encontrada para sincronizar." };
  }

  let synced = 0;
  let failed = 0;
  const toDelete: string[] = [];

  for (const msg of messages) {
    try {
      if (msg.webhook_id && msg.webhook_token) {
        const newMessageId = await sendBotMessage(msg.channel_id, botToken, payload);

        const { error: updateError } = await supabase
          .from("product_messages")
          .update({
            message_id: newMessageId,
            webhook_id: null,
            webhook_token: null,
          })
          .eq("id", msg.id);

        if (updateError) {
          throw new Error(`Erro ao atualizar rastreamento da mensagem: ${updateError.message}`);
        }

        await deleteTrackedProductMessage(msg, botToken);
        synced++;
        continue;
      }

      let editUrl: string;
      let headers: Record<string, string>;
      let body: Record<string, any>;

      editUrl = `${DISCORD_API}/channels/${msg.channel_id}/messages/${msg.message_id}`;
      headers = {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      };
      body = payload;

      const res = await fetch(editUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        synced++;
      } else {
        const status = res.status;
        console.error(`Failed to edit message ${msg.message_id}: ${status}`);
        // If message not found (deleted), remove from tracking
        if (status === 404 || status === 10008) {
          toDelete.push(msg.id);
        }
        failed++;
      }
    } catch (err) {
      console.error(`Error syncing message ${msg.message_id}:`, err);
      failed++;
    }
  }

  // Clean up deleted messages
  if (toDelete.length > 0) {
    await supabase.from("product_messages").delete().in("id", toDelete);
  }

  return { synced, failed, total: messages.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;
    if (!botToken) throw new Error("Bot externo não configurado (DISCORD_BOT_TOKEN)");

    // ── SYNC ACTION ──
    if (action === "sync") {
      const { tenant_id, product_id } = body;
      if (!tenant_id || !product_id) throw new Error("Missing tenant_id or product_id");

      const result = await syncProductMessages(supabase, tenant_id, product_id, botToken);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST ACTION (default) ──
    const { tenant_id, channel_id, content, embeds, product_id, components, buttons } = body;

    if (!tenant_id) throw new Error("Missing tenant_id");
    if (!channel_id) throw new Error("Missing channel_id");
    if (!content && (!embeds || embeds.length === 0)) {
      throw new Error("Missing content or embeds");
    }

    // Fetch tenant customization
    const { data: tenant } = await supabase
      .from("tenants")
      .select("bot_name, bot_avatar_url, banner_url, name, language")
      .eq("id", tenant_id)
      .single();

    const botUserId = await getBotUserId(botToken);

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

      const pEmbedConfig = product?.embed_config && typeof product.embed_config === "object" ? product.embed_config : {};
      const lang2: Lang = normLang(tenant?.language);

      if (embeds && embeds.length > 0) {
        embeds[0].fields = embeds[0].fields || [];

        // Update or add price field using custom label
        if (pEmbedConfig.show_price !== false) {
          const priceLabel = pEmbedConfig.price_label || tr(lang2, "price_label");
          const existingPriceIdx = embeds[0].fields.findIndex(
            (f: any) => typeof f?.name === "string" && (f.name.toLowerCase().includes("valor") || f.name.toLowerCase().includes("preço") || f.name.toLowerCase().includes("price") || f.name.toLowerCase().includes("preis"))
          );
          const priceField = {
            name: `**${priceLabel}**`,
            value: embeds[0].fields[existingPriceIdx]?.value || "",
            inline: true,
          };
          if (existingPriceIdx >= 0) {
            embeds[0].fields[existingPriceIdx] = priceField;
          }
        }

        // Update or add stock field using custom label
        if (pEmbedConfig.show_stock_field !== false) {
          const stockLabel = pEmbedConfig.stock_label || tr(lang2, "stock_label");
          const stockField = {
            name: stockLabel,
            value: `\`${realStockCount ?? 0}\``,
            inline: true,
          };
          const existingStockIdx = embeds[0].fields.findIndex(
            (field: any) => typeof field?.name === "string" && (field.name.toLowerCase() === "restam" || field.name.toLowerCase().includes("estoque") || field.name.toLowerCase().includes("stock") || field.name.toLowerCase().includes("verfügbar"))
          );
          if (existingStockIdx >= 0) {
            embeds[0].fields[existingStockIdx] = stockField;
          } else {
            embeds[0].fields.push(stockField);
          }
        }
      }

      // Delivery badge using custom text
      if (embeds && embeds.length > 0) {
        const showBadge = pEmbedConfig.show_delivery_badge !== false;
        const currentDesc = embeds[0].description || "";
        const hasBadge = /Entrega|Delivery|Lieferung/i.test(currentDesc);
        if (showBadge && product?.auto_delivery && !hasBadge) {
          const badgeText = pEmbedConfig.delivery_auto_text || tr(lang2, "delivery_auto");
          embeds[0].description = `${badgeText}\n\n${currentDesc}`;
        } else if (showBadge && !product?.auto_delivery && !hasBadge) {
          const badgeText = pEmbedConfig.delivery_manual_text || tr(lang2, "delivery_manual");
          embeds[0].description = `${badgeText}\n\n${currentDesc}`;
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
      const normalizedBuyLabel = rawBuyLabel.trim().toLowerCase();
      const isDefaultLabel = !normalizedBuyLabel || normalizedBuyLabel === "comprar" || normalizedBuyLabel === "buy" || normalizedBuyLabel === "kaufen";
      const finalBuyLabel = isDefaultLabel ? tr(lang2, "buy_emoji") : rawBuyLabel;
      const { emoji: btnEmoji, cleanLabel: btnLabel, isCustom, customId, customName, animated } = parseEmojiFromLabel(finalBuyLabel);

      const buyButton: any = {
        type: 2,
        style: discordBuyStyle,
        label: btnLabel || tr(lang2, "buy"),
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
    } else if (buttons && Array.isArray(buttons) && buttons.length > 0) {
      const styleMap: Record<string, number> = {
        primary: 1, secondary: 2, success: 3, danger: 4, link: 5, glass: 2,
      };
      const btnComponents = buttons.map((btn: any, idx: number) => {
        const comp: any = {
          type: 2,
          style: styleMap[btn.style] || 1,
          label: btn.label || "Botão",
        };
        if (btn.style === "link" && btn.url) {
          comp.url = btn.url;
        } else {
          comp.custom_id = `embed_btn_${idx}_${Date.now()}`;
        }
        if (btn.emoji) {
          const parsed = parseEmojiFromLabel(btn.emoji + " ");
          if (parsed.emoji) {
            if (parsed.isCustom && parsed.customId) {
              comp.emoji = { id: parsed.customId, name: parsed.customName, animated: parsed.animated };
            } else {
              comp.emoji = { name: parsed.emoji };
            }
          }
        }
        return comp;
      });
      payload.components = [{ type: 1, components: btnComponents }];
    } else if (components) {
      payload.components = components;
    }

    let messageId: string | null = null;
    let usedWebhookId: string | null = null;
    let usedWebhookToken: string | null = null;

    if (product_id) {
      messageId = await sendBotMessage(channel_id, botToken, payload);
    } else

    // Try webhook first for custom branding
    if (!product_id && (customBotName || customAvatarUrl)) {
      const webhook = await getOrCreateWebhook(channel_id, botToken, botUserId);
      if (webhook) {
        usedWebhookId = webhook.id;
        usedWebhookToken = webhook.token;
        const webhookPayload: Record<string, any> = { ...payload };
        if (customBotName) webhookPayload.username = customBotName;
        if (customAvatarUrl) webhookPayload.avatar_url = customAvatarUrl;

        const sendRes = await fetch(`${DISCORD_API}/webhooks/${webhook.id}/${webhook.token}?wait=true`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });

        if (sendRes.ok) {
          const message = await sendRes.json();
          messageId = message.id;
        } else {
          const errText = await sendRes.text();
          console.error("Webhook send failed, falling back to Bot API:", sendRes.status, errText);
          usedWebhookId = null;
          usedWebhookToken = null;
          const fallbackRes = await fetch(`${DISCORD_API}/channels/${channel_id}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          if (!fallbackRes.ok) {
            const fallbackErr = await fallbackRes.text();
            throw new Error(`Discord API error: ${fallbackRes.status} - ${fallbackErr}`);
          }
          const message = await fallbackRes.json();
          messageId = message.id;
        }
      } else {
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
          throw new Error(`Discord API error: ${sendRes.status} - ${errText}`);
        }
        const message = await sendRes.json();
        messageId = message.id;
      }
    } else if (!product_id) {
      messageId = await sendBotMessage(channel_id, botToken, payload);
    }

    if (!messageId) {
      throw new Error("Falha ao enviar mensagem para o Discord");
    }

    // Track the posted message for sync functionality
    if (product_id && messageId) {
      await supabase.from("product_messages").insert({
        tenant_id,
        product_id,
        channel_id,
        message_id: messageId,
        webhook_id: usedWebhookId,
        webhook_token: usedWebhookToken,
      }).then(({ error: insertErr }: any) => {
        if (insertErr) console.error("Failed to track message:", insertErr.message);
      });
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
