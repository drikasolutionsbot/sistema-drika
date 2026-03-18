import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_STATUS = new Set(["open", "in_progress", "delivered", "closed"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      action,
      tenant_id,
      ticket_id,
      status,
      closed_by,
      preset_id,
      preset_name,
      preset_data,
    } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ tickets: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_status") {
      if (!ticket_id || !status) {
        return new Response(JSON.stringify({ error: "ticket_id e status são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!VALID_STATUS.has(status)) {
        return new Response(JSON.stringify({ error: "status inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date().toISOString();
      const updatePayload: Record<string, string | null> = {
        status,
        updated_at: now,
      };

      if (status === "closed") {
        updatePayload.closed_at = now;
        updatePayload.closed_by = closed_by || "painel";
      } else {
        updatePayload.closed_at = null;
        updatePayload.closed_by = null;
      }

      const { data, error } = await supabase
        .from("tickets")
        .update(updatePayload)
        .eq("id", ticket_id)
        .eq("tenant_id", tenant_id)
        .select("*")
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ ticket: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_presets") {
      const { data, error } = await supabase
        .from("saved_ticket_presets")
        .select("id, name, preset_data, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ presets: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_preset") {
      if (!preset_name?.trim() || !preset_data) {
        return new Response(JSON.stringify({ error: "preset_name e preset_data são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("saved_ticket_presets")
        .insert({
          tenant_id,
          name: preset_name.trim(),
          preset_data,
        })
        .select("id, name, preset_data, created_at")
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ preset: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_preset") {
      if (!preset_id) {
        return new Response(JSON.stringify({ error: "preset_id é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("saved_ticket_presets")
        .delete()
        .eq("id", preset_id)
        .eq("tenant_id", tenant_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
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
