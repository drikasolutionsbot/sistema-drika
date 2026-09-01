const checkoutHandler = require("../handlers/checkout");
const ticketsHandler = require("../handlers/tickets");

module.exports = async function handleInteraction(client, interaction) {
  const guildId = interaction.guildId;
  if (!guildId && !interaction.isButton() && !interaction.isModalSubmit()) return;

  const tenant = guildId ? await client.resolveTenant(guildId) : null;

  // For DM interactions (buttons/modals)
  let isAllowedDM = false;
  if (!tenant && !guildId) {
    const customId = interaction.customId || "";
    isAllowedDM = customId.startsWith("cancel_order:") || 
                  customId.startsWith("copy_delivered:") || 
                  customId.startsWith("feedback_open:") || 
                  customId.startsWith("feedback_rate:") || 
                  customId.startsWith("feedback_modal:");
    
    if (!isAllowedDM) {
      return;
    }
  }

  // Se não tem tenant e não é uma DM permitida, bloqueia.
  if (!tenant && !isAllowedDM) {
    const canReply = interaction.isCommand() || interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit();
    if (canReply) {
      await interaction.reply({ content: "<:close:1521192513048674505> Este servidor não está configurado no painel.", ephemeral: true }).catch(() => {});
    }
    return;
  }

  // ── Modal Submits ──
  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    if (customId.startsWith("modal_mark_delivered_")) {
      return checkoutHandler.handleMarkDeliveredModal(interaction, tenant, customId.replace("modal_mark_delivered_", ""));
    }
  }

  // ── Buttons ──
  if (interaction.isButton()) {
    const customId = interaction.customId;
    // Checkout buttons
    if (customId.startsWith("notify_restock:")) {
      const parts = customId.split(":");
      const productId = parts[1];
      const fieldId = parts[2] || null;
      const tenantId = tenant.id; // Tenant is already resolved above
      
      const { addRestockNotification } = require("../supabase");
      await addRestockNotification(tenantId, productId, interaction.user.id, fieldId);
      
      return interaction.reply({
        content: "✅ | Notificações ativadas com sucesso.",
        ephemeral: true
      });
    }

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

    // Ticket buttons (handled by Supabase Edge Function to avoid timeouts)
    // if (customId.startsWith("ticket_open_")) return ticketsHandler.openTicket(interaction, tenant);
    
    // Ticket category buttons
    if (customId.startsWith("ticket_category_btn:")) {
      const parts = customId.split(":");
      const categoryId = parts[1];
      if (categoryId) return ticketsHandler.openTicketCategory(interaction, tenant, categoryId);
    }

    // if (customId.startsWith("ticket_close_")) return ticketsHandler.handleCloseTicket(interaction, tenant, customId.replace("ticket_close_", ""));
    // if (customId.startsWith("ticket_delete_")) return ticketsHandler.handleDeleteTicket(interaction, tenant, customId.replace("ticket_delete_", ""));
    // if (customId.startsWith("ticket_remind_")) return ticketsHandler.handleRemindTicket(interaction, tenant, customId.replace("ticket_remind_", ""));
    // if (customId.startsWith("ticket_rename_")) return ticketsHandler.showRenameModal(interaction, customId.replace("ticket_rename_", ""));

    // View variations / details buttons
    if (customId.startsWith("view_variations:")) return checkoutHandler.viewVariations(interaction, tenant, customId.replace("view_variations:", ""));
    if (customId.startsWith("view_details:")) return checkoutHandler.viewDetails(interaction, tenant, customId.replace("view_details:", ""));

    // Transcript view button (handled by Edge Function or bot-externo depending on if Edge Function has it)
    if (customId.startsWith("transcript_view_")) return ticketsHandler.handleTranscriptView(interaction, tenant, customId.replace("transcript_view_", ""));

    // Feedback buttons
    if (customId.startsWith("feedback_open:")) {
      const { openFeedback } = require("../handlers/feedback");
      return openFeedback(interaction, customId.replace("feedback_open:", ""));
    }
    if (customId.startsWith("feedback_rate:")) {
      const parts = customId.split(":");
      const { rateFeedback } = require("../handlers/feedback");
      return rateFeedback(interaction, parts[1], parts[2]);
    }

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
    if (interaction.customId.startsWith("ticket_category_select:")) {
      const parts = interaction.customId.split(":");
      // ticket_category_select:TENANT:CHANNEL
      if (parts.length >= 3) {
        let categoryId = interaction.values[0];
        // Backward compatibility
        if (categoryId.startsWith("ticket_cat:")) {
          const catParts = categoryId.split(":");
          if (catParts.length >= 4) categoryId = catParts[3];
        }
        return ticketsHandler.openTicketCategory(interaction, tenant, categoryId);
      }
    }
    if (interaction.customId.startsWith("select_variation:")) {
      const productId = interaction.customId.replace("select_variation:", "");
      const selectedValue = interaction.values[0]; // buy_field:productId:fieldId
      const parts = selectedValue.split(":");
      if (parts.length >= 3) return checkoutHandler.selectVariation(interaction, tenant, parts[1], parts[2]);
    }
    if (interaction.customId === "select_product") {
      const selectedValue = interaction.values[0];
      if (selectedValue.startsWith("buy_field:")) {
        const parts = selectedValue.split(":");
        if (parts.length >= 3) return checkoutHandler.selectVariation(interaction, tenant, parts[1], parts[2]);
      }
      return checkoutHandler.startCheckout(interaction, tenant, selectedValue);
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
    if (customId.startsWith("feedback_modal:")) {
      const parts = customId.split(":");
      const { submitFeedback } = require("../handlers/feedback");
      return submitFeedback(interaction, parts[1], parts[2]);
    }
  }
};
