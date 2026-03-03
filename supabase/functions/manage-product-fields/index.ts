import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, tenant_id, product_id, field_id, field, items } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
        status: 400,
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

      // Also fetch stock counts
      const ids = (data || []).map((f: any) => f.id);
      let stockCounts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: stockData } = await supabase
          .from("product_stock_items")
          .select("field_id")
          .in("field_id", ids)
          .eq("delivered", false);
        (stockData || []).forEach((s: any) => {
          stockCounts[s.field_id] = (stockCounts[s.field_id] || 0) + 1;
        });
      }

      return new Response(JSON.stringify({ fields: data, stockCounts }), {
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

    // ADD STOCK items
    if (action === "add_stock") {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ error: "items obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const rows = items.map((content: string) => ({
        field_id,
        tenant_id,
        content,
      }));
      const { data, error } = await supabase
        .from("product_stock_items")
        .insert(rows)
        .select();
      if (error) throw error;
      return new Response(JSON.stringify({ count: data?.length || 0 }), {
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
