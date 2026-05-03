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
    const body = await req.json();
    const { tenant_id, updates, guild_icon_base64 } = body;
    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resolve tenant guild and use external bot token único
    const { data: tenantInfo } = await supabase
      .from("tenants")
      .select("discord_guild_id")
      .eq("id", tenant_id)
      .single();

    const tenantBotToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;

    // Handle guild icon update (separate flow)
    if (guild_icon_base64) {
      if (!tenantInfo?.discord_guild_id) throw new Error("No Discord guild linked");
      if (!tenantBotToken) throw new Error("Bot externo não configurado (DISCORD_BOT_TOKEN)");

      const iconRes = await fetch(
        `https://discord.com/api/v10/guilds/${tenantInfo.discord_guild_id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bot ${tenantBotToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ icon: guild_icon_base64 }),
        }
      );
      if (!iconRes.ok) {
        const errBody = await iconRes.text();
        console.error("Discord guild icon update failed:", iconRes.status, errBody);
        throw new Error("Falha ao atualizar ícone no Discord");
      }
      console.log("Discord guild icon updated successfully");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      throw new Error("No updates provided");
    }

    const allowedFields = ["name", "logo_url", "banner_url", "primary_color", "secondary_color", "language", "bot_status", "bot_status_interval", "bot_prefix", "bot_name", "bot_avatar_url", "bot_banner_url", "discord_guild_id", "ecloud_custom_url", "verify_enabled", "verify_redirect_url", "verify_role_id", "verify_channel_id", "verify_logs_channel_id", "verify_title", "verify_description", "verify_button_label", "verify_embed_color", "verify_image_url", "verify_button_style", "pix_key", "pix_key_type"];
    const safeUpdates: Record<string, string> = {};
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        safeUpdates[key] = updates[key];
      }
    }

    // Master-only enforcement: bloquear bot_banner_url para tenants não-Master
    let blockedMasterOnly = false;
    if ("bot_banner_url" in safeUpdates) {
      const { data: tenantPlan } = await supabase
        .from("tenants")
        .select("plan")
        .eq("id", tenant_id)
        .single();
      if (tenantPlan?.plan !== "master") {
        delete safeUpdates.bot_banner_url;
        blockedMasterOnly = true;
        console.warn(`Tenant ${tenant_id} (plano ${tenantPlan?.plan || "?"}) tentou salvar bot_banner_url — bloqueado (Master only).`);
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      if (blockedMasterOnly) {
        throw new Error("A capa personalizada do bot é exclusiva do plano Master. Esta loja está em outro plano.");
      }
      throw new Error("No valid fields to update");
    }

    // Validate discord_guild_id when connecting a new server
    if (safeUpdates.discord_guild_id && safeUpdates.discord_guild_id !== "null") {
      const guildId = safeUpdates.discord_guild_id;

      // Check format
      if (!/^\d{17,20}$/.test(guildId)) {
        throw new Error("ID do servidor inválido. Deve conter 17-20 dígitos.");
      }

      // Check if already claimed by another tenant
      const { data: existingTenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("discord_guild_id", guildId)
        .neq("id", tenant_id)
        .maybeSingle();

      if (existingTenant) {
        throw new Error("Este servidor já está vinculado a outra loja.");
      }

      // Verify bot is in the server using tenant's bot token
      if (tenantBotToken) {
        const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
          headers: { Authorization: `Bot ${tenantBotToken}` },
        });
        if (!guildRes.ok) {
          if (guildRes.status === 404 || guildRes.status === 403) {
            throw new Error("O bot não está neste servidor. Adicione o bot primeiro.");
          }
        }
      }
    }

    const { data, error } = await supabase
      .from("tenants")
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq("id", tenant_id)
      .select()
      .single();

    if (error) throw error;

    if ("discord_guild_id" in safeUpdates && !safeUpdates.discord_guild_id && tenantInfo?.discord_guild_id) {
      await supabase
        .from("tenant_audit_logs")
        .insert({
          tenant_id,
          action: "disconnect_server",
          entity_type: "servidor",
          entity_id: tenantInfo.discord_guild_id,
          entity_name: data?.name || null,
          actor_name: "Sistema",
          details: { source: "update_tenant" },
        })
        .then(() => undefined, () => undefined);
    }

    // If name was updated, also rename the Discord guild
    if (safeUpdates.name && data.discord_guild_id) {
      const effectiveBotToken = tenantBotToken;
      console.log("Attempting Discord guild rename to:", safeUpdates.name, "for guild:", data.discord_guild_id);
      try {
        if (effectiveBotToken) {
          const renameRes = await fetch(
            `https://discord.com/api/v10/guilds/${data.discord_guild_id}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bot ${effectiveBotToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ name: safeUpdates.name }),
            }
          );
          const resBody = await renameRes.text();
          console.log("Discord guild rename response:", renameRes.status, resBody);
        }
      } catch (discordErr) {
        console.error("Discord guild rename error:", discordErr);
      }
    }

    // If bot_name, bot_avatar_url or bot_banner_url was updated, sync in Discord server
    if ((safeUpdates.bot_name || safeUpdates.bot_avatar_url || "bot_banner_url" in safeUpdates) && data.discord_guild_id && tenantBotToken) {
      try {
        const memberPatch: Record<string, any> = {};

        if (safeUpdates.bot_name) {
          memberPatch.nick = safeUpdates.bot_name;
        }

        // Helper: download URL → data URI base64 (chunked p/ evitar stack overflow)
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

        if (safeUpdates.bot_avatar_url) {
          const dataUri = await urlToDataUri(safeUpdates.bot_avatar_url);
          if (dataUri) memberPatch.avatar = dataUri;
        }

        // Banner é Master-only (já validado acima, então se chegou aqui é permitido)
        if ("bot_banner_url" in safeUpdates) {
          if (safeUpdates.bot_banner_url) {
            const dataUri = await urlToDataUri(safeUpdates.bot_banner_url);
            if (dataUri) memberPatch.banner = dataUri;
          } else {
            memberPatch.banner = null; // remover banner
          }
        }

        if (Object.keys(memberPatch).length > 0) {
          console.log("Syncing bot member profile for guild:", data.discord_guild_id, "fields:", Object.keys(memberPatch));
          const patchRes = await fetch(
            `https://discord.com/api/v10/guilds/${data.discord_guild_id}/members/@me`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bot ${tenantBotToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(memberPatch),
            }
          );
          const patchBody = await patchRes.text();
          console.log("Discord bot member patch response:", patchRes.status, patchBody);

          // Detect Discord banner rate limit and surface a friendly error
          if (!patchRes.ok && "bot_banner_url" in safeUpdates) {
            let isBannerRateLimit = false;
            try {
              const parsed = JSON.parse(patchBody);
              if (parsed?.errors?.banner?._errors?.some((e: any) => e?.code === "BANNER_RATE_LIMIT")) {
                isBannerRateLimit = true;
              }
            } catch (_) { /* ignore */ }

            if (isBannerRateLimit) {
              return new Response(
                JSON.stringify({
                  error: "BANNER_RATE_LIMIT",
                  message: "O Discord limita a troca da capa do bot. Aguarde alguns minutos antes de trocar novamente.",
                  tenant: data,
                }),
                { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      } catch (err) {
        console.error("Discord bot member sync error:", err);
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
