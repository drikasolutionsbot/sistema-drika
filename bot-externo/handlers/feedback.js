const { supabase } = require("../supabase");
const { tr, trf, resolveOrderLang } = require("../i18n");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require("discord.js");

async function getOrderById(orderId) {
  const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  return data;
}

async function alreadyRated(orderId, userId) {
  const { data } = await supabase
    .from("order_feedbacks")
    .select("id")
    .eq("order_id", orderId)
    .eq("discord_user_id", userId)
    .maybeSingle();
  return !!data;
}

// "Deixe seu feedback" → edita a mensagem mostrando os 3 botões
async function openFeedback(interaction, orderId) {
  const order = await getOrderById(orderId);
  if (!order) return interaction.reply({ content: tr("pt-BR", "order_not_found"), ephemeral: true });
  const L = await resolveOrderLang(supabase, order);

  if (await alreadyRated(orderId, interaction.user.id)) {
    return interaction.reply({ content: tr(L, "feedback_already_rated"), ephemeral: true });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`feedback_rate:${orderId}:1`).setLabel(tr(L, "feedback_bad")).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`feedback_rate:${orderId}:3`).setLabel(tr(L, "feedback_average")).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`feedback_rate:${orderId}:5`).setLabel(tr(L, "feedback_good")).setStyle(ButtonStyle.Primary),
  );

  await interaction.update({
    content: interaction.message?.content || tr(L, "feedback_experience_prompt"),
    components: [row],
  });
}

// Clique em Ruim/Mediano/Muito Bom → abre modal de comentário
async function rateFeedback(interaction, orderId, rating) {
  const order = await getOrderById(orderId);
  if (!order) return interaction.reply({ content: tr("pt-BR", "order_not_found"), ephemeral: true });
  const L = await resolveOrderLang(supabase, order);

  if (await alreadyRated(orderId, interaction.user.id)) {
    return interaction.reply({ content: tr(L, "feedback_already_rated"), ephemeral: true });
  }

  const r = parseInt(rating);
  if (isNaN(r) || r < 1 || r > 5) {
    return interaction.reply({ content: tr(L, "feedback_invalid_rating"), ephemeral: true });
  }

  const ratingLabel = r <= 1 ? tr(L, "feedback_bad") : r <= 3 ? tr(L, "feedback_average") : tr(L, "feedback_good");

  const modal = new ModalBuilder()
    .setCustomId(`feedback_modal:${orderId}:${r}`)
    .setTitle(trf(L, "feedback_modal_title", { rating: ratingLabel }))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("comment")
          .setLabel(tr(L, "feedback_comment_label"))
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setPlaceholder(tr(L, "feedback_comment_placeholder"))
          .setRequired(false),
      ),
    );

  await interaction.showModal(modal);
}

// Submit do modal → salva no banco e posta no canal de feedbacks
async function submitFeedback(interaction, orderId, rating) {
  const r = parseInt(rating);
  const comment = interaction.fields.getTextInputValue("comment")?.trim() || null;

  const order = await getOrderById(orderId);
  if (!order) {
    return interaction.reply({ content: "❌ Pedido não encontrado.", ephemeral: true });
  }

  const { error: insertErr } = await supabase.from("order_feedbacks").insert({
    tenant_id: order.tenant_id,
    order_id: order.id,
    discord_user_id: interaction.user.id,
    discord_username: interaction.user.username,
    rating: r,
    comment,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return interaction.reply({ content: "⭐ Você já avaliou esta compra. Obrigado!", ephemeral: true });
    }
    return interaction.reply({ content: `❌ Erro ao salvar avaliação: ${insertErr.message}`, ephemeral: true });
  }

  // Posta no canal de feedbacks (ou logs como fallback)
  try {
    const { data: sc } = await supabase
      .from("store_configs")
      .select("feedback_channel_id, logs_channel_id")
      .eq("tenant_id", order.tenant_id)
      .maybeSingle();

    // Fallback para channel_configs (chave logs_feedback) se não houver no store_configs
    let fallbackFeedback = null;
    if (!sc?.feedback_channel_id) {
      const { data: cc } = await supabase
        .from("channel_configs")
        .select("discord_channel_id")
        .eq("tenant_id", order.tenant_id)
        .eq("channel_key", "logs_feedback")
        .maybeSingle();
      fallbackFeedback = cc?.discord_channel_id || null;
    }

    const targetChannel = sc?.feedback_channel_id || fallbackFeedback || sc?.logs_channel_id;
    if (targetChannel) {
      const stars = "⭐".repeat(r) + "☆".repeat(5 - r);
      const color = r >= 4 ? 0x57F287 : r === 3 ? 0xFEE75C : 0xED4245;

      const embed = new EmbedBuilder()
        .setTitle("⭐ Nova avaliação recebida")
        .setDescription(`<@${interaction.user.id}> avaliou o pedido **#${order.order_number}**.`)
        .setColor(color)
        .addFields(
          { name: "**Nota**", value: `${stars} (${r}/5)`, inline: true },
          { name: "**Produto**", value: `\`${order.product_name}\``, inline: true },
          { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
        )
        .setTimestamp(new Date());

      if (comment) embed.addFields({ name: "**Comentário**", value: comment, inline: false });

      const channel = await interaction.client.channels.fetch(targetChannel).catch(() => null);
      if (channel) await channel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.error("Failed to post feedback:", e);
  }

  const stars = "⭐".repeat(r);
  return interaction.reply({ content: `✅ Obrigado pela sua avaliação de ${stars}!`, ephemeral: true });
}

module.exports = { openFeedback, rateFeedback, submitFeedback };
