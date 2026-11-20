import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTenantAccess } from "../_shared/tenant-auth.ts";

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
    const body = await req.json();
    const { action, tenant_id, product_id, coupon, coupon_id } = body;
    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { response: authErr } = await requireTenantAccess(req, supabase, tenant_id, body, corsHeaders);
    if (authErr) return authErr;

    if (action === "list") {
      // List coupons for a specific product + global coupons (product_id is null)
      let query = supabase
        .from("coupons")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });

      if (product_id) {
        query = query.or(`product_id.eq.${product_id},product_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_product") {
      if (!product_id) throw new Error("Missing product_id");
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("product_id", product_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      if (!coupon?.code) throw new Error("Missing coupon code");
      const { data, error } = await supabase
        .from("coupons")
        .insert({
          tenant_id,
          product_id: product_id || null,
          code: coupon.code.toUpperCase(),
          type: coupon.type || "percent",
          value: coupon.value || 0,
          max_uses: coupon.max_uses ?? 100,
          active: coupon.active ?? true,
          expires_at: coupon.expires_at || null,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      if (!coupon_id) throw new Error("Missing coupon_id");
      const updates: Record<string, unknown> = {};
      if (coupon?.code !== undefined) updates.code = coupon.code.toUpperCase();
      if (coupon?.type !== undefined) updates.type = coupon.type;
      if (coupon?.value !== undefined) updates.value = coupon.value;
      if (coupon?.max_uses !== undefined) updates.max_uses = coupon.max_uses;
      if (coupon?.active !== undefined) updates.active = coupon.active;
      if (coupon?.expires_at !== undefined) updates.expires_at = coupon.expires_at || null;
      if (product_id !== undefined) updates.product_id = product_id || null;

      const { data, error } = await supabase
        .from("coupons")
        .update(updates)
        .eq("id", coupon_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!coupon_id) throw new Error("Missing coupon_id");
      const { error } = await supabase
        .from("coupons")
        .delete()
        .eq("id", coupon_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
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
