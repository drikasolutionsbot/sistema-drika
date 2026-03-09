import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, item, item_id, tenant_id } = await req.json();

    // Admin: import item from LZT to marketplace
    if (action === "import") {
      if (!item) throw new Error("Missing item data");
      const { data, error } = await supabase
        .from("marketplace_items")
        .insert({
          lzt_item_id: item.lzt_item_id,
          title: item.title,
          description: item.description || null,
          category: item.category || null,
          cost_cents: item.cost_cents || 0,
          resale_price_cents: item.resale_price_cents || 0,
          lzt_data: item.lzt_data || {},
          image_url: item.image_url || null,
          status: "available",
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin: update item
    if (action === "update") {
      if (!item_id) throw new Error("Missing item_id");
      const updates: Record<string, unknown> = {};
      if (item?.title !== undefined) updates.title = item.title;
      if (item?.description !== undefined) updates.description = item.description;
      if (item?.category !== undefined) updates.category = item.category;
      if (item?.resale_price_cents !== undefined) updates.resale_price_cents = item.resale_price_cents;
      if (item?.status !== undefined) updates.status = item.status;
      if (item?.image_url !== undefined) updates.image_url = item.image_url;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("marketplace_items")
        .update(updates)
        .eq("id", item_id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin: delete item
    if (action === "delete") {
      if (!item_id) throw new Error("Missing item_id");
      const { error } = await supabase
        .from("marketplace_items")
        .delete()
        .eq("id", item_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List available items (for tenants)
    if (action === "list") {
      const query = supabase
        .from("marketplace_items")
        .select("*")
        .order("created_at", { ascending: false });
      
      // If no tenant_id, show all (admin view)
      if (!tenant_id) {
        // admin sees all
      } else {
        // tenant only sees available
        query.eq("status", "available");
      }

      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant: mark as purchased (after PIX confirmation)
    if (action === "purchase") {
      if (!item_id || !tenant_id) throw new Error("Missing item_id or tenant_id");
      
      // Check item is available
      const { data: existing, error: fetchErr } = await supabase
        .from("marketplace_items")
        .select("*")
        .eq("id", item_id)
        .eq("status", "available")
        .single();
      if (fetchErr || !existing) throw new Error("Item não disponível");

      const { data, error } = await supabase
        .from("marketplace_items")
        .update({
          status: "sold",
          bought_by_tenant_id: tenant_id,
          bought_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item_id)
        .eq("status", "available")
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant: list purchased items
    if (action === "my_purchases") {
      if (!tenant_id) throw new Error("Missing tenant_id");
      const { data, error } = await supabase
        .from("marketplace_items")
        .select("*")
        .eq("bought_by_tenant_id", tenant_id)
        .order("bought_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
