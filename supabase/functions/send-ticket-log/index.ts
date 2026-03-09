import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCORD_API = "https://discord.com/api/v10";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, ticket_id, action, closed_by, discord_channel_id } = await req.json();

    if (!tenant_id || !ticket_id) {
      return new Response(JSON.stringify({ error: "tenant_id and ticket_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get bot token
    const { data: tenant } = await supabase
      .from("tenants")
      .select("bot_token_encrypted")
      .eq("id", tenant_id)
      .single();

    const botToken = tenant?.bot_token_encrypted || Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) {
      return new Response(JSON.stringify({ error: "Bot token not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ticket details
    const { data: ticket } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticket_id)
      .single();

    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get logs channel
    const { data: sc } = await supabase
      .from("store_configs")
      .select("ticket_logs_channel_id")
      .eq("tenant_id", tenant_id)
      .single();

    // Send log embed
    if (sc?.ticket_logs_channel_id && action === "closed") {
      const logEmbed = {
        title: "🔒 Ticket Fechado (Painel)",
        color: 0xED4245,
        fields: [
          { name: "👤 Usuário", value: `<@${ticket.discord_user_id}> (${ticket.discord_username || "N/A"})`, inline: true },
          { name: "🔐 Fechado por", value: closed_by || "Painel", inline: true },
          { name: "📅 Criado em", value: `<t:${Math.floor(new Date(ticket.created_at).getTime() / 1000)}:f>`, inline: true },
          { name: "📅 Fechado em", value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      };

      if (ticket.product_name) {
        logEmbed.fields.push({ name: "📦 Produto", value: ticket.product_name, inline: true });
      }

      await fetch(`${DISCORD_API}/channels/${sc.ticket_logs_channel_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [logEmbed] }),
      });
    }

    // Delete the Discord channel if it exists
    const channelToDelete = discord_channel_id || ticket.discord_channel_id;
    if (channelToDelete && action === "closed") {
      try {
        // Send closing message first
        await fetch(`${DISCORD_API}/channels/${channelToDelete}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: "🔒 Ticket Fechado",
              description: `Este ticket foi fechado pelo painel.\nO canal será excluído em 10 segundos.`,
              color: 0xED4245,
            }],
          }),
        });

        // Wait and delete
        await new Promise((r) => setTimeout(r, 10000));
        await fetch(`${DISCORD_API}/channels/${channelToDelete}`, {
          method: "DELETE",
          headers: { Authorization: `Bot ${botToken}` },
        });
      } catch (e) {
        console.error("Failed to delete ticket channel:", e);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
