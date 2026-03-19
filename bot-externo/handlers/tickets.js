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
  const memberPerms = interaction.member?.permissions;
  if (memberPerms?.has("Administrator")) return true;

  const storeConfig = await getStoreConfig(tenant.id);
  const staffRoleIdRaw = storeConfig?.ticket_staff_role_id;
  if (!staffRoleIdRaw) return false;

  const staffRoleIds = staffRoleIdRaw.split(",").map((s) => s.trim()).filter(Boolean);
  return staffRoleIds.some((rid) => interaction.member?.roles?.cache?.has(rid));
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

  const embedColor = parseInt((storeConfig?.ticket_embed_color || "#2B2D31").replace("#", ""), 16);
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
    new UserSelectMenuBuilder().setCustomId(`ticket_assign_${ticket.id}`).setPlaceholder("Selecione algum membro").setMinValues(1).setMaxValues(1),
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
  const isStaff = await checkStaffPermission(tenant, interaction);
  if (!isStaff) return interaction.reply({ content: "❌ Você não tem permissão para fechar tickets.", ephemeral: true });

  await interaction.deferUpdate();

  const ticket = await getTicketById(ticketId);
  if (!ticket) return interaction.followUp({ content: "❌ Ticket não encontrado.", ephemeral: true });

  await closeTicket(ticketId, interaction.user.username);
  await sendTicketLog(interaction.client, ticket, interaction.user.id, interaction.user.username, "closed", tenant);

  await sendWithIdentity(interaction.channel, tenant, { embeds: [new EmbedBuilder().setTitle("📁 Ticket Arquivado").setDescription(`Ticket arquivado por <@${interaction.user.id}>.`).setColor(0x2B2D31)] });

  try {
    await interaction.channel.setArchived(true);
    await interaction.channel.setLocked(true);
  } catch {}
}

// ── Delete Ticket ──
async function handleDeleteTicket(interaction, tenant, ticketId) {
  const isStaff = await checkStaffPermission(tenant, interaction);
  if (!isStaff) return interaction.reply({ content: "❌ Você não tem permissão para deletar tickets.", ephemeral: true });

  await interaction.deferUpdate();

  const ticket = await getTicketById(ticketId);
  if (!ticket) return interaction.followUp({ content: "❌ Ticket não encontrado.", ephemeral: true });

  await closeTicket(ticketId, interaction.user.username);
  await sendTicketLog(interaction.client, ticket, interaction.user.id, interaction.user.username, "deleted", tenant);

  await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle("🗑️ Ticket Deletado").setDescription(`Ticket deletado por <@${interaction.user.id}>.\nO tópico será excluído em 5 segundos.`).setColor(0x2B2D31)] });

  setTimeout(() => { interaction.channel.delete().catch(() => {}); }, 5000);
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
      embeds: [new EmbedBuilder().setDescription(`${greeting} <@${ticket.discord_user_id}>, você possui um ticket pendente de resposta; se não for respondido, poderá ser fechado.`).setColor(0x2B2D31)],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("Ir para o ticket").setStyle(ButtonStyle.Link).setURL(ticketUrl))],
    });
  } catch {}

  await interaction.channel.send({ content: `🔔 <@${ticket.discord_user_id}>, este é um lembrete sobre seu ticket!` });
  await interaction.editReply({ content: `✅ Lembrete enviado para <@${ticket.discord_user_id}>!` });
}

// ── Assign User to Ticket ──
async function handleAssignTicket(interaction, tenant, ticketId) {
  const selectedUserId = interaction.values?.[0];
  if (!selectedUserId) return;

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
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const now = new Date().toLocaleString("pt-BR");

  let rows = "";
  for (const m of msgs) {
    const ts = new Date(m.createdTimestamp).toLocaleString("pt-BR");
    const author = m.author?.username || "Desconhecido";
    const avatar = m.author?.displayAvatarURL?.({ size: 40 }) || "";
    let content = esc(m.content || "");
    if (!content && m.embeds?.length) content = "<em>[embed]</em>";
    if (!content && m.attachments?.size) content = [...m.attachments.values()].map((a) => `<a href="${esc(a.url)}">${esc(a.name)}</a>`).join(", ");
    if (!content) content = "<em>[sem conteúdo]</em>";

    rows += `<div style="display:flex;gap:12px;padding:8px 16px;border-bottom:1px solid #2f3136;">
      <img src="${avatar}" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;" />
      <div>
        <div><strong style="color:#fff;">${esc(author)}</strong> <span style="color:#72767d;font-size:12px;">${ts}</span></div>
        <div style="color:#dcddde;margin-top:2px;">${content}</div>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(serverName)} - ${esc(ticketName)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#36393f;color:#dcddde;font-family:'Segoe UI',sans-serif;font-size:14px}.header{background:#2f3136;padding:20px;border-bottom:2px solid #202225}.header h1{color:#fff;font-size:18px}.header p{color:#72767d;font-size:12px;margin-top:4px}.footer{background:#2f3136;padding:12px 16px;text-align:center;color:#72767d;font-size:11px;border-top:2px solid #202225}</style></head><body>
<div class="header"><h1>${esc(serverName)} — Transcript</h1><p>${esc(ticketName)} · ${esc(status)} · Gerado em ${now}</p></div>
<div>${rows}</div>
<div class="footer">Transcript gerado automaticamente</div></body></html>`;
}

// ── Send Ticket Log ──
async function sendTicketLog(client, ticket, closedByUserId, closedByUsername, action, tenant) {
  const storeConfig = await getStoreConfig(ticket.tenant_id);

  // Fetch messages
  let msgs = [];
  if (ticket.discord_channel_id) {
    try {
      const ch = await client.channels.fetch(ticket.discord_channel_id);
      const fetched = await ch.messages.fetch({ limit: 100 });
      msgs = [...fetched.values()].reverse();
    } catch {}
  }

  const statusLabel = action === "deleted" ? "Deletado" : "Fechado";
  const htmlTranscript = msgs.length > 0 ? generateHtmlTranscript(msgs, tenant.name || "Servidor", `ticket-${ticket.discord_username}`, statusLabel) : "";

  if (storeConfig?.ticket_logs_channel_id) {
    const logEmbed = new EmbedBuilder()
      .setTitle(`Ticket - ${statusLabel}`)
      .setColor(action === "deleted" ? 0xED4245 : 0x2B2D31)
      .addFields({ name: "👤 Moderador", value: `<@${closedByUserId}>\n@${closedByUsername}`, inline: false })
      .setTimestamp();

    try {
      const logsCh = await client.channels.fetch(storeConfig.ticket_logs_channel_id);

      // Upload transcript to Supabase Storage
      let transcriptUrl = null;
      if (htmlTranscript) {
        const fileName = `transcripts/${ticket.tenant_id}/${ticket.id}.html`;
        const { error: uploadErr } = await supabase.storage.from("tenant-assets").upload(fileName, htmlTranscript, { contentType: "text/html", upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(fileName);
          transcriptUrl = urlData?.publicUrl || null;
        }
      }

      const components = transcriptUrl ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("Ver transcript").setEmoji("📜").setStyle(ButtonStyle.Link).setURL(transcriptUrl))] : [];

      if (htmlTranscript) {
        const { AttachmentBuilder } = require("discord.js");
        const attachment = new AttachmentBuilder(Buffer.from(htmlTranscript), { name: `transcript-${ticket.id.slice(0, 8)}.html` });
        await logsCh.send({ embeds: [logEmbed], components, files: [attachment] });
      } else {
        await logsCh.send({ embeds: [logEmbed], components });
      }
    } catch (e) { console.error("Ticket log error:", e.message); }
  }

  // DM transcript to user
  if (htmlTranscript) {
    try {
      const user = await client.users.fetch(ticket.discord_user_id);
      const { AttachmentBuilder } = require("discord.js");
      const attachment = new AttachmentBuilder(Buffer.from(htmlTranscript), { name: `transcript-${ticket.id.slice(0, 8)}.html` });
      await user.send({ content: "📜 Aqui está o transcript do seu ticket encerrado.", files: [attachment] });
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

  if (msgs.length === 0) {
    // Check if transcript exists in storage
    const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(`transcripts/${ticket.tenant_id}/${ticket.id}.html`);
    if (urlData?.publicUrl) {
      return interaction.editReply({ content: `📜 Acesse o transcript: ${urlData.publicUrl}` });
    }
    return interaction.editReply({ content: "📜 O transcript está anexado como arquivo na mensagem acima." });
  }

  const serverName = interaction.guild?.name || "Servidor";
  const ticketName = `ticket-${ticket.discord_username || ticket.discord_user_id}`;
  const htmlTranscript = generateHtmlTranscript(msgs, serverName, ticketName, "Suporte · transcript");

  // Upload to storage
  let transcriptUrl = null;
  try {
    const fileName = `transcripts/${ticket.tenant_id}/${ticket.id}.html`;
    await supabase.storage.from("tenant-assets").upload(fileName, htmlTranscript, { contentType: "text/html", upsert: true });
    const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(fileName);
    transcriptUrl = urlData?.publicUrl || null;
  } catch {}

  if (transcriptUrl) {
    return interaction.editReply({ content: `📜 Acesse o transcript: ${transcriptUrl}` });
  }

  // Fallback: send as file
  const { AttachmentBuilder } = require("discord.js");
  const attachment = new AttachmentBuilder(Buffer.from(htmlTranscript), { name: `transcript-${ticket.id.slice(0, 8)}.html` });
  return interaction.editReply({ content: "📜 Aqui está o transcript:", files: [attachment] });
}

module.exports = {
  openTicket, handleCloseTicket, handleDeleteTicket,
  handleRemindTicket, handleAssignTicket,
  showRenameModal, handleRenameModal,
  checkStaffPermission, sendTicketLog,
  handleTranscriptView,
};
