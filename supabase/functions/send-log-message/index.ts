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
    const { token, tenant_id, channel_key, embed, content } = await req.json();

    if (!channel_key) {
      return new Response(JSON.stringify({ error: "channel_key é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resolve tenant
    let resolvedTenantId = tenant_id;

    if (token) {
      const { data: tokenRecord, error: tokenError } = await supabase
        .from("access_tokens")
        .select("tenant_id")
        .eq("token", token)
        .eq("revoked", false)
        .single();

      if (tokenError || !tokenRecord) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      resolvedTenantId = tokenRecord.tenant_id;
    }

    if (!resolvedTenantId) {
      return new Response(JSON.stringify({ error: "tenant_id ou token é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the mapped Discord channel for this key
    const { data: config, error: configError } = await supabase
      .from("channel_configs")
      .select("discord_channel_id")
      .eq("tenant_id", resolvedTenantId)
      .eq("channel_key", channel_key)
      .single();

    if (configError || !config?.discord_channel_id) {
      return new Response(
        JSON.stringify({ error: `Canal não configurado para: ${channel_key}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const discordChannelId = config.discord_channel_id;

    // Resolve bot token from tenant
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("bot_token_encrypted")
      .eq("id", resolvedTenantId)
      .single();
    const botToken = tenantData?.bot_token_encrypted || Deno.env.get("DISCORD_BOT_TOKEN")!;

    // Build Discord message payload
    const messageBody: Record<string, any> = {};

    if (content) {
      messageBody.content = content;
    }

    if (embed) {
      messageBody.embeds = [embed];
    }

    if (!messageBody.content && !messageBody.embeds) {
      return new Response(JSON.stringify({ error: "content ou embed é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send message via Discord Bot API
    const discordRes = await fetch(
      `https://discord.com/api/v10/channels/${discordChannelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageBody),
      }
    );

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      console.error("Discord API error:", errText);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar mensagem no Discord", details: errText }),
        { status: discordRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageData = await discordRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        channel_key,
        discord_channel_id: discordChannelId,
        message_id: messageData.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("send-log-message error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
