import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Limpa a capa personalizada do bot no Discord para um tenant específico.
 * Usado quando o plano Master expira/é rebaixado — o banner customizado precisa
 * ser removido tanto no DB quanto efetivamente no perfil do bot na guild.
 *
 * Body: { tenant_id: string }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Limpa no banco
    const { data: tenant, error } = await supabase
      .from("tenants")
      .update({ bot_banner_url: null, updated_at: new Date().toISOString() })
      .eq("id", tenant_id)
      .select("discord_guild_id")
      .single();

    if (error) throw error;

    // 2) Remove a capa do bot na guild via Discord API (e reaplica a global)
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    let discordCleared = false;
    let discordError: string | null = null;

    if (tenant?.discord_guild_id && botToken) {
      try {
        let bannerDataUri: string | null = null;
        
        // Obter capa global para fallback
        const { data: config } = await supabase.from("landing_config").select("global_bot_banner_url").limit(1).single();
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
          `https://discord.com/api/v10/guilds/${tenant.discord_guild_id}/members/@me`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ banner: bannerDataUri }),
          }
        );
        const body = await res.text();
        if (res.ok) {
          discordCleared = true;
          console.log(`[clear-bot-banner] tenant=${tenant_id} guild=${tenant.discord_guild_id} OK`);
        } else {
          discordError = `${res.status} ${body}`;
          console.error(`[clear-bot-banner] discord PATCH failed:`, discordError);
        }
      } catch (e: any) {
        discordError = e.message;
        console.error(`[clear-bot-banner] discord error:`, e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, discordCleared, discordError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("clear-bot-banner error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
