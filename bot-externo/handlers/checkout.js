const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder,
  TextInputStyle, StringSelectMenuBuilder,
} = require("discord.js");
const {
  getProducts, getProductById, getProductFields, countStock, getAvailableStock,
  createOrder, getOrder, updateOrderStatus, deliverStockItems,
  getStoreConfig, getCoupon, incrementCouponUsage,
  getActivePaymentProvider, triggerAutomation, deliverOrder, supabase,
} = require("../supabase");
const { sendWithIdentity } = require("./webhookSender");

const formatBRL = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const formatDateTime = (dateObj = new Date()) => ({
  date: dateObj.toLocaleDateString("pt-BR"),
  time: dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
});

function applyFooterTemplate(template, context = {}) {
  if (!template || !String(template).trim()) return "";
  return String(template)
    .replace(/\{store\}/gi, context.storeName || "")
    .replace(/\{product\}/gi, context.productName || "")
    .replace(/\{order\}/gi, context.orderNumber ? `#${context.orderNumber}` : "")
    .replace(/\{expires\}/gi, context.timeoutMin ? `${context.timeoutMin} minutos` : "")
    .replace(/\{date\}/gi, context.date || "")
    .replace(/\{time\}/gi, context.time || "")
    .replace(/\{user\}/gi, context.username || "");
}

function resolveCheckoutFooter(storeConfig, product, stockCount, context) {
  const embedConfig = product?.embed_config && typeof product.embed_config === "object"
    ? product.embed_config
    : {};

  const numericStock = Number(stockCount);
  const hasStock = stockCount === "∞" || (!Number.isNaN(numericStock) && numericStock > 0);

  const productFooter = embedConfig.show_footer === false
    ? ""
    : (hasStock ? embedConfig.footer_available_text : embedConfig.footer_unavailable_text) || embedConfig.footer || "";

  const storeFooter = storeConfig?.purchase_embed_footer || "";
  const fallback = `${context.storeName} • ${context.date} ${context.time}`;
  return applyFooterTemplate(storeFooter || productFooter || fallback, context);
}

function resolvePixFooter(storeConfig, context) {
  const storeFooter = storeConfig?.purchase_embed_footer || "";
  const fallback = `${context.storeName} – Pagamento expira em ${context.timeoutMin} minutos.\n• Hoje às ${context.time}`;
  return applyFooterTemplate(storeFooter || fallback, context);
}

// ── PIX Helpers ──
function tlv(id, value) { return `${id}${value.length.toString().padStart(2, "0")}${value}`; }
function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) { crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1; crc &= 0xffff; }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function generateStaticBRCode(pixKey, name, amount, txId) {
  let p = tlv("00", "01") + tlv("01", amount ? "12" : "11");
  p += tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", pixKey));
  p += tlv("52", "0000") + tlv("53", "986");
  if (amount && amount > 0) p += tlv("54", amount.toFixed(2));
  p += tlv("58", "BR") + tlv("59", name.substring(0, 25)) + tlv("60", "Brasil");
  p += tlv("62", tlv("05", (txId || "***").substring(0, 25)));
  p += "6304";
  return p + crc16(p);
}

// ── Mercado Pago PIX ──
async function generateMercadoPagoPix(apiKey, amount, desc, ref, webhook) {
  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Idempotency-Key": ref },
    body: JSON.stringify({ transaction_amount: amount, payment_method_id: "pix", description: desc, statement_descriptor: "Drika Solutions", external_reference: ref, notification_url: webhook, payer: { email: "customer@email.com" } }),
  });
  if (!res.ok) throw new Error(`Mercado Pago error: ${res.status}`);
  const data = await res.json();
  return { brcode: data.point_of_interaction?.transaction_data?.qr_code || "", payment_id: String(data.id) };
}

// ── PushinPay PIX ──
async function generatePushinPayPix(apiKey, amountCents, webhook) {
  const res = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ value: amountCents, webhook_url: webhook || undefined }),
  });
  if (!res.ok) throw new Error(`PushinPay error: ${res.status}`);
  const data = await res.json();
  return { brcode: data.qr_code || "", payment_id: data.id };
}

// ── Start Checkout (from buy_product button) ──
async function startCheckout(interaction, tenant, productId) {
  await interaction.deferReply({ ephemeral: true });

  console.log(`[CHECKOUT] startCheckout productId=${productId} tenantId=${tenant.id}`);

  const productIdCandidates = String(productId || "")
    .split(/[:|,;\/\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  // Try direct query first (more reliable), then fallback to list
  let product = await getProductById(productId, tenant.id);
  if (!product) {
    console.log(`[CHECKOUT] Direct query failed, trying list fallback...`);
    const products = await getProducts(tenant.id, false);
    product = products.find((p) => productIdCandidates.includes(p.id));

    if (!product) {
      const activeProducts = products.filter((p) => p.active);
      if (activeProducts.length === 1) {
        console.warn(`[CHECKOUT] Using single active-product fallback for tenant ${tenant.id}`);
        product = activeProducts[0];
      }
    }
  }

  if (!product) {
    console.error(`[CHECKOUT] Product not found for rawId=${productId} tenantId=${tenant.id}`);
    return interaction.editReply({ content: "❌ Produto não encontrado." });
  }

  if (!product.active) return interaction.editReply({ content: "❌ Este produto está indisponível." });

  const fields = await getProductFields(product.id, tenant.id);
  if (fields.length > 0) {
    // Show variation selector
    const storeConfig = await getStoreConfig(tenant.id);
    const embedColor = parseInt((storeConfig?.embed_color || "#2B2D31").replace("#", ""), 16);

    // Get stock counts per field
    const stockMap = {};
    for (const f of fields) {
      stockMap[f.id] = await countStock(product.id, tenant.id, f.id);
    }

    const options = fields.slice(0, 25).map((f) => ({
      label: f.name,
      value: `buy_field:${productId}:${f.id}`,
      description: `Preço: ${formatBRL(f.price_cents)} | Estoque: ${stockMap[f.id] || 0}`,
    }));

    const autoDelivery = product.auto_delivery ? "⚡ **Entrega Automática!**\n\n" : "";
    const embed = new EmbedBuilder()
      .setTitle(product.name)
      .setDescription(`${autoDelivery}${product.description || ""}`)
      .setColor(embedColor);
    if (product.banner_url) embed.setImage(product.banner_url);
    if (product.icon_url) embed.setThumbnail(product.icon_url);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(`select_variation:${productId}`).setPlaceholder("Clique aqui para ver as opções").addOptions(options)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // No variations - direct purchase
  await processPurchase(interaction, tenant, product, product.price_cents);
}

// ── Select Variation (from dropdown) ──
async function selectVariation(interaction, tenant, productId, fieldId) {
  await interaction.deferReply({ ephemeral: true });

  const products = await getProducts(tenant.id, false);
  const product = products.find((p) => p.id === productId);
  if (!product) return interaction.editReply({ content: "❌ Produto não encontrado." });

  const fields = await getProductFields(product.id, tenant.id);
  const field = fields.find((f) => f.id === fieldId);
  if (!field) return interaction.editReply({ content: "❌ Variação não encontrada." });

  await processPurchase(interaction, tenant, product, field.price_cents, field.id, field.name);
}

// ── Process Purchase ──
async function processPurchase(interaction, tenant, product, priceCents, fieldId = null, fieldName = null) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const orderName = fieldName ? `${product.name} - ${fieldName}` : product.name;

  const order = await createOrder({
    tenant_id: tenant.id, product_id: product.id, field_id: fieldId,
    product_name: orderName, discord_user_id: userId, discord_username: username,
    total_cents: priceCents, status: "pending_payment",
  });

  // Trigger automation
  await triggerAutomation(tenant.id, "order_created", {
    discord_user_id: userId, discord_username: username,
    order_id: order.id, order_number: order.order_number,
    product_name: orderName, total_cents: priceCents,
  });

  // ── Free product: deliver immediately ──
  if (priceCents <= 0) {
    await updateOrderStatus(order.id, "paid", { payment_provider: "free" });
    await deliverOrder(order.id, tenant.id);
    return interaction.editReply({ content: `✅ Pedido **#${order.order_number}** — **${orderName}** entregue gratuitamente! Verifique sua DM.` });
  }

  // ── Create private thread for checkout ──
  const channel = interaction.channel;
  const threadName = `🛒 • ${username} • ${order.order_number}`.substring(0, 100);

  let checkoutThread;
  try {
    checkoutThread = await channel.threads.create({
      name: threadName, autoArchiveDuration: 1440,
      type: ChannelType.PrivateThread, reason: `Checkout #${order.order_number}`,
    });
    await checkoutThread.members.add(userId);
  } catch {
    checkoutThread = await interaction.guild.channels.create({
      name: `checkout-${order.order_number}`, type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });
  }

  await updateOrderStatus(order.id, "pending_payment", { checkout_thread_id: checkoutThread.id });

  // Get store branding
  const storeConfig = await getStoreConfig(tenant.id);
  const storeName = storeConfig?.store_title || tenant.name || "Loja";
  const storeLogo = storeConfig?.store_logo_url || tenant.logo_url;
  const embedColor = parseInt((storeConfig?.embed_color || "#2B2D31").replace("#", ""), 16);

  // Stock count
  let stockCount = "∞";
  const sc = await countStock(product.id, tenant.id, fieldId);
  if (sc !== null) stockCount = String(sc);

  // Build checkout embed
  const descLines = [];
  if (product.auto_delivery) descLines.push("⚡ **Entrega Automática!**");
  if (product.description) descLines.push(product.description);

  const { date: checkoutDate, time: checkoutTime } = formatDateTime();
  const checkoutFooterText = resolveCheckoutFooter(storeConfig, product, stockCount, {
    storeName,
    productName: orderName,
    orderNumber: order.order_number,
    timeoutMin: storeConfig?.payment_timeout_minutes || 30,
    date: checkoutDate,
    time: checkoutTime,
    username,
  });

  const reviewEmbed = new EmbedBuilder()
    .setAuthor({ name: username, iconURL: interaction.user.displayAvatarURL() })
    .setTitle("Revisão do Pedido")
    .setColor(embedColor)
    .addFields(
      { name: "🛒 Carrinho", value: `1x ${orderName}`, inline: false },
      { name: "Valor à vista", value: formatBRL(priceCents), inline: true },
      { name: "📦 Em estoque", value: stockCount, inline: true },
    )
    .setFooter({ text: checkoutFooterText, iconURL: storeLogo || undefined })
    .setTimestamp();

  if (descLines.length) reviewEmbed.setDescription(descLines.join("\n\n"));
  if (product.banner_url) reviewEmbed.setImage(product.banner_url);
  if (product.icon_url) reviewEmbed.setThumbnail(product.icon_url);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`checkout_pay:${order.id}`).setLabel("Ir para o Pagamento").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`checkout_quantity:${order.id}`).setLabel("Editar Quantidade").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`checkout_coupon:${order.id}`).setLabel("Usar Cupom").setEmoji("🏷️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`checkout_cancel:${order.id}`).setLabel("Cancelar").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
  );

  await sendWithIdentity(checkoutThread, tenant, { content: `<@${userId}>`, embeds: [reviewEmbed], components: [row1, row2] });

  // Tell user where to go
  const threadLink = `https://discord.com/channels/${interaction.guild.id}/${checkoutThread.id}`;
  const linkRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Ir para o carrinho").setStyle(ButtonStyle.Link).setURL(threadLink)
  );

  await interaction.editReply({ content: "✅ | Seu carrinho foi criado com êxito.", components: [linkRow] });

  // Auto-expire
  const timeout = (storeConfig?.payment_timeout_minutes || 30) * 60 * 1000;
  setTimeout(async () => {
    try {
      const current = await getOrder(order.id);
      if (current?.status === "pending_payment") {
        await updateOrderStatus(order.id, "expired");
        await checkoutThread.send("⏰ Pedido expirado por falta de pagamento.").catch(() => {});
        setTimeout(() => {
          checkoutThread.setArchived?.(true).catch(() => {});
          checkoutThread.setLocked?.(true).catch(() => {});
        }, 5000);
      }
    } catch {}
  }, timeout);
}

// ── Go to Payment (generate PIX) ──
async function goToPayment(interaction, tenant, orderId) {
  await interaction.deferUpdate();

  const order = await getOrder(orderId);
  if (!order) return interaction.followUp({ content: "❌ Pedido não encontrado.", ephemeral: true });
  if (order.status !== "pending_payment") return interaction.followUp({ content: `ℹ️ Pedido não está mais pendente.`, ephemeral: true });

  const channel = interaction.channel;
  const preStoreConfig = await getStoreConfig(tenant.id);
  const preEmbedColor = parseInt((preStoreConfig?.embed_color || "#2B2D31").replace("#", ""), 16);
  await sendWithIdentity(channel, tenant, { embeds: [new EmbedBuilder().setDescription("⏳ | Gerando QR Code...\nQuase lá, só mais um instante!").setColor(preEmbedColor)] });

  const priceCents = order.total_cents;
  const amountBRL = priceCents / 100;
  const webhookBaseUrl = `${process.env.SUPABASE_URL}/functions/v1/payment-webhook`;
  let brcode = "";
  let paymentId = "";

  const provider = await getActivePaymentProvider(tenant.id);

  if (provider && amountBRL > 0) {
    const providerKey = provider.provider_key;
    const apiKey = provider.api_key_encrypted;
    const webhookUrl = `${webhookBaseUrl}/${providerKey}/${tenant.id}`;
    const externalRef = `order_${order.id}`;

    if (providerKey === "mercadopago") {
      const r = await generateMercadoPagoPix(apiKey, amountBRL, order.product_name, externalRef, webhookUrl);
      brcode = r.brcode; paymentId = r.payment_id;
    } else if (providerKey === "pushinpay") {
      const r = await generatePushinPayPix(apiKey, priceCents, webhookUrl);
      brcode = r.brcode; paymentId = r.payment_id;
    } else if (providerKey === "efi" || providerKey === "misticpay") {
      const pixRes = await fetch(`${process.env.SUPABASE_URL}/functions/v1/generate-pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ tenant_id: tenant.id, amount_cents: priceCents, product_name: order.product_name, tx_id: externalRef }),
      });
      const pixData = await pixRes.json();
      if (pixData.error) throw new Error(pixData.error);
      brcode = pixData.brcode || ""; paymentId = pixData.payment_id || externalRef;
    }

    await updateOrderStatus(order.id, "pending_payment", { payment_id: paymentId, payment_provider: providerKey });
  } else {
    // Static PIX
    if (!tenant.pix_key) {
      return sendWithIdentity(channel, tenant, { embeds: [new EmbedBuilder().setTitle("❌ Erro").setDescription("Nenhum método de pagamento configurado.").setColor(0xED4245)] });
    }
    brcode = generateStaticBRCode(tenant.pix_key, tenant.name || "Loja", amountBRL, `PED${order.order_number}`);
    await updateOrderStatus(order.id, "pending_payment", { payment_provider: "static_pix" });

    // Send admin approval notification
    const storeConfig = await getStoreConfig(tenant.id);
    if (storeConfig?.logs_channel_id) {
      try {
        const logsChannel = await interaction.guild.channels.fetch(storeConfig.logs_channel_id);
        const logEmbed = new EmbedBuilder()
          .setTitle("🔔 Novo Pedido — PIX Estático")
          .setDescription("Aguardando confirmação manual do pagamento.")
          .setColor(0xFEE75C)
          .addFields(
            { name: "📦 Produto", value: order.product_name, inline: true },
            { name: "💰 Valor", value: formatBRL(priceCents), inline: true },
            { name: "🔢 Pedido", value: `#${order.order_number}`, inline: true },
            { name: "👤 Comprador", value: `<@${order.discord_user_id}> (${order.discord_username})`, inline: false },
          )
          .setTimestamp();

        const approvalRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`approve_order:${order.id}`).setLabel("Aprovar Pagamento").setEmoji("✅").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`reject_order:${order.id}`).setLabel("Recusar").setEmoji("❌").setStyle(ButtonStyle.Danger),
        );

        await sendWithIdentity(logsChannel, tenant, { embeds: [logEmbed], components: [approvalRow] });
      } catch {}
    }
  }

  // Send PIX embed
  const storeConfig = await getStoreConfig(tenant.id);
  const storeName = storeConfig?.store_title || tenant.name || "Loja";
  const storeLogo = storeConfig?.store_logo_url || tenant.logo_url;
  const timeoutMin = storeConfig?.payment_timeout_minutes || 30;
  const embedColor = parseInt((storeConfig?.embed_color || "#2B2D31").replace("#", ""), 16);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(brcode)}`;
  const { date: paymentDate, time: paymentTime } = formatDateTime();
  const pixFooterText = resolvePixFooter(storeConfig, {
    storeName,
    productName: order.product_name,
    orderNumber: order.order_number,
    timeoutMin,
    date: paymentDate,
    time: paymentTime,
    username: order.discord_username || "",
  });

  const pixEmbed = new EmbedBuilder()
    .setAuthor({ name: order.discord_username || "Comprador" })
    .setTitle("Pagamento via PIX criado")
    .setDescription([
      "🟢 **Ambiente Seguro**", "Seu pagamento será processado em um ambiente 100% seguro.\n",
      "🟢 **Pagamento Instantâneo**", "Assim que confirmado, seu pedido será processado imediatamente.\n",
      "**Código copia e cola**", `\`\`\`\n${brcode}\n\`\`\``,
    ].join("\n"))
    .setColor(embedColor)
    .setImage(qrImageUrl)
    .setFooter({ text: pixFooterText, iconURL: storeLogo || undefined });

  if (storeLogo) pixEmbed.setThumbnail(storeLogo);

  const pixRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`copy_pix:${order.id}`).setLabel("Código copia e cola").setEmoji("📋").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`checkout_cancel:${order.id}`).setLabel("Cancelar").setStyle(ButtonStyle.Danger),
  );

  await sendWithIdentity(channel, tenant, { embeds: [pixEmbed], components: [pixRow] });
}

// ── Approve Order ──
async function approveOrder(interaction, tenant, orderId) {
  await interaction.deferUpdate();
  const order = await getOrder(orderId);
  if (!order) return interaction.followUp({ content: "❌ Pedido não encontrado.", ephemeral: true });
  if (order.status !== "pending_payment") return interaction.followUp({ content: `ℹ️ Pedido #${order.order_number} já processado.`, ephemeral: true });

  await updateOrderStatus(orderId, "paid", { payment_provider: "static_pix" });
  await deliverOrder(orderId, order.tenant_id);

  // Trigger automation
  await triggerAutomation(order.tenant_id, "order_paid", {
    discord_user_id: order.discord_user_id, discord_username: order.discord_username,
    order_id: orderId, order_number: order.order_number,
    product_name: order.product_name, total_cents: order.total_cents,
  });

  // DM buyer
  try {
    const user = await interaction.client.users.fetch(order.discord_user_id);
    const dmStoreConfig = await getStoreConfig(tenant.id);
    const dmEmbedColor = parseInt((dmStoreConfig?.embed_color || "#2B2D31").replace("#", ""), 16);
    await user.send({ embeds: [new EmbedBuilder().setTitle("✅ Pagamento Confirmado!").setDescription(`Seu pedido **#${order.order_number}** (${order.product_name}) foi aprovado!\nSeu produto será entregue em instantes.`).setColor(dmEmbedColor).setTimestamp()] });
  } catch {}

  const approveStoreConfig = await getStoreConfig(tenant.id);
  const approveEmbedColor = parseInt((approveStoreConfig?.embed_color || "#2B2D31").replace("#", ""), 16);
  const approvedEmbed = new EmbedBuilder()
    .setTitle("✅ Pedido Aprovado")
    .setDescription(`Pedido **#${order.order_number}** aprovado por <@${interaction.user.id}>`)
    .setColor(approveEmbedColor)
    .addFields(
      { name: "📦 Produto", value: order.product_name, inline: true },
      { name: "💰 Valor", value: formatBRL(order.total_cents), inline: true },
      { name: "👤 Comprador", value: `<@${order.discord_user_id}>`, inline: true },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [approvedEmbed], components: [] });
}

// ── Reject Order ──
async function rejectOrder(interaction, tenant, orderId) {
  await interaction.deferUpdate();
  const order = await getOrder(orderId);
  if (!order) return interaction.followUp({ content: "❌ Pedido não encontrado.", ephemeral: true });
  if (order.status !== "pending_payment") return interaction.followUp({ content: `ℹ️ Pedido #${order.order_number} já processado.`, ephemeral: true });

  await updateOrderStatus(orderId, "canceled");

  try {
    const user = await interaction.client.users.fetch(order.discord_user_id);
    await user.send({ embeds: [new EmbedBuilder().setTitle("❌ Pedido Recusado").setDescription(`Seu pedido **#${order.order_number}** (${order.product_name}) foi recusado.`).setColor(0xED4245).setTimestamp()] });
  } catch {}

  await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle("❌ Pedido Recusado").setDescription(`Pedido **#${order.order_number}** recusado por <@${interaction.user.id}>`).setColor(0x2B2D31).addFields({ name: "📦 Produto", value: order.product_name, inline: true }, { name: "👤 Comprador", value: `<@${order.discord_user_id}>`, inline: true }).setTimestamp()],
    components: [],
  });
}

// ── Cancel Order ──
async function cancelOrder(interaction, tenant, orderId) {
  await interaction.deferUpdate();
  const order = await getOrder(orderId);
  if (!order) return;

  if (order.status === "pending_payment") {
    await updateOrderStatus(orderId, "canceled");
  }

  const channel = interaction.channel;
  await sendWithIdentity(channel, tenant, { embeds: [new EmbedBuilder().setTitle("❌ Compra Cancelada").setDescription(`Pedido **#${order.order_number}** foi cancelado.\nO tópico será arquivado.`).setColor(0x2B2D31)] });

  setTimeout(() => {
    channel.setArchived?.(true).catch(() => {});
    channel.setLocked?.(true).catch(() => {});
  }, 3000);
}

// ── Copy PIX ──
async function copyPix(interaction, tenant, orderId) {
  const order = await getOrder(orderId);
  if (!order) return interaction.reply({ content: "❌ Pedido não encontrado.", ephemeral: true });

  if (tenant.pix_key) {
    const brcode = generateStaticBRCode(tenant.pix_key, tenant.name || "Loja", order.total_cents / 100, `PED${order.order_number}`);
    return interaction.reply({ content: `📋 **Código PIX Copia e Cola:**\n\`\`\`\n${brcode}\n\`\`\``, ephemeral: true });
  }
  return interaction.reply({ content: "📋 O código PIX está na mensagem acima.", ephemeral: true });
}

// ── Coupon Modal ──
async function showCouponModal(interaction, orderId) {
  const modal = new ModalBuilder().setCustomId(`coupon_modal_${orderId}`).setTitle("Usar Cupom");
  const input = new TextInputBuilder().setCustomId("coupon_code").setLabel("Código do Cupom").setStyle(TextInputStyle.Short).setPlaceholder("Digite o código...").setRequired(true).setMaxLength(50);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

// ── Coupon Modal Submit ──
async function handleCouponModal(interaction, tenant, orderId) {
  await interaction.deferReply({ ephemeral: true });
  const couponCode = interaction.fields.getTextInputValue("coupon_code").trim().toUpperCase();
  if (!couponCode) return interaction.editReply({ content: "❌ Código inválido." });

  const order = await getOrder(orderId);
  if (!order || order.status !== "pending_payment") return interaction.editReply({ content: "❌ Pedido não encontrado ou já processado." });

  const coupon = await getCoupon(tenant.id, couponCode);
  if (!coupon) return interaction.editReply({ content: "❌ Cupom não encontrado ou inativo." });
  if (coupon.product_id && coupon.product_id !== order.product_id) return interaction.editReply({ content: "❌ Este cupom não é válido para este produto." });

  let discount = coupon.type === "percent" ? Math.floor(order.total_cents * coupon.value / 100) : coupon.value;
  const newTotal = Math.max(0, order.total_cents - discount);

  await updateOrderStatus(order.id, "pending_payment", { total_cents: newTotal, coupon_id: coupon.id });
  await incrementCouponUsage(coupon.id, coupon.used_count);

  await sendWithIdentity(interaction.channel, tenant, {
    embeds: [new EmbedBuilder().setTitle("🏷️ Cupom Aplicado!").setDescription(`Cupom **${couponCode}** aplicado!\n\n~~${formatBRL(order.total_cents)}~~ → **${formatBRL(newTotal)}**\nDesconto: **-${formatBRL(discount)}**`).setColor(0x57F287)],
  });

  await interaction.editReply({ content: "✅ Cupom aplicado!" });
}

// ── Quantity Modal ──
async function showQuantityModal(interaction, orderId) {
  const modal = new ModalBuilder().setCustomId(`quantity_modal_${orderId}`).setTitle("Editar Quantidade");
  const input = new TextInputBuilder().setCustomId("quantity_value").setLabel("Quantidade").setStyle(TextInputStyle.Short).setPlaceholder("1").setRequired(true).setMaxLength(3).setValue("1");
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

// ── Quantity Modal Submit ──
async function handleQuantityModal(interaction, tenant, orderId) {
  await interaction.deferReply({ ephemeral: true });
  const qty = parseInt(interaction.fields.getTextInputValue("quantity_value").trim());
  if (isNaN(qty) || qty < 1 || qty > 99) return interaction.editReply({ content: "❌ Quantidade inválida (1-99)." });

  const order = await getOrder(orderId);
  if (!order || order.status !== "pending_payment") return interaction.editReply({ content: "❌ Pedido não encontrado ou já processado." });

  let unitPrice = order.total_cents;
  if (order.field_id) {
    const { data: field } = await supabase.from("product_fields").select("price_cents").eq("id", order.field_id).single();
    if (field) unitPrice = field.price_cents;
  } else if (order.product_id) {
    const { data: prod } = await supabase.from("products").select("price_cents").eq("id", order.product_id).single();
    if (prod) unitPrice = prod.price_cents;
  }

  const newTotal = unitPrice * qty;
  await updateOrderStatus(order.id, "pending_payment", { total_cents: newTotal });

  await sendWithIdentity(interaction.channel, tenant, {
    embeds: [new EmbedBuilder().setTitle("✏️ Quantidade Atualizada").setDescription(`Quantidade: **${qty}x**\nNovo total: **${formatBRL(newTotal)}**`).setColor(0x2B2D31)],
  });

  await interaction.editReply({ content: `✅ Quantidade atualizada para ${qty}x!` });
}

// ── Mark Delivered ──
async function markDelivered(interaction, tenant, orderId) {
  await interaction.deferUpdate();
  const order = await getOrder(orderId);
  if (!order) return;

  await updateOrderStatus(orderId, "delivered");

  await sendWithIdentity(interaction.channel, tenant, {
    embeds: [new EmbedBuilder().setTitle("✅ Entrega Confirmada").setDescription(`Pedido **#${order.order_number}** marcado como entregue por <@${interaction.user.id}>.`).setColor(0x2B2D31)],
  });

  await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle("✅ Pedido Entregue").setDescription(`Pedido **#${order.order_number}** (${order.product_name}) entregue.`).setColor(0x57F287)],
    components: [],
  });
}

// ── Cancel Manual ──
async function cancelManual(interaction, tenant, orderId) {
  await interaction.deferUpdate();
  const order = await getOrder(orderId);
  if (!order) return;

  await updateOrderStatus(orderId, "canceled");

  try {
    const user = await interaction.client.users.fetch(order.discord_user_id);
    await user.send({ embeds: [new EmbedBuilder().setTitle("❌ Pedido Cancelado").setDescription(`Seu pedido **#${order.order_number}** (${order.product_name}) foi cancelado.`).setColor(0xED4245)] });
  } catch {}

  await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle("❌ Pedido Cancelado").setDescription(`Pedido **#${order.order_number}** cancelado por <@${interaction.user.id}>.`).setColor(0xED4245)],
    components: [],
  });
}

// ── Copy Delivered ──
async function copyDelivered(interaction, tenant, orderId) {
  const order = await getOrder(orderId);
  if (!order) return interaction.reply({ content: "❌ Pedido não encontrado.", ephemeral: true });

  const { data: items } = await supabase.from("product_stock_items").select("content")
    .eq("product_id", order.product_id).eq("tenant_id", order.tenant_id)
    .eq("delivered_to", order.discord_user_id).eq("delivered", true)
    .order("delivered_at", { ascending: false }).limit(10);

  if (!items?.length) return interaction.reply({ content: "❌ Nenhum conteúdo entregue encontrado.", ephemeral: true });
  const content = items.map((i) => i.content).join("\n");
  return interaction.reply({ content: `📋 **Produto entregue:**\n\`\`\`\n${content}\n\`\`\``, ephemeral: true });
}

// ── View Variations ──
async function viewVariations(interaction, tenant, productId) {
  const { data: product } = await supabase.from("products").select("name, tenant_id").eq("id", productId).single();
  if (!product) return interaction.reply({ content: "❌ Produto não encontrado.", ephemeral: true });

  const fields = await getProductFields(productId, product.tenant_id);
  if (!fields.length) return interaction.reply({ content: "Este produto não tem variações.", ephemeral: true });

  const storeConfig = await getStoreConfig(product.tenant_id);
  const embedColor = parseInt((storeConfig?.embed_color || "#2B2D31").replace("#", ""), 16);

  const fieldLines = fields.map((f) => {
    const emoji = f.emoji || "•";
    const desc = f.description ? ` - ${f.description}` : "";
    return `${emoji} **${f.name}** — ${formatBRL(f.price_cents)}${desc}`;
  });

  return interaction.reply({
    embeds: [new EmbedBuilder().setTitle(`📋 Variações de ${product.name}`).setDescription(fieldLines.join("\n")).setColor(embedColor)],
    ephemeral: true,
  });
}

// ── View Details ──
async function viewDetails(interaction, tenant, productId) {
  const products = await getProducts(tenant.id, false);
  const product = products.find((p) => p.id === productId);
  if (!product) return interaction.reply({ content: "❌ Produto não encontrado.", ephemeral: true });

  const fields = await getProductFields(productId, tenant.id);
  const storeConfig = await getStoreConfig(tenant.id);
  const embedColor = parseInt((storeConfig?.embed_color || "#2B2D31").replace("#", ""), 16);

  const autoDeliveryText = product.auto_delivery ? "⚡ **Entrega Automática!**\n\n" : "";
  const embed = new EmbedBuilder()
    .setTitle(`ℹ️ ${product.name}`)
    .setDescription(`${autoDeliveryText}${product.description || "Sem descrição."}`)
    .setColor(embedColor)
    .addFields(
      { name: "💰 Preço", value: formatBRL(product.price_cents), inline: true },
      { name: "📦 Tipo", value: product.type === "digital_auto" ? "Digital" : product.type === "service" ? "Serviço" : "Híbrido", inline: true },
    );

  if (product.show_stock && product.stock !== null) {
    embed.addFields({ name: "📊 Estoque", value: `${product.stock} disponíveis`, inline: true });
  }
  if (fields.length > 0) {
    embed.addFields({ name: "📋 Variações", value: `${fields.length} opções disponíveis`, inline: true });
  }
  if (product.banner_url) embed.setImage(product.banner_url);
  if (product.icon_url) embed.setThumbnail(product.icon_url);

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = {
  startCheckout, selectVariation, processPurchase,
  goToPayment, approveOrder, rejectOrder, cancelOrder,
  copyPix, showCouponModal, handleCouponModal,
  showQuantityModal, handleQuantityModal,
  markDelivered, cancelManual, copyDelivered,
  viewVariations, viewDetails,
};
