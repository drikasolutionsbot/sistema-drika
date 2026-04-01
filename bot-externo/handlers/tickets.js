const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle,
  UserSelectMenuBuilder,
} = require("discord.js");
const {
  getStoreConfig, createTicket, getOpenTickets, closeTicket,
  getTicketById, supabase,
} = require("../supabase");
const { sendWithIdentity } = require("./webhookSender");

// ── Check staff permission ──
async function checkStaffPermission(tenant, interaction) {
  try {
    // In threads, member data may be partial - fetch full member if needed
    let member = interaction.member;
    if (!member?.permissions && interaction.guild) {
      try {
        member = await interaction.guild.members.fetch(interaction.user.id);
      } catch {}
    }

    if (member?.permissions?.has?.("Administrator")) return true;

    const storeConfig = await getStoreConfig(tenant.id);
    const staffRoleIdRaw = storeConfig?.ticket_staff_role_id;
    if (!staffRoleIdRaw) {
      // No staff roles configured - allow admins or ticket owner
      return member?.permissions?.has?.("ManageMessages") || false;
    }

    const staffRoleIds = staffRoleIdRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (staffRoleIds.length === 0) return false;

    const memberRoles = member?.roles?.cache || member?._roles;
    if (memberRoles?.has) {
      return staffRoleIds.some((rid) => memberRoles.has(rid));
    }
    // Fallback: _roles is an array of IDs
    if (Array.isArray(memberRoles)) {
      return staffRoleIds.some((rid) => memberRoles.includes(rid));
    }

    return false;
  } catch (e) {
    console.error("[checkStaffPermission] Error:", e.message);
    return false;
  }
}

// ── Open Ticket (from button or command) ──
async function openTicket(interaction, tenant, targetChannelId = null) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Check existing open tickets
  const existing = await getOpenTickets(tenant.id, userId);
  let hasRealOpen = false;
  for (const t of existing) {
    if (!t.discord_channel_id) continue;
    try {
      const ch = await interaction.client.channels.fetch(t.discord_channel_id);
      if (ch && !ch.archived) { hasRealOpen = true; break; }
      else { await closeTicket(t.id, "system"); }
    } catch { await closeTicket(t.id, "system"); }
  }

  if (hasRealOpen) return interaction.editReply({ content: "⚠️ Você já possui um ticket aberto." });

  const storeConfig = await getStoreConfig(tenant.id);
  let parentChannelId = targetChannelId || storeConfig?.ticket_channel_id || interaction.channel.id;

  // If category, find first text channel
  try {
    const parentCh = await interaction.guild.channels.fetch(parentChannelId);
    if (parentCh?.type === ChannelType.GuildCategory) {
      const textCh = interaction.guild.channels.cache.find((c) => c.parentId === parentChannelId && c.type === ChannelType.GuildText);
      if (textCh) parentChannelId = textCh.id;
    }
  } catch {}

  const ticketSuffix = Date.now().toString(36).slice(-4);
  const threadName = `ticket-${username}-${ticketSuffix}`.toLowerCase().replace(/[^a-z0-9-_]/g, "").substring(0, 100);

  let ticketThread;
  try {
    const parentCh = await interaction.guild.channels.fetch(parentChannelId);
    ticketThread = await parentCh.threads.create({
      name: threadName, type: ChannelType.PrivateThread, autoArchiveDuration: 10080,
      reason: "Ticket de suporte",
    });
    await ticketThread.members.add(userId);
  } catch (err) {
    return interaction.editReply({ content: "❌ Não foi possível criar o ticket." });
  }

  const ticket = await createTicket({
    tenant_id: tenant.id, discord_user_id: userId, discord_username: username,
    discord_channel_id: ticketThread.id, status: "open",
  });

  const embedColor = parseInt((storeConfig?.ticket_embed_color || storeConfig?.embed_color || "#5865F2").replace("#", ""), 16);
  let staffRoleIds = (storeConfig?.ticket_staff_role_id || "").split(",").map((s) => s.trim()).filter(Boolean);

  // Fallback: if no explicit staff roles, use tenant_roles with management permissions
  if (staffRoleIds.length === 0) {
    const { data: fallbackRoles } = await supabase
      .from("tenant_roles")
      .select("discord_role_id")
      .eq("tenant_id", tenant.id)
      .or("can_manage_app.eq.true,can_manage_permissions.eq.true,can_manage_store.eq.true,can_manage_stock.eq.true,can_manage_resources.eq.true,can_manage_protection.eq.true");
    staffRoleIds = [...new Set((fallbackRoles || []).map((r) => r.discord_role_id).filter(Boolean))];
  }

  // Also get panel users with management permissions
  const { data: panelStaffRows } = await supabase
    .from("tenant_permissions")
    .select("discord_user_id")
    .eq("tenant_id", tenant.id)
    .or("can_manage_app.eq.true,can_manage_permissions.eq.true,can_manage_store.eq.true,can_manage_stock.eq.true,can_manage_resources.eq.true,can_manage_protection.eq.true");
  const panelStaffUserIds = [...new Set((panelStaffRows || []).map((r) => r.discord_user_id).filter((id) => id && id !== userId))];

  const staffMentions = staffRoleIds.map((rid) => `<@&${rid}>`).join(" ");
  const contentMention = staffMentions ? `<@${userId}> ${staffMentions}` : `<@${userId}>`;

  const styleMap = { primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger, glass: ButtonStyle.Secondary };
  const btnStyle = styleMap[storeConfig?.ticket_embed_button_style || "glass"] || ButtonStyle.Secondary;

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(storeConfig?.ticket_embed_title || "🎫 Ticket de Suporte")
    .setDescription((storeConfig?.ticket_embed_description || "Seu ticket foi criado! Aguarde atendimento.").replace("{user}", `<@${userId}>`).replace("{ticket_id}", ticket.id.slice(0, 8)))
    .setColor(embedColor);

  if (storeConfig?.ticket_embed_footer) welcomeEmbed.setFooter({ text: storeConfig.ticket_embed_footer });
  if (storeConfig?.ticket_embed_image_url) welcomeEmbed.setImage(storeConfig.ticket_embed_image_url);
  if (storeConfig?.ticket_embed_thumbnail_url) welcomeEmbed.setThumbnail(storeConfig.ticket_embed_thumbnail_url);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_remind_${ticket.id}`).setLabel("Lembrar").setStyle(btnStyle),
    new ButtonBuilder().setCustomId(`ticket_rename_${ticket.id}`).setLabel("Renomear").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_close_${ticket.id}`).setLabel("Arquivar").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_delete_${ticket.id}`).setLabel("Deletar").setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`ticket_assign_${ticket.id}`)
      .setPlaceholder("Selecione algum membro")
  );

  const welcomeMsg = await sendWithIdentity(ticketThread, tenant, {
    content: contentMention, allowedMentions: { users: [userId], roles: staffRoleIds },
    embeds: [welcomeEmbed], components: [row1, row2],
  });

  try { await welcomeMsg.pin(); } catch {}

  // Auto-add staff members to private thread
  try {
    const guild = interaction.guild;
    const members = await guild.members.fetch({ limit: 1000 });
    const guildRoles = await guild.roles.fetch();

    // Find roles with ADMINISTRATOR permission
    const adminRoleIds = new Set([...guildRoles.filter((r) => r.permissions.has("Administrator")).keys()]);
    const effectiveStaffRoleIds = new Set([...staffRoleIds, ...adminRoleIds]);

    const roleBasedStaffIds = members
      .filter((m) => !m.user.bot && m.user.id !== userId)
      .filter((m) => m.roles.cache.some((r) => effectiveStaffRoleIds.has(r.id)))
      .map((m) => m.user.id);

    const allStaffIds = [...new Set([...roleBasedStaffIds, ...panelStaffUserIds])];

    for (const staffId of allStaffIds) {
      try { await ticketThread.members.add(staffId); } catch {}
    }
  } catch (e) { console.error("[TICKET_OPEN] staff auto-add error:", e.message); }

  await interaction.editReply({ content: `✅ Ticket criado! Acesse <#${ticketThread.id}>` });
}

// ── Close Ticket ──
async function handleCloseTicket(interaction, tenant, ticketId) {
  try {
    const isStaff = await checkStaffPermission(tenant, interaction);
    if (!isStaff) {
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ content: "❌ Você não tem permissão para fechar tickets.", ephemeral: true });
      }
      return interaction.reply({ content: "❌ Você não tem permissão para fechar tickets.", ephemeral: true });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    const ticket = await getTicketById(ticketId);
    if (!ticket) return interaction.followUp({ content: "❌ Ticket não encontrado.", ephemeral: true });

    await closeTicket(ticketId, interaction.user.username);

    try {
      await sendTicketLog(interaction.client, ticket, interaction.user.id, interaction.user.username, "closed", tenant);
    } catch (logErr) {
      console.error("[handleCloseTicket] Log error:", logErr.message);
    }

    await interaction.channel.send({
      embeds: [new EmbedBuilder().setTitle("📁 Ticket Arquivado").setDescription(`Ticket arquivado por <@${interaction.user.id}>.`).setColor(parseInt((storeConfig?.embed_color || "#5865F2").replace("#", ""), 16))],
    });

    try {
      await interaction.channel.setArchived(true);
      await interaction.channel.setLocked(true);
    } catch {}
  } catch (err) {
    console.error("[handleCloseTicket] Error:", err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "❌ Erro ao arquivar o ticket.", ephemeral: true });
      } else {
        await interaction.reply({ content: "❌ Erro ao arquivar o ticket.", ephemeral: true });
      }
    } catch {}
  }
}

// ── Delete Ticket ──
async function handleDeleteTicket(interaction, tenant, ticketId) {
  try {
    const isStaff = await checkStaffPermission(tenant, interaction);
    if (!isStaff) {
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ content: "❌ Você não tem permissão para deletar tickets.", ephemeral: true });
      }
      return interaction.reply({ content: "❌ Você não tem permissão para deletar tickets.", ephemeral: true });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    const ticket = await getTicketById(ticketId);
    if (!ticket) return interaction.followUp({ content: "❌ Ticket não encontrado.", ephemeral: true });

    await closeTicket(ticketId, interaction.user.username);

    try {
      await sendTicketLog(interaction.client, ticket, interaction.user.id, interaction.user.username, "deleted", tenant);
    } catch (logErr) {
      console.error("[handleDeleteTicket] Log error:", logErr.message);
    }

    await interaction.channel.send({
      embeds: [new EmbedBuilder().setTitle("🗑️ Ticket Deletado").setDescription(`Ticket deletado por <@${interaction.user.id}>.\nO tópico será excluído em 5 segundos.`).setColor(parseInt((storeConfig?.embed_color || "#5865F2").replace("#", ""), 16))],
    });

    setTimeout(() => { interaction.channel.delete().catch(() => {}); }, 5000);
  } catch (err) {
    console.error("[handleDeleteTicket] Error:", err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "❌ Erro ao deletar o ticket.", ephemeral: true });
      } else {
        await interaction.reply({ content: "❌ Erro ao deletar o ticket.", ephemeral: true });
      }
    } catch {}
  }
}

// ── Remind Ticket ──
async function handleRemindTicket(interaction, tenant, ticketId) {
  await interaction.deferReply({ ephemeral: true });

  const ticket = await getTicketById(ticketId);
  if (!ticket) return interaction.editReply({ content: "❌ Ticket não encontrado." });
  if (ticket.status === "closed") return interaction.editReply({ content: "ℹ️ Este ticket já está fechado." });

  const hour = new Date().getUTCHours() - 3;
  const greeting = hour >= 0 && hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  try {
    const user = await interaction.client.users.fetch(ticket.discord_user_id);
    const ticketUrl = `https://discord.com/channels/${interaction.guild.id}/${ticket.discord_channel_id}`;
    await user.send({
      embeds: [new EmbedBuilder().setDescription(`${greeting} <@${ticket.discord_user_id}>, você possui um ticket pendente de resposta; se não for respondido, poderá ser fechado.`).setColor(parseInt((storeConfig?.embed_color || "#5865F2").replace("#", ""), 16))],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("Ir para o ticket").setStyle(ButtonStyle.Link).setURL(ticketUrl))],
    });
  } catch {}

  await sendWithIdentity(interaction.channel, tenant, { content: `🔔 <@${ticket.discord_user_id}>, este é um lembrete sobre seu ticket!` });
  await interaction.editReply({ content: `✅ Lembrete enviado para <@${ticket.discord_user_id}>!` });
}

// ── Assign User to Ticket ──
async function handleAssignTicket(interaction, tenant, ticketId) {
  const selectedUserId = interaction.values?.[0];
  if (!selectedUserId) return;

  // Only staff can add members
  const isStaff = await checkStaffPermission(tenant, interaction);
  if (!isStaff) {
    return interaction.reply({ content: "❌ Apenas membros da equipe podem adicionar pessoas ao ticket.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const ticket = await getTicketById(ticketId);
  if (!ticket) return interaction.editReply({ content: "❌ Ticket não encontrado." });

  try {
    const ch = await interaction.guild.channels.fetch(ticket.discord_channel_id);
    await ch.members.add(selectedUserId);
    await ch.send({ content: `👤 <@${selectedUserId}> foi adicionado ao ticket por <@${interaction.user.id}>.` });
  } catch {}

  await interaction.editReply({ content: `✅ <@${selectedUserId}> adicionado ao ticket!` });
}

// ── Rename Modal ──
async function showRenameModal(interaction, ticketId) {
  const modal = new ModalBuilder().setCustomId(`ticket_rename_modal_${ticketId}`).setTitle("✏️ Renomear Ticket");
  const input = new TextInputBuilder().setCustomId("new_name").setLabel("Novo nome do ticket").setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(100).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

// ── Rename Modal Submit ──
async function handleRenameModal(interaction, tenant, ticketId) {
  await interaction.deferReply({ ephemeral: true });
  const newName = interaction.fields.getTextInputValue("new_name").trim();
  if (!newName) return interaction.editReply({ content: "❌ Nome inválido." });

  const ticket = await getTicketById(ticketId);
  if (!ticket?.discord_channel_id) return interaction.editReply({ content: "❌ Ticket não encontrado." });

  try {
    const ch = await interaction.guild.channels.fetch(ticket.discord_channel_id);
    await ch.setName(newName.substring(0, 100));
    await interaction.editReply({ content: `✅ Ticket renomeado para: **${newName.substring(0, 100)}**` });
  } catch {
    await interaction.editReply({ content: "❌ Não foi possível renomear o ticket." });
  }
}

// ── HTML Transcript ──
function generateHtmlTranscript(msgs, serverName, ticketName, status) {
  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const now = new Date().toLocaleString("pt-BR");

  const parseMarkdown = (text) => {
    return text
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/__(.+?)__/g, "<u>$1</u>")
      .replace(/~~(.+?)~~/g, "<s>$1</s>")
      .replace(/\n/g, "<br>");
  };

  // Gather participant stats
  const participantMap = {};
  for (const m of msgs) {
    const id = m.author?.id || "unknown";
    if (!participantMap[id]) {
      participantMap[id] = {
        username: m.author?.username || "Desconhecido",
        avatar: m.author?.displayAvatarURL?.({ size: 64, extension: "png" }) || "",
        isBot: m.author?.bot || false,
        count: 0,
      };
    }
    participantMap[id].count++;
  }
  const participantsList = Object.values(participantMap).sort((a, b) => b.count - a.count);

  // Calculate duration
  const firstMsg = msgs[0];
  const lastMsg = msgs[msgs.length - 1];
  let durationStr = "—";
  if (firstMsg && lastMsg) {
    const diffMs = lastMsg.createdTimestamp - firstMsg.createdTimestamp;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) durationStr = `${mins} minutos`;
    else if (mins < 1440) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      durationStr = m > 0 ? `${h}h ${m}m` : `${h} horas`;
    } else {
      const d = Math.floor(mins / 1440);
      durationStr = `${d} dia${d > 1 ? "s" : ""}`;
    }
  }

  // Build participant badges HTML
  let participantsHtml = participantsList.map((p) => {
    const avatarFallback = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect fill=%22%235865F2%22 width=%2232%22 height=%2232%22 rx=%2216%22/><text x=%2250%25%22 y=%2258%25%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2214%22>${esc(p.username[0] || "?")}</text></svg>`;
    return `<div class="participant">
      <img src="${p.avatar || avatarFallback}" class="participant-avatar" onerror="this.src='${avatarFallback}'" />
      <div class="participant-info">
        <span class="participant-name">${esc(p.username)}${p.isBot ? ' <span class="bot-tag">BOT</span>' : ''}</span>
        <span class="participant-msgs">${p.count} msg${p.count > 1 ? "s" : ""}</span>
      </div>
    </div>`;
  }).join("");

  let rows = "";
  let lastDate = "";
  let lastAuthor = "";

  for (const m of msgs) {
    const date = new Date(m.createdTimestamp);
    const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    if (dateStr !== lastDate) {
      rows += `<div class="date-divider"><span>${esc(dateStr)}</span></div>`;
      lastDate = dateStr;
      lastAuthor = "";
    }

    const author = m.author?.username || "Desconhecido";
    const authorId = m.author?.id || "";
    const avatar = m.author?.displayAvatarURL?.({ size: 64, extension: "png" }) || "";
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
          if (emb.author.iconURL) embedHtml += `<img src="${esc(emb.author.iconURL)}" class="embed-author-icon" />`;
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
    if (m.attachments?.size) {
      for (const a of m.attachments.values()) {
        if (a.contentType?.startsWith("image/")) {
          attachHtml += `<a href="${esc(a.url)}" target="_blank" class="attach-link"><img src="${esc(a.url)}" class="attach-img" /></a>`;
        } else {
          const sizeKb = (a.size / 1024).toFixed(1);
          attachHtml += `<div class="attach-file"><span class="attach-icon">📎</span><a href="${esc(a.url)}" target="_blank">${esc(a.name || "arquivo")}</a><span class="file-size">${sizeKb} KB</span></div>`;
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
        <img src="${avatar}" class="avatar" onerror="this.src='${avatarFallback}'" />
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

/* Code */
.inline-code{background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;font-size:0.85em;font-family:'Consolas','Monaco',monospace}
.code-block{background:var(--bg-tertiary);padding:12px;border-radius:6px;margin:6px 0;overflow-x:auto;font-size:0.85em;font-family:'Consolas','Monaco',monospace;line-height:1.6;border:1px solid rgba(255,255,255,0.04)}
.code-block code{background:none;padding:0;border-radius:0;font-size:1em}

/* Header */
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

/* Summary panel */
.summary{background:var(--bg-secondary);margin:16px 24px;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.04)}
.summary-title{color:var(--white);font-weight:700;font-size:0.9rem;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.participants-grid{display:flex;flex-wrap:wrap;gap:8px}
.participant{display:flex;align-items:center;gap:8px;background:var(--bg-tertiary);border-radius:8px;padding:6px 12px 6px 6px;border:1px solid rgba(255,255,255,0.04)}
.participant-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0}
.participant-info{display:flex;flex-direction:column;gap:0}
.participant-name{color:var(--white);font-size:0.8rem;font-weight:600}
.participant-msgs{color:var(--text-muted);font-size:0.65rem}

/* Messages */
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

/* Mentions */
.mention{background:rgba(88,101,242,0.3);color:#c9cdfb;padding:0 3px;border-radius:3px;font-weight:500;cursor:default}
.mention.role{background:rgba(88,101,242,0.2)}
.mention.channel{background:rgba(88,101,242,0.2)}

/* Date divider */
.date-divider{display:flex;align-items:center;margin:24px 24px 8px;gap:8px}
.date-divider::before,.date-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.06)}
.date-divider span{color:var(--text-muted);font-size:0.75rem;font-weight:600;white-space:nowrap}

/* Embeds */
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

/* Attachments */
.attach-link{display:inline-block;margin-top:6px}
.attach-img{max-width:400px;max-height:300px;border-radius:8px;display:block;transition:opacity .2s}
.attach-img:hover{opacity:0.85}
.attach-file{margin-top:6px;padding:10px 14px;background:var(--bg-secondary);border:1px solid rgba(255,255,255,0.08);border-radius:8px;display:inline-flex;align-items:center;gap:8px}
.attach-icon{font-size:1.1rem}
.file-size{color:var(--text-muted);font-size:0.75rem}
.empty{color:var(--text-muted);font-style:italic}

/* Footer */
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

// ── Send Ticket Log ──
async function sendTicketLog(client, ticket, closedByUserId, closedByUsername, action, tenant) {
  console.log(`[sendTicketLog] Starting for ticket ${ticket.id}, action: ${action}`);
  
  let storeConfig;
  try {
    storeConfig = await getStoreConfig(ticket.tenant_id);
  } catch (e) {
    console.error(`[sendTicketLog] Failed to get store config: ${e.message}`);
    return;
  }
  
  const logsChannelId = storeConfig?.ticket_logs_channel_id;
  console.log(`[sendTicketLog] ticket_logs_channel_id: ${logsChannelId || "NOT SET"}`);
  
  if (!logsChannelId) {
    console.warn(`[sendTicketLog] No ticket_logs_channel_id configured, skipping`);
    return;
  }

  let logsCh;
  try {
    logsCh = await client.channels.fetch(logsChannelId);
    if (!logsCh) throw new Error("Channel returned null");
  } catch (e) {
    console.error(`[sendTicketLog] Cannot fetch logs channel ${logsChannelId}: ${e.message}`);
    return;
  }

  // Fetch messages from ticket thread
  let msgs = [];
  if (ticket.discord_channel_id) {
    try {
      const ch = await client.channels.fetch(ticket.discord_channel_id);
      if (ch) {
        const fetched = await ch.messages.fetch({ limit: 100 });
        msgs = [...fetched.values()].reverse();
      }
    } catch (fetchErr) {
      console.error(`[sendTicketLog] Failed to fetch messages: ${fetchErr.message}`);
    }
  }

  const statusLabel = action === "deleted" ? "Deletado" : "Fechado";
  const statusEmoji = action === "deleted" ? "🗑️" : "🔒";
  const embedColor = parseInt((storeConfig?.ticket_embed_color || storeConfig?.embed_color || "#5865F2").replace("#", ""), 16);

  // Calculate duration
  const createdAt = new Date(ticket.created_at);
  const closedAt = new Date();
  const durationMs = closedAt - createdAt;
  const durationMin = Math.floor(durationMs / 60000);
  let durationStr;
  if (durationMin < 60) {
    durationStr = `${durationMin}m`;
  } else if (durationMin < 1440) {
    const h = Math.floor(durationMin / 60);
    const m = durationMin % 60;
    durationStr = m > 0 ? `${h}h ${m}m` : `${h}h`;
  } else {
    const d = Math.floor(durationMin / 1440);
    const h = Math.floor((durationMin % 1440) / 60);
    durationStr = h > 0 ? `${d}d ${h}h` : `${d}d`;
  }

  // Count unique participants
  const participants = new Set(msgs.map((m) => m.author?.id).filter(Boolean));

  const closedAtStr = closedAt.toLocaleDateString("pt-BR") + " " + closedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const logEmbed = new EmbedBuilder()
    .setTitle(`Ticket - ${statusLabel}`)
    .setColor(embedColor)
    .addFields(
      { name: "👤 Moderador", value: `<@${closedByUserId}>\n@${closedByUsername}`, inline: false },
    )
    .setTimestamp()
    .setFooter({ text: `${closedAtStr}` });

  // Build transcript and upload
  let components = [];
  let transcriptFallbackBuffer = null;

  if (msgs.length > 0) {
    let htmlTranscript;
    try {
      htmlTranscript = generateHtmlTranscript(msgs, tenant.name || "Servidor", `ticket-${ticket.discord_username}`, statusLabel);
    } catch (genErr) {
      console.error(`[sendTicketLog] Transcript generation error: ${genErr.message}`);
    }

    if (htmlTranscript) {
      const fileName = `transcripts/${ticket.tenant_id}/${ticket.id}.html`;
      const htmlBuffer = Buffer.from(htmlTranscript, "utf-8");
      transcriptFallbackBuffer = htmlBuffer;

      let transcriptUrl = null;

      // Try upload
      try {
        // First try to remove existing file (upsert can be unreliable)
        await supabase.storage.from("tenant-assets").remove([fileName]);
      } catch {}

      try {
        const { error: uploadErr } = await supabase.storage
          .from("tenant-assets")
          .upload(fileName, htmlBuffer, { contentType: "text/html; charset=utf-8", upsert: true, cacheControl: "no-cache" });

        if (uploadErr) {
          console.error(`[sendTicketLog] Storage upload error: ${uploadErr.message}`);
        } else {
          console.log(`[sendTicketLog] Transcript uploaded: ${fileName}`);
          // Use public URL since bucket is public
          const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(fileName);
          if (urlData?.publicUrl) {
            // Add cache-busting param
            transcriptUrl = `${urlData.publicUrl}?t=${Date.now()}`;
          }
        }
      } catch (storageErr) {
        console.error(`[sendTicketLog] Storage error: ${storageErr.message}`);
      }

      if (transcriptUrl) {
        components = [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel("Ver Transcript").setEmoji("🔄").setStyle(ButtonStyle.Link).setURL(transcriptUrl)
        )];
      }
    }
  }

  try {
    const sendPayload = { embeds: [logEmbed], components };

    // Sempre anexar o HTML quando existir, mesmo com botão ativo
    if (transcriptFallbackBuffer) {
      const { AttachmentBuilder } = require("discord.js");
      sendPayload.files = [new AttachmentBuilder(transcriptFallbackBuffer, { name: `transcript-${ticket.id.slice(0, 8)}.html` })];
    }

    await logsCh.send(sendPayload);
    console.log(`[sendTicketLog] Log sent successfully to ${logsChannelId} (hasButton: ${components.length > 0}, hasFile: ${!!sendPayload.files})`);
  } catch (sendErr) {
    console.error(`[sendTicketLog] Failed to send log: ${sendErr.message}`);
    try {
      await logsCh.send({ embeds: [logEmbed] });
    } catch (e2) {
      console.error(`[sendTicketLog] Fallback also failed: ${e2.message}`);
    }
  }

  // DM transcript to user
  if (components.length > 0) {
    try {
      const user = await client.users.fetch(ticket.discord_user_id);
      const transcriptUrl = components[0].components[0].data.url;
      const dmEmbed = new EmbedBuilder()
        .setTitle("📜 Transcript do Ticket")
        .setDescription(`Seu ticket foi **${statusLabel.toLowerCase()}** por **@${closedByUsername}**.\nClique no botão abaixo para visualizar o histórico completo.`)
        .setColor(embedColor)
        .addFields(
          { name: "Produto", value: ticket.product_name || "Suporte Geral", inline: true },
          { name: "Duração", value: durationStr, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: tenant.name || "Drika Hub" });
      await user.send({
        embeds: [dmEmbed],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel("Ver Transcript").setEmoji("🔄").setStyle(ButtonStyle.Link).setURL(transcriptUrl)
        )],
      });
    } catch {}
  }
}

// ── Transcript View Button ──
async function handleTranscriptView(interaction, tenant, ticketId) {
  await interaction.deferReply({ ephemeral: true });

  const ticket = await getTicketById(ticketId);
  if (!ticket) return interaction.editReply({ content: "❌ Ticket não encontrado." });

  // Try to fetch messages from the ticket channel
  let msgs = [];
  if (ticket.discord_channel_id) {
    try {
      const ch = await interaction.client.channels.fetch(ticket.discord_channel_id);
      const fetched = await ch.messages.fetch({ limit: 100 });
      msgs = [...fetched.values()].reverse();
    } catch {}
  }

  const transcriptFileName = `transcripts/${ticket.tenant_id}/${ticket.id}.html`;

  if (msgs.length === 0) {
    let transcriptUrl = null;
    try {
      const { data: signedData, error: signedErr } = await supabase.storage
        .from("tenant-assets")
        .createSignedUrl(transcriptFileName, 60 * 60 * 24 * 7);

      if (!signedErr && signedData?.signedUrl) {
        transcriptUrl = signedData.signedUrl;
      } else {
        const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(transcriptFileName);
        transcriptUrl = urlData?.publicUrl || null;
      }
    } catch {}

    if (transcriptUrl) {
      return interaction.editReply({
        content: "📜 Clique no botão para abrir o transcript no navegador:",
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel("Abrir Transcript").setEmoji("🔄").setStyle(ButtonStyle.Link).setURL(transcriptUrl)
        )],
      });
    }

    return interaction.editReply({ content: "❌ Transcript ainda não encontrado para este ticket." });
  }

  const serverName = interaction.guild?.name || "Servidor";
  const ticketName = `ticket-${ticket.discord_username || ticket.discord_user_id}`;
  const htmlTranscript = generateHtmlTranscript(msgs, serverName, ticketName, "Suporte · transcript");

  let transcriptUrl = null;
  try {
    const htmlBuffer = Buffer.from(htmlTranscript, "utf-8");
    const { error: uploadErr } = await supabase.storage
      .from("tenant-assets")
      .upload(transcriptFileName, htmlBuffer, { contentType: "text/html; charset=utf-8", upsert: true, cacheControl: "no-cache" });

    if (uploadErr) {
      console.error(`[handleTranscriptView] Storage upload error: ${uploadErr.message}`);
    }

    const { data: signedData, error: signedErr } = await supabase.storage
      .from("tenant-assets")
      .createSignedUrl(transcriptFileName, 60 * 60 * 24 * 7);

    if (!signedErr && signedData?.signedUrl) {
      transcriptUrl = signedData.signedUrl;
    } else {
      if (signedErr) {
        console.error(`[handleTranscriptView] Signed URL error: ${signedErr.message}`);
      }
      const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(transcriptFileName);
      transcriptUrl = urlData?.publicUrl || null;
    }
  } catch (err) {
    console.error(`[handleTranscriptView] Transcript upload error: ${err.message}`);
  }

  if (transcriptUrl) {
    return interaction.editReply({
      content: "📜 Clique no botão para abrir o transcript no navegador:",
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("Abrir Transcript").setEmoji("🔄").setStyle(ButtonStyle.Link).setURL(transcriptUrl)
      )],
    });
  }

  return interaction.editReply({ content: "❌ Não consegui gerar o link do transcript agora. Tente novamente em instantes." });
}

module.exports = {
  openTicket, handleCloseTicket, handleDeleteTicket,
  handleRemindTicket, handleAssignTicket,
  showRenameModal, handleRenameModal,
  checkStaffPermission, sendTicketLog,
  handleTranscriptView,
};
