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
    const { action, tenant_id, order_id, status, payment_provider } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");
    if (!order_id) throw new Error("Missing order_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (action === "update-status") {
      const updates: any = { status };
      if (payment_provider) updates.payment_provider = payment_provider;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", order_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { data, error } = await supabase
        .from("orders")
        .delete()
        .eq("id", order_id)
        .eq("tenant_id", tenant_id)
        .select();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Invalid action: ${action}`);
  } catch (error: any) {
    console.error("Error in manage-orders:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
