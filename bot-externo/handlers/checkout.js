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
const { DRIKA_COVER_URL, applyDrikaCover } = require("../drikaTemplate");
const { tr, trf, normLang, resolveOrderLang } = require("../i18n");

const CURRENCY_LOCALES = { BRL: "pt-BR", USD: "en-US", EUR: "de-DE" };
const formatMoney = (cents, currency = "BRL") => {
  const cur = (currency || "BRL").toUpperCase();
  const locale = CURRENCY_LOCALES[cur] || "en-US";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: cur }).format((cents || 0) / 100);
  } catch {
    return `${cur} ${((cents || 0) / 100).toFixed(2)}`;
  }
};
// Mantido por compatibilidade
const formatBRL = (cents) => formatMoney(cents, "BRL");
const PIX_PROVIDER_KEYS = new Set(["mercadopago", "pushinpay", "efi", "misticpay", "abacatepay"]);

// ── Delete PIX QR Code message after payment is resolved (paid/canceled/expired) ──
async function deletePixMessage(channel, order) {
  try {
    if (!channel || !order?.pix_message_id) return;
    await channel.messages.delete(order.pix_message_id).catch(() => {});
  } catch {}
}

// ── Delete PIX QR Code by client + order (resolves checkout thread by id) ──
async function deletePixMessageByOrder(client, order) {
  try {
    if (!client || !order?.pix_message_id || !order?.checkout_thread_id) return;
    const ch = await client.channels.fetch(order.checkout_thread_id).catch(() => null);
    if (!ch) return;
    await ch.messages.delete(order.pix_message_id).catch(() => {});
  } catch {}
}
const formatDateTime = (dateObj = new Date()) => ({
  date: dateObj.toLocaleDateString("pt-BR"),
  time: dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
});

// ── Log helper ──
async function sendLog(guild, tenant, { title, description, color, fields: extraFields, storeConfig: sc, components: rawComponents }) {
  try {
    const storeConfig = sc || await getStoreConfig(tenant.id);
    if (!storeConfig?.logs_channel_id) {
      console.warn(`[LOG] No logs_channel_id for tenant ${tenant.id}, skipping: ${title}`);
      return;
    }

    const storeName = storeConfig?.store_title || tenant.name || tr("en", "store_default");
    const storeLogo = storeConfig?.store_logo_url || tenant.logo_url;
    const embedColor = color || parseInt((storeConfig?.embed_color || "#2B2D31").replace("#", ""), 16);
    const { date, time } = formatDateTime();
    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!botToken) {
      console.error(`[LOG] DISCORD_BOT_TOKEN not set, cannot send: ${title}`);
      return;
    }

    const embed = {
      title,
      description,
      color: embedColor,
      image: { url: DRIKA_COVER_URL },
      footer: { text: `${storeName} | ${date}, ${time}`, icon_url: storeLogo || undefined },
      timestamp: new Date().toISOString(),
    };
    if (extraFields?.length) embed.fields = extraFields;

    const body = { embeds: [embed] };

    if (rawComponents && Array.isArray(rawComponents)) {
      body.components = rawComponents.map(c => typeof c.toJSON === "function" ? c.toJSON() : c);
    }

    const res = await fetch(`https://discord.com/api/v10/channels/${storeConfig.logs_channel_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[LOG] REST send failed [${title}]: ${res.status} ${errBody}`);
    } else {
      console.log(`[LOG] ✅ ${title} sent for tenant ${tenant.id} to channel ${storeConfig.logs_channel_id}`);
    }
  } catch (err) {
    console.error(`Failed to send log [${title}]:`, err.message);
  }
}

async function canManuallyApproveOrder(interaction, tenant) {
  try {
    let member = interaction.member;
    if (!member?.permissions && interaction.guild) {
      try {
        member = await interaction.guild.members.fetch(interaction.user.id);
      } catch {}
    }

    if (member?.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;

    const storeConfig = await getStoreConfig(tenant.id);
    const staffRoleIdRaw = storeConfig?.ticket_staff_role_id;
    if (!staffRoleIdRaw) {
      return member?.permissions?.has?.(PermissionFlagsBits.ManageMessages) || false;
    }

    const staffRoleIds = staffRoleIdRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (staffRoleIds.length === 0) return false;

    const memberRoles = member?.roles?.cache || member?._roles;
    if (memberRoles?.has) {
      return staffRoleIds.some((rid) => memberRoles.has(rid));
    }
    if (Array.isArray(memberRoles)) {
      return staffRoleIds.some((rid) => memberRoles.includes(rid));
    }

    return false;
  } catch (e) {
    console.error("Manual approval permission check failed:", e.message);
    return false;
  }
}

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

function resolveHexColor(value, fallback = "#5865F2") {
  const raw = typeof value === "string" ? value.trim() : "";
  const normalized = raw ? (raw.startsWith("#") ? raw : `#${raw}`) : fallback;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
}

function getProductEmbedConfig(product) {
  const rawConfig = product?.embed_config;
  if (!rawConfig) return {};
  if (typeof rawConfig === "string") {
    try {
      const parsed = JSON.parse(rawConfig);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof rawConfig === "object" ? rawConfig : {};
}

async function fetchGuildMembersForStaff(guild) {
  try {
    return await guild.members.fetch();
  } catch (err) {
    console.warn("[STAFF_AUTO_ADD] full member fetch failed, using cache:", err.message);
    return guild.members.cache;
  }
}

// Resolve embed color for a product: product color > store color > fallback
function resolveProductColor(product, storeConfig) {
  const embedConfig = getProductEmbedConfig(product);
  const hex = resolveHexColor(embedConfig.color, resolveHexColor(storeConfig?.embed_color || "#5865F2"));
  return parseInt(hex.replace("#", ""), 16);
}

// Resolve embed color from an order (fetches product if available)
async function resolveOrderColor(order, storeConfig) {
  if (order?.product_id) {
    const { data: product } = await supabase.from("products").select("embed_config").eq("id", order.product_id).single();
    if (product) return resolveProductColor(product, storeConfig);
  }
  return parseInt(resolveHexColor(storeConfig?.embed_color || "#5865F2").replace("#", ""), 16);
}

function resolveCheckoutFooter(storeConfig, product, stockCount, context) {
  const embedConfig = getProductEmbedConfig(product);

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
  const lang = context.lang || "pt-BR";
  const fallback = `${context.storeName} – ${trf(lang, "payment_expires_in", { minutes: context.timeoutMin })}.\n• ${tr(lang, "today_at")} ${context.time}`;
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

// ── MisticPay PIX ──
async function generateMisticPayPix(clientId, clientSecret, amountBRL, externalRef, webhookUrl) {
  const res = await fetch("https://api.misticpay.com/api/transactions/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "ci": clientId, "cs": clientSecret },
    body: JSON.stringify({
      amount: amountBRL,
      payerName: "Cliente",
      payerDocument: "00000000000",
      transactionId: externalRef,
      description: "Pagamento PIX",
      projectWebhook: webhookUrl,
    }),
  });
  if (!res.ok) throw new Error(`MisticPay error: ${res.status}`);
  const json = await res.json();
  const data = json.data || json;
  return { brcode: data.copyPaste || data.qrCode || "", payment_id: String(data.transactionId || externalRef) };
}

// ── AbacatePay PIX ──
async function generateAbacatePayPix(apiKey, amountCents, description, externalRef) {
  const res = await fetch("https://api.abacatepay.com/v1/pixQrCode/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      amount: amountCents,
      expiresIn: 900,
      description: (description || "Pagamento PIX").substring(0, 140),
      externalId: externalRef,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`AbacatePay error: ${res.status} ${text.slice(0, 200)}`);
  let json = {};
  try { json = JSON.parse(text); } catch {}
  const data = json?.data || json;
  const brcode = data.brCode || data.brcode || data.qrCode || data.pixCopyPaste || data.pixCopiaECola || "";
  return { brcode, payment_id: String(data.id || externalRef) };
}

async function startCheckout(interaction, tenant, productId) {
  await interaction.deferReply({ ephemeral: true });

  console.log(`[CHECKOUT] startCheckout productId=${productId} tenantId=${tenant.id}`);
  let L = await resolveOrderLang(supabase, { tenant_id: tenant.id, tenant_language: tenant.language });

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
    return interaction.editReply({ content: tr(L, "product_not_found") });
  }
  L = await resolveOrderLang(supabase, { tenant_id: tenant.id, tenant_language: tenant.language, product_id: product.id, product_language: product.language });

  if (!product.active) return interaction.editReply({ content: tr(L, "product_unavailable") });

  const fields = await getProductFields(product.id, tenant.id);

  // ── Check stock before proceeding (block if stock is 0, regardless of auto_delivery) ──
  if (fields.length > 0) {
    let totalStock = 0;
    for (const f of fields) {
      const sc = await countStock(product.id, tenant.id, f.id);
      totalStock += (sc || 0);
    }
    if (totalStock <= 0) {
      return interaction.editReply({
        content: tr(L, "product_out_of_stock"),
      });
    }
  } else {
    const sc = await countStock(product.id, tenant.id);
    if (sc !== null && sc <= 0) {
      return interaction.editReply({
        content: tr(L, "product_out_of_stock"),
      });
    }
  }

  if (fields.length > 0) {
    // Show variation selector
    const storeConfig = await getStoreConfig(tenant.id);
    const productEmbedCfg = getProductEmbedConfig(product);
    const resolvedHex = resolveHexColor(productEmbedCfg.color, resolveHexColor(storeConfig?.embed_color || "#5865F2"));
    const embedColor = parseInt(resolvedHex.replace("#", ""), 16);

    // Get stock counts per field
    const stockMap = {};
    for (const f of fields) {
      stockMap[f.id] = await countStock(product.id, tenant.id, f.id);
    }

    const options = fields.slice(0, 25).map((f) => ({
      label: f.name,
      value: `buy_field:${productId}:${f.id}`,
      description: trf(L, "field_option_desc", { price: formatMoney(f.price_cents, product.currency), stock: stockMap[f.id] || 0 }),
    }));

    const autoDelivery = product.auto_delivery ? `${tr(L, "auto_delivery_inline")}\n\n` : "";
    const embed = new EmbedBuilder()
      .setTitle(product.name)
      .setDescription(`${autoDelivery}${product.description || ""}`)
      .setColor(embedColor);
    embed.setImage(DRIKA_COVER_URL); // Capa fixa Drika
    if (product.icon_url) embed.setThumbnail(product.icon_url);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(`select_variation:${productId}`).setPlaceholder(tr(L, "select_variation_placeholder")).addOptions(options)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // No variations - direct purchase
  await processPurchase(interaction, tenant, product, product.price_cents);
}

// ── Select Variation (from dropdown) ──
async function selectVariation(interaction, tenant, productId, fieldId) {
  await interaction.deferReply({ ephemeral: true });
  let L = await resolveOrderLang(supabase, { tenant_id: tenant.id, tenant_language: tenant.language });

  const products = await getProducts(tenant.id, false);
  const product = products.find((p) => p.id === productId);
  if (!product) return interaction.editReply({ content: tr(L, "product_not_found") });
  L = await resolveOrderLang(supabase, { tenant_id: tenant.id, tenant_language: tenant.language, product_id: product.id, product_language: product.language });

  const fields = await getProductFields(product.id, tenant.id);
  const field = fields.find((f) => f.id === fieldId);
  if (!field) return interaction.editReply({ content: tr(L, "variation_not_found") });

  // Check stock for this specific field (block regardless of auto_delivery)
  const sc = await countStock(product.id, tenant.id, fieldId);
  if (sc !== null && sc <= 0) {
    return interaction.editReply({
      content: tr(L, "variation_out_of_stock"),
    });
  }

  await processPurchase(interaction, tenant, product, field.price_cents, field.id, field.name);
}

// ── Process Purchase ──
async function processPurchase(interaction, tenant, product, priceCents, fieldId = null, fieldName = null) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const orderName = fieldName ? `${product.name} - ${fieldName}` : product.name;
  const [{ data: freshTenantLang }, { data: freshProductLang }] = await Promise.all([
    supabase.from("tenants").select("language").eq("id", tenant.id).maybeSingle(),
    supabase.from("products").select("language").eq("id", product.id).eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  const Lreview = normLang(
    freshProductLang?.language || product.language || freshTenantLang?.language || tenant.language
  );
  console.log(`[CHECKOUT][i18n] tenant=${tenant.id} product=${product.id} tenantLang=${freshTenantLang?.language || tenant.language || "null"} productLang=${freshProductLang?.language || product.language || "null"} resolved=${Lreview}`);

  const order = await createOrder({
    tenant_id: tenant.id, product_id: product.id, field_id: fieldId,
    product_name: orderName, discord_user_id: userId, discord_username: username,
    total_cents: priceCents, status: "pending_payment",
    currency: (product.currency || "BRL").toUpperCase(),
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
    return interaction.editReply({ content: trf(Lreview, "free_order_delivered", { order_number: order.order_number, product: orderName }) });
  }

  // ── Create checkout thread ──
  const channel = interaction.channel;
  const threadParent = channel?.isThread?.() ? channel.parent : channel;
  const threadName = `🛒 • ${username} • ${order.order_number}`.substring(0, 100);

  const safeUsername = String(username || "cliente")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "cliente";

  if (!threadParent?.threads?.create) {
    return interaction.editReply({ content: tr(Lreview, "cannot_open_cart") });
  }

  try {
    await threadParent.permissionOverwrites?.edit?.(userId, {
      SendMessagesInThreads: true,
    }, { reason: "Checkout: permitir usuário enviar mensagens na thread" });
  } catch (permErr) {
    console.error("[CHECKOUT] permission overwrite error:", permErr.message);
  }

  let checkoutThread;
  try {
    checkoutThread = await threadParent.threads.create({
      name: `${tr(Lreview, "cart_thread_prefix")}-${safeUsername}-${order.order_number}`,
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: 10080,
      reason: `Checkout #${order.order_number}`,
    });
  } catch (privateThreadError) {
    console.error("[CHECKOUT] private thread creation failed:", privateThreadError.message);
    checkoutThread = await threadParent.threads.create({
      name: `${tr(Lreview, "cart_thread_prefix")}-${safeUsername}-${order.order_number}`,
      type: ChannelType.PublicThread,
      autoArchiveDuration: 10080,
      reason: `Checkout #${order.order_number}`,
    });
  }

  await checkoutThread.members.add(userId).catch(() => {});

  await updateOrderStatus(order.id, "pending_payment", { checkout_thread_id: checkoutThread.id });

  // Get store branding
  const storeConfig = await getStoreConfig(tenant.id);

  // ── Auto-add staff to checkout thread (so admins/staff can monitor & confirm manually) ──
  try {
    let staffRoleIds = (storeConfig?.ticket_staff_role_id || "")
      .split(",").map((s) => s.trim()).filter(Boolean);

    // Fallback: tenant_roles with management permissions
    if (staffRoleIds.length === 0) {
      const { data: fallbackRoles } = await supabase
        .from("tenant_roles")
        .select("discord_role_id")
        .eq("tenant_id", tenant.id)
        .or("can_manage_app.eq.true,can_manage_permissions.eq.true,can_manage_store.eq.true,can_manage_stock.eq.true,can_manage_resources.eq.true,can_manage_protection.eq.true");
      staffRoleIds = [...new Set((fallbackRoles || []).map((r) => r.discord_role_id).filter(Boolean))];
    }

    // Panel users with management permissions
    const { data: panelStaffRows } = await supabase
      .from("tenant_permissions")
      .select("discord_user_id")
      .eq("tenant_id", tenant.id)
      .or("can_manage_app.eq.true,can_manage_permissions.eq.true,can_manage_store.eq.true,can_manage_stock.eq.true,can_manage_resources.eq.true,can_manage_protection.eq.true");
    const panelStaffUserIds = [...new Set((panelStaffRows || []).map((r) => r.discord_user_id).filter((id) => id && id !== userId))];

    const guild = interaction.guild;
    const guildRoles = await guild.roles.fetch();
    const adminRoleIds = new Set([...guildRoles.filter((r) => r.permissions.has("Administrator")).keys()]);
    const effectiveStaffRoleIds = new Set([...staffRoleIds, ...adminRoleIds]);

    const members = await fetchGuildMembersForStaff(guild);
    const roleBasedStaffIds = members
      .filter((m) => !m.user.bot && m.user.id !== userId)
      .filter((m) => m.roles.cache.some((r) => effectiveStaffRoleIds.has(r.id)))
      .map((m) => m.user.id);

    const allStaffIds = [...new Set([...roleBasedStaffIds, ...panelStaffUserIds])];
    for (const staffId of allStaffIds) {
      try { await checkoutThread.members.add(staffId); }
      catch (addErr) { console.warn(`[CHECKOUT] failed to add staff ${staffId}:`, addErr.message); }
    }
    console.log(`[CHECKOUT] Added ${allStaffIds.length} staff members to checkout thread #${order.order_number}`);
  } catch (e) {
    console.error("[CHECKOUT] staff auto-add error:", e.message);
  }
  const storeName = storeConfig?.store_title || tenant.name || tr(Lreview, "store_default");
  const storeLogo = storeConfig?.store_logo_url || tenant.logo_url;
  const productEmbedConfig = getProductEmbedConfig(product);
  const resolvedEmbedHex = resolveHexColor(productEmbedConfig.color, resolveHexColor(storeConfig?.embed_color || "#5865F2"));
  const embedColor = parseInt(resolvedEmbedHex.replace("#", ""), 16);

  // Stock count
  let stockCount = "∞";
  const sc = await countStock(product.id, tenant.id, fieldId);
  if (sc !== null) stockCount = String(sc);

  // Build checkout embed
  const descLines = [];
  if (product.auto_delivery) descLines.push(tr(Lreview, "auto_delivery_inline"));
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
    .setTitle(tr(Lreview, "review_title"))
    .setColor(embedColor)
    .addFields(
      { name: tr(Lreview, "cart_label"), value: `1x ${orderName}`, inline: false },
      { name: tr(Lreview, "price_label"), value: formatMoney(priceCents, product.currency), inline: true },
      { name: tr(Lreview, "stock_label_emoji"), value: stockCount, inline: true },
    )
    .setFooter({ text: checkoutFooterText, iconURL: storeLogo || undefined })
    .setTimestamp();

  if (descLines.length) reviewEmbed.setDescription(descLines.join("\n\n"));
  reviewEmbed.setImage(DRIKA_COVER_URL); // Capa fixa Drika
  if (product.icon_url) reviewEmbed.setThumbnail(product.icon_url);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`checkout_pay:${order.id}`).setLabel(tr(Lreview, "go_to_payment")).setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`checkout_quantity:${order.id}`).setLabel(tr(Lreview, "edit_quantity")).setEmoji("✏️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`approve_order:${order.id}`).setLabel(tr(Lreview, "confirm_manual")).setEmoji("🛠️").setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`checkout_coupon:${order.id}`).setLabel(tr(Lreview, "use_coupon")).setEmoji("🏷️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`checkout_cancel:${order.id}`).setLabel(tr(Lreview, "cancel")).setEmoji("🗑️").setStyle(ButtonStyle.Danger),
  );

  await sendWithIdentity(checkoutThread, tenant, {
    embeds: [reviewEmbed],
    components: [row1, row2],
    allowedMentions: { parse: [] },
  });

  // Tell user where to go
  const threadLink = `https://discord.com/channels/${interaction.guild.id}/${checkoutThread.id}`;
  const linkRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel(tr(Lreview, "go_to_cart")).setStyle(ButtonStyle.Link).setURL(threadLink)
  );

  await interaction.editReply({ content: tr(Lreview, "cart_created"), components: [linkRow] });

  // ── Send "Carrinho aberto" log to logs channel ──
  await sendLog(interaction.guild, tenant, {
    title: tr(Lreview, "cart_opened_log_title"),
    description: trf(Lreview, "cart_opened_log_desc", { user_id: userId }),
    fields: [
      { name: `**${tr(Lreview, "details_label")}**`, value: `\`1x ${orderName} | ${formatMoney(priceCents, product.currency)}\``, inline: false },
      { name: `**${tr(Lreview, "order_id_label")}**`, value: `\`${order.id}\``, inline: false },
    ],
    storeConfig,
  });

  // Auto-expire
  const timeout = (storeConfig?.payment_timeout_minutes || 30) * 60 * 1000;
  setTimeout(async () => {
    try {
      const current = await getOrder(order.id);
      if (current?.status === "pending_payment") {
        await updateOrderStatus(order.id, "expired");
        await deletePixMessage(checkoutThread, current);
        await checkoutThread.send(trf(Lreview, "order_expired_desc2", { order_number: current.order_number, product: current.product_name })).catch(() => {});
        setTimeout(() => {
          checkoutThread.setArchived?.(true).catch(() => {});
          checkoutThread.setLocked?.(true).catch(() => {});
        }, 5000);

        // ── Send "Pagamento expirado" log via unified helper ──
        await sendLog(interaction.guild, tenant, {
          title: tr(Lreview, "payment_expired_log_title"),
          description: trf(Lreview, "payment_expired_log_desc", { user_id: current.discord_user_id }),
          color: 0xED4245,
          fields: [
            { name: `**${tr(Lreview, "details_label")}**`, value: `\`${current.product_name} | ${formatMoney(current.total_cents, current.currency)}\``, inline: false },
            { name: `**${tr(Lreview, "order_id_label")}**`, value: `\`${current.id}\``, inline: false },
          ],
        });
      }
    } catch {}
  }, timeout);
}

// ── Lock to prevent duplicate PIX generation ──
const paymentLocks = new Set();

// ── Go to Payment (generate PIX) ──
async function goToPayment(interaction, tenant, orderId) {
  await interaction.deferUpdate();

  // Prevent multiple clicks from generating multiple PIX
  if (paymentLocks.has(orderId)) {
    const L = await resolveOrderLang(supabase, { tenant_id: tenant.id, tenant_language: tenant.language });
    return interaction.followUp({ content: tr(L, "payment_generating_busy"), ephemeral: true });
  }
  paymentLocks.add(orderId);

  try {
    return await _goToPaymentInternal(interaction, tenant, orderId);
  } finally {
    // Release lock after 10s to allow retries if something truly failed
    setTimeout(() => paymentLocks.delete(orderId), 10000);
  }
}

async function _goToPaymentInternal(interaction, tenant, orderId) {
  const order = await getOrder(orderId);
  const L = await resolveOrderLang(supabase, order || { tenant_id: tenant.id });
  if (!order) return interaction.followUp({ content: tr(L, "order_not_found"), ephemeral: true });
  if (order.status !== "pending_payment") return interaction.followUp({ content: tr(L, "order_not_pending"), ephemeral: true });

  // Block if payment was already generated for this order
  if (order.payment_id) {
    return interaction.followUp({ content: tr(L, "pix_already_generated"), ephemeral: true });
  }

  // ── Validate stock before generating PIX ──
  if (order.product_id) {
    const { data: prod } = await supabase.from("products").select("auto_delivery, stock").eq("id", order.product_id).single();
    if (prod && prod.auto_delivery) {
      const fieldId = order.field_id;
      const sc = await countStock(order.product_id, order.tenant_id, fieldId || undefined);
      if (sc !== null && sc <= 0) {
        return interaction.followUp({ content: tr(L, "product_out_of_stock"), ephemeral: true });
      }
    }
  }

  const channel = interaction.channel;
  const preStoreConfig = await getStoreConfig(tenant.id);
  const preEmbedColor = await resolveOrderColor(order, preStoreConfig);
  await sendWithIdentity(channel, tenant, { embeds: [applyDrikaCover(new EmbedBuilder().setDescription(tr(L, "generating_qr")).setColor(preEmbedColor))] });

  const priceCents = order.total_cents;
  const orderCurrency = (order.currency || "BRL").toUpperCase();
  const amount = priceCents / 100;
  const webhookBaseUrl = `${process.env.SUPABASE_URL}/functions/v1/payment-webhook`;
  let brcode = "";
  let paymentId = "";

  const { data: orderProduct } = order.product_id
    ? await supabase.from("products").select("payment_provider_key, currency").eq("id", order.product_id).eq("tenant_id", tenant.id).maybeSingle()
    : { data: null };
  const preferredProviderKey = orderProduct?.payment_provider_key || null;
  const provider = await getActivePaymentProvider(tenant.id, preferredProviderKey);

  if (provider && amount > 0) {
    const providerKey = provider.provider_key;
    const apiKey = provider.api_key_encrypted;
    const webhookUrl = `${webhookBaseUrl}/${providerKey}/${tenant.id}`;
    const externalRef = `order_${order.id}`;

    if (orderCurrency !== "BRL" && providerKey !== "stripe") {
      return sendWithIdentity(channel, tenant, { embeds: [applyDrikaCover(new EmbedBuilder().setTitle("❌ Gateway incompatível").setDescription(`${formatMoney(priceCents, orderCurrency)} só pode ser cobrado com Stripe (Cartão). Selecione Stripe no produto ou altere a moeda para BRL.`).setColor(0xED4245))] });
    }

    if (providerKey === "mercadopago") {
      const r = await generateMercadoPagoPix(apiKey, amount, order.product_name, externalRef, webhookUrl);
      brcode = r.brcode; paymentId = r.payment_id;
    } else if (providerKey === "pushinpay") {
      const r = await generatePushinPayPix(apiKey, priceCents, webhookUrl);
      brcode = r.brcode; paymentId = r.payment_id;
    } else if (providerKey === "misticpay") {
      const secretKey = provider.secret_key_encrypted || "";
      const r = await generateMisticPayPix(apiKey, secretKey, amount, externalRef, webhookUrl);
      brcode = r.brcode; paymentId = r.payment_id;
    } else if (providerKey === "abacatepay") {
      const r = await generateAbacatePayPix(apiKey, priceCents, order.product_name, externalRef);
      brcode = r.brcode; paymentId = r.payment_id;
    } else if (providerKey === "efi") {
      const pixRes = await fetch(`${process.env.SUPABASE_URL}/functions/v1/generate-pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ tenant_id: tenant.id, amount_cents: priceCents, product_name: order.product_name, tx_id: externalRef }),
      });
      const pixData = await pixRes.json();
      if (pixData.error) throw new Error(pixData.error);
      brcode = pixData.brcode || ""; paymentId = pixData.payment_id || externalRef;
    } else if (providerKey === "stripe") {
      // Stripe: gera Checkout Session (link de pagamento por cartão) ao invés de PIX
      const stripeRes = await fetch(`${process.env.SUPABASE_URL}/functions/v1/stripe-create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ tenant_id: tenant.id, order_id: order.id }),
      });
      const stripeData = await stripeRes.json();
      if (stripeData.error) throw new Error(stripeData.error);
      const checkoutUrl = stripeData.checkout_url;
      const currency = (stripeData.currency || orderCurrency).toUpperCase();
      paymentId = stripeData.session_id || externalRef;

      await updateOrderStatus(order.id, "pending_payment", { payment_id: paymentId, payment_provider: "stripe" });

      // Envia embed Stripe com link button
      const storeConfig = await getStoreConfig(tenant.id);
      const embedColor = await resolveOrderColor(order, storeConfig);
      const storeLogo = storeConfig?.store_logo_url || tenant.logo_url;
      const stripeEmbed = new EmbedBuilder()
        .setAuthor({ name: order.discord_username || tr(L, "buyer_label") })
        .setTitle("💳 Pagamento via Cartão")
        .setDescription([
          `**Produto:** \`${order.product_name}\``,
          `**Valor:** \`${formatMoney(priceCents, currency)}\``,
          ``,
          `🔒 Ambiente seguro processado pela **Stripe**.`,
          `Clique no botão abaixo para abrir o checkout e finalizar o pagamento com seu cartão.`,
          ``,
          `_O pedido será confirmado automaticamente após a aprovação do pagamento._`,
        ].join("\n"))
        .setColor(embedColor);
      if (storeLogo) stripeEmbed.setThumbnail(storeLogo);

      const stripeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("💳 Pagar com Cartão").setStyle(ButtonStyle.Link).setURL(checkoutUrl),
        new ButtonBuilder().setCustomId(`checkout_cancel:${order.id}`).setLabel(tr(L, "cancel")).setStyle(ButtonStyle.Danger),
      );

      const stripeSentMsg = await sendWithIdentity(channel, tenant, { embeds: [stripeEmbed], components: [stripeRow] });
      try {
        if (stripeSentMsg?.id) {
          await supabase.from("orders").update({ pix_message_id: stripeSentMsg.id }).eq("id", order.id);
          order.pix_message_id = stripeSentMsg.id;
        }
      } catch (e) { console.error("[CHECKOUT] Failed to persist stripe msg id:", e?.message || e); }

      await sendLog(interaction.guild, tenant, {
        title: tr(L, "order_requested_log_title"),
        description: trf(L, "order_requested_log_desc", { user_id: order.discord_user_id }),
        fields: [
          { name: `**${tr(L, "details_label")}**`, value: `\`1x ${order.product_name} | ${formatMoney(priceCents, currency)}\``, inline: false },
          { name: `**${tr(L, "order_id_label")}**`, value: `\`${order.id}\``, inline: false },
          { name: `**${tr(L, "payment_method_label")}**`, value: `\`💳 Stripe (Cartão)\``, inline: false },
        ],
      });

      // Inicia polling como fallback (webhook é o caminho principal)
      startPaymentPolling(order.id, tenant.id, channel, tenant, (await getStoreConfig(tenant.id))?.payment_timeout_minutes || 30);
      return;
    }

    await updateOrderStatus(order.id, "pending_payment", { payment_id: paymentId, payment_provider: providerKey });

    const provLabel = providerKey === "pushinpay" ? "Pix – PushinPay"
      : providerKey === "efi" ? "Pix – Efi Bank"
      : providerKey === "mercadopago" ? "Pix – Mercado Pago"
      : providerKey === "misticpay" ? "Pix – Mistic Pay"
      : providerKey === "abacatepay" ? "Pix – AbacatePay"
      : `Pix – ${providerKey}`;

    await sendLog(interaction.guild, tenant, {
      title: tr(L, "order_requested_log_title"),
      description: trf(L, "order_requested_log_desc", { user_id: order.discord_user_id }),
      fields: [
        { name: `**${tr(L, "details_label")}**`, value: `\`1x ${order.product_name} | ${formatMoney(priceCents, order.currency)}\``, inline: false },
        { name: `**${tr(L, "order_id_label")}**`, value: `\`${order.id}\``, inline: false },
        { name: `**${tr(L, "payment_method_label")}**`, value: `\`💎 ${provLabel}\``, inline: false },
      ],
    });
  } else {
    // Static PIX
    if (!tenant.pix_key) {
      return sendWithIdentity(channel, tenant, { embeds: [applyDrikaCover(new EmbedBuilder().setTitle("❌ Error").setDescription(tr(L, "no_payment_method")).setColor(0xED4245))] });
    }
    brcode = generateStaticBRCode(tenant.pix_key, tenant.name || tr(L, "store_default"), amountBRL, `PED${order.order_number}`);
    await updateOrderStatus(order.id, "pending_payment", { payment_provider: "static_pix" });

    const storeConfig = await getStoreConfig(tenant.id);
    const approvalRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`approve_order:${order.id}`).setLabel(tr(L, "approve_payment")).setEmoji("✅").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`reject_order:${order.id}`).setLabel(tr(L, "reject")).setEmoji("❌").setStyle(ButtonStyle.Danger),
    );

    await sendLog(interaction.guild, tenant, {
      title: tr(L, "order_requested_log_title"),
      description: trf(L, "order_requested_log_desc", { user_id: order.discord_user_id }),
      fields: [
        { name: `**${tr(L, "details_label")}**`, value: `\`1x ${order.product_name} | ${formatMoney(priceCents, order.currency)}\``, inline: false },
        { name: `**${tr(L, "order_id_label")}**`, value: `\`${order.id}\``, inline: false },
        { name: `**${tr(L, "payment_method_label")}**`, value: `\`💎 ${tr(L, "static_pix_label")}\``, inline: false },
      ],
      components: [approvalRow],
      storeConfig,
    });
  }

  // Send PIX embed
  const storeConfig = await getStoreConfig(tenant.id);
  const storeName = storeConfig?.store_title || tenant.name || tr(L, "store_default");
  const storeLogo = storeConfig?.store_logo_url || tenant.logo_url;
  const timeoutMin = storeConfig?.payment_timeout_minutes || 30;
  const embedColor = await resolveOrderColor(order, storeConfig);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(brcode)}`;
  const { date: paymentDate, time: paymentTime } = formatDateTime();
  const pixFooterText = resolvePixFooter(storeConfig, {
    storeName,
    productName: order.product_name,
    orderNumber: order.order_number,
    timeoutMin,
    date: paymentDate,
    time: paymentTime,
    lang: L,
    username: order.discord_username || "",
  });

  const pixEmbed = new EmbedBuilder()
    .setAuthor({ name: order.discord_username || tr(L, "buyer_label") })
    .setTitle(tr(L, "pix_created_title"))
    .setDescription([
      tr(L, "secure_environment_title"), `${tr(L, "secure_environment_desc")}\n`,
      tr(L, "instant_payment_title"), `${tr(L, "instant_payment_desc")}\n`,
      `**${tr(L, "pix_copy_code_label")}**`, `\`\`\`\n${brcode}\n\`\`\``,
    ].join("\n"))
    .setColor(embedColor)
    .setImage(qrImageUrl)
    .setFooter({ text: pixFooterText, iconURL: storeLogo || undefined });

  if (storeLogo) pixEmbed.setThumbnail(storeLogo);

  const pixRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`copy_pix:${order.id}`).setLabel(tr(L, "pix_copy_code_label")).setEmoji("📋").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`checkout_cancel:${order.id}`).setLabel(tr(L, "cancel")).setStyle(ButtonStyle.Danger),
  );

  const pixSentMsg = await sendWithIdentity(channel, tenant, { embeds: [pixEmbed], components: [pixRow] });
  // Save the PIX message id so we can delete it once the payment is resolved
  try {
    if (pixSentMsg?.id) {
      await supabase.from("orders").update({ pix_message_id: pixSentMsg.id }).eq("id", order.id);
      order.pix_message_id = pixSentMsg.id;
    }
  } catch (e) { console.error("[CHECKOUT] Failed to persist pix_message_id:", e?.message || e); }

  // ── Start payment polling for providers without reliable webhooks ──
  if (provider && provider.provider_key) {
    startPaymentPolling(order.id, tenant.id, channel, tenant, timeoutMin);
  }
}

// ── Payment Polling ──
// Polls check-payment-status edge function every 10s until paid, canceled, or timeout
async function startPaymentPolling(orderId, tenantId, channel, tenant, timeoutMin = 30) {
  const maxAttempts = Math.floor((timeoutMin * 60) / 10); // poll every 10 seconds
  let attempts = 0;

  const poll = async () => {
    attempts++;
    if (attempts > maxAttempts) {
      console.log(`[POLLING] Timeout for order ${orderId} after ${attempts} attempts`);
      return;
    }

    try {
      // Check if order is still pending
      const currentOrder = await getOrder(orderId);
      if (!currentOrder || currentOrder.status !== "pending_payment") {
        console.log(`[POLLING] Order ${orderId} no longer pending: ${currentOrder?.status}`);
        return;
      }

      const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/check-payment-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ order_id: orderId, tenant_id: tenantId }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`[POLLING] Order ${orderId} attempt ${attempts}: ${JSON.stringify(data)}`);

        if (data.status === "paid" && data.changed) {
          console.log(`[POLLING] Payment confirmed for order ${orderId}!`);
          // Trigger automation + send log from bot side
          try {
            const paidOrder = await getOrder(orderId);
            if (paidOrder) {
              await triggerAutomation(tenantId, "order_paid", {
                discord_user_id: paidOrder.discord_user_id,
                discord_username: paidOrder.discord_username,
                order_id: orderId,
                order_number: paidOrder.order_number,
                product_name: paidOrder.product_name,
                total_cents: paidOrder.total_cents,
              });

              // Log: Pagamento confirmado
              const Lpaid = await resolveOrderLang(supabase, paidOrder);
              const paidTenant = await require("../supabase").getTenantByGuild(null) || tenant;
              await sendLog(null, { id: tenantId, name: paidTenant?.name || tenant?.name || tr(Lpaid, "store_default"), logo_url: paidTenant?.logo_url || tenant?.logo_url }, {
                title: tr(Lpaid, "payment_confirmed_log_title"),
                description: trf(Lpaid, "payment_confirmed_log_desc", { user_id: paidOrder.discord_user_id }),
                color: 0x57F287,
                fields: [
                  { name: `**${tr(Lpaid, "details_label")}**`, value: `\`${paidOrder.product_name} | ${formatMoney(paidOrder.total_cents, paidOrder.currency)}\``, inline: false },
                  { name: `**${tr(Lpaid, "order_label")}**`, value: `\`#${paidOrder.order_number}\``, inline: true },
                  { name: `**${tr(Lpaid, "order_id_label")}**`, value: `\`${orderId}\``, inline: false },
                ],
              });
            }
          } catch (e) {
            console.error("[POLLING] Automation trigger error:", e.message);
          }
          return; // Stop polling - delivery was triggered by the edge function
        }
      }
    } catch (e) {
      console.error(`[POLLING] Error checking order ${orderId}:`, e.message);
    }

    // Schedule next poll
    setTimeout(poll, 10000);
  };

  // Start polling after 10 seconds (give webhook a chance first)
  setTimeout(poll, 10000);
}

// ── Approve Order ──
async function approveOrder(interaction, tenant, orderId) {
  await interaction.deferUpdate();
  const order = await getOrder(orderId);
  const L = await resolveOrderLang(supabase, order || { tenant_id: tenant.id, tenant_language: tenant.language });

  const canApprove = await canManuallyApproveOrder(interaction, tenant);
  if (!canApprove) {
    return interaction.followUp({ content: tr(L, "no_manual_approve_permission"), ephemeral: true });
  }

  if (!order) return interaction.followUp({ content: tr(L, "order_not_found"), ephemeral: true });
  if (order.status !== "pending_payment") return interaction.followUp({ content: trf(L, "order_already_processed", { order_number: order.order_number }), ephemeral: true });

  await updateOrderStatus(orderId, "paid", { payment_provider: "manual_confirmation" });
  await deletePixMessageByOrder(interaction.client, order);
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
    const dmEmbedColor = await resolveOrderColor(order, dmStoreConfig);
    const dmApprovedEmbed = new EmbedBuilder()
      .setTitle(tr(L, "payment_confirmed_title"))
      .setDescription(trf(L, "payment_confirmed_desc", { order_number: order.order_number, product: order.product_name }))
      .setColor(dmEmbedColor)
      .setTimestamp();
    applyDrikaCover(dmApprovedEmbed);
    await user.send({ embeds: [dmApprovedEmbed] });
  } catch {}

  const approveStoreConfig = await getStoreConfig(tenant.id);
  const approveEmbedColor = await resolveOrderColor(order, approveStoreConfig);
  const approvedEmbed = new EmbedBuilder()
    .setTitle(tr(L, "order_approved_panel_title"))
    .setDescription(trf(L, "order_approved_panel_desc", { order_number: order.order_number, user_id: interaction.user.id }))
    .setColor(approveEmbedColor)
    .addFields(
      { name: `📦 ${tr(L, "product_label")}`, value: order.product_name, inline: true },
      { name: `💰 ${tr(L, "value_label")}`, value: formatMoney(order.total_cents, order.currency), inline: true },
      { name: `👤 ${tr(L, "buyer_label")}`, value: `<@${order.discord_user_id}>`, inline: true },
    )
    .setTimestamp();
  applyDrikaCover(approvedEmbed);

  await interaction.editReply({ embeds: [approvedEmbed], components: [] });

  // Log: Pedido aprovado
  await sendLog(interaction.guild, tenant, {
    title: tr(L, "order_approved_log_title"),
    description: trf(L, "order_approved_log_desc", { order_number: order.order_number, user_id: interaction.user.id }),
    color: 0x57F287,
    fields: [
      { name: `**${tr(L, "details_label")}**`, value: `\`1x ${order.product_name} | ${formatMoney(order.total_cents, order.currency)}\``, inline: false },
      { name: `**${tr(L, "order_id_label")}**`, value: `\`${order.id}\``, inline: false },
      { name: `**${tr(L, "buyer_label")}**`, value: `<@${order.discord_user_id}>`, inline: false },
    ],
  });
}

// ── Reject Order ──
async function rejectOrder(interaction, tenant, orderId) {
  await interaction.deferUpdate();
  const order = await getOrder(orderId);
  const L = await resolveOrderLang(supabase, order || { tenant_id: tenant.id, tenant_language: tenant.language });
  if (!order) return interaction.followUp({ content: tr(L, "order_not_found"), ephemeral: true });
  if (order.status !== "pending_payment") return interaction.followUp({ content: trf(L, "order_already_processed", { order_number: order.order_number }), ephemeral: true });

  await updateOrderStatus(orderId, "canceled");
  await deletePixMessageByOrder(interaction.client, order);

  try {
    const user = await interaction.client.users.fetch(order.discord_user_id);
    const dmRejectedEmbed = new EmbedBuilder()
      .setTitle(tr(L, "order_rejected_title"))
      .setDescription(trf(L, "order_rejected_desc", { order_number: order.order_number, product: order.product_name }))
      .setColor(0xED4245)
      .setTimestamp();
    applyDrikaCover(dmRejectedEmbed);
    await user.send({ embeds: [dmRejectedEmbed] });
  } catch {}

  const rejectedEmbed = new EmbedBuilder().setTitle(tr(L, "order_rejected_panel_title")).setDescription(trf(L, "order_rejected_panel_desc", { order_number: order.order_number, user_id: interaction.user.id })).setColor(0xED4245).addFields({ name: `📦 ${tr(L, "product_label")}`, value: order.product_name, inline: true }, { name: `👤 ${tr(L, "buyer_label")}`, value: `<@${order.discord_user_id}>`, inline: true }).setTimestamp();
  applyDrikaCover(rejectedEmbed);
  await interaction.editReply({
    embeds: [rejectedEmbed],
    components: [],
  });

  // Log: Pedido recusado
  await sendLog(interaction.guild, tenant, {
    title: tr(L, "order_rejected_log_title"),
    description: trf(L, "order_rejected_log_desc", { order_number: order.order_number, user_id: interaction.user.id }),
    color: 0xED4245,
    fields: [
      { name: `**${tr(L, "details_label")}**`, value: `\`1x ${order.product_name} | ${formatMoney(order.total_cents, order.currency)}\``, inline: false },
      { name: `**${tr(L, "order_id_label")}**`, value: `\`${order.id}\``, inline: false },
      { name: `**${tr(L, "buyer_label")}**`, value: `<@${order.discord_user_id}>`, inline: false },
    ],
  });
}

// ── Cancel Order ──
async function cancelOrder(interaction, tenant, orderId) {
  await interaction.deferUpdate();
  const order = await getOrder(orderId);
  if (!order) return;
  const L = await resolveOrderLang(supabase, order);

  if (order.status === "pending_payment") {
    await updateOrderStatus(orderId, "canceled");
  }

  const channel = interaction.channel;
  await deletePixMessage(channel, order);
  const cancelStoreConfig = await getStoreConfig(tenant.id);
  const cancelEmbedColor = await resolveOrderColor(order, cancelStoreConfig);
  await sendWithIdentity(channel, tenant, { embeds: [applyDrikaCover(new EmbedBuilder().setTitle(tr(L, "purchase_canceled_title")).setDescription(trf(L, "purchase_canceled_desc_archived", { order_number: order.order_number })).setColor(cancelEmbedColor))] });

  // Log: Pedido cancelado pelo cliente
  await sendLog(interaction.guild, tenant, {
    title: tr(L, "order_canceled_log_title"),
    description: trf(L, "order_canceled_log_desc", { user_id: order.discord_user_id }),
    color: 0xED4245,
    fields: [
      { name: `**${tr(L, "details_label")}**`, value: `\`1x ${order.product_name} | ${formatMoney(order.total_cents, order.currency)}\``, inline: false },
      { name: `**${tr(L, "order_id_label")}**`, value: `\`${order.id}\``, inline: false },
    ],
    storeConfig: cancelStoreConfig,
  });

  setTimeout(() => {
    channel.setArchived?.(true).catch(() => {});
    channel.setLocked?.(true).catch(() => {});
  }, 3000);
}

// ── Copy PIX ──
async function copyPix(interaction, tenant, orderId) {
  const order = await getOrder(orderId);
  const L = await resolveOrderLang(supabase, order || { tenant_id: tenant.id });
  if (!order) return interaction.reply({ content: tr(L, "order_not_found"), ephemeral: true });

  if (tenant.pix_key) {
    const brcode = generateStaticBRCode(tenant.pix_key, tenant.name || tr(L, "store_default"), order.total_cents / 100, `PED${order.order_number}`);
    return interaction.reply({ content: `${tr(L, "pix_copy_code_title")}\n\`\`\`\n${brcode}\n\`\`\``, ephemeral: true });
  }
  return interaction.reply({ content: tr(L, "pix_code_above"), ephemeral: true });
}

// ── Coupon Modal ──
async function showCouponModal(interaction, orderId) {
  const order = await getOrder(orderId).catch(() => null);
  const L = await resolveOrderLang(supabase, order || {});
  const modal = new ModalBuilder().setCustomId(`coupon_modal_${orderId}`).setTitle(tr(L, "use_coupon"));
  const input = new TextInputBuilder().setCustomId("coupon_code").setLabel(tr(L, "coupon_code_label")).setStyle(TextInputStyle.Short).setPlaceholder(tr(L, "coupon_code_placeholder")).setRequired(true).setMaxLength(50);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

// ── Coupon Modal Submit ──
async function handleCouponModal(interaction, tenant, orderId) {
  await interaction.deferReply({ ephemeral: true });
  const couponCode = interaction.fields.getTextInputValue("coupon_code").trim().toUpperCase();
  const order = await getOrder(orderId);
  const L = await resolveOrderLang(supabase, order || { tenant_id: tenant.id, tenant_language: tenant.language });
  if (!couponCode) return interaction.editReply({ content: tr(L, "invalid_coupon_code") });
  if (!order || order.status !== "pending_payment") return interaction.editReply({ content: tr(L, "order_not_found_or_processed") });

  const coupon = await getCoupon(tenant.id, couponCode);
  if (!coupon) return interaction.editReply({ content: tr(L, "coupon_not_found") });
  if (coupon.product_id && coupon.product_id !== order.product_id) return interaction.editReply({ content: tr(L, "coupon_not_valid_for_product") });

  let discount = coupon.type === "percent" ? Math.floor(order.total_cents * coupon.value / 100) : coupon.value;
  const newTotal = Math.max(0, order.total_cents - discount);

  await updateOrderStatus(order.id, "pending_payment", { total_cents: newTotal, coupon_id: coupon.id });
  await incrementCouponUsage(coupon.id, coupon.used_count);

  await sendWithIdentity(interaction.channel, tenant, {
    embeds: [applyDrikaCover(new EmbedBuilder().setTitle(tr(L, "coupon_applied_title")).setDescription(trf(L, "coupon_applied_desc", { coupon: couponCode, old_total: formatMoney(order.total_cents, order.currency), new_total: formatMoney(newTotal, order.currency), discount: formatMoney(discount, order.currency) })).setColor(0x57F287))],
  });

  await interaction.editReply({ content: tr(L, "coupon_applied_response") });

  // Log: Cupom aplicado
  await sendLog(interaction.guild, tenant, {
    title: tr(L, "coupon_applied_log_title"),
    description: trf(L, "coupon_applied_log_desc", { user_id: interaction.user.id }),
    fields: [
      { name: `**${tr(L, "coupon") || tr(L, "coupon_code_label")}**`, value: `\`${couponCode}\``, inline: true },
      { name: `**${tr(L, "discount_label")}**`, value: `\`-${formatMoney(discount, order.currency)}\``, inline: true },
      { name: `**${tr(L, "new_total_label")}**`, value: `\`${formatMoney(newTotal, order.currency)}\``, inline: true },
      { name: `**${tr(L, "order_id_label")}**`, value: `\`${order.id}\``, inline: false },
    ],
  });
}

// ── Quantity Modal ──
async function showQuantityModal(interaction, orderId) {
  const order = await getOrder(orderId).catch(() => null);
  const L = await resolveOrderLang(supabase, order || {});
  const modal = new ModalBuilder().setCustomId(`quantity_modal_${orderId}`).setTitle(tr(L, "edit_quantity"));
  const input = new TextInputBuilder().setCustomId("quantity_value").setLabel(tr(L, "quantity")).setStyle(TextInputStyle.Short).setPlaceholder("1").setRequired(true).setMaxLength(3).setValue("1");
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

// ── Quantity Modal Submit ──
async function handleQuantityModal(interaction, tenant, orderId) {
  await interaction.deferReply({ ephemeral: true });
  const qty = parseInt(interaction.fields.getTextInputValue("quantity_value").trim());
  const order = await getOrder(orderId);
  const L = await resolveOrderLang(supabase, order || { tenant_id: tenant.id, tenant_language: tenant.language });
  if (isNaN(qty) || qty < 1 || qty > 99) return interaction.editReply({ content: tr(L, "invalid_quantity") });
  if (!order || order.status !== "pending_payment") return interaction.editReply({ content: tr(L, "order_not_found_or_processed") });

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
    embeds: [applyDrikaCover(new EmbedBuilder().setTitle(tr(L, "quantity_updated_title")).setDescription(trf(L, "quantity_updated_desc", { quantity: qty, total: formatMoney(newTotal, order.currency) })).setColor(await resolveOrderColor(order, await getStoreConfig(tenant.id))))],
  });

  await interaction.editReply({ content: trf(L, "quantity_updated_response", { quantity: qty }) });

  // Log: Quantidade editada
  await sendLog(interaction.guild, tenant, {
    title: tr(L, "quantity_edited_log_title"),
    description: trf(L, "quantity_edited_log_desc", { user_id: interaction.user.id }),
    fields: [
      { name: `**${tr(L, "product_label")}**`, value: `\`${order.product_name}\``, inline: true },
      { name: `**${tr(L, "quantity")}**`, value: `\`${qty}x\``, inline: true },
      { name: `**${tr(L, "new_total_label")}**`, value: `\`${formatMoney(newTotal, order.currency)}\``, inline: true },
      { name: `**${tr(L, "order_id_label")}**`, value: `\`${order.id}\``, inline: false },
    ],
  });
}

// ── Mark Delivered ──
async function markDelivered(interaction, tenant, orderId) {
  await interaction.deferUpdate();
  const order = await getOrder(orderId);
  const L = await resolveOrderLang(supabase, order || { tenant_id: tenant.id, tenant_language: tenant.language });

  const canApprove = await canManuallyApproveOrder(interaction, tenant);
  if (!canApprove) {
    return interaction.followUp({ content: tr(L, "no_mark_delivered_permission"), ephemeral: true });
  }

  if (!order) return;

  await updateOrderStatus(orderId, "delivered");

  await sendWithIdentity(interaction.channel, tenant, {
    embeds: [new EmbedBuilder().setTitle(tr(L, "delivery_confirmed_title")).setDescription(trf(L, "delivery_confirmed_desc", { order_number: order.order_number, user_id: interaction.user.id })).setColor(await resolveOrderColor(order, await getStoreConfig(tenant.id)))],
  });

  await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle(tr(L, "order_delivered_panel_title")).setDescription(trf(L, "order_delivered_panel_desc", { order_number: order.order_number, product: order.product_name })).setColor(0x57F287)],
    components: [],
  });

  // Log: Entrega manual confirmada
  await sendLog(interaction.guild, tenant, {
    title: tr(L, "manual_delivery_confirmed_log_title"),
    description: trf(L, "manual_delivery_confirmed_log_desc", { order_number: order.order_number, user_id: interaction.user.id }),
    color: 0x57F287,
    fields: [
      { name: `**${tr(L, "details_label")}**`, value: `\`${order.product_name} | ${formatMoney(order.total_cents, order.currency)}\``, inline: false },
      { name: `**${tr(L, "order_id_label")}**`, value: `\`${order.id}\``, inline: false },
      { name: `**${tr(L, "buyer_label")}**`, value: `<@${order.discord_user_id}>`, inline: false },
    ],
  });
}

// ── Cancel Manual ──
async function cancelManual(interaction, tenant, orderId) {
  await interaction.deferUpdate();
  const order = await getOrder(orderId);
  const L = await resolveOrderLang(supabase, order || { tenant_id: tenant.id, tenant_language: tenant.language });

  const canApprove = await canManuallyApproveOrder(interaction, tenant);
  if (!canApprove) {
    return interaction.followUp({ content: tr(L, "no_cancel_permission"), ephemeral: true });
  }

  if (!order) return;

  await updateOrderStatus(orderId, "canceled");
  await deletePixMessageByOrder(interaction.client, order);

  try {
    const user = await interaction.client.users.fetch(order.discord_user_id);
    await user.send({ embeds: [new EmbedBuilder()
      .setTitle(tr(L, "order_canceled_title"))
      .setDescription(trf(L, "order_canceled_desc", { order_number: order.order_number, product: order.product_name }))
      .setColor(0xED4245)] });
  } catch {}

  await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle(tr(L, "order_canceled_title")).setDescription(trf(L, "order_canceled_desc", { order_number: order.order_number, product: order.product_name })).setColor(0xED4245)],
    components: [],
  });

  // Log: Cancelamento manual pelo admin
  await sendLog(interaction.guild, tenant, {
    title: tr(L, "manual_cancel_log_title"),
    description: trf(L, "manual_cancel_log_desc", { order_number: order.order_number, user_id: interaction.user.id }),
    color: 0xED4245,
    fields: [
      { name: `**${tr(L, "details_label")}**`, value: `\`${order.product_name} | ${formatMoney(order.total_cents, order.currency)}\``, inline: false },
      { name: `**${tr(L, "order_id_label")}**`, value: `\`${order.id}\``, inline: false },
      { name: `**${tr(L, "buyer_label")}**`, value: `<@${order.discord_user_id}>`, inline: false },
    ],
  });
}

// ── Copy Delivered ──
async function copyDelivered(interaction, tenant, orderId) {
  const order = await getOrder(orderId);
  const L = await resolveOrderLang(supabase, order || { tenant_id: tenant.id, tenant_language: tenant.language });
  if (!order) return interaction.reply({ content: tr(L, "order_not_found"), ephemeral: true });

  const { data: items } = await supabase.from("product_stock_items").select("content")
    .eq("product_id", order.product_id).eq("tenant_id", order.tenant_id)
    .eq("delivered_to", order.discord_user_id).eq("delivered", true)
    .order("delivered_at", { ascending: false }).limit(10);

  if (!items?.length) return interaction.reply({ content: tr(L, "delivered_not_found"), ephemeral: true });
  const content = items.map((i) => i.content).join("\n");
  return interaction.reply({ content: trf(L, "delivered_copy_response", { content }), ephemeral: true });
}

// ── View Variations ──
async function viewVariations(interaction, tenant, productId) {
  const { data: product } = await supabase.from("products").select("name, tenant_id, language, currency").eq("id", productId).single();
  const L = await resolveOrderLang(supabase, { tenant_id: product?.tenant_id || tenant.id, tenant_language: tenant.language, product_id: productId, product_language: product?.language });
  if (!product) return interaction.reply({ content: tr(L, "product_not_found"), ephemeral: true });

  const fields = await getProductFields(productId, product.tenant_id);
  if (!fields.length) return interaction.reply({ content: tr(L, "no_variations"), ephemeral: true });

  const storeConfig = await getStoreConfig(product.tenant_id);
  const { data: fullProduct } = await supabase.from("products").select("*").eq("id", productId).single();
  const embedColor = fullProduct ? resolveProductColor(fullProduct, storeConfig) : parseInt(resolveHexColor(storeConfig?.embed_color || "#5865F2").replace("#", ""), 16);

  const fieldLines = fields.map((f) => {
    const emoji = f.emoji || "•";
    const desc = f.description ? ` - ${f.description}` : "";
    return `${emoji} **${f.name}** — ${formatMoney(f.price_cents, product.currency)}${desc}`;
  });

  return interaction.reply({
    embeds: [new EmbedBuilder().setTitle(trf(L, "variations_of", { product: product.name })).setDescription(fieldLines.join("\n")).setColor(embedColor)],
    ephemeral: true,
  });
}

// ── View Details ──
async function viewDetails(interaction, tenant, productId) {
  const products = await getProducts(tenant.id, false);
  const product = products.find((p) => p.id === productId);
  const L = await resolveOrderLang(supabase, { tenant_id: tenant.id, tenant_language: tenant.language, product_id: productId, product_language: product?.language });
  if (!product) return interaction.reply({ content: tr(L, "product_not_found"), ephemeral: true });

  const fields = await getProductFields(productId, tenant.id);
  const storeConfig = await getStoreConfig(tenant.id);
  const embedColor = resolveProductColor(product, storeConfig);

  const autoDeliveryText = product.auto_delivery ? `${tr(L, "auto_delivery_inline")}\n\n` : "";
  const embed = new EmbedBuilder()
    .setTitle(`ℹ️ ${product.name}`)
    .setDescription(`${autoDeliveryText}${product.description || tr(L, "no_description")}`)
    .setColor(embedColor)
    .addFields(
      { name: tr(L, "price_label_md"), value: formatMoney(product.price_cents, product.currency), inline: true },
      { name: `📦 ${tr(L, "type_label")}`, value: product.type === "digital_auto" ? "Digital" : product.type === "service" ? tr(L, "service_type") : tr(L, "hybrid_type"), inline: true },
    );

  if (product.show_stock && product.stock !== null) {
    embed.addFields({ name: `📊 ${tr(L, "stock_label_md")}`, value: trf(L, "stock_count", { stock: product.stock }), inline: true });
  }
  if (fields.length > 0) {
    embed.addFields({ name: `📋 ${tr(L, "variations_label")}`, value: trf(L, "variations_count", { count: fields.length }), inline: true });
  }
  embed.setImage(DRIKA_COVER_URL); // Capa fixa Drika
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
