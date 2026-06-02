const { supabase, getProductById } = require("../supabase");

function initRealtimeListeners(client) {
  supabase
    .channel('restock-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'product_stock_items' },
      async (payload) => {
        const { product_id, tenant_id, field_id } = payload.new;
        if (!product_id || !tenant_id) return;

        // Check pending notifications for this product
        const { data: notifications, error } = await supabase
          .from("restock_notifications")
          .select("*")
          .eq("product_id", product_id)
          .eq("tenant_id", tenant_id)
          .eq("notified", false);

        if (error || !notifications || notifications.length === 0) return;

        // Filter by field_id if applicable
        const pending = notifications.filter(n => !n.field_id || n.field_id === field_id);
        if (pending.length === 0) return;

        // Mark as notified
        const ids = pending.map(n => n.id);
        await supabase
          .from("restock_notifications")
          .update({ notified: true })
          .in("id", ids);

        // Get product details
        const product = await getProductById(product_id, tenant_id);
        if (!product) return;

        // Send DMs
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
        console.log("✅ Realtime listener para reabastecimento de estoque ativado!");
      }
    });
}

module.exports = { initRealtimeListeners };
