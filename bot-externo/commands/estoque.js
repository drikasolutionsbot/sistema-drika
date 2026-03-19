const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getProducts, countStock, getStoreConfig } = require("../supabase");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("estoque")
    .setDescription("Veja o estoque atual dos produtos"),

  async execute(interaction, tenant) {
    await interaction.deferReply({ ephemeral: true });

    const [products, storeConfig] = await Promise.all([
      getProducts(tenant.id),
      getStoreConfig(tenant.id),
    ]);

    if (!products.length) {
      return interaction.editReply({ content: "📦 Nenhum produto cadastrado." });
    }

    const embedColor = parseInt((storeConfig?.embed_color || "#FF69B4").replace("#", ""), 16);

    const lines = await Promise.all(
      products.map(async (p) => {
        const stock = await countStock(p.id, tenant.id);
        const emoji = stock > 0 ? "🟢" : "🔴";
        return `${emoji} **${p.name}** — ${stock} unidade(s)`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle("📊 Estoque")
      .setDescription(lines.join("\n"))
      .setColor(embedColor)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
