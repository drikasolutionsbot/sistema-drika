import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, tenant_id } = body;
    if (!tenant_id) throw new Error("tenant_id required");

    const json = (data: any) => new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (action === "list") {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(data);
    }

    if (action === "create") {
      const { name, trigger_type, trigger_config, actions: acts, conditions } = body;
      const { data, error } = await supabase
        .from("automations")
        .insert({ tenant_id, name, trigger_type, trigger_config: trigger_config || {}, actions: acts || [], conditions: conditions || [] })
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    if (action === "update") {
      const { automation_id, ...fields } = body;
      delete fields.action;
      delete fields.tenant_id;
      fields.updated_at = new Date().toISOString();
      const { data, error } = await supabase
        .from("automations")
        .update(fields)
        .eq("id", automation_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    if (action === "toggle") {
      const { automation_id, enabled } = body;
      const { data, error } = await supabase
        .from("automations")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("id", automation_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    if (action === "delete") {
      const { automation_id } = body;
      const { error } = await supabase.from("automations").delete().eq("id", automation_id).eq("tenant_id", tenant_id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "list_logs") {
      const { automation_id, limit: lim } = body;
      let query = supabase
        .from("automation_logs")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(lim || 50);
      if (automation_id) query = query.eq("automation_id", automation_id);
      const { data, error } = await query;
      if (error) throw error;
      return json(data);
    }

    if (action === "clear_logs") {
      const { automation_id } = body;
      let query = supabase.from("automation_logs").delete().eq("tenant_id", tenant_id);
      if (automation_id) query = query.eq("automation_id", automation_id);
      const { error } = await query;
      if (error) throw error;
      return json({ success: true });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
