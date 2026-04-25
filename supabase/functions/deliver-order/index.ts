import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tr, trf, normLang } from "../_shared/i18n.ts";

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

    // 2. Get tenant + external bot token
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, logo_url, discord_guild_id, bot_name, bot_avatar_url, language")
      .eq("id", tenant_id)
      .single();
    const lang = normLang((tenant as any)?.language);

    // Identidade da loja para embeds em DM (DM usa perfil global do bot;
    // por isso aplicamos a marca no embed via author + footer)
    const storeBrand = {
      name: tenant?.bot_name || tenant?.name || "Loja",
      icon_url: tenant?.bot_avatar_url || tenant?.logo_url || undefined,
    };

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;
    if (!botToken) throw new Error("Bot externo não configurado (DISCORD_BOT_TOKEN)");

    const guildId = tenant?.discord_guild_id;
    if (!guildId) throw new Error("Guild ID not configured");

    // 3. Get product details + determine delivery type
    let isAutoDelivery = false;
    let stockItems: any[] = [];
    const fieldId = order.field_id;
    let product: any = null;

    if (order.product_id) {
      const { data: productData } = await supabase
        .from("products")
        .select("*, auto_delivery")
        .eq("id", order.product_id)
        .eq("tenant_id", tenant_id)
        .single();

      product = productData;
      isAutoDelivery = !!product?.auto_delivery;

      if (isAutoDelivery) {
        let deliveryQty = 1;

        if (fieldId) {
          const { data: fieldData } = await supabase
            .from("product_fields")
            .select("delivery_quantity")
            .eq("id", fieldId)
            .eq("tenant_id", tenant_id)
            .single();
          if (fieldData) deliveryQty = fieldData.delivery_quantity || 1;
        } else {
          const { data: fields } = await supabase
            .from("product_fields")
            .select("delivery_quantity")
            .eq("product_id", order.product_id)
            .eq("tenant_id", tenant_id)
            .order("sort_order", { ascending: true })
            .limit(1);
          if (fields && fields.length > 0) deliveryQty = fields[0].delivery_quantity || 1;
        }

        const { data: items } = await supabase
          .from("product_stock_items")
          .select("*")
          .eq("product_id", order.product_id)
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

          // Recalculate real stock count and sync Discord embed
          const { count: realStock } = await supabase
            .from("product_stock_items")
            .select("id", { count: "exact", head: true })
            .eq("product_id", order.product_id)
            .eq("tenant_id", tenant_id)
            .eq("delivered", false);

          await supabase
            .from("products")
            .update({ stock: realStock ?? 0, updated_at: new Date().toISOString() })
            .eq("id", order.product_id)
            .eq("tenant_id", tenant_id);

          // Sync Discord embed (fire-and-forget)
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-webhook-message`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                action: "sync",
                tenant_id,
                product_id: order.product_id,
              }),
            });
          } catch (e) {
            console.error("Failed to sync product embed after delivery:", e);
          }
        }
      }
    }

    // 4. Get store config
    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("logs_channel_id, sales_channel_id, customer_role_id, embed_color, purchase_embed_color, purchase_embed_title, purchase_embed_description, purchase_embed_footer, purchase_embed_image_url, purchase_embed_thumbnail_url")
      .eq("tenant_id", tenant_id)
      .single();

    const rawEmbedColor = storeConfig?.embed_color && storeConfig.embed_color !== "#2B2D31" ? parseInt(storeConfig.embed_color.replace("#", ""), 16) : undefined;
    const rawPurchaseColor = storeConfig?.purchase_embed_color && storeConfig.purchase_embed_color !== "#2B2D31" ? parseInt(storeConfig.purchase_embed_color.replace("#", ""), 16) : undefined;
    const embedColor = rawEmbedColor;
    const purchaseEmbedColor = rawPurchaseColor;

    // ═══════════════════════════════════════════════════════════
    // 5. SEND "Pedido aprovado" in the CHECKOUT THREAD
    // ═══════════════════════════════════════════════════════════
    const checkoutThreadId = order.checkout_thread_id;

    if (checkoutThreadId) {
      // Determine payment provider label
      const providerLabel = order.payment_provider === "pushinpay" ? "PushinPay"
        : order.payment_provider === "efi" ? "EFI Bank"
        : order.payment_provider === "mercadopago" ? "Mercado Pago"
        : order.payment_provider === "misticpay" ? "Mistic Pay"
        : order.payment_provider === "static_pix" ? "PIX Manual"
        : order.payment_provider || "PIX";

      await fetch(`${DISCORD_API}/channels/${checkoutThreadId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: tr(lang, "order_approved_title"),
            description: tr(lang, "order_approved_desc"),
            color: purchaseEmbedColor,
            fields: [
              { name: "**Detalhes**", value: `1x ${order.product_name} | ${formatBRL(order.total_cents)}`, inline: false },
              { name: "**Gateway de Pagamento**", value: providerLabel, inline: true },
              { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: true },
            ],
            footer: {
              text: `${tenant?.name || "Loja"} • Hoje às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
              icon_url: tenant?.logo_url || undefined,
            },
          }],
        }),
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 6. DELIVER VIA DM
    // ═══════════════════════════════════════════════════════════
    let dmChannelId: string | null = null;

    try {
      const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: order.discord_user_id }),
      });
      if (dmRes.ok) {
        const dm = await dmRes.json();
        dmChannelId = dm.id;
      }
    } catch (e) {
      console.error("Failed to open DM channel:", e);
    }

    if (dmChannelId) {
      // 6a. Send "Pagamento confirmado" embed
      const providerLabel = order.payment_provider === "pushinpay" ? "PushinPay"
        : order.payment_provider === "efi" ? "EFI Bank"
        : order.payment_provider === "mercadopago" ? "Mercado Pago"
        : order.payment_provider === "misticpay" ? "Mistic Pay"
        : order.payment_provider || "PIX";

      await fetch(`${DISCORD_API}/channels/${dmChannelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            author: storeBrand,
            title: tr(lang, "payment_confirmed_title"),
            description: trf(lang, "payment_confirmed_desc", { total: formatBRL(order.total_cents) }),
            color: purchaseEmbedColor,
            fields: [
              { name: "**Detalhes**", value: `1x ${order.product_name}`, inline: false },
              { name: "**Gateway de Pagamento**", value: providerLabel, inline: true },
              { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: true },
            ],
            footer: {
              text: `${storeBrand.name} • Hoje às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
              icon_url: storeBrand.icon_url,
            },
          }],
        }),
      });

      // 6b. Send stock content + .txt file (auto-delivery)
      if (isAutoDelivery && stockItems.length > 0) {
        const stockContent = stockItems.map((item: any) => item.content).join("\n");

        // Send stock content as plain text first
        await fetch(`${DISCORD_API}/channels/${dmChannelId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ content: stockContent }),
        });

        // Send .txt file attachment
        const blob = new Blob([stockContent], { type: "text/plain" });
        const formData = new FormData();
        formData.append("files[0]", blob, `${order.id}.txt`);
        formData.append("payload_json", JSON.stringify({
          attachments: [{ id: 0, filename: `${order.id}.txt`, description: "Produto entregue" }],
        }));

        await fetch(`${DISCORD_API}/channels/${dmChannelId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}` },
          body: formData,
        });
      }

      // 6c. Send "Entrega Realizada" embed with action buttons
      const deliveryEmbed: any = {
        author: storeBrand,
        title: `${tr(lang, "order_label")} #${order.id}`,
        description: isAutoDelivery && stockItems.length > 0
          ? "**Entrega Realizada**\nSeu produto foi anexado a essa mensagem"
          : isAutoDelivery
          ? "**Estoque Esgotado**\n⚠️ Não há estoque disponível. Nossa equipe entrará em contato."
          : "**Entrega Manual**\nSua compra foi registrada! Aguarde a entrega pela equipe.",
        color: embedColor,
        fields: [
          { name: "**Detalhes**", value: `1x ${order.product_name} | ${formatBRL(order.total_cents)}`, inline: false },
        ],
        footer: {
          text: `${storeBrand.name} • Hoje às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
          icon_url: storeBrand.icon_url,
        },
      };

      const dmButtons: any[] = [];

      if (isAutoDelivery && stockItems.length > 0) {
        dmButtons.push({
          type: 1,
          components: [
            { type: 2, style: 3, label: "Copiar produto entregue", emoji: { name: "📋" }, custom_id: `copy_delivered:${order.id}` },
          ],
        });
      }


      await fetch(`${DISCORD_API}/channels/${dmChannelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [deliveryEmbed],
          components: dmButtons,
        }),
      });

      // ─── Segunda mensagem: pedido de avaliação (estilo referência) ───
      const buyerMention = `<@${order.discord_user_id}>`;
      await fetch(`${DISCORD_API}/channels/${dmChannelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Avalie o serviço de ${buyerMention} sobre este produto.\n-# Sua avaliação é muito importante para reputação dessa loja.`,
          components: [{
            type: 1,
            components: [
              { type: 2, style: 1, label: "Deixe seu feedback", emoji: { name: "⭐" }, custom_id: `feedback_open:${order.id}` },
            ],
          }],
          allowed_mentions: { parse: [] },
        }),
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 7. UPDATE CHECKOUT THREAD: completion + rename + archive
    // ═══════════════════════════════════════════════════════════
    if (checkoutThreadId && isAutoDelivery && stockItems.length > 0) {
      // Send completion message in checkout thread
      const dmLink = dmChannelId
        ? `https://discord.com/channels/@me/${dmChannelId}`
        : `https://discord.com/channels/@me`;

      await fetch(`${DISCORD_API}/channels/${checkoutThreadId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            description: `✅ **Entrega realizada!** Verifique seu privado, esse ticket será excluído **em 2 minutos**`,
            color: 0x2B2D31,
          }],
          components: [
            {
              type: 1,
              components: [{
                type: 2,
                style: 5,
                label: "Ir para o pedido entregue",
                url: dmLink,
              }],
            },
          ],
        }),
      });

      // Rename thread to ✅ prefix
      try {
        const newName = `✅ • ${order.discord_username || order.discord_user_id} • ${order.order_number}`;
        await fetch(`${DISCORD_API}/channels/${checkoutThreadId}`, {
          method: "PATCH",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.substring(0, 100) }),
        });
      } catch {}

      // Archive after 2 minutes
      setTimeout(async () => {
        try {
          await fetch(`${DISCORD_API}/channels/${checkoutThreadId}`, {
            method: "PATCH",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ archived: true, locked: true }),
          });
        } catch {}
      }, 120000);
    } else if (checkoutThreadId && (!isAutoDelivery || (isAutoDelivery && stockItems.length === 0))) {
      // Manual delivery OR auto-delivery with no stock: keep thread open with staff notification
      const isOutOfStock = isAutoDelivery && stockItems.length === 0;
      const embedTitle = isOutOfStock ? "⚠️ Estoque Esgotado — Entrega Pendente" : "📋 Entrega Manual Pendente";
      const embedDesc = isOutOfStock
        ? `O pagamento foi aprovado, mas **não há estoque disponível** para entrega automática.\n\nPor favor, reponha o estoque ou realize a entrega manualmente e clique em **Marcar como Entregue**.`
        : `Este pedido requer entrega manual.\n\nPor favor, realize a entrega do produto e clique em **Marcar como Entregue** quando finalizar.`;

      await fetch(`${DISCORD_API}/channels/${checkoutThreadId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: embedTitle,
            description: embedDesc,
            color: 0xFEE75C,
            fields: [
              { name: "👤 Comprador", value: `<@${order.discord_user_id}>`, inline: true },
              { name: "📦 Produto", value: order.product_name, inline: true },
            ],
          }],
          components: [{
            type: 1,
            components: [
              { type: 2, style: 3, label: "Marcar como Entregue", custom_id: `mark_delivered_${order.id}` },
              { type: 2, style: 4, label: "Cancelar Pedido", custom_id: `cancel_manual_${order.id}` },
            ],
          }],
        }),
      });
    }

    // 8. (Hooks removed)

    // 9. Auto-assign customer role (global)
    if (storeConfig?.customer_role_id) {
      try {
        await fetch(
          `${DISCORD_API}/guilds/${guildId}/members/${order.discord_user_id}/roles/${storeConfig.customer_role_id}`,
          { method: "PUT", headers: { Authorization: `Bot ${botToken}` } }
        );
      } catch (roleErr) {
        console.error("Failed to assign customer role:", roleErr);
      }
    }

    // 9b. Auto-assign product-specific role
    if (product?.role_id) {
      try {
        await fetch(
          `${DISCORD_API}/guilds/${guildId}/members/${order.discord_user_id}/roles/${product.role_id}`,
          { method: "PUT", headers: { Authorization: `Bot ${botToken}` } }
        );
      } catch (roleErr) {
        console.error("Failed to assign product role:", roleErr);
      }
    }

    // 10. Update order status
    const newStatus = isAutoDelivery && stockItems.length > 0 ? "delivered" : "paid";
    await supabase
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", order_id)
      .eq("tenant_id", tenant_id);

    // 11. Log "Pagamento confirmado" + delivery to store logs channel
    if (storeConfig?.logs_channel_id) {
      // 11a. Send "Pagamento confirmado" log
      try {
        const providerLabel = order.payment_provider === "pushinpay" ? "PushinPay"
          : order.payment_provider === "efi" ? "EFI Bank"
          : order.payment_provider === "mercadopago" ? "Mercado Pago"
          : order.payment_provider === "misticpay" ? "Mistic Pay"
          : order.payment_provider === "static_pix" ? "PIX Manual"
          : order.payment_provider || "PIX";

        const paymentLogEmbed: any = {
          title: "💰 Pagamento confirmado",
          description: `Usuário <@${order.discord_user_id}> teve o pagamento confirmado.`,
          color: 0x57F287,
          fields: [
            { name: "**Detalhes**", value: `\`1x ${order.product_name} | ${formatBRL(order.total_cents)}\``, inline: false },
            { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
            { name: "**Forma de Pagamento**", value: `\`💎 Pix – ${providerLabel}\``, inline: false },
          ],
          footer: { text: `${tenant?.name || "Loja"} | ${new Date().toLocaleDateString("pt-BR")}, ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, icon_url: tenant?.logo_url || undefined },
          timestamp: new Date().toISOString(),
        };

        await fetch(`${DISCORD_API}/channels/${storeConfig.logs_channel_id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [paymentLogEmbed] }),
        });
      } catch (payLogErr) {
        console.error("Failed to send payment log:", payLogErr);
      }

      // 11b. Send delivery log
      try {
        const isOutOfStock = isAutoDelivery && stockItems.length === 0;
        const needsManualAction = !isAutoDelivery || isOutOfStock;
        const deliveryLogEmbed: any = {
          title: isOutOfStock ? "⚠️ Estoque Esgotado" : isAutoDelivery ? "⚡ Entrega Automática" : "📦 Entrega Manual Pendente",
          description: isOutOfStock
            ? `Pedido de <@${order.discord_user_id}> pago, mas **sem estoque** para entrega automática.`
            : isAutoDelivery
            ? `Usuário <@${order.discord_user_id}> teve seu pedido entregue automaticamente.`
            : `Pedido de <@${order.discord_user_id}> aguardando entrega manual.`,
          color: (isAutoDelivery && !isOutOfStock) ? 0x57F287 : 0xFEE75C,
          fields: [
            { name: "**Detalhes**", value: `${stockItems.length > 0 ? `${stockItems.length}x ` : ""}${order.product_name} | ${formatBRL(order.total_cents)}`, inline: false },
            { name: "**ID do Pedido**", value: order.id, inline: false },
          ],
          footer: { text: `${tenant?.name || "Loja"} • ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` },
          timestamp: new Date().toISOString(),
        };

        if (order.payment_provider) {
          const pLabel = order.payment_provider === "pushinpay" ? "Pix - PushinPay"
            : order.payment_provider === "efi" ? "Pix - Efi Bank"
            : order.payment_provider === "mercadopago" ? "Pix - Mercado Pago"
            : order.payment_provider;
          deliveryLogEmbed.fields.push({ name: "**Forma de Pagamento**", value: `💎 ${pLabel}`, inline: false });
        }

        if (tenant?.logo_url) deliveryLogEmbed.thumbnail = { url: tenant.logo_url };

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
          // For manual delivery or out-of-stock, include action buttons in the logs channel
          const logPayload: any = { embeds: [deliveryLogEmbed] };
          if (needsManualAction) {
            logPayload.components = [{
              type: 1,
              components: [
                { type: 2, style: 3, label: "Marcar como Entregue", emoji: { name: "✅" }, custom_id: `mark_delivered_${order_id}` },
                { type: 2, style: 4, label: "Cancelar Pedido", emoji: { name: "❌" }, custom_id: `cancel_manual_${order_id}` },
              ],
            }];
          }
          await fetch(`${DISCORD_API}/channels/${storeConfig.logs_channel_id}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(logPayload),
          });
        }
      } catch (logErr) {
        console.error("Failed to send delivery log:", logErr);
      }
    }

    // 12. Send public sales announcement (to sales channel AND logs channel)
    const salesEmbedColor = storeConfig?.purchase_embed_color
      ? parseInt(storeConfig.purchase_embed_color.replace("#", ""), 16)
      : 0x2B2D31;

    const salesEmbed: any = {
      author: {
        name: tenant?.name || "Loja",
        icon_url: tenant?.logo_url || undefined,
      },
      description: [
        `<@${order.discord_user_id}>`,
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

    if (storeConfig?.purchase_embed_thumbnail_url) salesEmbed.thumbnail = { url: storeConfig.purchase_embed_thumbnail_url };
    if (storeConfig?.purchase_embed_image_url) salesEmbed.image = { url: storeConfig.purchase_embed_image_url };

    const salesPayload = {
      embeds: [salesEmbed],
      components: [{
        type: 1,
        components: [{ type: 2, style: 5, label: "Comprar", url: `https://discord.com/channels/${guildId}` }],
      }],
    };

    // Send to logs channel only

    // Send to logs channel too
    if (storeConfig?.logs_channel_id) {
      try {
        await fetch(`${DISCORD_API}/channels/${storeConfig.logs_channel_id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [salesEmbed] }),
        });
      } catch (logSalesErr) {
        console.error("Failed to send sales log:", logSalesErr);
      }
    }

    // 13. Sync product embed messages (update stock visually)
    if (order.product_id) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-webhook-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            action: "sync",
            tenant_id,
            product_id: order.product_id,
          }),
        });
        console.log("Product embed synced after delivery");
      } catch (syncErr) {
        console.error("Failed to sync product embed:", syncErr);
      }
    }

    const result = {
      success: true,
      order_id,
      delivery_type: isAutoDelivery ? "automatic" : "manual",
      items_delivered: stockItems.length,
      dm_channel_id: dmChannelId,
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

