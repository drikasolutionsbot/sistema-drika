const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { applyDrikaCover } = require("../drikaTemplate");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Verifica a latência do bot"),

  async execute(interaction, tenant) {
    const sent = Date.now();
    await interaction.reply({ content: "<a:loading:1521565470686445678> Medindo latência...", ephemeral: true });
    const latency = Date.now() - sent;
    const wsLatency = interaction.client.ws.ping;

    const embed = new EmbedBuilder()
      .setTitle("🏓 Pong!")
      .setDescription(
        `**Latência:** ${latency}ms\n` +
        `**WebSocket:** ${wsLatency}ms\n` +
        `**Tenant:** ${tenant.name}\n` +
        `**Plano:** ${tenant.plan}`
      )
      .setColor(latency < 200 ? 0x57f287 : latency < 500 ? 0xfee75c : 0xed4245)
      .setTimestamp();
    applyDrikaCover(embed);

    return interaction.editReply({ embeds: [embed] });
  },
};
