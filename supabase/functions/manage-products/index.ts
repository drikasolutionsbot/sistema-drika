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
    const { action, tenant_id, product, product_id } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (action === "create") {
      const { data, error } = await supabase
        .from("products")
        .insert({ name: product?.name || "Novo Produto", tenant_id, price_cents: product?.price_cents || 0 })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      if (!product_id) throw new Error("Missing product_id");
      const allowedFields = ["name", "description", "price_cents", "compare_price_cents", "type", "active", "icon_url", "banner_url", "auto_delivery", "category_id", "stock", "enable_credits", "show_stock", "show_sold", "enable_instructions", "button_style"];
      const safeUpdates: Record<string, unknown> = {};
      for (const key of Object.keys(product || {})) {
        if (allowedFields.includes(key)) {
          safeUpdates[key] = product[key];
        }
      }
      safeUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("products")
        .update(safeUpdates)
        .eq("id", product_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!product_id) throw new Error("Missing product_id");
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });
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
