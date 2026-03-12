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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user with anon key
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Use service role for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { name, discord_guild_id, primary_color, secondary_color } = body;
    console.log("create-tenant body:", JSON.stringify(body));
    console.log("user:", user.id);

    if (!name || !discord_guild_id) {
      throw new Error("name and discord_guild_id are required");
    }

    // Check if guild is already registered
    const { data: existing } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("discord_guild_id", discord_guild_id)
      .maybeSingle();

    if (existing) {
      throw new Error("Este servidor Discord já está vinculado a uma loja.");
    }

    // Check if user already has a tenant
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingRole) {
      throw new Error("Você já possui uma loja. Acesse o dashboard.");
    }

    // Create tenant with 4-day free trial + auto referral code
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 4);

    const referralCode = crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
    const verifySlug = crypto.randomUUID().replace(/-/g, "").substring(0, 8).toLowerCase();

    // Extract Discord info from the authenticated user
    const discordUsername = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.user_name || null;
    const discordId = user.user_metadata?.provider_id || null;

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        name,
        discord_guild_id,
        primary_color: primary_color || "#FF69B4",
        secondary_color: secondary_color || "#FFD700",
        plan: "free",
        plan_started_at: now.toISOString(),
        plan_expires_at: trialEnd.toISOString(),
        referral_code: referralCode,
        referred_by_tenant_id: body.referred_by_tenant_id || null,
        owner_discord_username: discordUsername,
        owner_discord_id: discordId,
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // Assign owner role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: user.id,
        tenant_id: tenant.id,
        role: "owner",
      });

    if (roleError) throw roleError;

    return new Response(JSON.stringify({ tenant }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("create-tenant error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
