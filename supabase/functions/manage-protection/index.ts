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

    const body = await req.json();
    const { action, tenant_id } = body;
    if (!tenant_id) throw new Error("tenant_id required");

    const json = (data: any) => new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ---- SETTINGS ----
    if (action === "list_settings") {
      const { data, error } = await supabase
        .from("protection_settings")
        .select("*")
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return json(data);
    }

    if (action === "upsert_setting") {
      const { module_key, enabled, config } = body;
      const { data, error } = await supabase
        .from("protection_settings")
        .upsert(
          { tenant_id, module_key, enabled, config, updated_at: new Date().toISOString() },
          { onConflict: "tenant_id,module_key" }
        )
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    // ---- WHITELIST ----
    if (action === "list_whitelist") {
      const { data, error } = await supabase
        .from("protection_whitelist")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(data);
    }

    if (action === "add_whitelist") {
      const { type, discord_id, label } = body;
      const { data, error } = await supabase
        .from("protection_whitelist")
        .insert({ tenant_id, type, discord_id, label })
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    if (action === "remove_whitelist") {
      const { whitelist_id } = body;
      const { error } = await supabase
        .from("protection_whitelist")
        .delete()
        .eq("id", whitelist_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return json({ success: true });
    }

    // ---- LOGS ----
    if (action === "list_logs") {
      const limit = body.limit || 50;
      const { data, error } = await supabase
        .from("protection_logs")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json(data);
    }

    if (action === "clear_logs") {
      const { error } = await supabase
        .from("protection_logs")
        .delete()
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return json({ success: true });
    }

    // ---- DISCORD SYNC ----
    if (action === "sync_to_discord") {
      // Fetch all settings and whitelist
      const { data: settings } = await supabase
        .from("protection_settings")
        .select("*")
        .eq("tenant_id", tenant_id);

      const { data: whitelist } = await supabase
        .from("protection_whitelist")
        .select("*")
        .eq("tenant_id", tenant_id);

      // Get tenant info for bot token and log channel
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("discord_guild_id, bot_token_encrypted")
        .eq("id", tenant_id)
        .single();

      // Get log channel config
      const { data: channelConfig } = await supabase
        .from("channel_configs")
        .select("discord_channel_id")
        .eq("tenant_id", tenant_id)
        .eq("channel_key", "protection_logs")
        .maybeSingle();

      const enabledSettings = (settings || []).filter((s: any) => s.enabled);
      const disabledSettings = (settings || []).filter((s: any) => !s.enabled);
      const syncedAt = new Date().toISOString();

      // Send sync notification to Discord log channel if configured
      const botToken = tenantData?.bot_token_encrypted || Deno.env.get("DISCORD_BOT_TOKEN");
      const logChannelId = channelConfig?.discord_channel_id;

      if (botToken && logChannelId) {
        const moduleLines = enabledSettings.map((s: any) => `✅ **${s.module_key}**`).join("\n");
        const disabledLines = disabledSettings.map((s: any) => `❌ ~~${s.module_key}~~`).join("\n");
        const whitelistCount = (whitelist || []).length;

        const embed = {
          title: "🛡️ Proteção Sincronizada",
          description: `As configurações de proteção foram atualizadas via painel.`,
          color: 0x57F287,
          fields: [
            {
              name: `Módulos Ativos (${enabledSettings.length})`,
              value: moduleLines || "Nenhum",
              inline: true,
            },
            {
              name: `Módulos Inativos (${disabledSettings.length})`,
              value: disabledLines || "Nenhum",
              inline: true,
            },
            {
              name: "Whitelist",
              value: `${whitelistCount} entrada(s)`,
              inline: true,
            },
          ],
          footer: { text: `Sincronizado em` },
          timestamp: syncedAt,
        };

        try {
          await fetch(`https://discord.com/api/v10/channels/${logChannelId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ embeds: [embed] }),
          });
        } catch (e) {
          console.error("Failed to send Discord sync message:", e);
        }
      }

      return json({
        success: true,
        protection_config: {
          settings: settings || [],
          whitelist: whitelist || [],
          synced_at: syncedAt,
          guild_id: tenantData?.discord_guild_id,
        },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
