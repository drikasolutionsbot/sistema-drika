// manage-gateway-settings — Admin-only CRUD for platform-level gateway enable/disable
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifySuperAdminOrServiceRole(
  req: Request,
  supabase: any
): Promise<{ authorized: boolean; error?: string; user?: any; isServiceRole?: boolean }> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const apiKeyHeader = req.headers.get("apikey");

  const rawToken = (authHeader ? authHeader.replace(/^Bearer\s+/i, "") : apiKeyHeader)?.trim();
  if (!rawToken) {
    return { authorized: false, error: "Acesso não autorizado: token de autenticação ausente" };
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  // 1. Direct Service Role Key match
  if (serviceRoleKey && (rawToken === serviceRoleKey || apiKeyHeader === serviceRoleKey)) {
    return { authorized: true, isServiceRole: true };
  }

  // 2. JWT with service_role payload
  if (rawToken.includes(".")) {
    try {
      const parts = rawToken.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.role === "service_role") {
          return { authorized: true, isServiceRole: true };
        }
      }
    } catch {
      // Ignore parse failure, proceed to getUser
    }
  }

  // 3. User JWT verification
  const { data: { user }, error: authError } = await supabase.auth.getUser(rawToken);
  if (authError || !user) {
    return { authorized: false, error: "Acesso não autorizado: sessão de usuário inválida ou expirada" };
  }

  // 4. Check super_admin in user_roles
  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .maybeSingle();

  if (roleError || !roleRow) {
    return { authorized: false, error: "Acesso negado: permissão de super_admin necessária" };
  }

  return { authorized: true, user, isServiceRole: false };
}

// All known gateways with their display metadata
const ALL_GATEWAYS = [
  { key: "mercadopago",  label: "Mercado Pago",        color: "#3b82f6" },
  { key: "stripe",       label: "Stripe",               color: "#8b5cf6" },
  { key: "pushinpay",    label: "PushinPay",            color: "#f97316" },
  { key: "efi",          label: "Efí (Gerencianet)",    color: "#10b981" },
  { key: "misticpay",    label: "MisticPay",            color: "#a855f7" },
  { key: "abacatepay",   label: "AbacatePay",           color: "#84cc16" },
  { key: "lofypay",      label: "LofyPay",              color: "#06b6d4" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, gateway_key, enabled, visible } = body;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ── LIST — return all gateways with their platform settings ──────────
    if (action === "list") {
      const { data: rows } = await supabase
        .from("platform_gateway_settings")
        .select("*");

      const settingsMap = new Map((rows || []).map((r: any) => [r.gateway_key, r]));

      const result = ALL_GATEWAYS.map((gw) => {
        const saved = settingsMap.get(gw.key);
        return {
          key: gw.key,
          label: gw.label,
          color: gw.color,
          // defaults: enabled=true, visible=true (if no row saved yet)
          enabled:  saved ? saved.enabled  : true,
          visible:  saved ? saved.visible  : true,
          updated_at: saved?.updated_at ?? null,
        };
      });

      const splitRow = settingsMap.get("system_split_wallet");
      const splitEnabled = splitRow ? splitRow.enabled : true;

      if (body.include_split) {
        return new Response(JSON.stringify({ gateways: result, split_wallet_enabled: splitEnabled }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET SPLIT MODE ───────────────────────────────────────────────────
    if (action === "get_split_mode") {
      const { data } = await supabase
        .from("platform_gateway_settings")
        .select("enabled")
        .eq("gateway_key", "system_split_wallet")
        .maybeSingle();

      return new Response(JSON.stringify({ enabled: data ? data.enabled : true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SET SPLIT MODE ───────────────────────────────────────────────────
    if (action === "set_split_mode") {
      const authRes = await verifySuperAdminOrServiceRole(req, supabase);
      if (!authRes.authorized) {
        return new Response(JSON.stringify({ error: authRes.error || "Acesso negado: apenas super admins podem alterar o split" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { enabled } = body;
      const { error } = await supabase
        .from("platform_gateway_settings")
        .upsert({
          gateway_key: "system_split_wallet",
          enabled: Boolean(enabled),
          visible: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "gateway_key" });

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, enabled: Boolean(enabled) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE — upsert a gateway setting ────────────────────────────────
    if (action === "update") {
      const authRes = await verifySuperAdminOrServiceRole(req, supabase);
      if (!authRes.authorized) {
        return new Response(JSON.stringify({ error: authRes.error || "Acesso negado: apenas super admins podem alterar gateways" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!gateway_key) {
        return new Response(JSON.stringify({ error: "missing gateway_key" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const upsertData: any = {
        gateway_key,
        updated_at: new Date().toISOString(),
      };
      if (typeof enabled === "boolean") upsertData.enabled = enabled;
      if (typeof visible === "boolean") upsertData.visible = visible;

      const { error } = await supabase
        .from("platform_gateway_settings")
        .upsert(upsertData, { onConflict: "gateway_key" });

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown_action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[manage-gateway-settings]", e);
    return new Response(JSON.stringify({ error: e.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
