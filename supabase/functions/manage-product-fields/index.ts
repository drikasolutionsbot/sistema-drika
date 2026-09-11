import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper: update products.stock column AND trigger Discord embed sync
async function syncStockAndEmbed(supabase: any, productId: string, tenantId: string) {
  // Count real stock from product_stock_items
  const { count } = await supabase
    .from("product_stock_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("tenant_id", tenantId)
    .eq("delivered", false);

  const realStock = count ?? 0;

  // Update the products.stock column
  await supabase
    .from("products")
    .update({ stock: realStock, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("tenant_id", tenantId);

  // Trigger Discord embed sync (fire-and-forget)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-webhook-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        action: "sync",
        tenant_id: tenantId,
        product_id: productId,
      }),
    });
  } catch (e) {
    console.error("Failed to sync product embed:", e);
  }
}

// Helper: send restock announcement directly to Discord
async function sendRestockAnnouncement(
  supabase: any,
  tenantId: string,
  productId: string,
  fieldId: string | null,
  addedCount: number
) {
  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
    if (!botToken) { console.error("[RESTOCK] DISCORD_BOT_TOKEN não configurado"); return; }

    const { data: channelConfig } = await supabase
      .from("channel_configs")
      .select("discord_channel_id")
      .eq("tenant_id", tenantId)
      .eq("channel_key", "restock_channel")
      .maybeSingle();

    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("restock_channel_id, restock_embed_color, restock_embed_title, restock_embed_description, restock_embed_footer, restock_embed_image_url, restock_embed_thumbnail_url, restock_mention_role_id, store_url, embed_color")
      .eq("tenant_id", tenantId)
      .single();

    const restockChannelId = channelConfig?.discord_channel_id || storeConfig?.restock_channel_id;
    if (!restockChannelId) { console.log(`[RESTOCK] Nenhum canal configurado para tenant ${tenantId}`); return; }

    const { data: product } = await supabase
      .from("products").select("id, name").eq("id", productId).eq("tenant_id", tenantId).maybeSingle();
    if (!product) { console.log(`[RESTOCK] Produto não encontrado: ${productId}`); return; }

    let fieldName: string | null = null;
    if (fieldId) {
      const { data: field } = await supabase.from("product_fields").select("name").eq("id", fieldId).maybeSingle();
      fieldName = field?.name || null;
    }

    let stockQuery = supabase.from("product_stock_items")
      .select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("delivered", false);
    if (fieldId) stockQuery = stockQuery.eq("field_id", fieldId);
    else stockQuery = stockQuery.eq("product_id", productId);
    const { count: totalStock } = await stockQuery;

    const rawColor = storeConfig?.restock_embed_color || storeConfig?.embed_color || "#57F287";
    const embedColor = parseInt(rawColor.replace("#", ""), 16) || 0x57F287;

    const title = storeConfig?.restock_embed_title
      ? storeConfig.restock_embed_title.replace("{product}", product.name).replace("{qty}", String(addedCount)).replace("{total_stock}", String(totalStock ?? "?"))
      : `🔄 RESTOCK! O produto ${product.name} acabou de receber novos itens!`;

    const description = storeConfig?.restock_embed_description
      ? storeConfig.restock_embed_description.replace("{product}", product.name).replace("{qty}", String(addedCount)).replace("{total_stock}", String(totalStock ?? "?"))
      : null;

    const descLines: string[] = [];
    if (description) { descLines.push(description); descLines.push(""); }
    if (fieldName) descLines.push(`➥ 🏷️ • **Campo:** \`${fieldName}\``);
    descLines.push(`➥ 📦 • **Adicionados:** \`${addedCount}x\``);
    if (totalStock !== null) descLines.push(`➥ 📈 • **Estoque total:** \`${totalStock}x\``);
    const now = new Date();
    descLines.push(`🕒 **Data:** <t:${Math.floor(now.getTime() / 1000)}:F> (<t:${Math.floor(now.getTime() / 1000)}:R>)`);

    const embed: Record<string, unknown> = { title, color: embedColor, description: descLines.join("\n"), timestamp: now.toISOString() };
    if (storeConfig?.restock_embed_footer) embed.footer = { text: storeConfig.restock_embed_footer };
    if (storeConfig?.restock_embed_thumbnail_url) embed.thumbnail = { url: storeConfig.restock_embed_thumbnail_url };
    if (storeConfig?.restock_embed_image_url) embed.image = { url: storeConfig.restock_embed_image_url };

    const components: unknown[] = [];
    if (storeConfig?.store_url) {
      components.push({ type: 1, components: [{ type: 2, style: 5, label: "Comprar Agora", url: storeConfig.store_url, emoji: { name: "🛒" } }] });
    }

    const mentionRoleId = storeConfig?.restock_mention_role_id;
    const content = mentionRoleId ? (mentionRoleId === "everyone" ? "@everyone" : `<@&${mentionRoleId}>`) : undefined;

    const body: Record<string, unknown> = { embeds: [embed] };
    if (content) body.content = content;
    if (components.length > 0) body.components = components;

    const res = await fetch(`https://discord.com/api/v10/channels/${restockChannelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      console.log(`[RESTOCK] ✅ Anúncio enviado | Canal: ${restockChannelId} | Produto: ${product.name} | +${addedCount}`);
    } else {
      console.error(`[RESTOCK] ❌ Discord ${res.status}:`, await res.text());
    }
  } catch (err) {
    console.error("[RESTOCK] Erro:", (err as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, tenant_id, product_id, field_id, field, items, stock_item_id } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // COUNT fields grouped by product_id (for all products of tenant)
    if (action === "count_by_product") {
      const { data, error } = await supabase
        .from("product_fields")
        .select("product_id")
        .eq("tenant_id", tenant_id);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.product_id] = (counts[row.product_id] || 0) + 1;
      }
      return new Response(JSON.stringify(counts), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LIST fields for a product
    if (action === "list") {
      const { data, error } = await supabase
        .from("product_fields")
        .select("*")
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id)
        .order("sort_order", { ascending: true });
      if (error) throw error;

      return new Response(JSON.stringify({ fields: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE a new field
    if (action === "create") {
      const { data, error } = await supabase
        .from("product_fields")
        .insert({
          product_id,
          tenant_id,
          name: field?.name || "Novo",
          description: field?.description || "",
          price_cents: field?.price_cents || 0,
          sort_order: field?.sort_order || 0,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE a field
    if (action === "update") {
      const { error } = await supabase
        .from("product_fields")
        .update(field)
        .eq("id", field_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE a field
    if (action === "delete") {
      const { error } = await supabase
        .from("product_fields")
        .delete()
        .eq("id", field_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ADD STOCK items (now supports product-level stock)
    if (action === "add_stock") {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ error: "items obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!product_id) {
        return new Response(JSON.stringify({ error: "product_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const resolvedFieldId = field_id || null;
      const rows = items.map((content: string) => ({
        product_id,
        tenant_id,
        content,
        field_id: resolvedFieldId,
      }));
      const { data, error } = await supabase
        .from("product_stock_items")
        .insert(rows)
        .select();
      if (error) throw error;
      // Sync stock count and Discord embeds
      await syncStockAndEmbed(supabase, product_id, tenant_id);
      // Trigger restock announcement to Discord channel directly (no external function needed)
      sendRestockAnnouncement(supabase, tenant_id, product_id, resolvedFieldId, data?.length || items.length)
        .catch((e: Error) => console.error("[RESTOCK] Erro no anúncio:", e.message));
      return new Response(JSON.stringify({ count: data?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET STOCK COUNT + items (filters by field_id when provided)
    if (action === "get_stock") {
      if (!product_id) {
        return new Response(JSON.stringify({ error: "product_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let query = supabase
        .from("product_stock_items")
        .select("id, content, created_at")
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id)
        .eq("delivered", false)
        .order("created_at", { ascending: false })
        .limit(500);
      // Filter by field_id when viewing a specific variation
      if (field_id) {
        query = query.eq("field_id", field_id);
      } else {
        // General stock tab: show items with no field (unassigned) OR all items
        query = query.is("field_id", null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ stock: data?.length || 0, items: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE a single stock item
    if (action === "delete_stock_item") {
      if (!stock_item_id) {
        return new Response(JSON.stringify({ error: "stock_item_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Get product_id from the stock item before deleting
      const { data: stockItem } = await supabase
        .from("product_stock_items")
        .select("product_id")
        .eq("id", stock_item_id)
        .eq("tenant_id", tenant_id)
        .single();
      const deletedProductId = stockItem?.product_id;

      const { error } = await supabase
        .from("product_stock_items")
        .delete()
        .eq("id", stock_item_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      // Sync stock count and Discord embeds
      if (deletedProductId) {
        await syncStockAndEmbed(supabase, deletedProductId, tenant_id);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CLEAR STOCK (by field_id when provided, otherwise all unassigned items for product)
    if (action === "clear_stock") {
      if (!product_id) {
        return new Response(JSON.stringify({ error: "product_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let deleteQuery = supabase
        .from("product_stock_items")
        .delete()
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id)
        .eq("delivered", false);
      if (field_id) {
        deleteQuery = deleteQuery.eq("field_id", field_id);
      } else {
        deleteQuery = deleteQuery.is("field_id", null);
      }
      const { error } = await deleteQuery;
      if (error) throw error;
      // Sync stock count and Discord embeds
      await syncStockAndEmbed(supabase, product_id, tenant_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
