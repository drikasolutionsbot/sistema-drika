const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Link para o painel de gerenciamento"),

  async execute(interaction, tenant) {
    const embed = new EmbedBuilder()
      .setTitle("🔗 Painel de Gerenciamento")
      .setDescription(
        `Acesse o painel para gerenciar produtos, configurações e mais.\n\n` +
        `**[Acessar Painel](https://drikabotteste.lovable.app)**\n\n` +
        `Tenant: **${tenant.name}**\nPlano: **${tenant.plan}**`
      )
      .setColor(parseInt((tenant.primary_color || "#FF69B4").replace("#", ""), 16))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
