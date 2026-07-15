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
    const { action, tenant_id, product, product_id, updates } = await req.json();
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
      const allowedFields = ["name", "description", "price_cents", "compare_price_cents", "type", "active", "icon_url", "banner_url", "auto_delivery", "category_id", "stock", "enable_credits", "show_stock", "show_sold", "enable_instructions", "button_style", "embed_config", "role_id", "payment_provider_key", "language", "currency"];
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

    if (action === "duplicate") {
      if (!product_id) throw new Error("Missing product_id");
      
      const { data: original, error: origError } = await supabase
        .from("products")
        .select("*")
        .eq("id", product_id)
        .eq("tenant_id", tenant_id)
        .single();
        
      if (origError) throw origError;
      
      const { id, created_at, updated_at, ...productData } = original;
      productData.name = `Cópia de ${original.name}`;
      productData.active = false;
      
      const { data: newProduct, error: dupError } = await supabase
        .from("products")
        .insert(productData)
        .select()
        .single();
        
      if (dupError) throw dupError;

      const { data: fields } = await supabase
        .from("product_fields")
        .select("*")
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id);
        
      if (fields && fields.length > 0) {
        const newFields = fields.map(f => {
          const { id: _id, created_at: _ca, updated_at: _ua, ...fd } = f;
          fd.product_id = newProduct.id;
          return fd;
        });
        await supabase.from("product_fields").insert(newFields);
      }
      
      return new Response(JSON.stringify(newProduct), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reorder") {
      if (!updates || !Array.isArray(updates)) throw new Error("Missing updates array");
      
      for (const update of updates) {
        if (!update.id) continue;
        await supabase
          .from("products")
          .update({ position: update.position })
          .eq("id", update.id)
          .eq("tenant_id", tenant_id);
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    const message = error instanceof Error ? error.message : (typeof error === "object" && error !== null && "message" in error) ? String((error as any).message) : JSON.stringify(error);
    console.error("manage-products error:", message, error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
