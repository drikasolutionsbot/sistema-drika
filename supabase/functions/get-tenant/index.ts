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
    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenant_id)
      .single();

    if (error) throw error;

    // Fetch active access token for this tenant (auto-renew or create if missing)
    const { data: tokenData } = await supabase
      .from("access_tokens")
      .select("id, token, expires_at")
      .eq("tenant_id", tenant_id)
      .eq("revoked", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let activeToken = tokenData?.token || null;
    const newExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    if (tokenData?.id) {
      if (!tokenData.expires_at || new Date(tokenData.expires_at) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
        await supabase
          .from("access_tokens")
          .update({ expires_at: newExpiry, last_used_at: new Date().toISOString() })
          .eq("id", tokenData.id);
      }
    } else {
      const { data: createdToken } = await supabase
        .from("access_tokens")
        .insert({
          tenant_id,
          label: `Sessão Painel - ${data.name || "Loja"}`,
          expires_at: newExpiry,
        })
        .select("token")
        .maybeSingle();
      activeToken = createdToken?.token || null;
    }

    return new Response(
      JSON.stringify({
        ...data,
        access_token: activeToken,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
