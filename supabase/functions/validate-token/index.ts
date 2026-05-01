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
    const { token } = await req.json();
    if (!token) throw new Error("Token é obrigatório");

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find the token (busca pelo valor do token, que é único; revoked é checado abaixo)
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("access_tokens")
      .select("*, tenants(name)")
      .eq("token", token)
      .maybeSingle();

    if (!tokenError && tokenRecord && tokenRecord.revoked) {
      return new Response(JSON.stringify({ error: "Token revogado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tokenError || !tokenRecord) {
      return new Response(JSON.stringify({ error: "Token inválido ou revogado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiration — se o token expirou mas o tenant ainda existe,
    // estendemos automaticamente para que o cliente possa entrar e ver o
    // overlay de plano expirado (e renovar via PIX). NUNCA bloqueamos por aqui.
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("access_tokens")
        .update({ expires_at: newExpiry })
        .eq("id", tokenRecord.id);
      tokenRecord.expires_at = newExpiry;
    }

    // Check IP if restricted
    if (tokenRecord.allowed_ip && tokenRecord.allowed_ip !== clientIp) {
      return new Response(JSON.stringify({ error: "IP não autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_used_at
    await supabase
      .from("access_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    // Check if plan is expired
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("plan, plan_expires_at")
      .eq("id", tokenRecord.tenant_id)
      .single();

    const planExpired = tenantData?.plan === "pro" && tenantData?.plan_expires_at && new Date(tenantData.plan_expires_at) < new Date();

    return new Response(
      JSON.stringify({
        valid: true,
        tenant_id: tokenRecord.tenant_id,
        tenant_name: tokenRecord.tenants?.name,
        label: tokenRecord.label,
        client_ip: clientIp,
        plan_expired: !!planExpired,
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
