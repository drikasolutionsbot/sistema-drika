import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Validar credenciais via Supabase Auth (anon client)
    const anon = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await anon.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Email ou senha inválidos" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    // 2. Buscar tenant deste usuário (via user_roles)
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!roleRow?.tenant_id) {
      return new Response(JSON.stringify({ error: "Nenhuma loja vinculada a este email" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = roleRow.tenant_id;

    const { data: tenant } = await admin
      .from("tenants")
      .select("id, name")
      .eq("id", tenantId)
      .maybeSingle();

    if (!tenant) {
      return new Response(JSON.stringify({ error: "Loja não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Reaproveitar token ativo OU gerar um novo (4 dias)
    const { data: existingToken } = await admin
      .from("access_tokens")
      .select("token, expires_at, revoked")
      .eq("tenant_id", tenantId)
      .eq("revoked", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let token = existingToken?.token as string | undefined;
    const stillValid =
      existingToken && (!existingToken.expires_at || new Date(existingToken.expires_at) > new Date());

    if (!token || !stillValid) {
      const expiresAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
      const { data: newToken, error: tokenErr } = await admin
        .from("access_tokens")
        .insert({
          tenant_id: tenantId,
          label: `Login email - ${tenant.name}`,
          created_by: userId,
          expires_at: expiresAt,
        })
        .select("token")
        .single();
      if (tokenErr || !newToken) {
        return new Response(JSON.stringify({ error: "Não foi possível gerar token de acesso" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      token = newToken.token;
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("login-with-email error:", err.message);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
