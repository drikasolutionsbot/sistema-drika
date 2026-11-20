// Central authorization guard for tenant-scoped Edge Functions.
// Ensures ONLY the legitimate tenant owner/member (via Access Token or Supabase Auth JWT),
// a verified super_admin, or an internal service_role call can read or mutate tenant data.

export interface TenantAuthResult {
  authorized: boolean;
  isServiceRole?: boolean;
  isSuperAdmin?: boolean;
  userId?: string | null;
  error?: string;
}

export async function verifyTenantAccess(
  req: Request,
  supabaseAdmin: any,
  tenantId: string,
  body?: Record<string, any> | null
): Promise<TenantAuthResult> {
  if (!tenantId || typeof tenantId !== "string") {
    return { authorized: false, error: "tenant_id inválido ou ausente" };
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const apiKeyHeader = req.headers.get("apikey") || "";
  const rawBearer = authHeader.replace(/^Bearer\s+/i, "").trim();

  // 1. Direct service_role match (internal Edge Function or bot-externo call)
  if (
    serviceRoleKey &&
    (rawBearer === serviceRoleKey || apiKeyHeader === serviceRoleKey)
  ) {
    return { authorized: true, isServiceRole: true };
  }

  // 2. Valid tenant access_token (from body._auth_token, body.access_token, body.token, or x-tenant-token header)
  const candidateToken = (
    body?._auth_token ||
    body?.access_token ||
    body?.token ||
    req.headers.get("x-tenant-token") ||
    ""
  )
    .toString()
    .trim();

  if (candidateToken && candidateToken.length >= 16) {
    const { data: tok } = await supabaseAdmin
      .from("access_tokens")
      .select("id, tenant_id, revoked")
      .eq("tenant_id", tenantId)
      .eq("token", candidateToken)
      .eq("revoked", false)
      .maybeSingle();

    if (tok && tok.tenant_id === tenantId && !tok.revoked) {
      return { authorized: true };
    }
  }

  // 3. Valid Supabase Auth user JWT (Discord OAuth or Email/Password login)
  if (rawBearer && rawBearer !== anonKey && rawBearer.includes(".")) {
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabaseAdmin.auth.getUser(rawBearer);

      if (!userErr && user) {
        // 3a. Check user_roles for this tenant or super_admin
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("role, tenant_id")
          .eq("user_id", user.id);

        if (Array.isArray(roles)) {
          if (roles.some((r: any) => r.role === "super_admin")) {
            return { authorized: true, isSuperAdmin: true, userId: user.id };
          }
          if (roles.some((r: any) => r.tenant_id === tenantId)) {
            return { authorized: true, userId: user.id };
          }
        }

        // 3b. Check if Discord OAuth user matches tenant.owner_discord_id
        const discordId =
          user.user_metadata?.provider_id || user.user_metadata?.sub || null;
        if (discordId) {
          const { data: tenantRow } = await supabaseAdmin
            .from("tenants")
            .select("id, owner_discord_id")
            .eq("id", tenantId)
            .maybeSingle();

          if (
            tenantRow &&
            tenantRow.owner_discord_id &&
            String(tenantRow.owner_discord_id) === String(discordId)
          ) {
            return { authorized: true, userId: user.id };
          }
        }
      }
    } catch {
      // fall through to unauthorized
    }
  }

  return {
    authorized: false,
    error: "Acesso não autorizado: somente o proprietário autenticado desta loja pode realizar esta operação.",
  };
}

export async function requireTenantAccess(
  req: Request,
  supabaseAdmin: any,
  tenantId: string,
  body: Record<string, any> | null | undefined,
  corsHeaders: Record<string, string>
): Promise<{ response: Response | null; auth: TenantAuthResult }> {
  const auth = await verifyTenantAccess(req, supabaseAdmin, tenantId, body);
  if (!auth.authorized) {
    return {
      auth,
      response: new Response(
        JSON.stringify({ error: auth.error || "Não autorizado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      ),
    };
  }
  return { auth, response: null };
}
