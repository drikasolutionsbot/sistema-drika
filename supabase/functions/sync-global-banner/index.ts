import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper: download URL → data URI base64
const urlToDataUri = async (url: string): Promise<string | null> => {
  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.error("Failed to download asset:", url, r.status);
      return null;
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    const ct = r.headers.get("content-type") || "image/png";
    return `data:${ct};base64,${base64}`;
  } catch (e) {
    console.error("Error downloading asset:", url, e);
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify admin or service role
    const authHeader = req.headers.get("Authorization");
    const apiKeyHeader = req.headers.get("apikey");
    if (!authHeader && !apiKeyHeader) throw new Error("Missing auth");
    const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, "") : apiKeyHeader)?.trim() || "";

    let isServiceRole = token === serviceRoleKey || apiKeyHeader === serviceRoleKey;
    if (!isServiceRole && token.includes(".")) {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.role === "service_role") {
            isServiceRole = true;
          }
        }
      } catch (_) {}
    }

    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) throw new Error("Unauthorized");

      const { data: userRole } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      if (userRole?.role !== "admin") throw new Error("Acesso negado");
    }

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) throw new Error("DISCORD_BOT_TOKEN not configured");

    // Get global config
    const { data: config } = await supabase.from("landing_config").select("global_bot_banner_url").limit(1).single();
    const globalBannerUrl = config?.global_bot_banner_url;

    if (!globalBannerUrl) {
      return new Response(JSON.stringify({ success: true, message: "No global banner configured." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const globalDataUri = await urlToDataUri(globalBannerUrl);
    if (!globalDataUri) throw new Error("Failed to process global banner image");

    // Fetch all tenants that have a discord_guild_id
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id, name, plan, discord_guild_id, bot_banner_url")
      .not("discord_guild_id", "is", null);

    if (tenantsError) throw tenantsError;

    let successCount = 0;
    let failCount = 0;

    for (const tenant of tenants || []) {
      if (!tenant.discord_guild_id) continue;

      let bannerToApply: string | null = globalDataUri;

      // If tenant is master and has custom banner, use their custom banner
      if (tenant.plan === "master" && tenant.bot_banner_url) {
        const customDataUri = await urlToDataUri(tenant.bot_banner_url);
        if (customDataUri) {
          bannerToApply = customDataUri;
        }
      }

      console.log(`Syncing banner for tenant ${tenant.name} (${tenant.id}), guild: ${tenant.discord_guild_id}`);
      
      const memberPatch = { banner: bannerToApply };

      try {
        const patchRes = await fetch(
          `https://discord.com/api/v10/guilds/${tenant.discord_guild_id}/members/@me`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(memberPatch),
          }
        );

        if (patchRes.ok) {
          successCount++;
        } else {
          // If rate limited, wait a bit
          const patchBody = await patchRes.text();
          console.error(`Failed to patch banner for ${tenant.name}:`, patchRes.status, patchBody);
          failCount++;
          
          if (patchRes.status === 429) {
            let retryAfter = 1;
            try {
              retryAfter = JSON.parse(patchBody).retry_after || 1;
            } catch (_) {}
            console.log(`Rate limited, waiting ${retryAfter}s...`);
            await new Promise(r => setTimeout(r, retryAfter * 1000));
          }
        }
      } catch (e) {
        console.error(`Error patching banner for ${tenant.name}:`, e);
        failCount++;
      }
      
      // Delay to avoid hitting rate limits too quickly
      await new Promise(r => setTimeout(r, 1000));
    }

    return new Response(JSON.stringify({ success: true, successCount, failCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("sync-global-banner error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
