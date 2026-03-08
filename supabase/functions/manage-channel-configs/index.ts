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
    const { tenant_id, channels, action } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ─── LIST action ───
    if (action === "list") {
      const { data, error } = await supabase
        .from("channel_configs")
        .select("id, channel_key, discord_channel_id, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // channels: Record<string, string | null>  e.g. { "logs_system": "123456", "logs_commands": null }
    if (!channels || typeof channels !== "object") {
      return new Response(JSON.stringify({ error: "Missing channels object" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get existing configs for this tenant
    const { data: existing, error: fetchErr } = await supabase
      .from("channel_configs")
      .select("id, channel_key, discord_channel_id")
      .eq("tenant_id", tenant_id);

    if (fetchErr) throw fetchErr;

    const existingMap = new Map(
      (existing || []).map((c: any) => [c.channel_key, c])
    );

    const updates: any[] = [];
    const inserts: any[] = [];
    const deletes: string[] = [];

    for (const [key, value] of Object.entries(channels)) {
      const ex = existingMap.get(key);
      if (ex) {
        if (ex.discord_channel_id !== value) {
          if (value) {
            updates.push({ id: ex.id, tenant_id, channel_key: key, discord_channel_id: value });
          } else {
            deletes.push(ex.id);
          }
        }
      } else if (value) {
        inserts.push({ tenant_id, channel_key: key, discord_channel_id: value });
      }
    }

    if (updates.length > 0) {
      for (const up of updates) {
        const { error: upErr } = await supabase
          .from("channel_configs")
          .update({ discord_channel_id: up.discord_channel_id })
          .eq("id", up.id);
        if (upErr) throw upErr;
      }
    }

    if (inserts.length > 0) {
      const { error: insErr } = await supabase
        .from("channel_configs")
        .insert(inserts);
      if (insErr) throw insErr;
    }

    if (deletes.length > 0) {
      const { error: delErr } = await supabase
        .from("channel_configs")
        .delete()
        .in("id", deletes);
      if (delErr) throw delErr;
    }

    return new Response(
      JSON.stringify({ success: true, updated: updates.length + inserts.length, deleted: deletes.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    const message = error?.message || error?.msg || (typeof error === "string" ? error : JSON.stringify(error));
    console.error("manage-channel-configs error:", message, error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
