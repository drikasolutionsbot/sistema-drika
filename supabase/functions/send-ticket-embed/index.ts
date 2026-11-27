import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tr, getTenantLang } from "../_shared/i18n.ts";
import { formatCdnUrl } from "../_shared/utils.ts";
import { buildTicketPanelPayload } from "../_shared/ticket-panel.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      tenant_id,
      channel_id,
      title,
      description,
      button_label,
      button_style,
      embed_color,
      image_url,
      thumbnail_url,
      footer,
      how_it_works_title,
      how_it_works,
    } = await req.json();

    if (!tenant_id || !channel_id) {
      return new Response(JSON.stringify({ error: "tenant_id and channel_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("ticket_message_id, ticket_channel_id")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;

    if (!botToken) {
      return new Response(JSON.stringify({ error: "Bot externo nao configurado (DISCORD_BOT_TOKEN)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch active ticket categories
    const { data: categories } = await supabase
      .from("ticket_categories")
      .select("id, emoji, name, description")
      .eq("tenant_id", tenant_id)
      .eq("active", true)
      .order("sort_order", { ascending: true });

    const hasCategories = Boolean(categories && categories.length > 0);
    const safeImageUrl = typeof image_url === "string" && image_url.trim() ? formatCdnUrl(image_url.trim()) : null;
    const safeThumbnailUrl = typeof thumbnail_url === "string" && thumbnail_url.trim() ? formatCdnUrl(thumbnail_url.trim()) : null;

    // Banner só aparece se foi explicitamente configurado pelo usuário nas configs do ticket
    const lang = await getTenantLang(supabase, tenant_id);

    const payload = buildTicketPanelPayload({
      tenantId: tenant_id,
      channelId: channel_id,
      title,
      description,
      howItWorksTitle: how_it_works_title,
      howItWorks: how_it_works,
      footer,
      buttonLabel: button_label,
      buttonStyle: button_style,
      embedColor: embed_color,
      imageUrl: safeImageUrl,
      thumbnailUrl: safeThumbnailUrl,
      categories: (categories as any[]) || [],
      defaultTitle: tr(lang, "ticket_default_title"),
      defaultDescription: tr(lang, "ticket_default_desc"),
      defaultOpenTicketLabel: tr(lang, "open_ticket"),
    });

    const existingMessageId = storeConfig?.ticket_message_id;
    const existingChannelId = storeConfig?.ticket_channel_id;
    let messageId: string;

    if (existingMessageId && existingChannelId) {
      try {
        await fetch(
          `https://discord.com/api/v10/channels/${existingChannelId}/messages/${existingMessageId}`,
          { method: "DELETE", headers: { Authorization: `Bot ${botToken}` } }
        );
        // console.log("Deleted old ticket embed from channel", existingChannelId);
      } catch (err) {
        // console.log("Failed to delete old message, continuing:", err);
      }
    }

    const res = await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Discord API error:", errText);
      return new Response(JSON.stringify({ error: "Failed to send message", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await res.json();
    messageId = result.id;

    await supabase
      .from("store_configs")
      .update({ ticket_message_id: messageId!, ticket_channel_id: channel_id })
      .eq("tenant_id", tenant_id);

    return new Response(JSON.stringify({ success: true, message_id: messageId!, used_categories: hasCategories }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
