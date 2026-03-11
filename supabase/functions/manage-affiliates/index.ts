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
    const { action, tenant_id, affiliate, affiliate_id } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // LIST
    if (action === "list") {
      const { data, error } = await supabase
        .from("affiliates")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ affiliates: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET STATS (orders linked to affiliate)
    if (action === "stats") {
      if (!affiliate_id) throw new Error("Missing affiliate_id");
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, order_number, product_name, total_cents, status, discord_username, created_at")
        .eq("tenant_id", tenant_id)
        .eq("affiliate_id", affiliate_id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return new Response(JSON.stringify({ orders: orders ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE
    if (action === "create") {
      if (!affiliate?.name || !affiliate?.code) throw new Error("name e code obrigatórios");
      const { data, error } = await supabase
        .from("affiliates")
        .insert({
          tenant_id,
          name: affiliate.name,
          code: affiliate.code.toUpperCase().replace(/\s+/g, ""),
          commission_percent: affiliate.commission_percent ?? 5,
          active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ affiliate: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE
    if (action === "update") {
      if (!affiliate_id) throw new Error("Missing affiliate_id");
      const updates: Record<string, unknown> = {};
      if (affiliate?.name !== undefined) updates.name = affiliate.name;
      if (affiliate?.code !== undefined) updates.code = affiliate.code.toUpperCase().replace(/\s+/g, "");
      if (affiliate?.commission_percent !== undefined) updates.commission_percent = affiliate.commission_percent;
      if (affiliate?.active !== undefined) updates.active = affiliate.active;

      const { data, error } = await supabase
        .from("affiliates")
        .update(updates)
        .eq("id", affiliate_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ affiliate: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE
    if (action === "delete") {
      if (!affiliate_id) throw new Error("Missing affiliate_id");
      const { error } = await supabase
        .from("affiliates")
        .delete()
        .eq("id", affiliate_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
