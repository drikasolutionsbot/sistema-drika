import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCORD_API = "https://discord.com/api/v10";

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateHtmlTranscript(msgs: any[], serverName: string, ticketName: string, status: string): string {
  const now = new Date().toLocaleString("pt-BR");

  let rows = "";
  for (const m of msgs) {
    const ts = new Date(m.timestamp).toLocaleString("pt-BR");
    const author = m.author?.username || "Desconhecido";
    const avatar = m.author?.avatar
      ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=40`
      : `https://cdn.discordapp.com/embed/avatars/${(parseInt(m.author?.id || "0") >> 22) % 6}.png`;
    let content = escHtml(m.content || "");
    if (!content && m.embeds?.length) content = "<em>[embed]</em>";
    if (!content && m.attachments?.length) content = m.attachments.map((a: any) => `<a href="${escHtml(a.url)}">${escHtml(a.filename)}</a>`).join(", ");
    if (!content) content = "<em>[sem conteúdo]</em>";
    content = content.replace(/&lt;@!?(\d+)&gt;/g, '<span style="color:#7289da;font-weight:600">@user</span>');

    rows += `<div style="display:flex;gap:12px;padding:8px 16px;border-bottom:1px solid #2f3136;">
      <img src="${avatar}" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;margin-top:2px;" />
      <div>
        <div><strong style="color:#fff;">${escHtml(author)}</strong> <span style="color:#72767d;font-size:12px;">${ts}</span></div>
        <div style="color:#dcddde;margin-top:2px;">${content}</div>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(serverName)} - ${escHtml(status)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #36393f; color: #dcddde; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; }
    .header { background: #2f3136; padding: 20px; border-bottom: 2px solid #202225; }
    .header h1 { color: #fff; font-size: 18px; }
    .header p { color: #72767d; font-size: 12px; margin-top: 4px; }
    .messages { padding: 8px 0; }
    .footer { background: #2f3136; padding: 12px 16px; text-align: center; color: #72767d; font-size: 11px; border-top: 2px solid #202225; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escHtml(serverName)} — Transcript</h1>
    <p>${escHtml(ticketName)} · ${escHtml(status)} · Gerado em ${now}</p>
  </div>
  <div class="messages">${rows}</div>
  <div class="footer">Transcript gerado automaticamente por Drika Hub</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, ticket_id, action, closed_by, discord_channel_id, new_name } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get bot token + tenant name
    const { data: tenant } = await supabase
      .from("tenants")
      .select("bot_token_encrypted, name")
      .eq("id", tenant_id)
      .single();

    const botToken = tenant?.bot_token_encrypted || Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) {
      return new Response(JSON.stringify({ error: "Bot token not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── RENAME ACTION ──────────────────────────────────────
    if (action === "rename" && discord_channel_id && new_name) {
      const renameRes = await fetch(`${DISCORD_API}/channels/${discord_channel_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: new_name.substring(0, 100) }),
      });

      if (!renameRes.ok) {
        const errText = await renameRes.text();
        return new Response(JSON.stringify({ error: "Failed to rename", details: errText }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CLOSE/DELETE ACTION ────────────────────────────────
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { data: sc } = await supabase
      .from("store_configs")
      .select("ticket_logs_channel_id")
      .eq("tenant_id", tenant_id)
      .single();

    const channelToProcess = discord_channel_id || ticket.discord_channel_id;
    const serverName = tenant?.name || "Servidor";

    // Fetch messages for transcript
    let msgs: any[] = [];
    if (channelToProcess) {
      try {
        const msgsRes = await fetch(`${DISCORD_API}/channels/${channelToProcess}/messages?limit=100`, {
          headers: { Authorization: `Bot ${botToken}` },
        });
        if (msgsRes.ok) {
          msgs = await msgsRes.json();
          msgs = msgs.reverse();
        }
      } catch (e) { console.error("Transcript fetch error:", e); }
    }

    const closedAt = new Date();
    const statusLabel = action === "deleted" ? "Deletado" : "Fechado";
    const ticketName = `ticket-${ticket.discord_username || ticket.discord_user_id}`;

    // Generate HTML transcript
    const htmlTranscript = msgs.length > 0
      ? generateHtmlTranscript(msgs, serverName, ticketName, `Suporte · ${statusLabel.toLowerCase()}`)
      : "";

    // Send log embed + transcript to logs channel
    if (sc?.ticket_logs_channel_id && action === "closed") {
      const logEmbed: any = {
        title: `Ticket - ${statusLabel}`,
        color: 0x2B2D31,
        fields: [
          { name: "👤 Moderador", value: `${closed_by || "Painel"}\n@${closed_by || "painel"}`, inline: false },
        ],
        timestamp: closedAt.toISOString(),
      };

      if (ticket.product_name) {
        logEmbed.fields.push({ name: "📦 Produto", value: ticket.product_name, inline: false });
      }

      if (htmlTranscript) {
        const formData = new FormData();
        const blob = new Blob([htmlTranscript], { type: "text/html" });
        formData.append("files[0]", blob, `transcript-${ticket.discord_channel_id || ticket.id.slice(0, 8)}.html`);
        formData.append("payload_json", JSON.stringify({
          embeds: [logEmbed],
          components: [{
            type: 1,
            components: [{
              type: 2,
              style: 2,
              label: "Ver transcript",
              emoji: { name: "📜" },
              custom_id: `transcript_view_${ticket.id}`,
            }],
          }],
        }));

        await fetch(`${DISCORD_API}/channels/${sc.ticket_logs_channel_id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}` },
          body: formData,
        });
      } else {
        await fetch(`${DISCORD_API}/channels/${sc.ticket_logs_channel_id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [logEmbed] }),
        });
      }
    }

    // Archive and lock the thread if it exists
    if (channelToProcess && action === "closed") {
      try {
        await fetch(`${DISCORD_API}/channels/${channelToProcess}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: "🔒 Ticket Fechado",
              description: `Este ticket foi fechado pelo painel.\nO tópico será arquivado.`,
              color: 0xED4245,
            }],
          }),
        });

        await fetch(`${DISCORD_API}/channels/${channelToProcess}`, {
          method: "PATCH",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true, locked: true }),
        });
      } catch (e) {
        console.error("Failed to archive ticket thread:", e);
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
