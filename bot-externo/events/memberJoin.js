const { EmbedBuilder } = require("discord.js");
const { getStoreConfig } = require("../supabase");

module.exports = async function handleMemberJoin(client, member) {
  const tenant = await client.resolveTenant(member.guild.id);
  if (!tenant) return;

  // Verificação: adicionar cargo ao entrar (se verificação desativada)
  if (!tenant.verify_enabled && tenant.verify_role_id) {
    try {
      await member.roles.add(tenant.verify_role_id);
    } catch {}
  }

  // Log de entrada (se configurado canal de logs de membros)
  const storeConfig = await getStoreConfig(tenant.id);
  if (storeConfig?.logs_channel_id) {
    try {
      const logsChannel = await member.guild.channels.fetch(storeConfig.logs_channel_id);
      const embed = new EmbedBuilder()
        .setTitle("👋 Novo Membro")
        .setDescription(
          `${member} entrou no servidor.\n` +
          `**Conta criada:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n` +
          `**Total de membros:** ${member.guild.memberCount}`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setColor(0x5865f2)
        .setTimestamp();
      await logsChannel.send({ embeds: [embed] });
    } catch {}
  }
};
