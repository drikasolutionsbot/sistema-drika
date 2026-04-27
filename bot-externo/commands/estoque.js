const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getProducts, countStock, getStoreConfig, supabase } = require("../supabase");
const { applyDrikaCover } = require("../drikaTemplate");
const { tr, trf, resolveOrderLang } = require("../i18n");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("estoque")
    .setDescription("Veja o estoque atual dos produtos"),

  async execute(interaction, tenant) {
    await interaction.deferReply({ ephemeral: true });
    const L = await resolveOrderLang(supabase, { tenant_id: tenant.id, tenant_language: tenant.language });

    const [products, storeConfig] = await Promise.all([
      getProducts(tenant.id),
      getStoreConfig(tenant.id),
    ]);

    if (!products.length) {
      return interaction.editReply({ content: tr(L, "no_products_registered") });
    }

    const embedColor = parseInt((storeConfig?.embed_color || "#FF69B4").replace("#", ""), 16);

    const lines = await Promise.all(
      products.map(async (p) => {
        const stock = await countStock(p.id, tenant.id);
        const emoji = stock > 0 ? "🟢" : "🔴";
        return `${emoji} **${p.name}** — ${trf(L, "stock_units", { stock })}`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle(tr(L, "stock_title"))
      .setDescription(lines.join("\n"))
      .setColor(embedColor)
      .setTimestamp();
    applyDrikaCover(embed);

    return interaction.editReply({ embeds: [embed] });
  },
};
