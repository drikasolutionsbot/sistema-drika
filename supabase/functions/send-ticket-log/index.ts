import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCORD_API = "https://discord.com/api/v10";

// ── Helpers ──
function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parseMarkdown(text: string): string {
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/\n/g, "<br>");
}

function formatDuration(diffMs: number): string {
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} minutos`;
  if (mins < 1440) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h} horas`;
  }
  const d = Math.floor(mins / 1440);
  return `${d} dia${d > 1 ? "s" : ""}`;
}

// ── HTML Transcript Generator (matches bot-externo) ──
function generateHtmlTranscript(msgs: any[], serverName: string, ticketName: string, status: string): string {
  const now = new Date().toLocaleString("pt-BR");

  // Gather participants
  const participantMap: Record<string, { username: string; avatar: string; isBot: boolean; count: number }> = {};
  for (const m of msgs) {
    const id = m.author?.id || "unknown";
    if (!participantMap[id]) {
      const avatarUrl = m.author?.avatar
        ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=64`
        : "";
      participantMap[id] = {
        username: m.author?.username || "Desconhecido",
        avatar: avatarUrl,
        isBot: m.author?.bot || false,
        count: 0,
      };
    }
    participantMap[id].count++;
  }
  const participantsList = Object.values(participantMap).sort((a, b) => b.count - a.count);

  // Duration
  const firstMsg = msgs[0];
  const lastMsg = msgs[msgs.length - 1];
  let durationStr = "—";
  if (firstMsg && lastMsg) {
    const diffMs = new Date(lastMsg.timestamp).getTime() - new Date(firstMsg.timestamp).getTime();
    durationStr = formatDuration(diffMs);
  }

  // Participants HTML
  const participantsHtml = participantsList.map((p) => {
    const avatarFallback = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect fill=%22%235865F2%22 width=%2232%22 height=%2232%22 rx=%2216%22/><text x=%2250%25%22 y=%2258%25%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2214%22>${esc(p.username[0] || "?")}</text></svg>`;
    return `<div class="participant">
      <img src="${p.avatar || avatarFallback}" class="participant-avatar" onerror="this.src='${avatarFallback}'" />
      <div class="participant-info">
        <span class="participant-name">${esc(p.username)}${p.isBot ? ' <span class="bot-tag">BOT</span>' : ''}</span>
        <span class="participant-msgs">${p.count} msg${p.count > 1 ? "s" : ""}</span>
      </div>
    </div>`;
  }).join("");

  // Messages HTML
  let rows = "";
  let lastDate = "";
  let lastAuthor = "";

  for (const m of msgs) {
    const date = new Date(m.timestamp);
    const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    if (dateStr !== lastDate) {
      rows += `<div class="date-divider"><span>${esc(dateStr)}</span></div>`;
      lastDate = dateStr;
      lastAuthor = "";
    }

    const author = m.author?.username || "Desconhecido";
    const authorId = m.author?.id || "";
    const avatarHash = m.author?.avatar || "";
    const avatarUrl = avatarHash ? `https://cdn.discordapp.com/avatars/${authorId}/${avatarHash}.png?size=64` : "";
    const isBot = m.author?.bot;
    const isGrouped = authorId === lastAuthor;
    lastAuthor = authorId;

    let content = parseMarkdown(esc(m.content || ""));
    content = content.replace(/&lt;@!?(\d+)&gt;/g, '<span class="mention">@user</span>');
    content = content.replace(/&lt;@&amp;(\d+)&gt;/g, '<span class="mention role">@role</span>');
    content = content.replace(/&lt;#(\d+)&gt;/g, '<span class="mention channel">#channel</span>');

    let embedHtml = "";
    if (m.embeds?.length) {
      for (const emb of m.embeds) {
        const borderColor = emb.color ? `#${emb.color.toString(16).padStart(6, "0")}` : "#5865F2";
        embedHtml += `<div class="embed" style="border-left-color:${borderColor}">`;
        if (emb.author?.name) {
          embedHtml += `<div class="embed-author">`;
          if (emb.author.icon_url) embedHtml += `<img src="${esc(emb.author.icon_url)}" class="embed-author-icon" />`;
          embedHtml += `${esc(emb.author.name)}</div>`;
        }
        if (emb.title) embedHtml += `<div class="embed-title">${esc(emb.title)}</div>`;
        if (emb.description) embedHtml += `<div class="embed-desc">${parseMarkdown(esc(emb.description))}</div>`;
        if (emb.thumbnail?.url) embedHtml += `<img src="${esc(emb.thumbnail.url)}" class="embed-thumb" />`;
        if (emb.fields?.length) {
          embedHtml += `<div class="embed-fields">`;
          for (const f of emb.fields) {
            embedHtml += `<div class="embed-field${f.inline ? " inline" : ""}"><div class="field-name">${esc(f.name)}</div><div class="field-value">${parseMarkdown(esc(f.value))}</div></div>`;
          }
          embedHtml += `</div>`;
        }
        if (emb.image?.url) embedHtml += `<img src="${esc(emb.image.url)}" class="embed-img" />`;
        if (emb.footer?.text) embedHtml += `<div class="embed-footer">${esc(emb.footer.text)}</div>`;
        embedHtml += `</div>`;
      }
    }

    let attachHtml = "";
    if (m.attachments?.length) {
      for (const a of m.attachments) {
        if (a.content_type?.startsWith("image/")) {
          attachHtml += `<a href="${esc(a.url)}" target="_blank" class="attach-link"><img src="${esc(a.url)}" class="attach-img" /></a>`;
        } else {
          const sizeKb = ((a.size || 0) / 1024).toFixed(1);
          attachHtml += `<div class="attach-file"><span class="attach-icon">📎</span><a href="${esc(a.url)}" target="_blank">${esc(a.filename || "arquivo")}</a><span class="file-size">${sizeKb} KB</span></div>`;
        }
      }
    }

    if (!content && !embedHtml && !attachHtml) content = '<span class="empty">[sem conteúdo]</span>';

    if (isGrouped) {
      rows += `<div class="msg grouped">
        <span class="grouped-time">${timeStr}</span>
        <div class="msg-body">
          ${content ? `<div class="msg-content">${content}</div>` : ""}
          ${embedHtml}${attachHtml}
        </div>
      </div>`;
    } else {
      const avatarFallback = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%235865F2%22 width=%2240%22 height=%2240%22 rx=%2220%22/><text x=%2250%25%22 y=%2255%25%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2218%22>${esc(author[0] || "?")}</text></svg>`;
      rows += `<div class="msg">
        <img src="${avatarUrl}" class="avatar" onerror="this.src='${avatarFallback}'" />
        <div class="msg-body">
          <div class="msg-header">
            <span class="author">${esc(author)}</span>${isBot ? '<span class="bot-tag">BOT</span>' : ''}
            <span class="time">${timeStr}</span>
          </div>
          ${content ? `<div class="msg-content">${content}</div>` : ""}
          ${embedHtml}${attachHtml}
        </div>
      </div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ticketName)} — Transcript</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#313338;--bg-secondary:#2b2d31;--bg-tertiary:#1e1f22;--bg-hover:rgba(0,0,0,0.08);--text:#dbdee1;--text-muted:#949ba4;--text-link:#00a8fc;--white:#f2f3f5;--brand:#5865f2;--green:#57f287;--red:#ed4245;--yellow:#fee75c}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.375}
a{color:var(--text-link);text-decoration:none}
a:hover{text-decoration:underline}
.inline-code{background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;font-size:0.85em;font-family:'Consolas','Monaco',monospace}
.code-block{background:var(--bg-tertiary);padding:12px;border-radius:6px;margin:6px 0;overflow-x:auto;font-size:0.85em;font-family:'Consolas','Monaco',monospace;line-height:1.6;border:1px solid rgba(255,255,255,0.04)}
.code-block code{background:none;padding:0;border-radius:0;font-size:1em}
.header{background:var(--bg-secondary);padding:24px;border-bottom:2px solid var(--bg-tertiary);position:sticky;top:0;z-index:10;backdrop-filter:blur(10px)}
.header-top{display:flex;align-items:center;gap:16px}
.header-icon{width:48px;height:48px;background:linear-gradient(135deg,var(--brand),#7289da);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;box-shadow:0 4px 12px rgba(88,101,242,0.3)}
.header h1{color:var(--white);font-size:1.3rem;font-weight:700;line-height:1.2}
.header-sub{color:var(--text-muted);font-size:0.8125rem;margin-top:2px}
.header-stats{display:flex;gap:12px;margin-top:14px;flex-wrap:wrap}
.stat-card{background:var(--bg-tertiary);border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,0.04)}
.stat-card .stat-icon{font-size:1.1rem}
.stat-card .stat-value{color:var(--white);font-weight:700;font-size:0.95rem}
.stat-card .stat-label{color:var(--text-muted);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em}
.summary{background:var(--bg-secondary);margin:16px 24px;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.04)}
.summary-title{color:var(--white);font-weight:700;font-size:0.9rem;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.participants-grid{display:flex;flex-wrap:wrap;gap:8px}
.participant{display:flex;align-items:center;gap:8px;background:var(--bg-tertiary);border-radius:8px;padding:6px 12px 6px 6px;border:1px solid rgba(255,255,255,0.04)}
.participant-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0}
.participant-info{display:flex;flex-direction:column;gap:0}
.participant-name{color:var(--white);font-size:0.8rem;font-weight:600}
.participant-msgs{color:var(--text-muted);font-size:0.65rem}
.messages{padding:8px 0}
.msg{display:flex;gap:16px;padding:4px 24px;margin-top:16px;position:relative}
.msg:hover{background:var(--bg-hover)}
.msg.grouped{margin-top:0;padding-left:80px}
.grouped-time{position:absolute;left:24px;top:6px;width:40px;text-align:center;font-size:0.65rem;color:transparent}
.msg.grouped:hover .grouped-time{color:var(--text-muted)}
.avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0;margin-top:2px;object-fit:cover;background:var(--brand)}
.msg-body{flex:1;min-width:0}
.msg-header{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.author{color:var(--white);font-weight:600;font-size:1rem}
.bot-tag{background:var(--brand);color:#fff;font-size:0.6rem;font-weight:700;padding:1px 5px;border-radius:3px;text-transform:uppercase;letter-spacing:0.02em;position:relative;top:-1px}
.time{color:var(--text-muted);font-size:0.75rem}
.msg-content{color:var(--text);margin-top:2px;word-wrap:break-word;overflow-wrap:break-word;line-height:1.5}
.mention{background:rgba(88,101,242,0.3);color:#c9cdfb;padding:0 3px;border-radius:3px;font-weight:500;cursor:default}
.mention.role{background:rgba(88,101,242,0.2)}
.mention.channel{background:rgba(88,101,242,0.2)}
.date-divider{display:flex;align-items:center;margin:24px 24px 8px;gap:8px}
.date-divider::before,.date-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.06)}
.date-divider span{color:var(--text-muted);font-size:0.75rem;font-weight:600;white-space:nowrap}
.embed{border-left:4px solid var(--brand);background:var(--bg-secondary);border-radius:4px;padding:12px 16px;margin-top:6px;max-width:520px;display:grid;gap:4px;position:relative}
.embed-author{font-size:0.75rem;color:var(--white);font-weight:600;display:flex;align-items:center;gap:6px}
.embed-author-icon{width:20px;height:20px;border-radius:50%}
.embed-title{color:var(--text-link);font-weight:700;font-size:1rem}
.embed-desc{color:var(--text);font-size:0.875rem;line-height:1.5}
.embed-fields{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.embed-field{flex:0 0 100%}
.embed-field.inline{flex:0 0 calc(33.33% - 8px);min-width:100px}
.field-name{color:var(--text-muted);font-size:0.75rem;font-weight:700;text-transform:uppercase;margin-bottom:2px}
.field-value{color:var(--text);font-size:0.875rem}
.embed-img{max-width:100%;border-radius:4px;margin-top:8px}
.embed-thumb{width:80px;height:80px;border-radius:4px;object-fit:cover;float:right;margin-left:16px}
.embed-footer{color:var(--text-muted);font-size:0.75rem;margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04)}
.attach-link{display:inline-block;margin-top:6px}
.attach-img{max-width:400px;max-height:300px;border-radius:8px;display:block;transition:opacity .2s}
.attach-img:hover{opacity:0.85}
.attach-file{margin-top:6px;padding:10px 14px;background:var(--bg-secondary);border:1px solid rgba(255,255,255,0.08);border-radius:8px;display:inline-flex;align-items:center;gap:8px}
.attach-icon{font-size:1.1rem}
.file-size{color:var(--text-muted);font-size:0.75rem}
.empty{color:var(--text-muted);font-style:italic}
.footer{background:var(--bg-secondary);padding:20px 24px;text-align:center;color:var(--text-muted);font-size:0.75rem;border-top:2px solid var(--bg-tertiary);margin-top:24px}
@media(max-width:600px){
  .msg{padding:4px 12px;gap:10px}
  .msg.grouped{padding-left:54px}
  .grouped-time{left:12px}
  .avatar{width:32px;height:32px}
  .header{padding:16px 12px}
  .summary{margin:12px}
  .date-divider{margin:16px 12px 6px}
  .embed-field.inline{flex:0 0 calc(50% - 8px)}
  .attach-img{max-width:100%}
  .stat-card{padding:8px 12px}
}
</style>
</head>
<body>
<div class="header">
  <div class="header-top">
    <div class="header-icon">🎫</div>
    <div>
      <h1>${esc(serverName)}</h1>
      <div class="header-sub">${esc(ticketName)} · ${esc(status)}</div>
    </div>
  </div>
  <div class="header-stats">
    <div class="stat-card"><span class="stat-icon">💬</span><div><div class="stat-value">${msgs.length}</div><div class="stat-label">Mensagens</div></div></div>
    <div class="stat-card"><span class="stat-icon">👥</span><div><div class="stat-value">${participantsList.length}</div><div class="stat-label">Participantes</div></div></div>
    <div class="stat-card"><span class="stat-icon">⏱️</span><div><div class="stat-value">${durationStr}</div><div class="stat-label">Duração</div></div></div>
    <div class="stat-card"><span class="stat-icon">📅</span><div><div class="stat-value">${now}</div><div class="stat-label">Gerado em</div></div></div>
  </div>
</div>
<div class="summary">
  <div class="summary-title">👥 Participantes</div>
  <div class="participants-grid">${participantsHtml}</div>
</div>
<div class="messages">${rows}</div>
<div class="footer">Transcript gerado automaticamente · ${esc(serverName)} · Powered by Drika Hub</div>
</body>
</html>`;
}

// ── Main Handler ──
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

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenant_id)
      .single();

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;
    if (!botToken) {
      return new Response(JSON.stringify({ error: "Bot externo não configurado (DISCORD_BOT_TOKEN)" }), {
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

    // Send log + transcript
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

      // Generate HTML transcript, upload to storage, and send with button
      let transcriptUrl: string | null = null;
      let htmlBuffer: Uint8Array | null = null;

      if (msgs.length > 0) {
        try {
          const htmlTranscript = generateHtmlTranscript(msgs, serverName, ticketName, `Suporte · ${statusLabel.toLowerCase()}`);
          const encoder = new TextEncoder();
          htmlBuffer = encoder.encode(htmlTranscript);

          // Upload to Supabase Storage
          const fileName = `transcripts/${tenant_id}/${ticket_id}.html`;
          const { error: uploadErr } = await supabase.storage
            .from("tenant-assets")
            .upload(fileName, htmlBuffer, {
              contentType: "text/html; charset=utf-8",
              upsert: true,
            });

          if (uploadErr) {
            console.error(`Storage upload error: ${uploadErr.message}`);
          } else {
            console.log(`Transcript uploaded: ${fileName}`);
            const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(fileName);
            if (urlData?.publicUrl) {
              transcriptUrl = `${urlData.publicUrl}?t=${Date.now()}`;
            }
          }
        } catch (genErr) {
          console.error("Transcript generation error:", genErr);
        }
      }

      // Build Discord message with embed + HTML file + button
      const formData = new FormData();
      const payload: any = { embeds: [logEmbed] };

      // Add "Ver Transcript" button if we have a URL
      if (transcriptUrl) {
        payload.components = [{
          type: 1, // ActionRow
          components: [{
            type: 2, // Button
            style: 5, // Link
            label: "Ver Transcript",
            emoji: { name: "🔄" },
            url: transcriptUrl,
          }],
        }];
      }

      // Attach HTML file if available
      if (htmlBuffer) {
        const blob = new Blob([htmlBuffer as BlobPart], { type: "text/html; charset=utf-8" });
        formData.append("files[0]", blob, `transcript-${ticketName}.html`);
        formData.append("payload_json", JSON.stringify(payload));

        await fetch(`${DISCORD_API}/channels/${sc.ticket_logs_channel_id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}` },
          body: formData,
        });
      } else {
        await fetch(`${DISCORD_API}/channels/${sc.ticket_logs_channel_id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      // DM transcript to user
      if (transcriptUrl && ticket.discord_user_id) {
        try {
          // Open DM channel
          const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ recipient_id: ticket.discord_user_id }),
          });
          if (dmRes.ok) {
            const dmChannel = await dmRes.json();
            const dmEmbed = {
              title: "📜 Transcript do Ticket",
              description: `Seu ticket foi **${statusLabel.toLowerCase()}** por **${closed_by || "Painel"}**.\nClique no botão abaixo para visualizar o histórico completo.`,
              color: 0x2B2D31,
              timestamp: closedAt.toISOString(),
              footer: { text: "Drika Hub" },
            };

            await fetch(`${DISCORD_API}/channels/${dmChannel.id}/messages`, {
              method: "POST",
              headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                embeds: [dmEmbed],
                components: [{
                  type: 1,
                  components: [{
                    type: 2,
                    style: 5,
                    label: "Ver Transcript",
                    emoji: { name: "🔄" },
                    url: transcriptUrl,
                  }],
                }],
              }),
            });
          }
        } catch (dmErr) {
          console.error("Failed to DM transcript:", dmErr);
        }
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
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
