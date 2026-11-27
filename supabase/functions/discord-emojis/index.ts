import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchServerAndAppEmojis } from "../_shared/discord-emojis.ts";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    // Get guild_id from tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("discord_guild_id")
      .eq("id", tenant_id)
      .single();

    if (tenantErr || !tenant) {
      throw new Error("Tenant not found");
    }

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = tenant.discord_guild_id;

    if (!botToken) throw new Error("Bot externo não configurado (DISCORD_BOT_TOKEN).");
    if (!guildId) throw new Error("Nenhum servidor Discord conectado a este painel.");

    const emojis = await fetchServerAndAppEmojis(botToken, guildId);

    return new Response(JSON.stringify({ emojis, debug_guild_id: guildId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching emojis:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
