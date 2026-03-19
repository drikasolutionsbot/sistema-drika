const lojaCommand = require("../commands/loja");
const comprarHandler = require("../commands/comprar");
const ticketCommand = require("../commands/ticket");
const painelCommand = require("../commands/painel");
const estoqueCommand = require("../commands/estoque");
const checkoutHandler = require("../handlers/checkout");

module.exports = async function handleInteraction(client, interaction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const tenant = await client.resolveTenant(guildId);
  if (!tenant) {
    if (interaction.isCommand()) {
      await interaction.reply({
        content: "❌ Este servidor não está configurado no painel. Vincule o Guild ID nas configurações.",
        ephemeral: true,
      });
    }
    return;
  }

  // ── Slash Commands ──
  if (interaction.isChatInputCommand()) {
    switch (interaction.commandName) {
      case "loja":
        return lojaCommand.execute(interaction, tenant);
      case "comprar":
        return comprarHandler.execute(interaction, tenant);
      case "ticket":
        return ticketCommand.execute(interaction, tenant);
      case "painel":
        return painelCommand.execute(interaction, tenant);
      case "estoque":
        return estoqueCommand.execute(interaction, tenant);
    }
  }

  // ── Buttons ──
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // Botão de compra: buy_PRODUCTID
    if (customId.startsWith("buy_")) {
      return checkoutHandler.startCheckout(interaction, tenant, customId.replace("buy_", ""));
    }

    // Botão de selecionar variação: field_FIELDID_PRODUCTID
    if (customId.startsWith("field_")) {
      const parts = customId.split("_");
      return checkoutHandler.selectField(interaction, tenant, parts[1], parts[2]);
    }

    // Confirmar pagamento: confirm_ORDERID
    if (customId.startsWith("confirm_")) {
      return checkoutHandler.confirmPayment(interaction, tenant, customId.replace("confirm_", ""));
    }

    // Cancelar pedido: cancel_ORDERID
    if (customId.startsWith("cancel_")) {
      return checkoutHandler.cancelOrder(interaction, tenant, customId.replace("cancel_", ""));
    }

    // Ticket: open_ticket
    if (customId === "open_ticket") {
      return ticketCommand.openTicket(interaction, tenant);
    }

    // Fechar ticket: close_ticket
    if (customId === "close_ticket") {
      return ticketCommand.closeTicket(interaction, tenant);
    }
  }

  // ── Select Menus ──
  if (interaction.isStringSelectMenu()) {
    // Selecionar produto: select_product
    if (interaction.customId === "select_product") {
      const productId = interaction.values[0];
      return checkoutHandler.startCheckout(interaction, tenant, productId);
    }
  }
};
