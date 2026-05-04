const pingCommand = require("../commands/ping");
const lojaCommand = require("../commands/loja");
const comprarHandler = require("../commands/comprar");
const ticketCommand = require("../commands/ticket");
const painelCommand = require("../commands/painel");
const estoqueCommand = require("../commands/estoque");
const verificarCommand = require("../commands/verificar");
const sorteioCommand = require("../commands/sorteio");
const checkoutHandler = require("../handlers/checkout");
const ticketsHandler = require("../handlers/tickets");
const moderationHandler = require("../handlers/moderation");
const feedbackHandler = require("../handlers/feedback");
const { getTenantByGuild } = require("../supabase");

module.exports = async function handleInteraction(client, interaction) {
  const guildId = interaction.guildId;

  // ── DM interactions: handle feedback buttons/modals (no guild needed) ──
  if (!guildId) {
    if (interaction.isButton()) {
      const cid = interaction.customId;
      if (cid.startsWith("feedback_open:")) return feedbackHandler.openFeedback(interaction, cid.replace("feedback_open:", ""));
      if (cid.startsWith("feedback_rate:")) {
        const [, orderId, rating] = cid.split(":");
        return feedbackHandler.rateFeedback(interaction, orderId, rating);
      }
      // copy_delivered button sent in DM — no tenant needed, order has tenant_id
      if (cid.startsWith("copy_delivered:")) {
        const orderId = cid.replace("copy_delivered:", "");
        return checkoutHandler.copyDelivered(interaction, null, orderId);
      }
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith("feedback_modal:")) {
      const [, orderId, rating] = interaction.customId.split(":");
      return feedbackHandler.submitFeedback(interaction, orderId, rating);
    }
    return;
  }

  const cachedTenant = await client.resolveTenant(guildId);
  const freshTenant = await getTenantByGuild(guildId).catch(() => null);
  const tenant = freshTenant || cachedTenant;

  if (!tenant) {
    if (interaction.isCommand()) {
      await interaction.reply({ content: "❌ Este servidor não está configurado no painel.", ephemeral: true });
    }
    return;
  }

  // ── Slash Commands ──
  if (interaction.isChatInputCommand()) {
    switch (interaction.commandName) {
      case "ping": return pingCommand.execute(interaction, tenant);
      case "loja": return lojaCommand.execute(interaction, tenant);
      case "comprar": return comprarHandler.execute(interaction, tenant);
      case "ticket": return ticketsHandler.openTicket(interaction, tenant);
      case "painel": return painelCommand.execute(interaction, tenant);
      case "estoque": return estoqueCommand.execute(interaction, tenant);
      case "verificar": return verificarCommand.execute(interaction, tenant);
      case "sorteio": return sorteioCommand.execute(interaction, client);
      case "clear": return moderationHandler.handleClear(interaction, tenant);
      case "ban": return moderationHandler.handleBan(interaction, tenant);
      case "kick": return moderationHandler.handleKick(interaction, tenant);
      case "fechar": {
        const { getTicketByChannel } = require("../supabase");
        const ticket = await getTicketByChannel(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: "❌ Este canal não é um ticket ativo.", ephemeral: true });
        return ticketsHandler.handleCloseTicket(interaction, tenant, ticket.id);
      }
    }
  }

  // ── Buttons ──
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // Checkout buttons
    if (customId.startsWith("buy_product:")) return checkoutHandler.startCheckout(interaction, tenant, customId.replace("buy_product:", ""));
    if (customId.startsWith("checkout_pay:")) return checkoutHandler.goToPayment(interaction, tenant, customId.replace("checkout_pay:", ""));
    if (customId.startsWith("checkout_cancel:")) return checkoutHandler.cancelOrder(interaction, tenant, customId.replace("checkout_cancel:", ""));
    if (customId.startsWith("checkout_coupon:")) return checkoutHandler.showCouponModal(interaction, customId.replace("checkout_coupon:", ""));
    if (customId.startsWith("checkout_quantity:")) return checkoutHandler.showQuantityModal(interaction, customId.replace("checkout_quantity:", ""));
    if (customId.startsWith("approve_order:")) return checkoutHandler.approveOrder(interaction, tenant, customId.replace("approve_order:", ""));
    if (customId.startsWith("reject_order:")) return checkoutHandler.rejectOrder(interaction, tenant, customId.replace("reject_order:", ""));
    if (customId.startsWith("cancel_order:")) return checkoutHandler.cancelOrder(interaction, tenant, customId.replace("cancel_order:", ""));
    if (customId.startsWith("copy_pix:")) return checkoutHandler.copyPix(interaction, tenant, customId.replace("copy_pix:", ""));
    if (customId.startsWith("copy_delivered:")) return checkoutHandler.copyDelivered(interaction, tenant, customId.replace("copy_delivered:", ""));
    if (customId.startsWith("mark_delivered_")) return checkoutHandler.markDelivered(interaction, tenant, customId.replace("mark_delivered_", ""));
    if (customId.startsWith("cancel_manual_")) return checkoutHandler.cancelManual(interaction, tenant, customId.replace("cancel_manual_", ""));

    // Ticket buttons
    if (customId.startsWith("ticket_open_")) return ticketsHandler.openTicket(interaction, tenant);
    if (customId.startsWith("ticket_close_")) return ticketsHandler.handleCloseTicket(interaction, tenant, customId.replace("ticket_close_", ""));
    if (customId.startsWith("ticket_delete_")) return ticketsHandler.handleDeleteTicket(interaction, tenant, customId.replace("ticket_delete_", ""));
    if (customId.startsWith("ticket_remind_")) return ticketsHandler.handleRemindTicket(interaction, tenant, customId.replace("ticket_remind_", ""));
    if (customId.startsWith("ticket_rename_")) return ticketsHandler.showRenameModal(interaction, customId.replace("ticket_rename_", ""));

    // View variations / details buttons
    if (customId.startsWith("view_variations:")) return checkoutHandler.viewVariations(interaction, tenant, customId.replace("view_variations:", ""));
    if (customId.startsWith("view_details:")) return checkoutHandler.viewDetails(interaction, tenant, customId.replace("view_details:", ""));

    // Transcript view button
    if (customId.startsWith("transcript_view_")) return ticketsHandler.handleTranscriptView(interaction, tenant, customId.replace("transcript_view_", ""));

    // Legacy compatibility (mensagens antigas)
    if (customId.startsWith("buy_")) return checkoutHandler.startCheckout(interaction, tenant, customId.replace("buy_", ""));
    if (customId.startsWith("field_")) {
      const parts = customId.split("_");
      return checkoutHandler.selectVariation(interaction, tenant, parts[2], parts[1]);
    }
    if (customId.startsWith("confirm_")) return checkoutHandler.goToPayment(interaction, tenant, customId.replace("confirm_", ""));
    if (customId.startsWith("cancel_")) return checkoutHandler.cancelOrder(interaction, tenant, customId.replace("cancel_", ""));
    if (customId === "open_ticket") return ticketsHandler.openTicket(interaction, tenant);
    if (customId === "close_ticket") {
      const { getTicketByChannel } = require("../supabase");
      const ticket = await getTicketByChannel(interaction.channel.id);
      if (ticket) return ticketsHandler.handleCloseTicket(interaction, tenant, ticket.id);
    }
  }

  // ── Select Menus ──
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith("select_variation:")) {
      const productId = interaction.customId.replace("select_variation:", "");
      const selectedValue = interaction.values[0]; // buy_field:productId:fieldId
      const parts = selectedValue.split(":");
      if (parts.length >= 3) return checkoutHandler.selectVariation(interaction, tenant, parts[1], parts[2]);
    }
    if (interaction.customId === "select_product") {
      return checkoutHandler.startCheckout(interaction, tenant, interaction.values[0]);
    }
  }

  // ── User Select Menus ──
  if (interaction.isUserSelectMenu()) {
    if (interaction.customId.startsWith("ticket_assign_")) {
      return ticketsHandler.handleAssignTicket(interaction, tenant, interaction.customId.replace("ticket_assign_", ""));
    }
  }

  // ── Modals ──
  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    if (customId.startsWith("coupon_modal_")) return checkoutHandler.handleCouponModal(interaction, tenant, customId.replace("coupon_modal_", ""));
    if (customId.startsWith("quantity_modal_")) return checkoutHandler.handleQuantityModal(interaction, tenant, customId.replace("quantity_modal_", ""));
    if (customId.startsWith("ticket_rename_modal_")) return ticketsHandler.handleRenameModal(interaction, tenant, customId.replace("ticket_rename_modal_", ""));
  }
};
