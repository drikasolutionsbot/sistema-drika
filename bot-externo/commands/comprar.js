const { SlashCommandBuilder } = require("discord.js");
const { getProducts, supabase } = require("../supabase");
const checkoutHandler = require("../handlers/checkout");
const { trf, resolveOrderLang } = require("../i18n");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("comprar")
    .setDescription("Comprar um produto diretamente")
    .addStringOption((opt) =>
      opt.setName("produto").setDescription("Nome do produto").setRequired(true)
    ),

  async execute(interaction, tenant) {
    const produtoNome = interaction.options.getString("produto");
    const L = await resolveOrderLang(supabase, { tenant_id: tenant.id, tenant_language: tenant.language });
    const products = await getProducts(tenant.id);

    const product = products.find(
      (p) => p.name.toLowerCase() === produtoNome.toLowerCase()
    );

    if (!product) {
      return interaction.reply({
        content: trf(L, "product_not_found_use_store", { product: produtoNome }),
        ephemeral: true,
      });
    }

    return checkoutHandler.startCheckout(interaction, tenant, product.id);
  },
};
