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

    const json = (data: any) =>
      new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // Get welcome config (or return defaults)
    if (action === "get") {
      const { data, error } = await supabase
        .from("welcome_configs")
        .select("*")
        .eq("tenant_id", tenant_id)
        .maybeSingle();
      if (error) throw error;
      return json(data);
    }

    // Upsert welcome config
    if (action === "upsert") {
      const { config } = body;
      if (!config) throw new Error("config required");

      // Check if exists
      const { data: existing } = await supabase
        .from("welcome_configs")
        .select("id")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      let result;
      if (existing) {
        const { data, error } = await supabase
          .from("welcome_configs")
          .update({ ...config, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenant_id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from("welcome_configs")
          .insert({ ...config, tenant_id })
          .select()
          .single();
        if (error) throw error;
        result = data;
      }
      return json(result);
    }

    // Test welcome message - send to Discord
    if (action === "test") {
      const { channel_id, embed_data, content: msgContent } = body;
      if (!channel_id) throw new Error("channel_id required");

      // Use external bot token único
      const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;
      if (!botToken) throw new Error("Bot externo não configurado (DISCORD_BOT_TOKEN)");

      const embedPayload: any = {
        color: parseInt((embed_data.color || "#2B2D31").replace("#", ""), 16),
        title: embed_data.title || undefined,
        description: embed_data.description || undefined,
      };

      if (embed_data.thumbnail_url) embedPayload.thumbnail = { url: embed_data.thumbnail_url };
      if (embed_data.image_url) embedPayload.image = { url: embed_data.image_url };
      if (embed_data.footer_text) {
        embedPayload.footer = { text: embed_data.footer_text };
        if (embed_data.footer_icon_url) embedPayload.footer.icon_url = embed_data.footer_icon_url;
      }
      if (embed_data.timestamp) embedPayload.timestamp = new Date().toISOString();
      if (embed_data.fields?.length) {
        embedPayload.fields = embed_data.fields.map((f: any) => ({
          name: f.name,
          value: f.value,
          inline: f.inline ?? false,
        }));
      }

      const discordPayload: any = { embeds: [embedPayload] };
      if (msgContent) discordPayload.content = msgContent;

      const res = await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(discordPayload),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Discord API error: ${err}`);
      }

      return json({ success: true });
    }

    // Sync config to Discord (bot reads from DB, this just confirms)
    if (action === "sync") {
      return json({ success: true, message: "Config synced. Bot will use latest settings." });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
