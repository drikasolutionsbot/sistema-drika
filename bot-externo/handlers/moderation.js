const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { applyDrikaCover } = require("../drikaTemplate");

// ── /clear ──
async function handleClear(interaction, tenant) {
  try {
    const hasPermission =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

    if (!hasPermission) {
      return interaction.reply({ content: "❌ Você não tem permissão para limpar mensagens.", ephemeral: true });
    }

    await interaction.reply({ content: "<a:carregadeira:1520106959582527488> Limpando mensagens...", ephemeral: true });

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased()) {
      return interaction.editReply({ content: "❌ Este comando só funciona em canais de texto." });
    }

    const botMember = interaction.guild?.members?.me;
    const botCanManage = channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageMessages);
    if (!botCanManage) {
      return interaction.editReply({ content: "❌ Não tenho permissão de **Gerenciar Mensagens** neste canal." });
    }

    let totalDeleted = 0;
    let before;
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 100; i++) {
      const msgs = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      if (msgs.size === 0) break;

      before = msgs.last().id;

      const deletable = msgs.filter((m) => m.deletable);
      const recent = deletable.filter((m) => m.createdTimestamp > twoWeeksAgo);
      const old = deletable.filter((m) => m.createdTimestamp <= twoWeeksAgo);

      if (recent.size >= 2) {
        const deleted = await channel.bulkDelete(recent, true);
        totalDeleted += deleted.size;
      } else if (recent.size === 1) {
        try {
          await recent.first().delete();
          totalDeleted += 1;
        } catch {}
      }

      for (const [, m] of old) {
        try {
          await m.delete();
          totalDeleted += 1;
        } catch {}
      }

      if (msgs.size < 100) break;
      await new Promise((r) => setTimeout(r, 350));
    }

    await interaction.editReply({ content: `✅ Limpeza concluída. ${totalDeleted} mensagem(ns) removida(s), incluindo mensagens com embed.` });
  } catch (err) {
    console.error("[handleClear] Error:", err.message);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: "❌ Erro ao limpar o canal. Verifique permissões do bot e tente novamente." }).catch(() => {});
    } else {
      await interaction.reply({ content: "❌ Erro ao limpar o canal.", ephemeral: true }).catch(() => {});
    }
  }
}

// ── /ban ──
async function handleBan(interaction, tenant) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.reply({ content: "❌ Você não tem permissão para banir membros.", ephemeral: true });
  }

  const targetUser = interaction.options.getUser("usuario");
  const reason = interaction.options.getString("motivo") || "Sem motivo especificado";
  if (!targetUser) return interaction.reply({ content: "❌ Especifique um usuário.", ephemeral: true });

  await interaction.reply({ content: "<a:carregadeira:1520106959582527488> Aplicando ban...", ephemeral: true });

  try {
    await interaction.guild.members.ban(targetUser, { reason, deleteMessageSeconds: 604800 });
    const embed = new EmbedBuilder().setTitle("🔨 Usuário Banido").setDescription(`<@${targetUser.id}> foi banido por <@${interaction.user.id}>.`).addFields({ name: "Motivo", value: reason }).setColor(0x2B2D31).setTimestamp();
    applyDrikaCover(embed);
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

  await interaction.reply({ content: "<a:carregadeira:1520106959582527488> Aplicando kick...", ephemeral: true });

  try {
    await interaction.guild.members.kick(targetUser, reason);
    const embed = new EmbedBuilder().setTitle("👢 Usuário Expulso").setDescription(`<@${targetUser.id}> foi expulso por <@${interaction.user.id}>.`).addFields({ name: "Motivo", value: reason }).setColor(0x2B2D31).setTimestamp();
    applyDrikaCover(embed);
    await interaction.editReply({
      embeds: [embed],
    });
  } catch {
    await interaction.editReply({ content: "❌ Erro ao expulsar o usuário." });
  }
}

module.exports = { handleClear, handleBan, handleKick };
