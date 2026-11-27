const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { applyDrikaCover } = require("../drikaTemplate");

function isGuildAdminMember(member, guild, tenant) {
  if (!member) return false;
  const userId = member.id || member.user?.id;
  if (guild?.ownerId && userId === guild.ownerId) return true;
  if (tenant?.owner_discord_id && userId === tenant.owner_discord_id) return true;
  return Boolean(member.permissions?.has(PermissionFlagsBits.Administrator));
}

async function cleanChannelMessages(channel, { limit = null, keepPinned = true, excludeIds = [] } = {}) {
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const excludeSet = new Set((excludeIds || []).map(String));
  const targetLimit = typeof limit === "number" && limit > 0 ? Math.min(limit, 1000) : null;

  let totalDeleted = 0;
  let before;

  for (let i = 0; i < 25; i++) {
    if (targetLimit !== null && totalDeleted >= targetLimit) break;

    const remaining = targetLimit !== null ? targetLimit - totalDeleted : 100;
    const fetchLimit = Math.min(100, targetLimit !== null ? Math.max(remaining + excludeSet.size, 10) : 100);
    const msgs = await channel.messages.fetch({ limit: fetchLimit, ...(before ? { before } : {}) });
    if (msgs.size === 0) break;

    before = msgs.last().id;

    const eligible = [];
    for (const [, m] of msgs) {
      if (excludeSet.has(m.id)) continue;
      if (keepPinned && m.pinned) continue;
      if (!m.deletable) continue;
      eligible.push(m);
      if (targetLimit !== null && totalDeleted + eligible.length >= targetLimit) break;
    }

    const recent = eligible.filter((m) => m.createdTimestamp > twoWeeksAgo);
    const old = eligible.filter((m) => m.createdTimestamp <= twoWeeksAgo);

    if (recent.length >= 2) {
      try {
        const deleted = await channel.bulkDelete(recent, true);
        totalDeleted += deleted.size;
      } catch {
        for (const m of recent) {
          try { await m.delete(); totalDeleted += 1; } catch {}
        }
      }
    } else if (recent.length === 1) {
      try { await recent[0].delete(); totalDeleted += 1; } catch {}
    }

    for (const m of old) {
      try { await m.delete(); totalDeleted += 1; } catch {}
    }

    if (msgs.size < fetchLimit) break;
    await new Promise((r) => setTimeout(r, 350));
  }

  return totalDeleted;
}

function buildCleanSummaryMessage(deletedCount, userId) {
  const ts = Math.floor(Date.now() / 1000);
  const countText = deletedCount === 1 ? "1 mensagem excluída" : `${deletedCount} mensagens excluídas`;
  const actorText = userId ? `pelo <@${userId}>` : "automaticamente";
  const embed = new EmbedBuilder()
    .setDescription(`O canal teve **${countText}** ${actorText} <t:${ts}:f>`)
    .setColor(0x2b2d31);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("manual_channel_clean")
      .setLabel("Limpeza Manual")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [row],
    allowedMentions: { parse: [] },
  };
}

// ── /clear & /limpar & Limpeza Manual (Somente Administradores) ──
async function handleClear(interaction, tenant) {
  try {
    if (!isGuildAdminMember(interaction.member, interaction.guild, tenant)) {
      return interaction.reply({
        content: "❌ Apenas **Administradores** do servidor podem usar a limpeza de chat.",
        ephemeral: true,
      });
    }

    await interaction.reply({ content: "⏳ Limpando mensagens...", ephemeral: true });

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased()) {
      return interaction.editReply({ content: "❌ Este comando só funciona em canais de texto." });
    }

    const botMember = interaction.guild?.members?.me;
    const botCanManage = channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageMessages);
    if (!botCanManage) {
      return interaction.editReply({ content: "❌ Não tenho permissão de **Gerenciar Mensagens** neste canal." });
    }

    const rawQty = interaction.isChatInputCommand?.() ? interaction.options.getInteger("quantidade") : null;
    const rawKeepPinned = interaction.isChatInputCommand?.() ? interaction.options.getBoolean("manter_fixadas") : null;
    const keepPinned = rawKeepPinned === null || rawKeepPinned === undefined ? true : rawKeepPinned;

    const totalDeleted = await cleanChannelMessages(channel, {
      limit: rawQty && rawQty > 0 ? rawQty : null,
      keepPinned,
    });

    await channel.send(buildCleanSummaryMessage(totalDeleted, interaction.user?.id)).catch(() => {});
    await interaction.editReply({ content: `✅ Limpeza concluída. ${totalDeleted} mensagem(ns) excluída(s).` });
  } catch (err) {
    console.error("[handleClear] Error:", err.message);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: "❌ Erro ao limpar o canal. Verifique permissões do bot e tente novamente." }).catch(() => {});
    } else {
      await interaction.reply({ content: "❌ Erro ao limpar o canal.", ephemeral: true }).catch(() => {});
    }
  }
}

// ── Prefix command: !clear / !limpar / .clear / .limpar ──
async function handleMessageClear(message, tenant) {
  if (!message?.guild || !message?.channel?.isTextBased()) return;

  if (!isGuildAdminMember(message.member, message.guild, tenant)) {
    const warn = await message.reply("❌ Apenas **Administradores** do servidor podem usar a limpeza de chat.").catch(() => null);
    if (warn) setTimeout(() => warn.delete().catch(() => {}), 4000);
    return;
  }

  const botMember = message.guild.members?.me;
  if (!message.channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageMessages)) {
    const warn = await message.reply("❌ Não tenho permissão de **Gerenciar Mensagens** neste canal.").catch(() => null);
    if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
    return;
  }

  const match = message.content.trim().match(/^[!.](?:clear|limpar)(?:\s+(\d+))?$/i);
  const qty = match?.[1] ? parseInt(match[1], 10) : null;

  await message.delete().catch(() => {});
  const totalDeleted = await cleanChannelMessages(message.channel, {
    limit: qty && qty > 0 ? qty : null,
    keepPinned: true,
    excludeIds: [message.id],
  });

  await message.channel.send(buildCleanSummaryMessage(totalDeleted, message.author?.id)).catch(() => {});
}

// ── /ban ──
async function handleBan(interaction, tenant) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.reply({ content: "❌ Você não tem permissão para banir membros.", ephemeral: true });
  }

  const targetUser = interaction.options.getUser("usuario");
  const reason = interaction.options.getString("motivo") || "Sem motivo especificado";
  if (!targetUser) return interaction.reply({ content: "❌ Especifique um usuário.", ephemeral: true });

  await interaction.reply({ content: "⏳ Aplicando ban...", ephemeral: true });

  try {
    await interaction.guild.members.ban(targetUser, { reason, deleteMessageSeconds: 604800 });
    const embed = new EmbedBuilder().setTitle("🔨 Usuário Banido").setDescription(`<@${targetUser.id}> foi banido por <@${interaction.user.id}>.`).addFields({ name: "Motivo", value: reason }).setColor(0xFF69B4).setTimestamp();
    applyDrikaCover(embed, tenant);
    await interaction.editReply({
      embeds: [embed],
    });
  } catch {
    await interaction.editReply({ content: "❌ Erro ao banir o usuário." });
  }
}

// ── /kick ──
async function handleKick(interaction, tenant) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
    return interaction.reply({ content: "❌ Você não tem permissão para expulsar membros.", ephemeral: true });
  }

  const targetUser = interaction.options.getUser("usuario");
  const reason = interaction.options.getString("motivo") || "Sem motivo especificado";
  if (!targetUser) return interaction.reply({ content: "❌ Especifique um usuário.", ephemeral: true });

  await interaction.reply({ content: "⏳ Aplicando kick...", ephemeral: true });

  try {
    await interaction.guild.members.kick(targetUser, reason);
    const embed = new EmbedBuilder().setTitle("👢 Usuário Expulso").setDescription(`<@${targetUser.id}> foi expulso por <@${interaction.user.id}>.`).addFields({ name: "Motivo", value: reason }).setColor(0xFF69B4).setTimestamp();
    applyDrikaCover(embed, tenant);
    await interaction.editReply({
      embeds: [embed],
    });
  } catch {
    await interaction.editReply({ content: "❌ Erro ao expulsar o usuário." });
  }
}

module.exports = { handleClear, handleMessageClear, handleBan, handleKick };
