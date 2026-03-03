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
    const { tenant_id, channels } = await req.json();
    // channels: Record<string, string | null>  e.g. { "logs_system": "123456", "logs_commands": null }

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const upserts: any[] = [];
    const deletes: string[] = [];

    for (const [key, value] of Object.entries(channels)) {
      const ex = existingMap.get(key);
      if (ex) {
        // Update if changed
        if (ex.discord_channel_id !== value) {
          if (value) {
            upserts.push({ id: ex.id, tenant_id, channel_key: key, discord_channel_id: value });
          } else {
            // Clear: delete the row
            deletes.push(ex.id);
          }
        }
      } else if (value) {
        // Insert new
        upserts.push({ tenant_id, channel_key: key, discord_channel_id: value });
      }
    }

    if (upserts.length > 0) {
      const { error: upsertErr } = await supabase
        .from("channel_configs")
        .upsert(upserts, { onConflict: "id" });
      if (upsertErr) throw upsertErr;
    }

    if (deletes.length > 0) {
      const { error: delErr } = await supabase
        .from("channel_configs")
        .delete()
        .in("id", deletes);
      if (delErr) throw delErr;
    }

    return new Response(
      JSON.stringify({ success: true, updated: upserts.length, deleted: deletes.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
