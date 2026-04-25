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
    const { token, tenant_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate access via token
    let resolvedTenantId = tenant_id;

    if (token) {
      const { data: tokenRecord, error: tokenError } = await supabase
        .from("access_tokens")
        .select("tenant_id, expires_at")
        .eq("token", token)
        .eq("revoked", false)
        .single();

      if (tokenError || !tokenRecord) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Token expirado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      resolvedTenantId = tokenRecord.tenant_id;
    }

    if (!resolvedTenantId) {
      return new Response(JSON.stringify({ error: "tenant_id ou token é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all channel configs for the tenant
    const { data: configs, error: configsError } = await supabase
      .from("channel_configs")
      .select("channel_key, discord_channel_id")
      .eq("tenant_id", resolvedTenantId)
      .not("discord_channel_id", "is", null);

    if (configsError) throw configsError;

    // Return as a key-value map for easy bot consumption
    const channelMap: Record<string, string> = {};
    (configs || []).forEach((c: any) => {
      if (c.discord_channel_id) {
        channelMap[c.channel_key] = c.discord_channel_id;
      }
    });

    return new Response(
      JSON.stringify({
        tenant_id: resolvedTenantId,
        channels: channelMap,
        count: Object.keys(channelMap).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
