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
      return new Response(JSON.stringify({ count: data?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET STOCK COUNT + items for a product (general stock)
    if (action === "get_stock") {
      if (!product_id) {
        return new Response(JSON.stringify({ error: "product_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("product_stock_items")
        .select("id, content, created_at")
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id)
        .eq("delivered", false)
        .order("created_at", { ascending: false })
        .limit(500);
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

    // CLEAR STOCK for a product
    if (action === "clear_stock") {
      if (!product_id) {
        return new Response(JSON.stringify({ error: "product_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase
        .from("product_stock_items")
        .delete()
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id)
        .eq("delivered", false);
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
