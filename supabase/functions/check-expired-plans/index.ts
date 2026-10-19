import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if suspend_on_expire is enabled and fetch global banner
    const { data: config } = await supabase
      .from("landing_config")
      .select("suspend_on_expire, global_bot_banner_url")
      .limit(1)
      .single();

    if (config?.suspend_on_expire === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "suspend_on_expire disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    // Find all tenants with expired plans that are still set to pro/master/free
    const { data: expired, error } = await supabase
      .from("tenants")
      .select("id, name, plan, plan_expires_at, bot_banner_url, discord_guild_id")
      .not("plan_expires_at", "is", null)
      .lte("plan_expires_at", now)
      .not("plan", "eq", "expired");

    if (error) throw error;

    let suspended = 0;
    let bannersCleared = 0;
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

    // Helper: restaura banner global do bot na guild
    const clearDiscordBanner = async (guildId: string) => {
      if (!guildId || !botToken) return;
      try {
        let bannerDataUri: string | null = null;
        if (config?.global_bot_banner_url) {
          try {
            const r = await fetch(config.global_bot_banner_url);
            if (r.ok) {
              const buf = new Uint8Array(await r.arrayBuffer());
              let binary = "";
              const chunk = 8192;
              for (let i = 0; i < buf.length; i += chunk) {
                binary += String.fromCharCode(...buf.subarray(i, i + chunk));
              }
              const base64 = btoa(binary);
              const ct = r.headers.get("content-type") || "image/png";
              bannerDataUri = `data:${ct};base64,${base64}`;
            }
          } catch (e) {
            console.error("Failed to download global banner:", e);
          }
        }

        const res = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/@me`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ banner: bannerDataUri }),
          }
        );
        if (!res.ok) {
          const body = await res.text();
          console.error(`[check-expired-plans] discord clear banner failed for guild ${guildId}:`, res.status, body);
        }
      } catch (e) {
        console.error(`[check-expired-plans] discord clear banner error for guild ${guildId}:`, e);
      }
    };

    for (const tenant of expired || []) {
      const updates: Record<string, any> = { plan: "expired", updated_at: now };
      let mustClearDiscord = false;

      // Master perk: custom bot banner. When plan expires, revoke it so the
      // bot volte ao banner global automaticamente.
      if (tenant.plan === "master" && tenant.bot_banner_url) {
        updates.bot_banner_url = null;
        bannersCleared++;
        mustClearDiscord = true;
      }

      await supabase.from("tenants").update(updates).eq("id", tenant.id);

      // Remove a capa efetivamente no Discord (sem isso o bot continua mostrando a antiga)
      if (mustClearDiscord && (tenant as any).discord_guild_id) {
        await clearDiscordBanner((tenant as any).discord_guild_id);
      }

      suspended++;
    }

    if (suspended > 0) {
      console.log(`check-expired-plans: suspended=${suspended} bannersCleared=${bannersCleared}`);
    }

    return new Response(
      JSON.stringify({ success: true, suspended, bannersCleared }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("check-expired-plans error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
