const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getProducts, getCategories, countStock, getStoreConfig, getAllProductFields } = require("../supabase");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("loja")
    .setDescription("Veja os produtos disponíveis na loja"),

  async execute(interaction, tenant) {
    await interaction.reply({ content: "<a:carregadeira:1515809475922100426> Carregando loja..." });

    const [products, categories, storeConfig, allFields] = await Promise.all([
      getProducts(tenant.id),
      getCategories(tenant.id),
      getStoreConfig(tenant.id),
      getAllProductFields(tenant.id),
    ]);

    if (!products.length) {
      return interaction.editReply({
        content: "📦 Nenhum produto disponível no momento.",
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
      .setTitle(storeConfig?.store_title || `<:car:1521242918290194493> ${tenant.name}`)
      .setDescription(storeConfig?.store_description || "Confira nossos produtos disponíveis!")
      .setColor(embedColor)
      .setTimestamp();

    if (storeConfig?.store_logo_url) embed.setThumbnail(storeConfig.store_logo_url);
    if (storeConfig?.store_banner_url) embed.setImage(storeConfig.store_banner_url);

    // Listar produtos
    for (const product of productsWithStock) {
      const price = (product.price_cents / 100).toFixed(2);
      const stockText = product.show_stock ? ` | Estoque: ${product.stockCount}` : "";
      const catName = product.category_id ? categoryMap[product.category_id] : null;
      const catTag = catName ? ` [${catName}]` : "";

      embed.addFields({
        name: `${product.name}${catTag}`,
        value: `R$ ${price}${stockText}\n${product.description || "Sem descrição"}`,
        inline: true,
      });
    }

    // Select menu para escolher produto
    const selectOptions = [];

    for (const p of productsWithStock) {
      const pFields = allFields.filter(f => f.product_id === p.id);
      
      if (pFields.length > 0) {
        // Produto tem campos, adicionar cada campo como uma opção
        for (const f of pFields) {
          const fStock = await countStock(p.id, tenant.id, f.id);
          selectOptions.push({
            label: `${p.name.slice(0, 50)} - ${f.name}`.slice(0, 100),
            description: `R$ ${(f.price_cents / 100).toFixed(2)}${p.show_stock ? ` | Estoque: ${fStock}` : ""}`,
            value: `buy_field:${p.id}:${f.id}`,
            emoji: f.emoji || (fStock > 0 ? "<:check:1521190651146801222>" : "❌"),
          });
        }
      } else {
        // Produto sem campos
        selectOptions.push({
          label: p.name.slice(0, 100),
          description: `R$ ${(p.price_cents / 100).toFixed(2)}${p.show_stock ? ` | Estoque: ${p.stockCount}` : ""}`,
          value: p.id,
          emoji: p.stockCount > 0 ? "<:check:1521190651146801222>" : "❌",
        });
      }
    }

    if (selectOptions.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_product")
        .setPlaceholder("Selecione um produto...")
        .addOptions(selectOptions.slice(0, 25));

      const row = new ActionRowBuilder().addComponents(selectMenu);
      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
