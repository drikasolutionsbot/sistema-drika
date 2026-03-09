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
          // Fetch stock counts for each field
          const fieldIds = fields.map((f: any) => f.id);
          const { data: stockCounts } = await supabase
            .from("product_stock_items")
            .select("field_id")
            .in("field_id", fieldIds)
            .eq("tenant_id", tenantId)
            .eq("delivered", false);

          const stockMap: Record<string, number> = {};
          if (stockCounts) {
            for (const item of stockCounts) {
              stockMap[item.field_id] = (stockMap[item.field_id] || 0) + 1;
            }
          }

          // Show variation selector via select menu
          const options = fields.map((f: any) => {
            const stock = stockMap[f.id] || 0;
            return {
              label: f.name,
              value: `buy_field:${productId}:${f.id}`,
              description: `Preço: ${formatBRL(f.price_cents)} | Estoque: ${stock}`,
              emoji: f.emoji ? parseEmoji(f.emoji) : undefined,
            };
          });

          const autoDelivery = product.auto_delivery ? "⚡ **Entrega Automática!**\n\n" : "";
          await editFollowup(interaction, botToken, {
            content: "",
            embeds: [{
              title: product.name,
              description: `${autoDelivery}${product.description || ""}`,
              color: 0x2B2D31,
              image: product.banner_url ? { url: product.banner_url } : undefined,
              thumbnail: product.icon_url ? { url: product.icon_url } : undefined,
            }],
            components: [{
              type: 1,
              components: [{
                type: 3, // String Select
                custom_id: `select_variation:${productId}`,
                placeholder: "Clique aqui para ver as opções",
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
          color: 0x2B2D31,
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

        const autoDeliveryText = product.auto_delivery ? "⚡ **Entrega Automática!**\n\n" : "";
        const embed: any = {
          title: `ℹ️ ${product.name}`,
          description: `${autoDeliveryText}${product.description || "Sem descrição."}`,
          color: 0x2B2D31,
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

      // ─── APPROVE ORDER (admin button) ─────────────────────
      if (customId.startsWith("approve_order:")) {
        const orderId = customId.replace("approve_order:", "");
        await respondDeferredUpdate(interaction, botToken);

        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
        if (!order) { await editFollowup(interaction, botToken, "❌ Pedido não encontrado."); return ok(); }
        if (order.status !== "pending_payment") {
          await editFollowup(interaction, botToken, `ℹ️ Pedido #${order.order_number} já está com status: **${order.status}**`);
          return ok();
        }

        // Mark as paid
        await supabase.from("orders").update({ status: "paid", payment_provider: "static_pix" }).eq("id", orderId);

        // Try to deliver (invoke deliver-order)
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/deliver-order`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ order_id: orderId, tenant_id: order.tenant_id }),
          });
        } catch (e) {
          console.error("Auto-deliver error:", e);
        }

        // Trigger order_paid automation
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-automation`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({
              tenant_id: order.tenant_id,
              trigger_type: "order_paid",
              trigger_data: {
                discord_user_id: order.discord_user_id,
                discord_username: order.discord_username,
                order_id: orderId,
                order_number: order.order_number,
                product_name: order.product_name,
                total_cents: order.total_cents,
              },
            }),
          });
        } catch (e) { console.error("Automation order_paid failed:", e); }

        // Notify buyer via DM
        try {
          const dmCh = await fetch(`${DISCORD_API}/users/@me/channels`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ recipient_id: order.discord_user_id }),
          });
          if (dmCh.ok) {
            const ch = await dmCh.json();
            await fetch(`${DISCORD_API}/channels/${ch.id}/messages`, {
              method: "POST",
              headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                embeds: [{
                  title: "✅ Pagamento Confirmado!",
                  description: `Seu pedido **#${order.order_number}** (${order.product_name}) foi aprovado!\nSeu produto será entregue em instantes.`,
                  color: 0x57F287,
                  timestamp: new Date().toISOString(),
                }],
              }),
            });
          }
        } catch (e) { console.error("DM notify error:", e); }

        await editFollowup(interaction, botToken, {
          embeds: [{
            title: "✅ Pedido Aprovado",
            description: `Pedido **#${order.order_number}** aprovado por <@${userId}>`,
            color: 0x57F287,
            fields: [
              { name: "📦 Produto", value: order.product_name, inline: true },
              { name: "💰 Valor", value: formatBRL(order.total_cents), inline: true },
              { name: "👤 Comprador", value: `<@${order.discord_user_id}>`, inline: true },
            ],
            timestamp: new Date().toISOString(),
          }],
        });
        return ok();
      }

      // ─── REJECT ORDER (admin button) ──────────────────────
      if (customId.startsWith("reject_order:")) {
        const orderId = customId.replace("reject_order:", "");
        await respondDeferredUpdate(interaction, botToken);

        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
        if (!order) { await editFollowup(interaction, botToken, "❌ Pedido não encontrado."); return ok(); }
        if (order.status !== "pending_payment") {
          await editFollowup(interaction, botToken, `ℹ️ Pedido #${order.order_number} já está com status: **${order.status}**`);
          return ok();
        }

        await supabase.from("orders").update({ status: "canceled" }).eq("id", orderId);

        // Notify buyer
        try {
          const dmCh = await fetch(`${DISCORD_API}/users/@me/channels`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ recipient_id: order.discord_user_id }),
          });
          if (dmCh.ok) {
            const ch = await dmCh.json();
            await fetch(`${DISCORD_API}/channels/${ch.id}/messages`, {
              method: "POST",
              headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                embeds: [{
                  title: "❌ Pedido Recusado",
                  description: `Seu pedido **#${order.order_number}** (${order.product_name}) foi recusado pelo administrador.`,
                  color: 0xED4245,
                  timestamp: new Date().toISOString(),
                }],
              }),
            });
          }
        } catch (e) { console.error("DM notify error:", e); }

        await editFollowup(interaction, botToken, {
          embeds: [{
            title: "❌ Pedido Recusado",
            description: `Pedido **#${order.order_number}** recusado por <@${userId}>`,
            color: 0xED4245,
            fields: [
              { name: "📦 Produto", value: order.product_name, inline: true },
              { name: "👤 Comprador", value: `<@${order.discord_user_id}>`, inline: true },
            ],
            timestamp: new Date().toISOString(),
          }],
        });
        return ok();
      }

      // ─── CANCEL ORDER (buyer button in DM) ────────────────
      if (customId.startsWith("cancel_order:")) {
        const orderId = customId.replace("cancel_order:", "");
        await respondDeferredUpdate(interaction, botToken);

        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
        if (!order) { await editFollowup(interaction, botToken, "❌ Pedido não encontrado."); return ok(); }

        if (order.status !== "pending_payment") {
          await editFollowup(interaction, botToken, `ℹ️ Pedido #${order.order_number} não pode ser cancelado (status: **${order.status}**).`);
          return ok();
        }

        await supabase.from("orders").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("id", orderId);

        await editFollowup(interaction, botToken, {
          embeds: [{
            title: "❌ Compra Cancelada",
            description: `Pedido **#${order.order_number}** (${order.product_name}) foi cancelado.`,
            color: 0xED4245,
            timestamp: new Date().toISOString(),
          }],
          components: [],
        });
        return ok();
      }

      // ─── TICKET OPEN (from ticket embed button) ───────────
      if (customId.startsWith("ticket_open_")) {
        // Parse: ticket_open_{tenantId}_{channelId}
        const parts = customId.replace("ticket_open_", "").split("_");
        // channelId may contain underscores in theory, but UUIDs use hyphens and Discord IDs are numeric
        // Format: ticket_open_{uuid-tenant-id}_{discord-channel-id}
        // UUID has 5 segments separated by hyphens, so we split by last underscore
        const lastUnder = customId.lastIndexOf("_");
        const prefix = "ticket_open_";
        const afterPrefix = customId.substring(prefix.length);
        const lastUnderscore = afterPrefix.lastIndexOf("_");
        const ticketTenantId = lastUnderscore > 0 ? afterPrefix.substring(0, lastUnderscore) : afterPrefix;
        const targetChannelId = lastUnderscore > 0 ? afterPrefix.substring(lastUnderscore + 1) : null;

        await respondDeferred(interaction, botToken);

        // Get tenant guild + ticket config
        const { data: tenant } = await supabase
          .from("tenants")
          .select("discord_guild_id, name, logo_url")
          .eq("id", ticketTenantId)
          .single();

        if (!tenant?.discord_guild_id) {
          await editFollowup(interaction, botToken, "❌ Servidor não configurado.");
          return ok();
        }

        const { data: storeConfig } = await supabase
          .from("store_configs")
          .select("ticket_channel_id, ticket_embed_title, ticket_embed_description, ticket_embed_color, ticket_embed_footer, ticket_logs_channel_id")
          .eq("tenant_id", ticketTenantId)
          .single();

        const guildId = tenant.discord_guild_id;

        // Check if user already has an open ticket
        const { data: existingTickets } = await supabase
          .from("tickets")
          .select("id")
          .eq("tenant_id", ticketTenantId)
          .eq("discord_user_id", userId)
          .in("status", ["open", "in_progress"]);

        if (existingTickets && existingTickets.length > 0) {
          await editFollowup(interaction, botToken, "⚠️ Você já possui um ticket aberto. Feche o ticket atual antes de abrir outro.");
          return ok();
        }

        // Determine the category to create the ticket channel in
        // ticket_channel_id should point to a CATEGORY, not a text channel
        const categoryId = targetChannelId || storeConfig?.ticket_channel_id || null;

        console.log("Ticket open: categoryId =", categoryId, "targetChannelId =", targetChannelId);

        // Create a private text channel under the category for this ticket
        const channelName = `ticket-${username || userId}`.toLowerCase().replace(/[^a-z0-9-_]/g, "").substring(0, 100);

        const channelBody: any = {
          name: channelName,
          type: 0, // GUILD_TEXT
          permission_overwrites: [
            // Deny @everyone view
            {
              id: guildId, // @everyone role ID = guild ID
              type: 0, // role
              deny: "1024", // VIEW_CHANNEL
            },
            // Allow the ticket creator
            {
              id: userId,
              type: 1, // member
              allow: "1024", // VIEW_CHANNEL
            },
          ],
        };

        if (categoryId) channelBody.parent_id = categoryId;

        const createChRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(channelBody),
        });

        console.log("Channel creation status:", createChRes.status);

        if (!createChRes.ok) {
          const errText = await createChRes.text();
          console.error("Failed to create ticket channel:", errText);
          await editFollowup(interaction, botToken, "❌ Não foi possível criar o canal do ticket. Verifique as permissões do bot.");
          return ok();
        }

        const ticketChannel = await createChRes.json();

        // Insert ticket in DB
        const { data: ticket, error: ticketErr } = await supabase
          .from("tickets")
          .insert({
            tenant_id: ticketTenantId,
            discord_user_id: userId,
            discord_username: username,
            discord_channel_id: ticketChannel.id,
            status: "open",
          })
          .select()
          .single();

        if (ticketErr) {
          console.error("Ticket insert error:", ticketErr);
          await editFollowup(interaction, botToken, "❌ Erro ao criar ticket no banco de dados.");
          return ok();
        }

        // Send welcome embed in the thread with action buttons
        const embedColor = parseInt((storeConfig?.ticket_embed_color || "#5865F2").replace("#", ""), 16);
        const welcomeEmbed: any = {
          title: storeConfig?.ticket_embed_title || "🎫 Ticket de Suporte",
          description: (storeConfig?.ticket_embed_description || "Seu ticket foi criado com sucesso! Aguarde atendimento.")
            .replace("{user}", `<@${userId}>`)
            .replace("{ticket_id}", ticket.id.slice(0, 8)),
          color: embedColor,
          timestamp: new Date().toISOString(),
        };

        if (storeConfig?.ticket_embed_footer) {
          welcomeEmbed.footer = { text: storeConfig.ticket_embed_footer };
        }

        await fetch(`${DISCORD_API}/channels/${ticketChannel.id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `<@${userId}>`,
            embeds: [welcomeEmbed],
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 1, // Primary (blurple)
                    label: "🕐 Lembrar",
                    custom_id: `ticket_remind_${ticket.id}`,
                  },
                  {
                    type: 2,
                    style: 2, // Secondary (grey)
                    label: "✏️ Renomear",
                    custom_id: `ticket_rename_${ticket.id}`,
                  },
                  {
                    type: 2,
                    style: 4, // Danger (red)
                    label: "🔒 Fechar Ticket",
                    custom_id: `ticket_close_${ticket.id}`,
                  },
                ],
              },
            ],
          }),
        });

        await editFollowup(interaction, botToken, `✅ Ticket criado! Acesse <#${ticketChannel.id}>`);
        return ok();
      }

      // ─── TICKET REMIND (notify the user who opened the ticket) ───
      if (customId.startsWith("ticket_remind_")) {
        const ticketId = customId.replace("ticket_remind_", "");
        await respondDeferred(interaction, botToken);

        const { data: ticket } = await supabase
          .from("tickets")
          .select("discord_user_id, discord_channel_id, status")
          .eq("id", ticketId)
          .single();

        if (!ticket) {
          await editFollowup(interaction, botToken, "❌ Ticket não encontrado.");
          return ok();
        }

        if (ticket.status === "closed") {
          await editFollowup(interaction, botToken, "ℹ️ Este ticket já está fechado.");
          return ok();
        }

        const channelId = ticket.discord_channel_id || interaction.channel_id;

        // Send a reminder mention in the thread
        await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `🔔 <@${ticket.discord_user_id}>, este é um lembrete sobre seu ticket! Por favor, verifique se há atualizações pendentes.`,
          }),
        });

        await editFollowup(interaction, botToken, `✅ Lembrete enviado para <@${ticket.discord_user_id}>!`);
        return ok();
      }

      // ─── TICKET RENAME (modal to rename the thread) ──────────
      if (customId.startsWith("ticket_rename_")) {
        const ticketId = customId.replace("ticket_rename_", "");

        // Show a modal for the new name
        await fetch(`${DISCORD_API}/interactions/${interaction.id}/${interaction.token}/callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: 9, // MODAL
            data: {
              title: "✏️ Renomear Ticket",
              custom_id: `ticket_rename_modal_${ticketId}`,
              components: [
                {
                  type: 1,
                  components: [
                    {
                      type: 4, // TEXT_INPUT
                      custom_id: "new_name",
                      label: "Novo nome do ticket",
                      style: 1, // Short
                      min_length: 1,
                      max_length: 100,
                      required: true,
                    },
                  ],
                },
              ],
            },
          }),
        });
        return ok();
      }

      // ─── TICKET CLOSE (button inside ticket channel) ──────
      if (customId.startsWith("ticket_close_")) {
        const ticketId = customId.replace("ticket_close_", "");
        await respondDeferredUpdate(interaction, botToken);

        const { data: ticket } = await supabase
          .from("tickets")
          .select("*, tenant_id")
          .eq("id", ticketId)
          .single();

        if (!ticket) {
          await editFollowup(interaction, botToken, "❌ Ticket não encontrado.");
          return ok();
        }

        if (ticket.status === "closed") {
          await editFollowup(interaction, botToken, "ℹ️ Este ticket já está fechado.");
          return ok();
        }

        // Update ticket status
        await supabase
          .from("tickets")
          .update({
            status: "closed",
            closed_by: username || userId,
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", ticketId);

        // Send log to ticket_logs_channel_id
        const { data: sc } = await supabase
          .from("store_configs")
          .select("ticket_logs_channel_id")
          .eq("tenant_id", ticket.tenant_id)
          .single();

        if (sc?.ticket_logs_channel_id) {
          const createdAt = new Date(ticket.created_at);
          const closedAt = new Date();
          const diffMs = closedAt.getTime() - createdAt.getTime();
          const diffMin = Math.floor(diffMs / 60000);
          const diffH = Math.floor(diffMin / 60);
          const remainMin = diffMin % 60;
          const totalTime = diffH > 0 ? `${diffH}h ${remainMin}m` : `${diffMin}m`;

          const logEmbed: any = {
            title: "⚙️ Sistema de Logs",
            color: 0x2B2D31,
            fields: [
              { name: "➡️ Usuário que abriu:", value: `> <@${ticket.discord_user_id}>`, inline: false },
              { name: "➡️ Usuário que fechou:", value: `> <@${userId}>`, inline: false },
              { name: "➡️ Quem assumiu:", value: "> Ninguém Assumiu", inline: false },
              { name: "📋 Código do Ticket:", value: `> ${ticket.discord_channel_id || ticket.id.slice(0, 20)}`, inline: false },
              { name: "😊 Horário de abertura:", value: `> <t:${Math.floor(createdAt.getTime() / 1000)}:f> <t:${Math.floor(createdAt.getTime() / 1000)}:R>`, inline: false },
              { name: "😔 Horário do fechamento:", value: `> <t:${Math.floor(closedAt.getTime() / 1000)}:f> (<t:${Math.floor(closedAt.getTime() / 1000)}:R>)`, inline: false },
              { name: "➡️ Tempo total de atendimento:", value: `> ${totalTime}`, inline: false },
            ],
            timestamp: closedAt.toISOString(),
          };

          if (ticket.product_name) {
            logEmbed.fields.splice(3, 0, { name: "📦 Produto:", value: `> ${ticket.product_name}`, inline: false });
          }

          await fetch(`${DISCORD_API}/channels/${sc.ticket_logs_channel_id}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ embeds: [logEmbed] }),
          });
        }

        // Send closing message in the ticket thread and archive it
        const channelId = interaction.channel_id || ticket.discord_channel_id;
        if (channelId) {
          await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              embeds: [{
                title: "🔒 Ticket Fechado",
                description: `Este ticket foi fechado por <@${userId}>.\nO tópico será arquivado.`,
                color: 0xED4245,
              }],
            }),
          });

          // Archive and lock the thread instead of deleting
          await fetch(`${DISCORD_API}/channels/${channelId}`, {
            method: "PATCH",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ archived: true, locked: true }),
          });
        }

        return ok();
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

  // Type 5: MODAL_SUBMIT
  if (interaction.type === 5) {
    const customId = interaction.data?.custom_id || "";
    const userId = interaction.member?.user?.id || interaction.user?.id;

    try {
      // ─── TICKET RENAME MODAL SUBMIT ──────────────────────
      if (customId.startsWith("ticket_rename_modal_")) {
        const ticketId = customId.replace("ticket_rename_modal_", "");
        await respondDeferred(interaction, botToken);

        const newName = interaction.data?.components?.[0]?.components?.[0]?.value || "";
        if (!newName) {
          await editFollowup(interaction, botToken, "❌ Nome inválido.");
          return ok();
        }

        const { data: ticket } = await supabase
          .from("tickets")
          .select("discord_channel_id")
          .eq("id", ticketId)
          .single();

        if (!ticket?.discord_channel_id) {
          await editFollowup(interaction, botToken, "❌ Ticket não encontrado.");
          return ok();
        }

        // Rename the thread
        const renameRes = await fetch(`${DISCORD_API}/channels/${ticket.discord_channel_id}`, {
          method: "PATCH",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.substring(0, 100) }),
        });

        if (!renameRes.ok) {
          await editFollowup(interaction, botToken, "❌ Não foi possível renomear o ticket.");
          return ok();
        }

        await editFollowup(interaction, botToken, `✅ Ticket renomeado para: **${newName.substring(0, 100)}**`);
        return ok();
      }
    } catch (err) {
      console.error("Modal interaction error:", err);
      try {
        await editFollowup(interaction, botToken, `❌ Erro: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
      } catch {}
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

  // Trigger order_created automation
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-automation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({
        tenant_id: tenantId,
        trigger_type: "order_created",
        trigger_data: {
          discord_user_id: userId,
          discord_username: username,
          order_id: order.id,
          order_number: order.order_number,
          product_name: orderName,
          total_cents: priceCents,
        },
      }),
    });
  } catch (e) { console.error("Automation order_created failed:", e); }

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
    await supabase.from("orders").update({ payment_provider: "static_pix" }).eq("id", order.id);

    // ─── Send admin notification to logs channel ────────────
    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("logs_channel_id")
      .eq("tenant_id", tenantId)
      .single();

    if (storeConfig?.logs_channel_id) {
      const adminEmbed = {
        title: "🔔 Novo Pedido — PIX Estático",
        description: `Um novo pedido foi criado com **PIX estático**.\nAguardando confirmação manual do pagamento.`,
        color: 0xFEE75C,
        fields: [
          { name: "📦 Produto", value: orderName, inline: true },
          { name: "💰 Valor", value: formatBRL(priceCents), inline: true },
          { name: "🔢 Pedido", value: `#${order.order_number}`, inline: true },
          { name: "👤 Comprador", value: `<@${userId}> (${username})`, inline: false },
        ],
        footer: { text: "Clique em Aprovar após confirmar o pagamento no seu banco" },
        timestamp: new Date().toISOString(),
      };

      await fetch(`${DISCORD_API}/channels/${storeConfig.logs_channel_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [adminEmbed],
          components: [{
            type: 1,
            components: [
              {
                type: 2, // Button
                style: 3, // Green (Success)
                label: "✅ Aprovar Pagamento",
                custom_id: `approve_order:${order.id}`,
              },
              {
                type: 2,
                style: 4, // Red (Danger)
                label: "❌ Recusar",
                custom_id: `reject_order:${order.id}`,
              },
            ],
          }],
        }),
      });
    }
  }

  // Get store config for branding
  const { data: storeConfigForCheckout } = await supabase
    .from("store_configs")
    .select("store_banner_url, store_logo_url, store_title, payment_timeout_minutes")
    .eq("tenant_id", tenantId)
    .single();

  const { data: tenantInfo } = await supabase
    .from("tenants")
    .select("name, logo_url")
    .eq("id", tenantId)
    .single();

  const storeName = storeConfigForCheckout?.store_title || tenantInfo?.name || "Loja";
  const storeLogo = storeConfigForCheckout?.store_logo_url || tenantInfo?.logo_url;
  const storeBanner = storeConfigForCheckout?.store_banner_url;
  const timeoutMin = storeConfigForCheckout?.payment_timeout_minutes || 30;

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

    const checkoutEmbed: any = {
      title: `🛒 ${storeName} - Carrinho`,
      description: `> <@${userId}>, escaneie o QR Code ou copie o código PIX!`,
      color: 0x2B2D31,
      fields: [
        { name: "🕐 Informações do Pedido", value: `**${orderName}**`, inline: false },
        { name: "💠 Pagamento PIX", value: `→ **Preço:** ${formatBRL(priceCents)}\n→ **Tempo Limite:** ${timeoutMin} minutos`, inline: false },
      ],
      image: { url: qrImageUrl },
      footer: { 
        text: `${storeName} • Pedido #${order.order_number}`,
        icon_url: storeLogo || undefined,
      },
      timestamp: new Date().toISOString(),
    };

    if (storeLogo) {
      checkoutEmbed.thumbnail = { url: storeLogo };
    }

    // Send: embed + brcode as plain text (easy copy on mobile) + cancel button
    await fetch(`${DISCORD_API}/channels/${dmChannel.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [checkoutEmbed],
      }),
    });

    // Send brcode as separate message for easy mobile copy
    await fetch(`${DISCORD_API}/channels/${dmChannel.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `\`\`\`\n${brcode}\n\`\`\`\n↓ Após o pagamento, a conta será entregue automaticamente!`,
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 4, // Danger (red)
            label: "Cancelar Compra",
            emoji: { name: "✕" },
            custom_id: `cancel_order:${order.id}`,
          }],
        }],
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
