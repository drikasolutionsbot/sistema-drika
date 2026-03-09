import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCORD_API = "https://discord.com/api/v10";

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { order_id, tenant_id } = await req.json();
    if (!order_id || !tenant_id) throw new Error("Missing order_id or tenant_id");

    // 1. Get order details
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (orderErr || !order) throw new Error("Order not found");
    if (order.status !== "paid") throw new Error("Order is not paid");

    // 2. Get tenant + bot token
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, logo_url, bot_token_encrypted, discord_guild_id")
      .eq("id", tenant_id)
      .single();

    const botToken = tenant?.bot_token_encrypted || Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) throw new Error("No bot token available");

    const guildId = tenant?.discord_guild_id;
    if (!guildId) throw new Error("Guild ID not configured");

    // 3. Determine stock to deliver
    const fieldId = order.field_id;
    let stockItems: any[] = [];

    if (order.product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("*, auto_delivery")
        .eq("id", order.product_id)
        .eq("tenant_id", tenant_id)
        .single();

      if (product?.auto_delivery) {
        let targetFieldId = fieldId;

        if (!targetFieldId) {
          const { data: fields } = await supabase
            .from("product_fields")
            .select("id")
            .eq("product_id", order.product_id)
            .eq("tenant_id", tenant_id)
            .order("sort_order", { ascending: true })
            .limit(1);

          if (fields && fields.length > 0) {
            targetFieldId = fields[0].id;
          }
        }

        if (targetFieldId) {
          const { data: items } = await supabase
            .from("product_stock_items")
            .select("*")
            .eq("field_id", targetFieldId)
            .eq("tenant_id", tenant_id)
            .eq("delivered", false)
            .order("created_at", { ascending: true })
            .limit(1);

          if (items && items.length > 0) {
            stockItems = items;

            const ids = items.map((i: any) => i.id);
            await supabase
              .from("product_stock_items")
              .update({
                delivered: true,
                delivered_at: new Date().toISOString(),
                delivered_to: order.discord_user_id,
              })
              .in("id", ids);
          }
        }
      }
    }

    // 4. Get ticket embed config
    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("logs_channel_id, ticket_embed_title, ticket_embed_description, ticket_embed_color, ticket_embed_image_url, ticket_embed_thumbnail_url, ticket_embed_footer, ticket_channel_id, customer_role_id")
      .eq("tenant_id", tenant_id)
      .single();

    // 5. Create a private ticket channel in the server
    const ticketChannelName = `🎫┃pedido-${order.order_number}`;

    // Get bot's own user ID for permissions
    const botMeRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    const botMe = await botMeRes.json();

    // Permission overwrites: deny @everyone, allow buyer + bot
    const permissionOverwrites = [
      {
        id: guildId, // @everyone role (same as guild id)
        type: 0, // role
        deny: "1024", // VIEW_CHANNEL
        allow: "0",
      },
      {
        id: order.discord_user_id, // buyer
        type: 1, // member
        allow: "3072", // VIEW_CHANNEL + SEND_MESSAGES
        deny: "0",
      },
      {
        id: botMe.id, // bot
        type: 1, // member
        allow: "3072",
        deny: "0",
      },
    ];

    // If there's a ticket category channel configured, use it as parent
    const channelPayload: any = {
      name: ticketChannelName,
      type: 0, // text channel
      permission_overwrites: permissionOverwrites,
    };

    if (storeConfig?.ticket_channel_id) {
      channelPayload.parent_id = storeConfig.ticket_channel_id;
    }

    const createChannelRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(channelPayload),
    });

    if (!createChannelRes.ok) {
      const errText = await createChannelRes.text();
      console.error("Failed to create ticket channel:", errText);
      throw new Error(`Failed to create ticket channel: ${createChannelRes.status}`);
    }

    const ticketChannel = await createChannelRes.json();
    console.log(`Ticket channel created: ${ticketChannel.id}`);

    // 6. Create ticket record in database
    await supabase.from("tickets").insert({
      tenant_id,
      discord_user_id: order.discord_user_id,
      discord_username: order.discord_username || null,
      order_id: order.id,
      product_name: order.product_name,
      status: "open",
    });

    // 7. Build and send embed in the ticket channel
    const embedColor = storeConfig?.ticket_embed_color
      ? parseInt(storeConfig.ticket_embed_color.replace("#", ""), 16)
      : 0x57F287;

    const embedTitle = (storeConfig?.ticket_embed_title || "Compra realizada com sucesso! ✅")
      .replace("{user}", order.discord_username || order.discord_user_id)
      .replace("{product}", order.product_name)
      .replace("{ticket_id}", `${order.order_number}`);

    const embedDescription = (storeConfig?.ticket_embed_description || "Obrigado pela sua compra de **{product}**!")
      .replace("{user}", `<@${order.discord_user_id}>`)
      .replace("{product}", order.product_name)
      .replace("{ticket_id}", `${order.order_number}`);

    const embed: any = {
      title: embedTitle,
      description: embedDescription,
      color: embedColor,
      timestamp: new Date().toISOString(),
      footer: { text: storeConfig?.ticket_embed_footer || tenant?.name || "Loja" },
    };

    if (storeConfig?.ticket_embed_thumbnail_url) {
      embed.thumbnail = { url: storeConfig.ticket_embed_thumbnail_url };
    } else if (tenant?.logo_url) {
      embed.thumbnail = { url: tenant.logo_url };
    }

    if (storeConfig?.ticket_embed_image_url) {
      embed.image = { url: storeConfig.ticket_embed_image_url };
    }

    embed.fields = [
      { name: "📦 Produto", value: order.product_name, inline: true },
      { name: "🔢 Pedido", value: `#${order.order_number}`, inline: true },
      { name: "💰 Total", value: `R$ ${(order.total_cents / 100).toFixed(2)}`, inline: true },
    ];

    // Mention the buyer first
    const mentionContent = `<@${order.discord_user_id}> Seu pedido foi processado! 🎉`;

    // Prepare form data for file attachment
    const formData = new FormData();
    const payload: any = { content: mentionContent, embeds: [embed] };

    if (stockItems.length > 0) {
      const stockContent = stockItems.map((item: any) => item.content).join("\n");
      const blob = new Blob([stockContent], { type: "text/plain" });
      formData.append("files[0]", blob, `pedido-${order.order_number}.txt`);

      embed.fields.push({
        name: "📎 Entrega",
        value: "Seu produto está no arquivo anexado abaixo.",
        inline: false,
      });

      payload.attachments = [{ id: 0, filename: `pedido-${order.order_number}.txt`, description: "Seu produto" }];
    } else if (order.product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("auto_delivery")
        .eq("id", order.product_id)
        .single();

      if (product?.auto_delivery) {
        embed.fields.push({
          name: "📎 Entrega",
          value: "⚠️ Estoque esgotado. Nossa equipe entrará em contato.",
          inline: false,
        });
      }
    }

    formData.append("payload_json", JSON.stringify(payload));

    const sendRes = await fetch(`${DISCORD_API}/channels/${ticketChannel.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}` },
      body: formData,
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("Failed to send message in ticket channel:", errText);
    }

    // 8. Execute product hooks
    if (order.product_id) {
      const { data: hooks } = await supabase
        .from("product_hooks")
        .select("*")
        .eq("product_id", order.product_id)
        .eq("tenant_id", tenant_id)
        .eq("active", true)
        .order("sort_order", { ascending: true });

      if (hooks && hooks.length > 0) {
        for (const hook of hooks) {
          try {
            await executeHook(hook, order, tenant, botToken);
          } catch (hookErr) {
            console.error(`Hook ${hook.hook_type} failed:`, hookErr);
          }
        }
      }
    }

    // 9. Auto-assign customer role if configured
    if (storeConfig?.customer_role_id) {
      try {
        const roleRes = await fetch(
          `${DISCORD_API}/guilds/${guildId}/members/${order.discord_user_id}/roles/${storeConfig.customer_role_id}`,
          {
            method: "PUT",
            headers: { Authorization: `Bot ${botToken}` },
          }
        );
        console.log(`Auto-assign customer role ${storeConfig.customer_role_id}: ${roleRes.status}`);
      } catch (roleErr) {
        console.error("Failed to assign customer role:", roleErr);
      }
    }

    // 10. Update order status to delivered
    await supabase
      .from("orders")
      .update({ status: "delivered", updated_at: new Date().toISOString() })
      .eq("id", order_id)
      .eq("tenant_id", tenant_id);

    // 11. Log to store logs channel if configured — detailed embed like reference
    if (storeConfig?.logs_channel_id) {
      try {
        // Build detailed delivery log embed
        const deliveryLogEmbed: any = {
          title: "🚀 Entrega realizada!",
          description: `Usuário <@${order.discord_user_id}> teve seu pedido entregue.`,
          color: 0x57F287,
          fields: [
            { name: "**Detalhes**", value: `${stockItems.length}x ${order.product_name} | ${formatBRL(order.total_cents)}`, inline: false },
            { name: "**ID do Pedido**", value: order.id, inline: false },
          ],
          footer: { text: `${tenant?.name || "Loja"} • ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` },
          timestamp: new Date().toISOString(),
        };

        if (order.payment_provider) {
          deliveryLogEmbed.fields.push({
            name: "**Forma de Pagamento**",
            value: `💎 ${order.payment_provider === "pushinpay" ? "Pix - PushinPay" : order.payment_provider === "efi" ? "Pix - Efi Bank" : order.payment_provider === "mercadopago" ? "Pix - Mercado Pago" : order.payment_provider}`,
            inline: false,
          });
        }

        if (tenant?.logo_url) {
          deliveryLogEmbed.thumbnail = { url: tenant.logo_url };
        }

        // Send with stock file attached if there are items
        if (stockItems.length > 0) {
          const stockContent = stockItems.map((item: any) => item.content).join("\n");
          const blob = new Blob([stockContent], { type: "text/plain" });
          const logFormData = new FormData();
          logFormData.append("files[0]", blob, `pedido-${order.order_number}.txt`);

          const logPayload: any = {
            embeds: [deliveryLogEmbed],
            attachments: [{ id: 0, filename: `pedido-${order.order_number}.txt`, description: "Conteúdo entregue" }],
          };

          logFormData.append("payload_json", JSON.stringify(logPayload));

          await fetch(`${DISCORD_API}/channels/${storeConfig.logs_channel_id}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}` },
            body: logFormData,
          });
        } else {
          await fetch(`${DISCORD_API}/channels/${storeConfig.logs_channel_id}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ embeds: [deliveryLogEmbed] }),
          });
        }
      } catch (logErr) {
        console.error("Failed to send delivery log:", logErr);
      }
    }

    const result = {
      success: true,
      order_id,
      items_delivered: stockItems.length,
      ticket_channel_id: ticketChannel.id,
    };

    console.log("deliver-order result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("deliver-order error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Hook executor ─────────────────────────────────────────────────
async function executeHook(hook: any, order: any, tenant: any, botToken: string) {
  const config = hook.config || {};
  const guildId = tenant?.discord_guild_id;

  switch (hook.hook_type) {
    case "add_role": {
      if (!guildId || !config.role_id) return;
      await fetch(
        `${DISCORD_API}/guilds/${guildId}/members/${order.discord_user_id}/roles/${config.role_id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bot ${botToken}` },
        }
      );
      console.log(`Hook: added role ${config.role_id} to ${order.discord_user_id}`);
      break;
    }

    case "remove_role": {
      if (!guildId || !config.role_id) return;
      await fetch(
        `${DISCORD_API}/guilds/${guildId}/members/${order.discord_user_id}/roles/${config.role_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bot ${botToken}` },
        }
      );
      console.log(`Hook: removed role ${config.role_id} from ${order.discord_user_id}`);
      break;
    }

    case "send_dm": {
      if (!config.message) return;
      const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipient_id: order.discord_user_id }),
      });
      if (dmRes.ok) {
        const dm = await dmRes.json();
        const msg = config.message
          .replace("{user}", `<@${order.discord_user_id}>`)
          .replace("{product}", order.product_name)
          .replace("{order}", `#${order.order_number}`);
        await fetch(`${DISCORD_API}/channels/${dm.id}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: msg }),
        });
      }
      break;
    }

    case "send_channel_message": {
      if (!config.channel_id || !config.message) return;
      const msg = config.message
        .replace("{user}", `<@${order.discord_user_id}>`)
        .replace("{product}", order.product_name)
        .replace("{order}", `#${order.order_number}`);
      await fetch(`${DISCORD_API}/channels/${config.channel_id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: msg }),
      });
      break;
    }

    case "call_webhook": {
      if (!config.url) return;
      await fetch(config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          order_number: order.order_number,
          product_name: order.product_name,
          discord_user_id: order.discord_user_id,
          total_cents: order.total_cents,
        }),
      });
      break;
    }
  }
}
