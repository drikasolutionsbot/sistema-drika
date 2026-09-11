const { supabase, getProductById } = require("../supabase");

function initRealtimeListeners(client) {
  const restockBatch = new Map();

  supabase
    .channel('restock-events-combined')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'product_stock_items' },
      async (payload) => {
        const { product_id, tenant_id, field_id } = payload.new;
        if (!product_id || !tenant_id) return;

        // ── 1. Lógica de DMs (restock_notifications) ──
        try {
          const { data: notifications, error } = await supabase
            .from("restock_notifications")
            .select("*")
            .eq("product_id", product_id)
            .eq("tenant_id", tenant_id)
            .eq("notified", false);

          if (!error && notifications && notifications.length > 0) {
            const pending = notifications.filter(n => !n.field_id || n.field_id === field_id);
            if (pending.length > 0) {
              const ids = pending.map(n => n.id);
              await supabase.from("restock_notifications").update({ notified: true }).in("id", ids);

              const product = await getProductById(product_id, tenant_id);
              if (product) {
                for (const notif of pending) {
                  try {
                    const user = await client.users.fetch(notif.user_id);
                    if (user) {
                      await user.send(`📦 **Boas notícias!** O produto **${product.name}** acabou de ser reabastecido! Corra para garantir o seu antes que acabe novamente!`);
                    }
                  } catch (e) {
                    console.error(`Failed to DM user ${notif.user_id}:`, e.message);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error("[RESTOCK DM] Erro:", err.message);
        }

        // ── 2. Lógica de Anúncio no Canal ──
        const batchKey = `${tenant_id}:${product_id}:${field_id || ''}`;
        if (restockBatch.has(batchKey)) {
          restockBatch.get(batchKey).count++;
        } else {
          const entry = { count: 1, product_id, tenant_id, field_id: field_id || null, timer: null };
          entry.timer = setTimeout(() => sendRestockAnnouncement(client, entry, batchKey, restockBatch), 3000);
          restockBatch.set(batchKey, entry);
        }
      }
    )
    .subscribe((status, err) => {
      console.log(`[REALTIME] Restock Events Subscribe Status: ${status}`, err || "");
      if (status === 'SUBSCRIBED') {
        console.log("✅ Realtime listener para restock (DMs + Canal) ativado!");
      }
    });

  // ── Fechar canal de ticket quando entrega for confirmada ──
  supabase
    .channel('ticket-delivered-close')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'tickets', filter: 'status=eq.delivered' },
      async (payload) => {
        const ticket = payload.new;
        if (!ticket?.discord_channel_id) return;

        console.log(`[REALTIME] Ticket ${ticket.id} marcado como entregue. Canal: ${ticket.discord_channel_id}. Fechando em 2 minutos...`);

        setTimeout(async () => {
          try {
            const channel = await client.channels.fetch(ticket.discord_channel_id).catch(() => null);
            if (!channel) return;

            if (channel.isThread?.()) {
              await channel.setLocked(true).catch(() => {});
              await channel.setArchived(true).catch(() => {});
              console.log(`[REALTIME] Thread de ticket ${ticket.id} arquivada.`);
            } else {
              await channel.delete("Entrega confirmada - ticket fechado automaticamente").catch(() => {});
              console.log(`[REALTIME] Canal de ticket ${ticket.id} deletado.`);
            }
          } catch (err) {
            console.error(`[REALTIME] Erro ao fechar canal do ticket ${ticket.id}:`, err.message);
          }
        }, 120000);
      }
    )
    .subscribe((status, err) => {
      console.log(`[REALTIME] Ticket Close Subscribe Status: ${status}`, err || "");
    });
}

async function sendRestockAnnouncement(client, entry, batchKey, restockBatch) {
  restockBatch.delete(batchKey);
  const { product_id, tenant_id, field_id, count: addedCount } = entry;

  try {
    const { data: channelConfig } = await supabase
      .from("channel_configs")
      .select("discord_channel_id")
      .eq("tenant_id", tenant_id)
      .eq("channel_key", "restock_channel")
      .maybeSingle();

    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("restock_channel_id, restock_embed_color, restock_embed_title, restock_embed_description, restock_embed_footer, restock_embed_image_url, restock_embed_thumbnail_url, restock_mention_role_id, store_url, embed_color")
      .eq("tenant_id", tenant_id)
      .single();

    const restockChannelId = channelConfig?.discord_channel_id || storeConfig?.restock_channel_id;
    if (!restockChannelId) {
      console.log(`[RESTOCK] Ignorado: Nenhum canal de restock configurado para tenant ${tenant_id}`);
      return;
    }

    const product = await getProductById(product_id, tenant_id);
    if (!product) {
      console.log(`[RESTOCK] Produto não encontrado: ${product_id}`);
      return;
    }

    let fieldName = null;
    if (field_id) {
      const { data: field } = await supabase.from("product_fields").select("name").eq("id", field_id).maybeSingle();
      fieldName = field?.name || null;
    }

    let stockQuery = supabase.from("product_stock_items").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id).eq("delivered", false);
    if (field_id) stockQuery = stockQuery.eq("field_id", field_id);
    else stockQuery = stockQuery.eq("product_id", product_id);
    const { count: totalStock } = await stockQuery;

    const rawColor = storeConfig?.restock_embed_color || storeConfig?.embed_color || "#57F287";
    const embedColor = parseInt(rawColor.replace("#", ""), 16) || 0x57F287;

    const title = storeConfig?.restock_embed_title
      ? storeConfig.restock_embed_title.replace("{product}", product.name).replace("{qty}", addedCount).replace("{total_stock}", totalStock ?? "?")
      : `🔄 RESTOCK! O produto ${product.name} acabou de receber novos itens!`;

    const description = storeConfig?.restock_embed_description
      ? storeConfig.restock_embed_description.replace("{product}", product.name).replace("{qty}", addedCount).replace("{total_stock}", totalStock ?? "?")
      : null;

    const descLines = [];
    if (description) {
      descLines.push(description);
      descLines.push("");
    }

    if (fieldName) descLines.push(`➥ 🏷️ • **Campo:** \`${fieldName}\``);
    descLines.push(`➥ 📦 • **Adicionados:** \`${addedCount}x\``);
    if (totalStock !== null) descLines.push(`➥ 📈 • **Estoque total:** \`${totalStock}x\``);

    const now = new Date();
    const unixTimestamp = Math.floor(now.getTime() / 1000);
    descLines.push(`🕒 **Data:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`);

    const finalDescription = descLines.join("\n");

    const embed = { 
      title, 
      color: embedColor, 
      description: finalDescription,
      timestamp: now.toISOString() 
    };
    if (storeConfig?.restock_embed_footer) embed.footer = { text: storeConfig.restock_embed_footer };
    if (storeConfig?.restock_embed_thumbnail_url) embed.thumbnail = { url: storeConfig.restock_embed_thumbnail_url };
    if (storeConfig?.restock_embed_image_url) embed.image = { url: storeConfig.restock_embed_image_url };

    const components = [];
    const storeUrl = storeConfig?.store_url;
    if (storeUrl) {
      components.push({
        type: 1,
        components: [{ type: 2, style: 5, label: "Comprar Agora", url: storeUrl, emoji: { name: "🛒" } }],
      });
    }

    const mentionRoleId = storeConfig?.restock_mention_role_id;
    const content = mentionRoleId ? (mentionRoleId === 'everyone' ? '@everyone' : `<@&${mentionRoleId}>`) : undefined;

    const body = { embeds: [embed] };
    if (content) body.content = content;
    if (components.length > 0) body.components = components;

    const res = await fetch(`https://discord.com/api/v10/channels/${restockChannelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      console.log(`[RESTOCK] ✅ Anúncio enviado | Canal: ${restockChannelId} | Produto: ${product.name} | +${addedCount} itens`);
    } else {
      console.error(`[RESTOCK] ❌ Erro ${res.status}:`, await res.text());
    }
  } catch (err) {
    console.error(`[RESTOCK] Erro no anúncio:`, err.message);
  }
}

module.exports = { initRealtimeListeners };
