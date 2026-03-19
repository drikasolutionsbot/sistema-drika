const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const {
  getProducts,
  getProductFields,
  countStock,
  getAvailableStock,
  createOrder,
  updateOrderStatus,
  deliverStockItems,
  getStoreConfig,
} = require("../supabase");

/**
 * Inicia o checkout para um produto
 */
async function startCheckout(interaction, tenant, productId) {
  await interaction.deferReply({ ephemeral: true });

  const products = await getProducts(tenant.id, false);
  const product = products.find((p) => p.id === productId);

  if (!product) {
    return interaction.editReply({ content: "❌ Produto não encontrado." });
  }

  if (!product.active) {
    return interaction.editReply({ content: "❌ Este produto está desativado." });
  }

  // Verificar se tem variações
  const fields = await getProductFields(product.id, tenant.id);
  if (fields.length > 0) {
    return showFieldSelection(interaction, tenant, product, fields);
  }

  // Sem variações: checkout direto
  const stock = await countStock(product.id, tenant.id);
  if (stock <= 0 && product.auto_delivery) {
    return interaction.editReply({ content: "❌ Produto sem estoque." });
  }

  return createCheckoutThread(interaction, tenant, product, null);
}

/**
 * Mostra seleção de variações
 */
async function showFieldSelection(interaction, tenant, product, fields) {
  const storeConfig = await getStoreConfig(tenant.id);
  const embedColor = parseInt((storeConfig?.embed_color || "#FF69B4").replace("#", ""), 16);

  const embed = new EmbedBuilder()
    .setTitle(`🛒 ${product.name}`)
    .setDescription("Selecione uma opção:")
    .setColor(embedColor);

  const rows = [];
  const buttons = [];

  for (const field of fields.slice(0, 25)) {
    const stock = await countStock(product.id, tenant.id, field.id);
    const price = (field.price_cents / 100).toFixed(2);
    const emoji = field.emoji || (stock > 0 ? "✅" : "❌");

    embed.addFields({
      name: `${field.name}`,
      value: `R$ ${price}${field.show_stock ? ` | Estoque: ${stock}` : ""}`,
      inline: true,
    });

    buttons.push(
      new ButtonBuilder()
        .setCustomId(`field_${field.id}_${product.id}`)
        .setLabel(field.name.slice(0, 80))
        .setStyle(stock > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(stock <= 0 && product.auto_delivery)
    );
  }

  // Agrupar botões em rows (5 por row)
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  return interaction.editReply({ embeds: [embed], components: rows.slice(0, 5) });
}

/**
 * Seleção de variação
 */
async function selectField(interaction, tenant, fieldId, productId) {
  await interaction.deferReply({ ephemeral: true });

  const products = await getProducts(tenant.id, false);
  const product = products.find((p) => p.id === productId);
  if (!product) return interaction.editReply({ content: "❌ Produto não encontrado." });

  const fields = await getProductFields(product.id, tenant.id);
  const field = fields.find((f) => f.id === fieldId);
  if (!field) return interaction.editReply({ content: "❌ Opção não encontrada." });

  const stock = await countStock(product.id, tenant.id, field.id);
  if (stock <= 0 && product.auto_delivery) {
    return interaction.editReply({ content: "❌ Esta opção está sem estoque." });
  }

  return createCheckoutThread(interaction, tenant, product, field);
}

/**
 * Cria thread de checkout
 */
async function createCheckoutThread(interaction, tenant, product, field) {
  const storeConfig = await getStoreConfig(tenant.id);
  const guild = interaction.guild;
  const member = interaction.member;
  const price = field ? field.price_cents : product.price_cents;
  const productName = field ? `${product.name} - ${field.name}` : product.name;
  const embedColor = parseInt((storeConfig?.embed_color || "#FF69B4").replace("#", ""), 16);

  // Criar pedido no banco
  const order = await createOrder({
    tenant_id: tenant.id,
    product_id: product.id,
    field_id: field?.id || null,
    product_name: productName,
    discord_user_id: member.id,
    discord_username: member.user.username,
    total_cents: price,
    status: "pending_payment",
  });

  // Criar thread privada ou canal temporário
  let checkoutChannel;
  try {
    // Tentar criar thread no canal atual
    const parentChannel = interaction.channel;
    checkoutChannel = await parentChannel.threads.create({
      name: `🛒-${member.user.username}-${order.order_number}`,
      autoArchiveDuration: 60,
      type: ChannelType.PrivateThread,
      reason: `Checkout #${order.order_number}`,
    });
    await checkoutChannel.members.add(member.id);
  } catch {
    // Fallback: criar canal de texto
    checkoutChannel = await guild.channels.create({
      name: `checkout-${order.order_number}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });
  }

  // Atualizar pedido com ID do checkout
  await updateOrderStatus(order.id, "pending_payment", {
    checkout_thread_id: checkoutChannel.id,
  });

  // Embed do checkout
  const embed = new EmbedBuilder()
    .setTitle(`🛒 Checkout #${order.order_number}`)
    .setDescription(
      `**Produto:** ${productName}\n` +
      `**Preço:** R$ ${(price / 100).toFixed(2)}\n\n` +
      (tenant.pix_key
        ? `**Chave PIX:** \`${tenant.pix_key}\`\nTipo: ${tenant.pix_key_type || "Aleatória"}\n\n` +
          `Faça o pagamento e clique em **Confirmar Pagamento**.`
        : `Aguardando configuração do pagamento.`)
    )
    .setColor(embedColor)
    .setFooter({ text: `Pedido expira em ${storeConfig?.payment_timeout_minutes || 30} minutos` })
    .setTimestamp();

  if (product.banner_url) embed.setImage(product.banner_url);
  if (product.icon_url) embed.setThumbnail(product.icon_url);

  const confirmBtn = new ButtonBuilder()
    .setCustomId(`confirm_${order.id}`)
    .setLabel("✅ Confirmar Pagamento")
    .setStyle(ButtonStyle.Success);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(`cancel_${order.id}`)
    .setLabel("❌ Cancelar")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

  await checkoutChannel.send({ content: `${member}`, embeds: [embed], components: [row] });

  await interaction.editReply({
    content: `✅ Seu carrinho foi criado! Vá para ${checkoutChannel} para finalizar.`,
  });

  // Auto-expirar pedido
  const timeout = (storeConfig?.payment_timeout_minutes || 30) * 60 * 1000;
  setTimeout(async () => {
    try {
      const { supabase } = require("../supabase");
      const { data: currentOrder } = await supabase
        .from("orders")
        .select("status")
        .eq("id", order.id)
        .single();

      if (currentOrder?.status === "pending_payment") {
        await updateOrderStatus(order.id, "expired");
        await checkoutChannel.send("⏰ Pedido expirado por falta de pagamento.").catch(() => {});
        setTimeout(() => checkoutChannel.delete().catch(() => {}), 10000);
      }
    } catch {}
  }, timeout);
}

/**
 * Confirmar pagamento (aprovação manual)
 */
async function confirmPayment(interaction, tenant, orderId) {
  await interaction.deferReply({ ephemeral: true });

  const { supabase } = require("../supabase");
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("tenant_id", tenant.id)
    .single();

  if (!order) return interaction.editReply({ content: "❌ Pedido não encontrado." });
  if (order.status !== "pending_payment") {
    return interaction.editReply({ content: "❌ Este pedido já foi processado." });
  }

  // Marcar como pago
  await updateOrderStatus(orderId, "paid");

  // Entrega automática
  const products = await getProducts(tenant.id, false);
  const product = products.find((p) => p.id === order.product_id);

  if (product?.auto_delivery) {
    const stockItems = await getAvailableStock(
      order.product_id,
      tenant.id,
      order.field_id,
      product.type === "digital_auto" ? 1 : 1
    );

    if (stockItems.length > 0) {
      // Marcar como entregue
      await deliverStockItems(
        stockItems.map((s) => s.id),
        order.discord_user_id
      );
      await updateOrderStatus(orderId, "delivered");

      // Enviar produto via DM
      const user = await interaction.client.users.fetch(order.discord_user_id);
      const deliveryContent = stockItems.map((s) => s.content).join("\n");

      try {
        const storeConfig = await getStoreConfig(tenant.id);
        const embedColor = parseInt((storeConfig?.purchase_embed_color || "#57F287").replace("#", ""), 16);

        const deliveryEmbed = new EmbedBuilder()
          .setTitle(storeConfig?.purchase_embed_title || "Compra realizada! ✅")
          .setDescription(
            (storeConfig?.purchase_embed_description || "Obrigado pela sua compra, {user}!").replace(
              "{user}",
              user.username
            ) +
            `\n\n**Produto:** ${order.product_name}\n**Pedido:** #${order.order_number}`
          )
          .setColor(embedColor)
          .setTimestamp();

        if (storeConfig?.purchase_embed_footer) {
          deliveryEmbed.setFooter({ text: storeConfig.purchase_embed_footer });
        }

        await user.send({ embeds: [deliveryEmbed], content: `\`\`\`\n${deliveryContent}\n\`\`\`` });
      } catch (dmErr) {
        // DM fechada, enviar no canal
        await interaction.channel.send({
          content: `📦 <@${order.discord_user_id}> Seu produto:\n\`\`\`\n${deliveryContent}\n\`\`\``,
        });
      }

      await interaction.editReply({ content: "✅ Pagamento confirmado e produto entregue!" });
    } else {
      await interaction.editReply({ content: "⚠️ Pagamento confirmado, mas sem estoque para entrega automática." });
    }
  } else {
    await interaction.editReply({ content: "✅ Pagamento confirmado! Aguarde a entrega manual." });
  }

  // Renomear thread/canal
  try {
    const channel = interaction.channel;
    const newName = channel.name.replace("🛒", "✅");
    await channel.setName(newName);
    // Arquivar após 2min
    setTimeout(() => {
      channel.setArchived?.(true).catch(() => {});
    }, 120000);
  } catch {}

  // Log de venda
  const storeConfig = await getStoreConfig(tenant.id);
  if (storeConfig?.logs_channel_id) {
    try {
      const logsChannel = await interaction.guild.channels.fetch(storeConfig.logs_channel_id);
      const logEmbed = new EmbedBuilder()
        .setTitle("💰 Nova Venda")
        .setDescription(
          `**Produto:** ${order.product_name}\n` +
          `**Comprador:** <@${order.discord_user_id}>\n` +
          `**Valor:** R$ ${(order.total_cents / 100).toFixed(2)}\n` +
          `**Pedido:** #${order.order_number}`
        )
        .setColor(0x57f287)
        .setTimestamp();
      await logsChannel.send({ embeds: [logEmbed] });
    } catch {}
  }
}

/**
 * Cancelar pedido
 */
async function cancelOrder(interaction, tenant, orderId) {
  await interaction.deferReply({ ephemeral: true });

  const { supabase } = require("../supabase");
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("tenant_id", tenant.id)
    .single();

  if (!order) return interaction.editReply({ content: "❌ Pedido não encontrado." });
  if (order.status !== "pending_payment") {
    return interaction.editReply({ content: "❌ Este pedido não pode ser cancelado." });
  }

  await updateOrderStatus(orderId, "cancelled");
  await interaction.editReply({ content: "✅ Pedido cancelado." });

  // Deletar thread/canal
  setTimeout(() => {
    interaction.channel?.delete?.().catch(() => {});
  }, 5000);
}

module.exports = {
  startCheckout,
  selectField,
  confirmPayment,
  cancelOrder,
};
