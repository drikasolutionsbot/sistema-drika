import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // CRITICAL SECURITY: Verify caller is super_admin or internal service_role
    const authRes = await verifySuperAdminOrServiceRole(req, supabase);
    if (!authRes.authorized) {
      return new Response(JSON.stringify({ error: authRes.error || "Acesso negado: apenas super admins podem alterar a descrição do bot" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { description } = await req.json();

    if (typeof description !== "string") {
      return new Response(
        JSON.stringify({ error: "description must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (description.length > 400) {
      return new Response(
        JSON.stringify({ error: "Discord limita a descrição em 400 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) {
      return new Response(
        JSON.stringify({ error: "DISCORD_BOT_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PATCH /applications/@me  — Discord API v10
    const res = await fetch("https://discord.com/api/v10/applications/@me", {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("[update-bot-description] Discord error:", res.status, text);
      return new Response(
        JSON.stringify({
          error: `Discord API [${res.status}]`,
          details: text,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let app: any = null;
    try { app = JSON.parse(text); } catch { /* ignore */ }

    return new Response(
      JSON.stringify({
        success: true,
        description: app?.description ?? description,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[update-bot-description] error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
