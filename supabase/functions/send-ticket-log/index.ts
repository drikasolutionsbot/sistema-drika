import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCORD_API = "https://discord.com/api/v10";

// Transcript is now sent as Discord embeds + .txt backup

function generateTranscriptText(msgs: any[], serverName: string, ticketName: string, status: string): string {
  const now = new Date().toLocaleString("pt-BR");
  let lines = `══════════════════════════════════════\n`;
  lines += `  ${serverName} — Transcript\n`;
  lines += `  ${ticketName} · ${status} · ${now}\n`;
  lines += `══════════════════════════════════════\n\n`;

  for (const m of msgs) {
    const ts = new Date(m.timestamp).toLocaleString("pt-BR");
    const author = m.author?.username || "Desconhecido";
    let content = m.content || "";
    if (!content && m.embeds?.length) content = "[embed]";
    if (!content && m.attachments?.length) content = m.attachments.map((a: any) => a.url).join("\n");
    if (!content) content = "[sem conteúdo]";
    lines += `[${ts}] ${author}: ${content}\n`;
  }

  lines += `\n══════════════════════════════════════\n`;
  lines += `  Gerado automaticamente por Drika Hub\n`;
  lines += `══════════════════════════════════════`;
  return lines;
}

function generateTranscriptEmbeds(msgs: any[], serverName: string, ticketName: string, status: string): any[] {
  const now = new Date().toLocaleString("pt-BR");
  const embeds: any[] = [];

  // Header embed
  const headerEmbed: any = {
    title: "📜 Transcript",
    description: `**Servidor:** ${serverName}\n**Ticket:** ${ticketName}\n**Status:** ${status}\n**Gerado em:** ${now}`,
    color: 0x2B2D31,
  };
  embeds.push(headerEmbed);

  // Build message lines and split into chunks for embed fields (max 4096 chars per embed description)
  let chunk = "";
  for (const m of msgs) {
    const ts = new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const author = m.author?.username || "Desconhecido";
    let content = m.content || "";
    if (!content && m.embeds?.length) content = "*[embed]*";
    if (!content && m.attachments?.length) content = m.attachments.map((a: any) => `[${a.filename}](${a.url})`).join(", ");
    if (!content) content = "*[sem conteúdo]*";
    // Truncate very long messages
    if (content.length > 200) content = content.substring(0, 197) + "...";

    const line = `\`${ts}\` **${author}:** ${content}\n`;
    
    if ((chunk + line).length > 3900) {
      embeds.push({ description: chunk, color: 0x2B2D31 });
      chunk = line;
    } else {
      chunk += line;
    }
  }
  if (chunk) {
    embeds.push({ description: chunk, color: 0x2B2D31 });
  }

  // Discord max 10 embeds per message
  return embeds.slice(0, 10);
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

    // Send log + transcript as Discord embeds (viewable directly in channel)
    if (sc?.ticket_logs_channel_id && (action === "closed" || action === "deleted")) {
      const logEmbed: any = {
        title: `Ticket - ${statusLabel}`,
        color: action === "deleted" ? 0xED4245 : 0x2B2D31,
        fields: [
          { name: "👤 Moderador", value: `${closed_by || "Painel"}`, inline: true },
          { name: "🎫 Ticket", value: ticketName, inline: true },
        ],
        timestamp: closedAt.toISOString(),
        footer: { text: "Drika Hub • Transcript" },
      };

      if (ticket.product_name) {
        logEmbed.fields.push({ name: "📦 Produto", value: ticket.product_name, inline: true });
      }

      if (msgs.length > 0) {
        const transcriptEmbeds = generateTranscriptEmbeds(msgs, serverName, ticketName, `Suporte · ${statusLabel.toLowerCase()}`);
        const allEmbeds = [logEmbed, ...transcriptEmbeds].slice(0, 10);

        const txtTranscript = generateTranscriptText(msgs, serverName, ticketName, `Suporte · ${statusLabel.toLowerCase()}`);
        const formData = new FormData();
        const blob = new Blob([txtTranscript], { type: "text/plain; charset=utf-8" });
        formData.append("files[0]", blob, `transcript-${ticketName}.txt`);
        formData.append("payload_json", JSON.stringify({ embeds: allEmbeds }));

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
