import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_API = "https://discord.com/api/v10";

// ─── Ed25519 Signature Verification ─────────────────────────
async function verifyDiscordSignature(
  publicKeyHex: string,
  signature: string,
  timestamp: string,
  body: string
): Promise<boolean> {
  try {
    const publicKeyBytes = hexToUint8Array(publicKeyHex);
    const signatureBytes = hexToUint8Array(signature);
    const messageBytes = new TextEncoder().encode(timestamp + body);

    const key = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes,
      { name: "Ed25519", namedCurve: "Ed25519" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify("Ed25519", key, signatureBytes, messageBytes);
  } catch (e) {
    console.error("Signature verification error:", e);
    return false;
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return arr;
}

// ─── PIX generation helpers (same as generate-pix) ──────────
function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function generateStaticBRCode(pixKey: string, name: string, amount?: number, txId?: string): string {
  let payload = tlv("00", "01") + tlv("01", amount ? "12" : "11");
  payload += tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", pixKey));
  payload += tlv("52", "0000") + tlv("53", "986");
  if (amount && amount > 0) payload += tlv("54", amount.toFixed(2));
  payload += tlv("58", "BR") + tlv("59", name.substring(0, 25)) + tlv("60", "Brasil");
  payload += tlv("62", tlv("05", (txId || "***").substring(0, 25)));
  payload += "6304";
  return payload + crc16(payload);
}

// ─── Mercado Pago PIX ───────────────────────────────────────
async function generateMercadoPagoPix(apiKey: string, amount: number, desc: string, ref: string, webhook: string) {
  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Idempotency-Key": ref },
    body: JSON.stringify({
      transaction_amount: amount,
      payment_method_id: "pix",
      description: desc,
      statement_descriptor: "Drika Solutions",
      external_reference: ref,
      notification_url: webhook,
      payer: { email: "customer@email.com" },
    }),
  });
  if (!res.ok) throw new Error(`Mercado Pago error: ${res.status}`);
  const data = await res.json();
  const ptp = data.point_of_interaction?.transaction_data;
  return { brcode: ptp?.qr_code || "", payment_id: String(data.id), expires_at: data.date_of_expiration };
}

// ─── PushinPay PIX ──────────────────────────────────────────
async function generatePushinPayPix(apiKey: string, amountCents: number, webhook: string) {
  const res = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ value: amountCents, webhook_url: webhook || undefined }),
  });
  if (!res.ok) throw new Error(`PushinPay error: ${res.status}`);
  const data = await res.json();
  return { brcode: data.qr_code || "", payment_id: data.id };
}

// ─── Format price ───────────────────────────────────────────
const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const publicKey = Deno.env.get("DISCORD_PUBLIC_KEY");
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const body = await req.text();
  const signature = req.headers.get("x-signature-ed25519") || "";
  const timestamp = req.headers.get("x-signature-timestamp") || "";

  // Verify signature if public key is configured
  if (publicKey) {
    const isValid = await verifyDiscordSignature(publicKey, signature, timestamp, body);
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }
  }

  const interaction = JSON.parse(body);

  // Type 1: PING (Discord verification)
  if (interaction.type === 1) {
    return new Response(JSON.stringify({ type: 1 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Type 3: MESSAGE_COMPONENT (button clicks)
  if (interaction.type === 3) {
    const customId = interaction.data?.custom_id || "";
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const username = interaction.member?.user?.username || interaction.user?.username;

    try {
      // ─── BUY PRODUCT ─────────────────────────────────────
      if (customId.startsWith("buy_product:")) {
        const productId = customId.replace("buy_product:", "");

        // Defer with ephemeral (only the user sees it)
        await respondDeferred(interaction, botToken);

        const { data: product } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .single();

        if (!product) {
          await editFollowup(interaction, botToken, "❌ Produto não encontrado.");
          return ok();
        }

        if (!product.active) {
          await editFollowup(interaction, botToken, "❌ Este produto está indisponível no momento.");
          return ok();
        }

        const tenantId = product.tenant_id;

        // Check if product has fields (variations) - if so, require selection
        const { data: fields } = await supabase
          .from("product_fields")
          .select("id, name, emoji, price_cents, compare_price_cents")
          .eq("product_id", productId)
          .eq("tenant_id", tenantId)
          .order("sort_order", { ascending: true });

        if (fields && fields.length > 0) {
          // Show variation selector via select menu
          const options = fields.map((f: any) => ({
            label: f.name,
            value: `buy_field:${productId}:${f.id}`,
            description: formatBRL(f.price_cents),
            emoji: f.emoji ? parseEmoji(f.emoji) : undefined,
          }));

          await editFollowup(interaction, botToken, {
            content: "Escolha uma variação para comprar:",
            components: [{
              type: 1,
              components: [{
                type: 3, // String Select
                custom_id: `select_variation:${productId}`,
                placeholder: "Selecione uma variação...",
                options: options.slice(0, 25),
              }],
            }],
          });
          return ok();
        }

        // No variations - buy directly at product price
        await processPurchase(supabase, interaction, botToken, product, tenantId, userId, username, product.price_cents);
        return ok();
      }

      // ─── SELECT VARIATION (from dropdown) ─────────────────
      if (customId.startsWith("select_variation:")) {
        const values = interaction.data?.values || [];
        if (values.length === 0) return ok();

        const selectedValue = values[0]; // format: buy_field:productId:fieldId
        const parts = selectedValue.split(":");
        if (parts.length < 3) return ok();

        const productId = parts[1];
        const fieldId = parts[2];

        // Use DEFERRED_UPDATE_MESSAGE (type 6) to update existing message instead of creating new one
        await respondDeferredUpdate(interaction, botToken);

        const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
        if (!product) { await editFollowup(interaction, botToken, "❌ Produto não encontrado."); return ok(); }

        const { data: field } = await supabase.from("product_fields").select("*").eq("id", fieldId).single();
        if (!field) { await editFollowup(interaction, botToken, "❌ Variação não encontrada."); return ok(); }

        await processPurchase(supabase, interaction, botToken, product, product.tenant_id, userId, username, field.price_cents, fieldId, field.name);
        return ok();
      }

      // ─── VIEW VARIATIONS ─────────────────────────────────
      if (customId.startsWith("view_variations:")) {
        const productId = customId.replace("view_variations:", "");

        const { data: product } = await supabase.from("products").select("name, tenant_id").eq("id", productId).single();
        if (!product) return respondImmediate(interaction, "❌ Produto não encontrado.");

        const { data: fields } = await supabase
          .from("product_fields")
          .select("name, emoji, price_cents, compare_price_cents, description")
          .eq("product_id", productId)
          .eq("tenant_id", product.tenant_id)
          .order("sort_order", { ascending: true });

        if (!fields || fields.length === 0) {
          return respondImmediate(interaction, "Este produto não tem variações.");
        }

        const fieldLines = fields.map((f: any) => {
          const emoji = f.emoji || "•";
          const priceStr = f.compare_price_cents && f.compare_price_cents > f.price_cents
            ? `~~${formatBRL(f.compare_price_cents)}~~ → **${formatBRL(f.price_cents)}**`
            : formatBRL(f.price_cents);
          const desc = f.description ? ` - ${f.description}` : "";
          return `${emoji} **${f.name}** — ${priceStr}${desc}`;
        });

        const embed = {
          title: `📋 Variações de ${product.name}`,
          description: fieldLines.join("\n"),
          color: 0x5865F2,
        };

        return respondImmediate(interaction, { embeds: [embed] });
      }

      // ─── VIEW DETAILS ────────────────────────────────────
      if (customId.startsWith("view_details:")) {
        const productId = customId.replace("view_details:", "");

        const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
        if (!product) return respondImmediate(interaction, "❌ Produto não encontrado.");

        const { data: fields } = await supabase
          .from("product_fields")
          .select("id")
          .eq("product_id", productId)
          .eq("tenant_id", product.tenant_id);

        const embed: any = {
          title: `ℹ️ ${product.name}`,
          description: product.description || "Sem descrição.",
          color: 0x5865F2,
          fields: [
            { name: "💰 Preço", value: formatBRL(product.price_cents), inline: true },
            { name: "📦 Tipo", value: product.type === "digital_auto" ? "Digital" : product.type === "service" ? "Serviço" : "Híbrido", inline: true },
          ],
        };

        if (product.compare_price_cents && product.compare_price_cents > product.price_cents) {
          embed.fields.unshift({
            name: "🔥 Promoção",
            value: `~~${formatBRL(product.compare_price_cents)}~~ → **${formatBRL(product.price_cents)}**`,
            inline: true,
          });
        }

        if (product.show_stock && product.stock !== null) {
          embed.fields.push({ name: "📊 Estoque", value: `${product.stock} disponíveis`, inline: true });
        }

        if (fields && fields.length > 0) {
          embed.fields.push({ name: "📋 Variações", value: `${fields.length} opções disponíveis`, inline: true });
        }

        if (product.banner_url) embed.image = { url: product.banner_url };
        if (product.icon_url) embed.thumbnail = { url: product.icon_url };

        return respondImmediate(interaction, { embeds: [embed] });
      }

    } catch (err) {
      console.error("Interaction error:", err);
      try {
        await editFollowup(interaction, botToken, `❌ Erro: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
      } catch {
        // If deferred response wasn't sent, try immediate
      }
      return ok();
    }
  }

  return new Response(JSON.stringify({ type: 1 }), {
    headers: { "Content-Type": "application/json" },
  });
});

// ─── Process Purchase: create order + generate PIX ──────────
async function processPurchase(
  supabase: any,
  interaction: any,
  botToken: string,
  product: any,
  tenantId: string,
  userId: string,
  username: string,
  priceCents: number,
  fieldId?: string,
  fieldName?: string
) {
  const orderName = fieldName ? `${product.name} - ${fieldName}` : product.name;

  // Create order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      tenant_id: tenantId,
      product_id: product.id,
      field_id: fieldId || null,
      product_name: orderName,
      discord_user_id: userId,
      discord_username: username,
      total_cents: priceCents,
      status: "pending_payment",
    })
    .select()
    .single();

  if (orderErr) throw new Error(`Erro ao criar pedido: ${orderErr.message}`);

  // Generate PIX
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Check for active payment provider
  const { data: providers } = await supabase
    .from("payment_providers")
    .select("provider_key, api_key_encrypted, active")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .in("provider_key", ["mercadopago", "pushinpay"]);

  const activeProvider = providers?.find((p: any) => p.api_key_encrypted);
  const amountBRL = priceCents / 100;
  const webhookBaseUrl = `${supabaseUrl}/functions/v1/payment-webhook`;
  let brcode = "";
  let paymentId = "";

  if (activeProvider && amountBRL > 0) {
    const providerKey = activeProvider.provider_key;
    const apiKey = activeProvider.api_key_encrypted;
    const webhookUrl = `${webhookBaseUrl}/${providerKey}/${tenantId}`;
    const externalRef = `order_${order.id}`;

    if (providerKey === "mercadopago") {
      const result = await generateMercadoPagoPix(apiKey, amountBRL, orderName, externalRef, webhookUrl);
      brcode = result.brcode;
      paymentId = result.payment_id;
    } else if (providerKey === "pushinpay") {
      const result = await generatePushinPayPix(apiKey, priceCents, webhookUrl);
      brcode = result.brcode;
      paymentId = result.payment_id;
    }

    // Update order with payment info
    await supabase.from("orders").update({ payment_id: paymentId, payment_provider: providerKey }).eq("id", order.id);
  } else {
    // Static PIX fallback
    const { data: tenant } = await supabase.from("tenants").select("name, pix_key, pix_key_type").eq("id", tenantId).single();
    if (!tenant?.pix_key) throw new Error("Nenhum método de pagamento configurado.");
    brcode = generateStaticBRCode(tenant.pix_key, tenant.name || "Loja", amountBRL, `PED${order.order_number}`);
  }

  // Send PIX to user via DM
  const dmChannelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: userId }),
  });

  let dmSent = false;
  if (dmChannelRes.ok) {
    const dmChannel = await dmChannelRes.json();
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(brcode)}`;
    const embed = {
      title: "🛒 Pedido criado!",
      description: `Seu pedido **#${order.order_number}** foi criado.\nEfetue o pagamento via PIX para receber seu produto automaticamente.`,
      color: 0xFEE75C,
      fields: [
        { name: "📦 Produto", value: orderName, inline: true },
        { name: "💰 Valor", value: formatBRL(priceCents), inline: true },
      ],
      image: { url: qrImageUrl },
      footer: { text: "Copie o código abaixo e pague no app do seu banco • Expira em 30 min" },
      timestamp: new Date().toISOString(),
    };

    // Send embed + brcode as separate content so mobile users can long-press to copy
    await fetch(`${DISCORD_API}/channels/${dmChannel.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `📋 **PIX Copia e Cola:**\n${brcode}`,
        embeds: [embed],
      }),
    });
    dmSent = true;
  }

  // Respond in the channel (ephemeral)
  const responseContent = dmSent
    ? `✅ Pedido **#${order.order_number}** criado! Enviei o PIX na sua DM. Valor: **${formatBRL(priceCents)}**`
    : `✅ Pedido **#${order.order_number}** criado!\n\n**PIX Copia e Cola:**\n\`\`\`\n${brcode}\n\`\`\`\nValor: **${formatBRL(priceCents)}**`;

  await editFollowup(interaction, botToken, responseContent);
}

// ─── Discord response helpers ───────────────────────────────
function ok() {
  return new Response(null, { status: 202 });
}

function parseEmoji(emoji: string): any {
  const match = emoji.match(/^<(a?):(\w+):(\d+)>$/);
  if (match) return { name: match[2], id: match[3], animated: match[1] === "a" };
  return { name: emoji };
}

// Deferred ephemeral response (for long operations - creates NEW message)
async function respondDeferred(interaction: any, botToken: string) {
  await fetch(`${DISCORD_API}/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: 5, data: { flags: 64 } }), // 64 = ephemeral
  });
}

// Deferred update (updates EXISTING message, no new message created)
async function respondDeferredUpdate(interaction: any, botToken: string) {
  await fetch(`${DISCORD_API}/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: 6 }), // DEFERRED_UPDATE_MESSAGE
  });
}

// Immediate ephemeral response
function respondImmediate(interaction: any, content: string | Record<string, any>) {
  const data = typeof content === "string" ? { content, flags: 64 } : { ...content, flags: 64 };
  return new Response(JSON.stringify({ type: 4, data }), {
    headers: { "Content-Type": "application/json" },
  });
}

// Edit the deferred followup
async function editFollowup(interaction: any, botToken: string, content: string | Record<string, any>) {
  const payload = typeof content === "string" ? { content, components: [] } : { ...content, components: content.components || [] };
  await fetch(`${DISCORD_API}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
    method: "PATCH",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
