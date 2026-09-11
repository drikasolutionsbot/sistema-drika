const { supabase, getProductById } = require("../supabase");

function initRealtimeListeners(client) {
  // ── Reabastecimento de estoque — DMs para usuários cadastrados ──
  supabase
    .channel('restock-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'product_stock_items' },
      async (payload) => {
        const { product_id, tenant_id, field_id } = payload.new;
        if (!product_id || !tenant_id) return;

        const { data: notifications, error } = await supabase
          .from("restock_notifications")
          .select("*")
          .eq("product_id", product_id)
          .eq("tenant_id", tenant_id)
          .eq("notified", false);

        if (error || !notifications || notifications.length === 0) return;

        const pending = notifications.filter(n => !n.field_id || n.field_id === field_id);
        if (pending.length === 0) return;

        const ids = pending.map(n => n.id);
        await supabase.from("restock_notifications").update({ notified: true }).in("id", ids);

        const product = await getProductById(product_id, tenant_id);
        if (!product) return;

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
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log("✅ Realtime listener para reabastecimento de estoque (DMs) ativado!");
      }
    });

  // ── Restock Channel Announcement — batch de 3s por produto ──
  const restockBatch = new Map();

  supabase
    .channel('restock-channel-announce')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'product_stock_items' },
      (payload) => {
        const { product_id, tenant_id, field_id } = payload.new;
        if (!product_id || !tenant_id) return;

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
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log("✅ Realtime listener para anúncio de restock no canal ativado!");
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
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log("✅ Realtime listener para fechamento de tickets entregues ativado!");
      }
    });
}

async function sendRestockAnnouncement(client, entry, batchKey, restockBatch) {
  restockBatch.delete(batchKey);
  const { product_id, tenant_id, field_id, count: addedCount } = entry;

  try {
    // 1. Buscar canal configurado em channel_configs
    const { data: channelConfig } = await supabase
      .from("channel_configs")
      .select("discord_channel_id")
      .eq("tenant_id", tenant_id)
      .eq("channel_key", "restock_channel")
      .maybeSingle();

    // 2. Buscar store_configs para embed customizado
    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("restock_channel_id, restock_embed_color, restock_embed_title, restock_embed_description, restock_embed_footer, restock_embed_image_url, restock_embed_thumbnail_url, restock_mention_role_id, store_url, embed_color")
      .eq("tenant_id", tenant_id)
      .single();

    const restockChannelId = channelConfig?.discord_channel_id || storeConfig?.restock_channel_id;
    if (!restockChannelId) return;

    // 3. Buscar produto
    const product = await getProductById(product_id, tenant_id);
    if (!product) return;

    // 4. Nome da variante (field)
    let fieldName = null;
    if (field_id) {
      const { data: field } = await supabase.from("product_fields").select("name").eq("id", field_id).maybeSingle();
      fieldName = field?.name || null;
    }

    // 5. Contar estoque total
    let stockQuery = supabase.from("product_stock_items").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id).eq("delivered", false);
    if (field_id) stockQuery = stockQuery.eq("field_id", field_id);
    else stockQuery = stockQuery.eq("product_id", product_id);
    const { count: totalStock } = await stockQuery;

    // 6. Montar embed
    const rawColor = storeConfig?.restock_embed_color || storeConfig?.embed_color || "#57F287";
    const embedColor = parseInt(rawColor.replace("#", ""), 16);

    const title = storeConfig?.restock_embed_title
      ? storeConfig.restock_embed_title.replace("{product}", product.name).replace("{qty}", addedCount).replace("{total_stock}", totalStock ?? "?")
      : `🔄 RESTOCK! O produto ${product.name} acabou de receber novos itens!`;

    const description = storeConfig?.restock_embed_description
      ? storeConfig.restock_embed_description.replace("{product}", product.name).replace("{qty}", addedCount).replace("{total_stock}", totalStock ?? "?")
      : null;

    const fields = [];
    if (fieldName) fields.push({ name: "🔑 • Campo", value: `\`${fieldName}\``, inline: true });
    fields.push({ name: "📦 • Adicionados", value: `\`${addedCount}x\``, inline: true });
    if (totalStock !== null) fields.push({ name: "📊 • Estoque total", value: `\`${totalStock}x\``, inline: true });

    const now = new Date();
    fields.push({
      name: "🕐 • Data",
      value: now.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      inline: false,
    });

    const embed = { title, color: embedColor, fields, timestamp: now.toISOString() };
    if (description) embed.description = description;
    if (storeConfig?.restock_embed_footer) embed.footer = { text: storeConfig.restock_embed_footer };
    if (storeConfig?.restock_embed_thumbnail_url) embed.thumbnail = { url: storeConfig.restock_embed_thumbnail_url };
    if (storeConfig?.restock_embed_image_url) embed.image = { url: storeConfig.restock_embed_image_url };

    // 7. Botão Comprar Agora
    const components = [];
    const storeUrl = storeConfig?.store_url;
    if (storeUrl) {
      components.push({
        type: 1,
        components: [{ type: 2, style: 5, label: "Comprar Agora", url: storeUrl, emoji: { name: "🛒" } }],
      });
    }

    // 8. Menção ao cargo
    const mentionRoleId = storeConfig?.restock_mention_role_id;
    const content = mentionRoleId ? `<@&${mentionRoleId}>` : undefined;

    // 9. Enviar
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
