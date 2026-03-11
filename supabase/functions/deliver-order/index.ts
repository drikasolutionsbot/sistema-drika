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

    // 3. Get product details + determine delivery type
    let isAutoDelivery = false;
    let stockItems: any[] = [];
    const fieldId = order.field_id;

    if (order.product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("*, auto_delivery")
        .eq("id", order.product_id)
        .eq("tenant_id", tenant_id)
        .single();

      isAutoDelivery = !!product?.auto_delivery;

      if (isAutoDelivery) {
        let targetFieldId = fieldId;
        let deliveryQty = 1;

        if (!targetFieldId) {
          const { data: fields } = await supabase
            .from("product_fields")
            .select("id, delivery_quantity")
            .eq("product_id", order.product_id)
            .eq("tenant_id", tenant_id)
            .order("sort_order", { ascending: true })
            .limit(1);

          if (fields && fields.length > 0) {
            targetFieldId = fields[0].id;
            deliveryQty = fields[0].delivery_quantity || 1;
          }
        } else {
          // Fetch delivery_quantity for the specific field
          const { data: fieldData } = await supabase
            .from("product_fields")
            .select("delivery_quantity")
            .eq("id", targetFieldId)
            .eq("tenant_id", tenant_id)
            .single();

          if (fieldData) {
            deliveryQty = fieldData.delivery_quantity || 1;
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
            .limit(deliveryQty);

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

    // 4. Get store config
    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("logs_channel_id, sales_channel_id, ticket_embed_title, ticket_embed_description, ticket_embed_color, ticket_embed_image_url, ticket_embed_thumbnail_url, ticket_embed_footer, ticket_channel_id, customer_role_id, purchase_embed_color, purchase_embed_title, purchase_embed_description, purchase_embed_footer, purchase_embed_image_url, purchase_embed_thumbnail_url")
      .eq("tenant_id", tenant_id)
      .single();

    // 5. Create a private thread for the delivery
    // Resolve parent text channel from ticket_channel_id config
    let parentChannelId: string | null = null;
    const configuredChannelId = storeConfig?.ticket_channel_id || null;

    if (configuredChannelId) {
      try {
        const chInfoRes = await fetch(`${DISCORD_API}/channels/${configuredChannelId}`, {
          headers: { Authorization: `Bot ${botToken}` },
        });
        if (chInfoRes.ok) {
          const chInfo = await chInfoRes.json();
          if (chInfo.type === 4) {
            // Category — find first text channel inside
            const guildChRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
              headers: { Authorization: `Bot ${botToken}` },
            });
            if (guildChRes.ok) {
              const allChannels = await guildChRes.json();
              const textCh = allChannels.find((c: any) => c.parent_id === configuredChannelId && c.type === 0);
              if (textCh) parentChannelId = textCh.id;
            }
          } else if (chInfo.type === 0 || chInfo.type === 5) {
            parentChannelId = configuredChannelId;
          }
        }
      } catch (e) {
        console.error("Error resolving ticket channel:", e);
      }
    }

    // Fallback: try to find any text channel if no config
    if (!parentChannelId) {
      try {
        const guildChRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
          headers: { Authorization: `Bot ${botToken}` },
        });
        if (guildChRes.ok) {
          const allChannels = await guildChRes.json();
          const generalCh = allChannels.find((c: any) => c.type === 0);
          if (generalCh) parentChannelId = generalCh.id;
        }
      } catch (e) {
        console.error("Error finding fallback channel:", e);
      }
    }

    if (!parentChannelId) throw new Error("No text channel available for creating delivery thread");

    // Create private thread
    const deliveryLabel = isAutoDelivery ? "⚡" : "📦";
    const threadName = `${deliveryLabel}┃pedido-${order.order_number}`;

    const createThreadRes = await fetch(`${DISCORD_API}/channels/${parentChannelId}/threads`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: threadName.substring(0, 100),
        type: 12, // GUILD_PRIVATE_THREAD
        auto_archive_duration: 10080,
      }),
    });

    if (!createThreadRes.ok) {
      const errText = await createThreadRes.text();
      console.error("Failed to create delivery thread:", errText);
      throw new Error(`Failed to create delivery thread: ${createThreadRes.status}`);
    }

    const ticketThread = await createThreadRes.json();
    console.log(`Delivery thread created: ${ticketThread.id}`);

    // Add buyer to the thread
    await fetch(`${DISCORD_API}/channels/${ticketThread.id}/thread-members/${order.discord_user_id}`, {
      method: "PUT",
      headers: { Authorization: `Bot ${botToken}` },
    });

    // 6. Create ticket record in database
    await supabase.from("tickets").insert({
      tenant_id,
      discord_user_id: order.discord_user_id,
      discord_username: order.discord_username || null,
      discord_channel_id: ticketThread.id,
      order_id: order.id,
      product_name: order.product_name,
      status: isAutoDelivery && stockItems.length > 0 ? "delivered" : "open",
    });

    // 7. Build delivery embed
    const embedColor = parseInt((storeConfig?.purchase_embed_color || "#57F287").replace("#", ""), 16);

    const deliveryTypeLabel = isAutoDelivery ? "⚡ Entrega Automática" : "📦 Entrega Manual";
    const deliveryStatusText = isAutoDelivery
      ? (stockItems.length > 0
        ? "Seu produto foi entregue automaticamente! Confira o arquivo anexo abaixo."
        : "⚠️ Estoque esgotado. Nossa equipe entrará em contato.")
      : "Sua compra foi registrada! Aguarde a entrega pela nossa equipe.";

    const embed: any = {
      title: storeConfig?.purchase_embed_title || "Compra realizada! ✅",
      description: deliveryStatusText,
      color: embedColor,
      timestamp: new Date().toISOString(),
      footer: { text: storeConfig?.purchase_embed_footer || tenant?.name || "Loja" },
      fields: [
        { name: "📦 Produto", value: order.product_name, inline: true },
        { name: "🔢 Pedido", value: `#${order.order_number}`, inline: true },
        { name: "💰 Total", value: formatBRL(order.total_cents), inline: true },
        { name: "🚚 Tipo de Entrega", value: deliveryTypeLabel, inline: true },
      ],
    };

    if (storeConfig?.purchase_embed_thumbnail_url) {
      embed.thumbnail = { url: storeConfig.purchase_embed_thumbnail_url };
    } else if (tenant?.logo_url) {
      embed.thumbnail = { url: tenant.logo_url };
    }

    if (storeConfig?.purchase_embed_image_url) {
      embed.image = { url: storeConfig.purchase_embed_image_url };
    }

    // Mention the buyer
    const mentionContent = `<@${order.discord_user_id}> Seu pedido foi processado! 🎉`;

    // Send message (with file if auto-delivery with stock)
    const formData = new FormData();
    const payload: any = { content: mentionContent, embeds: [embed] };

    if (isAutoDelivery && stockItems.length > 0) {
      const stockContent = stockItems.map((item: any) => item.content).join("\n");
      const blob = new Blob([stockContent], { type: "text/plain" });
      formData.append("files[0]", blob, `pedido-${order.order_number}.txt`);
      payload.attachments = [{ id: 0, filename: `pedido-${order.order_number}.txt`, description: "Seu produto" }];
    }

    formData.append("payload_json", JSON.stringify(payload));

    const sendRes = await fetch(`${DISCORD_API}/channels/${ticketThread.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}` },
      body: formData,
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("Failed to send delivery message:", errText);
    }

    // For manual delivery: send a staff notification message
    if (!isAutoDelivery) {
      await fetch(`${DISCORD_API}/channels/${ticketThread.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "📋 Entrega Manual Pendente",
            description: `Este pedido requer entrega manual.\n\nPor favor, realize a entrega do produto e clique em **Marcar como Entregue** quando finalizar.`,
            color: 0xFEE75C,
            fields: [
              { name: "👤 Comprador", value: `<@${order.discord_user_id}>`, inline: true },
              { name: "📦 Produto", value: order.product_name, inline: true },
            ],
          }],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 3, // Success (green)
                  label: "Marcar como Entregue",
                  custom_id: `mark_delivered_${order.id}`,
                },
                {
                  type: 2,
                  style: 4, // Danger (red)
                  label: "Cancelar Pedido",
                  custom_id: `cancel_manual_${order.id}`,
                },
              ],
            },
          ],
        }),
      });
    }

    // If auto-delivery was successful, archive thread after a delay
    if (isAutoDelivery && stockItems.length > 0) {
      // Send a completion message
      await fetch(`${DISCORD_API}/channels/${ticketThread.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "✅ Entrega Concluída",
            description: "Seu produto foi entregue automaticamente! Se precisar de ajuda, entre em contato.",
            color: 0x57F287,
          }],
        }),
      });
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

    // 10. Update order status
    const newStatus = isAutoDelivery && stockItems.length > 0 ? "delivered" : "paid";
    await supabase
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", order_id)
      .eq("tenant_id", tenant_id);

    // 11. Log to store logs channel
    if (storeConfig?.logs_channel_id) {
      try {
        const deliveryLogEmbed: any = {
          title: isAutoDelivery ? "⚡ Entrega Automática" : "📦 Entrega Manual Pendente",
          description: isAutoDelivery
            ? `Usuário <@${order.discord_user_id}> teve seu pedido entregue automaticamente.`
            : `Pedido de <@${order.discord_user_id}> aguardando entrega manual.`,
          color: isAutoDelivery ? 0x57F287 : 0xFEE75C,
          fields: [
            { name: "**Detalhes**", value: `${stockItems.length > 0 ? `${stockItems.length}x ` : ""}${order.product_name} | ${formatBRL(order.total_cents)}`, inline: false },
            { name: "**ID do Pedido**", value: order.id, inline: false },
            { name: "**Tipo**", value: isAutoDelivery ? "⚡ Automática" : "📦 Manual", inline: true },
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

        // Send with stock file attached if auto-delivery
        if (isAutoDelivery && stockItems.length > 0) {
          const stockContent = stockItems.map((item: any) => item.content).join("\n");
          const blob = new Blob([stockContent], { type: "text/plain" });
          const logFormData = new FormData();
          logFormData.append("files[0]", blob, `pedido-${order.order_number}.txt`);
          logFormData.append("payload_json", JSON.stringify({
            embeds: [deliveryLogEmbed],
            attachments: [{ id: 0, filename: `pedido-${order.order_number}.txt`, description: "Conteúdo entregue" }],
          }));

          await fetch(`${DISCORD_API}/channels/${storeConfig.logs_channel_id}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}` },
            body: logFormData,
          });
        } else {
          await fetch(`${DISCORD_API}/channels/${storeConfig.logs_channel_id}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ embeds: [deliveryLogEmbed] }),
          });
        }
      } catch (logErr) {
        console.error("Failed to send delivery log:", logErr);
      }
    }

    // 12. Send public sales announcement
    if (storeConfig?.sales_channel_id) {
      try {
        const salesEmbedColor = storeConfig?.purchase_embed_color
          ? parseInt(storeConfig.purchase_embed_color.replace("#", ""), 16)
          : 0xFF69B4;

        const salesEmbed: any = {
          author: {
            name: tenant?.name || "Loja",
            icon_url: tenant?.logo_url || undefined,
          },
          description: [
            `**${order.discord_username || order.discord_user_id}**`,
            "",
            "🛒 **Compra Realizada!**",
            "",
            "**Carrinho**",
            `1x ${order.product_name}`,
            "",
            "**Valor pago**",
            `R$ ${(order.total_cents / 100).toFixed(2).replace(".", ",")}`,
          ].join("\n"),
          color: salesEmbedColor,
          footer: {
            text: `${tenant?.name || "Loja"} • ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
            icon_url: tenant?.logo_url || undefined,
          },
          timestamp: new Date().toISOString(),
        };

        if (storeConfig?.purchase_embed_thumbnail_url) {
          salesEmbed.thumbnail = { url: storeConfig.purchase_embed_thumbnail_url };
        }
        if (storeConfig?.purchase_embed_image_url) {
          salesEmbed.image = { url: storeConfig.purchase_embed_image_url };
        }

        const salesPayload: any = {
          embeds: [salesEmbed],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5, // Link
                  label: "Comprar",
                  url: `https://discord.com/channels/${guildId}`,
                },
              ],
            },
          ],
        };

        await fetch(`${DISCORD_API}/channels/${storeConfig.sales_channel_id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(salesPayload),
        });
        console.log("Sales announcement sent");
      } catch (salesErr) {
        console.error("Failed to send sales announcement:", salesErr);
      }
    }

    const result = {
      success: true,
      order_id,
      delivery_type: isAutoDelivery ? "automatic" : "manual",
      items_delivered: stockItems.length,
      ticket_thread_id: ticketThread.id,
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
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
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
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
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
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
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