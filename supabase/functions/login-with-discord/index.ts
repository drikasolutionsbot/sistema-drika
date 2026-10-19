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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Get the JWT from the Authorization header (Supabase session token)
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user session
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anon = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anon.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure this is a Discord user
    const provider = user.app_metadata?.provider;
    if (provider !== "discord") {
      return new Response(JSON.stringify({ error: "Usuário não autenticado via Discord" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const discordUsername =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.user_name ||
      "Usuário Discord";
    const discordId = user.user_metadata?.provider_id || user.user_metadata?.sub || null;
    const discordAvatar = user.user_metadata?.avatar_url || null;
    const userEmail = user.email || null;

    // --- Check if user already has a tenant linked (by auth user_id) ---
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    let tenantId: string;
    let tenantName: string;
    let isNew = false;

    if (roleRow?.tenant_id) {
      // Existing auth user — get tenant info directly
      tenantId = roleRow.tenant_id;
      const { data: tenant } = await admin
        .from("tenants")
        .select("id, name, owner_discord_id, owner_discord_username")
        .eq("id", tenantId)
        .maybeSingle();

      if (!tenant) {
        return new Response(JSON.stringify({ error: "Loja não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      tenantName = tenant.name;

      // Atualiza owner_discord_id/username se ainda estiver vazio (clientes antigos "Sem Discord")
      if (discordId && (!tenant.owner_discord_id || !tenant.owner_discord_username)) {
        await admin
          .from("tenants")
          .update({
            owner_discord_id: discordId,
            owner_discord_username: discordUsername,
          })
          .eq("id", tenantId);
      }
    } else if (discordId) {
      // Sem user_role para este auth user — verifica se já existe um tenant
      // com este discord_id (evita duplicatas quando o mesmo Discord gera múltiplos auth users)
      const { data: existingTenant } = await admin
        .from("tenants")
        .select("id, name")
        .eq("owner_discord_id", discordId)
        .maybeSingle();

      if (existingTenant) {
        // Tenant já existe para este Discord — apenas vincula o auth user atual
        tenantId = existingTenant.id;
        tenantName = existingTenant.name;

        // Vincula o novo auth user_id ao tenant existente (upsert seguro)
        await admin.from("user_roles").upsert(
          { user_id: userId, tenant_id: tenantId, role: "owner" },
          { onConflict: "user_id,tenant_id" }
        );

        // Atualiza username caso tenha mudado
        await admin
          .from("tenants")
          .update({ owner_discord_username: discordUsername })
          .eq("id", tenantId);
      } else {
        // Realmente novo usuário — cria o tenant com trial de 4 dias
        isNew = true;
        const clientIp =
          req.headers.get("cf-connecting-ip") ||
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null;

        const now = new Date();
        const trialExpires = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

        const { data: newTenant, error: tenantError } = await admin
          .from("tenants")
          .insert({
            name: discordUsername,
            email: userEmail,
            whatsapp: null,
            plan: "free",
            plan_started_at: now.toISOString(),
            plan_expires_at: trialExpires.toISOString(),
            registration_ip: clientIp,
            owner_discord_id: discordId,
            owner_discord_username: discordUsername,
          })
          .select()
          .single();

        if (tenantError) {
          // Se falhou por constraint de unicidade (race condition), busca o tenant existente
          if (tenantError.code === "23505") {
            const { data: raceTenant } = await admin
              .from("tenants")
              .select("id, name")
              .eq("owner_discord_id", discordId)
              .maybeSingle();
            if (raceTenant) {
              tenantId = raceTenant.id;
              tenantName = raceTenant.name;
              isNew = false;
              await admin.from("user_roles").upsert(
                { user_id: userId, tenant_id: tenantId, role: "owner" },
                { onConflict: "user_id,tenant_id" }
              );
            } else {
              return new Response(
                JSON.stringify({ error: "Erro ao criar loja: " + tenantError.message }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else {
            console.error("Tenant create error:", tenantError.message);
            return new Response(
              JSON.stringify({ error: "Erro ao criar loja: " + tenantError.message }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          tenantId = newTenant.id;
          tenantName = newTenant.name;

          // Atribui role de owner
          await admin.from("user_roles").insert({
            user_id: userId,
            tenant_id: tenantId,
            role: "owner",
          });
        }
      }
    } else {
      // Sem discord_id e sem tenant — não deveria chegar aqui
      return new Response(JSON.stringify({ error: "Discord ID não encontrado na sessão" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Get or create access token ---
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
      existingToken &&
      (!existingToken.expires_at || new Date(existingToken.expires_at) > new Date());

    if (!token || !stillValid) {
      const expiresAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
      const { data: newToken, error: tokenErr } = await admin
        .from("access_tokens")
        .insert({
          tenant_id: tenantId,
          label: `Login Discord - ${tenantName}`,
          created_by: userId,
          expires_at: expiresAt,
        })
        .select("token")
        .single();

      if (tokenErr || !newToken) {
        return new Response(
          JSON.stringify({ error: "Não foi possível gerar token de acesso" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      token = newToken.token;
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenant_id: tenantId,
        tenant_name: tenantName,
        token,
        is_new: isNew,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("login-with-discord error:", error.message);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
