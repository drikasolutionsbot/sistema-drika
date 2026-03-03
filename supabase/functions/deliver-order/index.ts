import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCORD_API = "https://discord.com/api/v10";

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

    // 3. Determine which field to deliver from
    const fieldId = order.field_id;
    let stockItems: any[] = [];

    if (order.product_id) {
      // Get product info
      const { data: product } = await supabase
        .from("products")
        .select("*, auto_delivery")
        .eq("id", order.product_id)
        .eq("tenant_id", tenant_id)
        .single();

      if (!product?.auto_delivery) {
        // Not auto-delivery, skip stock but still run hooks
        console.log("Product is not auto-delivery, skipping stock delivery");
      } else {
        // Pick stock items (from specific field or first available field)
        let targetFieldId = fieldId;

        if (!targetFieldId) {
          // Get first field with available stock
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
          // Get 1 available stock item
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

            // Mark as delivered
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

    // 4. Send DM to buyer with stock as .txt
    const dmChannelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: order.discord_user_id }),
    });

    if (!dmChannelRes.ok) {
      const errText = await dmChannelRes.text();
      console.error("Failed to open DM channel:", errText);
      throw new Error(`Failed to open DM: ${dmChannelRes.status}`);
    }

    const dmChannel = await dmChannelRes.json();

    // Build embed for the DM
    const embed: any = {
      title: "Compra realizada com sucesso! ✅",
      description: `Obrigado pela sua compra de **${order.product_name}**!`,
      color: 0x57F287,
      timestamp: new Date().toISOString(),
      footer: { text: tenant?.name || "Loja" },
    };

    if (tenant?.logo_url) {
      embed.thumbnail = { url: tenant.logo_url };
    }

    embed.fields = [
      { name: "📦 Produto", value: order.product_name, inline: true },
      { name: "🔢 Pedido", value: `#${order.order_number}`, inline: true },
      { name: "💰 Total", value: `R$ ${(order.total_cents / 100).toFixed(2)}`, inline: true },
    ];

    // Prepare form data for file attachment
    const formData = new FormData();

    const payload: any = { embeds: [embed] };

    if (stockItems.length > 0) {
      // Create .txt file with stock content
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

    const sendRes = await fetch(`${DISCORD_API}/channels/${dmChannel.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}` },
      body: formData,
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("Failed to send DM:", errText);
      // Don't throw - DM might fail if user has DMs closed
    }

    // 5. Execute product hooks
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

    // 6. Update order status to delivered
    await supabase
      .from("orders")
      .update({ status: "delivered", updated_at: new Date().toISOString() })
      .eq("id", order_id)
      .eq("tenant_id", tenant_id);

    // 7. Log to store logs channel if configured
    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("logs_channel_id")
      .eq("tenant_id", tenant_id)
      .single();

    if (storeConfig?.logs_channel_id) {
      const logEmbed = {
        title: "📦 Entrega Automática",
        description: `Pedido **#${order.order_number}** entregue para <@${order.discord_user_id}>`,
        color: 0x57F287,
        fields: [
          { name: "Produto", value: order.product_name, inline: true },
          { name: "Itens", value: `${stockItems.length}`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      };

      await fetch(`${DISCORD_API}/channels/${storeConfig.logs_channel_id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [logEmbed] }),
      });
    }

    const result = {
      success: true,
      order_id,
      items_delivered: stockItems.length,
      dm_sent: sendRes?.ok ?? false,
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
