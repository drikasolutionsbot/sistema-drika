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
    const { email, password, whatsapp, name } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if email already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (emailExists) {
      return new Response(JSON.stringify({ error: "Este email já está cadastrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { whatsapp: whatsapp || null },
    });

    if (authError) {
      console.error("Auth create error:", authError.message);
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const tenantName = name || email.split("@")[0];

    // 2. Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: tenantName,
        whatsapp: whatsapp || null,
        plan: "free",
      })
      .select()
      .single();

    if (tenantError) {
      console.error("Tenant create error:", tenantError.message);
      // Cleanup: delete the auth user
      await supabase.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "Erro ao criar loja: " + tenantError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Assign owner role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        tenant_id: tenant.id,
        role: "owner",
      });

    if (roleError) {
      console.error("Role assign error:", roleError.message);
    }

    // 4. Generate access token
    const { data: tokenData, error: tokenError } = await supabase
      .from("access_tokens")
      .insert({
        tenant_id: tenant.id,
        label: `Token inicial - ${tenantName}`,
        created_by: userId,
      })
      .select("token")
      .single();

    if (tokenError) {
      console.error("Token generate error:", tokenError.message);
      return new Response(
        JSON.stringify({
          success: true,
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          token: null,
          message: "Conta criada, mas não foi possível gerar o token. Entre em contato com o suporte.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        token: tokenData.token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("register-client error:", error.message);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
