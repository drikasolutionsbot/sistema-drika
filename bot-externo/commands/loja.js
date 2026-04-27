const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getProducts, getCategories, countStock, getStoreConfig } = require("../supabase");
const { applyDrikaCover } = require("../drikaTemplate");
const { tr, trf, resolveOrderLang } = require("../i18n");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("loja")
    .setDescription("Veja os produtos disponíveis na loja"),

  async execute(interaction, tenant) {
    await interaction.deferReply();
    const L = await resolveOrderLang(require("../supabase").supabase, { tenant_id: tenant.id, tenant_language: tenant.language });

    const [products, categories, storeConfig] = await Promise.all([
      getProducts(tenant.id),
      getCategories(tenant.id),
      getStoreConfig(tenant.id),
    ]);

    if (!products.length) {
      return interaction.editReply({
        content: tr(L, "no_products_available"),
      });
    }

    const embedColor = parseInt((storeConfig?.embed_color || tenant.primary_color || "#FF69B4").replace("#", ""), 16);

    // Adicionar contagem de estoque
    const productsWithStock = await Promise.all(
      products.map(async (p) => {
        const stock = await countStock(p.id, tenant.id);
        return { ...p, stockCount: stock };
      })
    );

    // Agrupar por categoria
    const categoryMap = {};
    for (const cat of categories) {
      categoryMap[cat.id] = cat.name;
    }

    const embed = new EmbedBuilder()
      .setTitle(storeConfig?.store_title || `🛒 ${tenant.name}`)
      .setDescription(storeConfig?.store_description || tr(L, "store_products_desc"))
      .setColor(embedColor)
      .setTimestamp();

    if (storeConfig?.store_logo_url) embed.setThumbnail(storeConfig.store_logo_url);
    if (storeConfig?.store_banner_url) embed.setImage(storeConfig.store_banner_url);
    applyDrikaCover(embed);

    // Listar produtos
    for (const product of productsWithStock) {
      const price = (product.price_cents / 100).toFixed(2);
      const stockText = product.show_stock ? ` | ${tr(L, "stock_label_md")}: ${product.stockCount}` : "";
      const catName = product.category_id ? categoryMap[product.category_id] : null;
      const catTag = catName ? ` [${catName}]` : "";

      embed.addFields({
        name: `${product.name}${catTag}`,
        value: `R$ ${price}${stockText}\n${product.description || tr(L, "no_description")}`,
        inline: true,
      });
    }

    // Select menu para escolher produto
    if (productsWithStock.length <= 25) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_product")
        .setPlaceholder(tr(L, "select_product_placeholder"))
        .addOptions(
          productsWithStock.map((p) => ({
            label: p.name.slice(0, 100),
            description: `R$ ${(p.price_cents / 100).toFixed(2)}${p.show_stock ? ` | ${tr(L, "stock_label_md")}: ${p.stockCount}` : ""}`,
            value: p.id,
            emoji: p.stockCount > 0 ? "✅" : "❌",
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);
      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
