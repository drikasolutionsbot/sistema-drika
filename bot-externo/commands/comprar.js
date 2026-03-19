const { SlashCommandBuilder } = require("discord.js");
const { getProducts } = require("../supabase");
const checkoutHandler = require("../handlers/checkout");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("comprar")
    .setDescription("Comprar um produto diretamente")
    .addStringOption((opt) =>
      opt.setName("produto").setDescription("Nome do produto").setRequired(true)
    ),

  async execute(interaction, tenant) {
    const produtoNome = interaction.options.getString("produto");
    const products = await getProducts(tenant.id);

    const product = products.find(
      (p) => p.name.toLowerCase() === produtoNome.toLowerCase()
    );

    if (!product) {
      return interaction.reply({
        content: `❌ Produto "${produtoNome}" não encontrado. Use **/loja** para ver os disponíveis.`,
        ephemeral: true,
      });
    }

    return checkoutHandler.startCheckout(interaction, tenant, product.id);
  },
};
