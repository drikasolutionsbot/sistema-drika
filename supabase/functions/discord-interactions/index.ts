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

  // Type 2: APPLICATION_COMMAND (slash commands)
  if (interaction.type === 2) {
    const commandName = interaction.data?.name || "";
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const username = interaction.member?.user?.username || interaction.user?.username;
    const guildId = interaction.guild_id;
    const channelId = interaction.channel_id;
    const options = interaction.data?.options || [];
    const getOption = (name: string) => options.find((o: any) => o.name === name)?.value;

    try {
      // ─── /clear - Limpa TODAS as mensagens do canal ──────
      if (commandName === "clear") {
        const memberPerms = BigInt(interaction.member?.permissions || "0");
        if (!(memberPerms & BigInt(0x2000)) && !(memberPerms & BigInt(0x8))) {
          return respondImmediate(interaction, "❌ Você não tem permissão para limpar mensagens.");
        }

        await respondDeferred(interaction, botToken);

        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        let totalDeleted = 0;
        let hasMore = true;

        while (hasMore) {
          const msgsRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages?limit=100`, {
            headers: { Authorization: `Bot ${botToken}` },
          });

          if (!msgsRes.ok) break;

          const msgs = await msgsRes.json();
          if (!Array.isArray(msgs) || msgs.length === 0) { hasMore = false; break; }

          const deletable = msgs.filter((m: any) => new Date(m.timestamp).getTime() > twoWeeksAgo);
          const old = msgs.filter((m: any) => new Date(m.timestamp).getTime() <= twoWeeksAgo);

          if (deletable.length >= 2) {
            await fetch(`${DISCORD_API}/channels/${channelId}/messages/bulk-delete`, {
              method: "POST",
              headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ messages: deletable.map((m: any) => m.id) }),
            });
            totalDeleted += deletable.length;
          } else if (deletable.length === 1) {
            await fetch(`${DISCORD_API}/channels/${channelId}/messages/${deletable[0].id}`, {
              method: "DELETE",
              headers: { Authorization: `Bot ${botToken}` },
            });
            totalDeleted += 1;
          }

          // Delete old messages one by one
          for (const m of old) {
            try {
              await fetch(`${DISCORD_API}/channels/${channelId}/messages/${m.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bot ${botToken}` },
              });
              totalDeleted++;
            } catch { /* skip */ }
          }

          if (msgs.length < 100) hasMore = false;

          // Small delay to avoid rate limits
          await new Promise(r => setTimeout(r, 1000));
        }

        await editFollowup(interaction, botToken, `✅ Canal limpo! ${totalDeleted} mensagem(ns) deletada(s).`);
        return ok();
      }

      // ─── /ban - Bane um usuário ───────────────────────────
      if (commandName === "ban") {
        const targetUser = getOption("usuario") || getOption("user");
        const reason = getOption("motivo") || getOption("reason") || "Sem motivo especificado";

        const memberPerms = BigInt(interaction.member?.permissions || "0");
        if (!(memberPerms & BigInt(0x4))) {
          return respondImmediate(interaction, "❌ Você não tem permissão para banir membros.");
        }

        if (!targetUser) return respondImmediate(interaction, "❌ Especifique um usuário.");

        await respondDeferred(interaction, botToken);

        const banRes = await fetch(`${DISCORD_API}/guilds/${guildId}/bans/${targetUser}`, {
          method: "PUT",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ delete_message_seconds: 604800 }),
        });

        if (!banRes.ok) {
          const errText = await banRes.text();
          await editFollowup(interaction, botToken, `❌ Erro ao banir: ${banRes.status}`);
          return ok();
        }

        await editFollowup(interaction, botToken, {
          embeds: [{
            title: "🔨 Usuário Banido",
            description: `<@${targetUser}> foi banido por <@${userId}>.`,
            fields: [{ name: "Motivo", value: String(reason) }],
            color: 0xED4245,
            timestamp: new Date().toISOString(),
          }],
        });
        return ok();
      }

      // ─── /kick - Expulsa um usuário ───────────────────────
      if (commandName === "kick") {
        const targetUser = getOption("usuario") || getOption("user");
        const reason = getOption("motivo") || getOption("reason") || "Sem motivo especificado";

        const memberPerms = BigInt(interaction.member?.permissions || "0");
        if (!(memberPerms & BigInt(0x2))) {
          return respondImmediate(interaction, "❌ Você não tem permissão para expulsar membros.");
        }

        if (!targetUser) return respondImmediate(interaction, "❌ Especifique um usuário.");

        await respondDeferred(interaction, botToken);

        const kickRes = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${targetUser}`, {
          method: "DELETE",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        });

        if (!kickRes.ok) {
          await editFollowup(interaction, botToken, `❌ Erro ao expulsar: ${kickRes.status}`);
          return ok();
        }

        await editFollowup(interaction, botToken, {
          embeds: [{
            title: "👢 Usuário Expulso",
            description: `<@${targetUser}> foi expulso por <@${userId}>.`,
            fields: [{ name: "Motivo", value: String(reason) }],
            color: 0xFEE75C,
            timestamp: new Date().toISOString(),
          }],
        });
        return ok();
      }

      // ─── /ticket - Abre um ticket ─────────────────────────
      if (commandName === "ticket") {
        // Find tenant by guild_id
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("discord_guild_id", guildId)
          .single();

        if (!tenant) return respondImmediate(interaction, "❌ Servidor não configurado.");

        // Simulate ticket_open button click by redirecting logic
        await respondDeferred(interaction, botToken);

        const { data: existingTickets } = await supabase
          .from("tickets")
          .select("id")
          .eq("tenant_id", tenant.id)
          .eq("discord_user_id", userId)
          .in("status", ["open", "in_progress"]);

        if (existingTickets && existingTickets.length > 0) {
          await editFollowup(interaction, botToken, "⚠️ Você já possui um ticket aberto.");
          return ok();
        }

        const { data: storeConfig } = await supabase
          .from("store_configs")
          .select("ticket_channel_id, ticket_embed_title, ticket_embed_description, ticket_embed_color, ticket_embed_footer, ticket_embed_button_label, ticket_embed_button_style")
          .eq("tenant_id", tenant.id)
          .single();

        let parentChannelId = storeConfig?.ticket_channel_id || channelId;

        // If it's a category, find first text channel
        if (parentChannelId && parentChannelId !== channelId) {
          try {
            const chInfoRes = await fetch(`${DISCORD_API}/channels/${parentChannelId}`, {
              headers: { Authorization: `Bot ${botToken}` },
            });
            if (chInfoRes.ok) {
              const chInfo = await chInfoRes.json();
              if (chInfo.type === 4) {
                const guildChRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
                  headers: { Authorization: `Bot ${botToken}` },
                });
                if (guildChRes.ok) {
                  const allCh = await guildChRes.json();
                  const textCh = allCh.find((c: any) => c.parent_id === parentChannelId && c.type === 0);
                  if (textCh) parentChannelId = textCh.id;
                }
              }
            }
          } catch (e) { console.error("Channel check error:", e); }
        }

        const ticketSuffix = Date.now().toString(36).slice(-4);
        const threadName = `ticket-${username || userId}-${ticketSuffix}`.toLowerCase().replace(/[^a-z0-9-_]/g, "").substring(0, 100);
        const createThreadRes = await fetch(`${DISCORD_API}/channels/${parentChannelId}/threads`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: threadName, type: 12, auto_archive_duration: 10080 }),
        });

        if (!createThreadRes.ok) {
          await editFollowup(interaction, botToken, "❌ Não foi possível criar o ticket.");
          return ok();
        }

        const ticketThread = await createThreadRes.json();
        await fetch(`${DISCORD_API}/channels/${ticketThread.id}/thread-members/${userId}`, {
          method: "PUT",
          headers: { Authorization: `Bot ${botToken}` },
        });

        const { data: ticket } = await supabase
          .from("tickets")
          .insert({ tenant_id: tenant.id, discord_user_id: userId, discord_username: username, discord_channel_id: ticketThread.id, status: "open" })
          .select()
          .single();

        if (ticket) {
          const embedColor = parseInt((storeConfig?.ticket_embed_color || "#5865F2").replace("#", ""), 16);
          await fetch(`${DISCORD_API}/channels/${ticketThread.id}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `<@${userId}>`,
              embeds: [{ title: storeConfig?.ticket_embed_title || "🎫 Ticket de Suporte", description: (storeConfig?.ticket_embed_description || "Seu ticket foi criado! Aguarde atendimento.").replace("{user}", `<@${userId}>`).replace("{ticket_id}", ticket.id.slice(0, 8)), color: embedColor }],
              components: [
                { type: 1, components: [
                  { type: 2, style: 2, label: "Lembrar", custom_id: `ticket_remind_${ticket.id}` },
                  { type: 2, style: 2, label: "Renomear", custom_id: `ticket_rename_${ticket.id}` },
                  { type: 2, style: 2, label: "Arquivar", custom_id: `ticket_close_${ticket.id}` },
                  { type: 2, style: 4, label: "Deletar", custom_id: `ticket_delete_${ticket.id}` },
                ]},
                { type: 1, components: [{ type: 5, custom_id: `ticket_assign_${ticket.id}`, placeholder: "Selecione algum membro", min_values: 1, max_values: 1 }]},
              ],
            }),
          });
        }

        await editFollowup(interaction, botToken, `✅ Ticket criado! Acesse <#${ticketThread.id}>`);
        return ok();
      }

      // ─── /fechar - Fecha o ticket atual ───────────────────
      if (commandName === "fechar") {
        const { data: ticket } = await supabase
          .from("tickets")
          .select("*, tenant_id")
          .eq("discord_channel_id", channelId)
          .in("status", ["open", "in_progress"])
          .single();

        if (!ticket) return respondImmediate(interaction, "❌ Este canal não é um ticket ativo.");

        await respondDeferred(interaction, botToken);

        await supabase.from("tickets").update({ status: "closed", closed_by: username || userId, closed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", ticket.id);

        const { data: closeTenant } = await supabase.from("tenants").select("name").eq("id", ticket.tenant_id).single();
        await sendTicketLog(supabase, botToken, ticket, channelId, userId, username, "closed", closeTenant?.name || "Servidor");

        await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [{ title: "📁 Ticket Arquivado", description: `Ticket arquivado por <@${userId}>.`, color: 0xFEE75C }] }),
        });
        await fetch(`${DISCORD_API}/channels/${channelId}`, {
          method: "PATCH",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true, locked: true }),
        });

        await editFollowup(interaction, botToken, "✅ Ticket fechado e arquivado.");
        return ok();
      }

      // ─── /estoque - Verifica estoque ──────────────────────
      if (commandName === "estoque") {
        const { data: tenant } = await supabase.from("tenants").select("id").eq("discord_guild_id", guildId).single();
        if (!tenant) return respondImmediate(interaction, "❌ Servidor não configurado.");

        const { data: products } = await supabase
          .from("products")
          .select("name, stock, active")
          .eq("tenant_id", tenant.id)
          .eq("active", true)
          .order("name");

        if (!products || products.length === 0) return respondImmediate(interaction, "ℹ️ Nenhum produto encontrado.");

        const lines = products.map((p: any) => {
          const stockText = p.stock !== null ? `${p.stock}` : "∞";
          const emoji = (p.stock === null || p.stock > 0) ? "🟢" : "🔴";
          return `${emoji} **${p.name}** — ${stockText} em estoque`;
        });

        return respondImmediate(interaction, {
          embeds: [{ title: "📦 Estoque", description: lines.join("\n"), color: 0x2B2D31 }],
        });
      }

      // ─── Default: unknown command ─────────────────────────
      return respondImmediate(interaction, `❌ Comando \`/${commandName}\` não reconhecido.`);

    } catch (err) {
      console.error("Slash command error:", err);
      try {
        await editFollowup(interaction, botToken, `❌ Erro: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
      } catch {
        return respondImmediate(interaction, `❌ Erro ao processar comando.`);
      }
      return ok();
    }
  }

  // Type 3: MESSAGE_COMPONENT (button clicks)
  if (interaction.type === 3) {
    const customId = interaction.data?.custom_id || "";
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const username = interaction.member?.user?.username || interaction.user?.username;

    // Helper to get store embed color for a tenant
    const getStoreEmbedColor = async (tid: string): Promise<number> => {
      const { data: sc } = await supabase
        .from("store_configs")
        .select("embed_color")
        .eq("tenant_id", tid)
        .single();
      return sc?.embed_color ? parseInt(sc.embed_color.replace("#", ""), 16) : 0x2B2D31;
    };

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
        const guildId = interaction.guild_id;
        const channelId = interaction.channel_id;

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

          const embedColorVal = await getStoreEmbedColor(tenantId);
          const autoDelivery = product.auto_delivery ? "⚡ **Entrega Automática!**\n\n" : "";
          await editFollowup(interaction, botToken, {
            content: "",
            embeds: [{
              title: product.name,
              description: `${autoDelivery}${product.description || ""}`,
              color: embedColorVal,
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

        // No variations - create checkout thread
        await processPurchase(supabase, interaction, botToken, product, tenantId, userId, username, product.price_cents, guildId, channelId);
        return ok();
      }

      // ─── SELECT VARIATION (from dropdown) ─────────────────
      if (customId.startsWith("select_variation:")) {
        console.log("SELECT_VARIATION handler entered, customId:", customId);
        const values = interaction.data?.values || [];
        console.log("Selected values:", JSON.stringify(values));
        if (values.length === 0) return ok();

        const selectedValue = values[0]; // format: buy_field:productId:fieldId
        const parts = selectedValue.split(":");
        console.log("Parsed parts:", JSON.stringify(parts));
        if (parts.length < 3) return ok();

        const productId = parts[1];
        const fieldId = parts[2];

        // Use deferred ephemeral reply (type 5) so processPurchase can send a NEW checkout message
        await respondDeferred(interaction, botToken);

        const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
        if (!product) { await editFollowup(interaction, botToken, "❌ Produto não encontrado."); return ok(); }

        const { data: field } = await supabase.from("product_fields").select("*").eq("id", fieldId).single();
        if (!field) { await editFollowup(interaction, botToken, "❌ Variação não encontrada."); return ok(); }

        await processPurchase(supabase, interaction, botToken, product, product.tenant_id, userId, username, field.price_cents, interaction.guild_id, interaction.channel_id, fieldId, field.name);
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
          const priceStr = formatBRL(f.price_cents);
          const desc = f.description ? ` - ${f.description}` : "";
          return `${emoji} **${f.name}** — ${priceStr}${desc}`;
        });

        const varEmbedColor = await getStoreEmbedColor(product.tenant_id);
        const embed = {
          title: `📋 Variações de ${product.name}`,
          description: fieldLines.join("\n"),
          color: varEmbedColor,
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

        const detailEmbedColor = await getStoreEmbedColor(product.tenant_id);
        const autoDeliveryText = product.auto_delivery ? "⚡ **Entrega Automática!**\n\n" : "";
        const embed: any = {
          title: `ℹ️ ${product.name}`,
          description: `${autoDeliveryText}${product.description || "Sem descrição."}`,
          color: detailEmbedColor,
          fields: [
            { name: "💰 Preço", value: formatBRL(product.price_cents), inline: true },
            { name: "📦 Tipo", value: product.type === "digital_auto" ? "Digital" : product.type === "service" ? "Serviço" : "Híbrido", inline: true },
          ],
        };

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

      // ─── CHECKOUT: GO TO PAYMENT (Pix) ────────────────────
      if (customId.startsWith("checkout_pay:")) {
        const orderId = customId.replace("checkout_pay:", "");
        await respondDeferredUpdate(interaction, botToken);

        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
        if (!order) { await editFollowup(interaction, botToken, "❌ Pedido não encontrado."); return ok(); }
        if (order.status !== "pending_payment") {
          await editFollowup(interaction, botToken, `ℹ️ Pedido #${order.order_number} não está mais pendente.`);
          return ok();
        }

        // Send loading message
        const channelId = interaction.channel_id;
        await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{ description: "⏳ | Gerando QR Code...\nQuase lá, só mais um instante!", color: 0x2B2D31 }],
          }),
        });

        // Generate PIX
        await generatePixInThread(supabase, botToken, order, channelId, userId);
        return ok();
      }

      // ─── CHECKOUT: CANCEL ORDER ───────────────────────────
      if (customId.startsWith("checkout_cancel:")) {
        const orderId = customId.replace("checkout_cancel:", "");
        await respondDeferredUpdate(interaction, botToken);

        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
        if (!order) { await editFollowup(interaction, botToken, "❌ Pedido não encontrado."); return ok(); }

        if (order.status === "pending_payment") {
          await supabase.from("orders").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("id", orderId);
        }

        // Send cancel message then archive thread
        const channelId = interaction.channel_id;
        await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{ title: "❌ Compra Cancelada", description: `Pedido **#${order.order_number}** foi cancelado.\nO tópico será arquivado.`, color: 0xED4245 }],
          }),
        });

        // Archive and lock thread after a short delay
        setTimeout(async () => {
          try {
            await fetch(`${DISCORD_API}/channels/${channelId}`, {
              method: "PATCH",
              headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ archived: true, locked: true }),
            });
          } catch {}
        }, 3000);

        return ok();
      }

      // ─── CHECKOUT: USE COUPON (open modal) ────────────────
      if (customId.startsWith("checkout_coupon:")) {
        const orderId = customId.replace("checkout_coupon:", "");
        // Show modal for coupon code
        await fetch(`${DISCORD_API}/interactions/${interaction.id}/${interaction.token}/callback`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            type: 9, // MODAL
            data: {
              custom_id: `coupon_modal_${orderId}`,
              title: "Usar Cupom",
              components: [{
                type: 1,
                components: [{
                  type: 4, // TEXT_INPUT
                  custom_id: "coupon_code",
                  label: "Código do Cupom",
                  style: 1,
                  placeholder: "Digite o código do cupom...",
                  required: true,
                  min_length: 1,
                  max_length: 50,
                }],
              }],
            },
          }),
        });
        return ok();
      }

      // ─── CHECKOUT: EDIT QUANTITY (open modal) ─────────────
      if (customId.startsWith("checkout_quantity:")) {
        const orderId = customId.replace("checkout_quantity:", "");
        await fetch(`${DISCORD_API}/interactions/${interaction.id}/${interaction.token}/callback`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            type: 9,
            data: {
              custom_id: `quantity_modal_${orderId}`,
              title: "Editar Quantidade",
              components: [{
                type: 1,
                components: [{
                  type: 4,
                  custom_id: "quantity_value",
                  label: "Quantidade",
                  style: 1,
                  placeholder: "1",
                  required: true,
                  min_length: 1,
                  max_length: 3,
                  value: "1",
                }],
              }],
            },
          }),
        });
        return ok();

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
          .select("ticket_channel_id, ticket_embed_title, ticket_embed_description, ticket_embed_color, ticket_embed_footer, ticket_logs_channel_id, ticket_embed_button_label, ticket_embed_button_style")
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

        // Determine parent text channel for creating a private thread
        let parentChannelId: string | null = null;
        const configuredChannelId = targetChannelId || storeConfig?.ticket_channel_id || null;

        if (configuredChannelId) {
          try {
            const chInfoRes = await fetch(`${DISCORD_API}/channels/${configuredChannelId}`, {
              headers: { Authorization: `Bot ${botToken}` },
            });
            if (chInfoRes.ok) {
              const chInfo = await chInfoRes.json();
              if (chInfo.type === 4) {
                // It's a category - find first text channel inside it
                const guildChRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
                  headers: { Authorization: `Bot ${botToken}` },
                });
                if (guildChRes.ok) {
                  const allChannels = await guildChRes.json();
                  const textCh = allChannels.find((c: any) => c.parent_id === configuredChannelId && c.type === 0);
                  if (textCh) parentChannelId = textCh.id;
                }
              } else if (chInfo.type === 0 || chInfo.type === 5) {
                // Text or announcement channel - use directly
                parentChannelId = configuredChannelId;
              }
            }
          } catch (e) {
            console.error("Error checking channel type:", e);
          }
        }

        // Fallback: use the channel where the button was clicked
        if (!parentChannelId) {
          parentChannelId = interaction.channel_id;
        }

        // Create a private thread for this ticket
        const ticketSuffix = Date.now().toString(36).slice(-4);
        const threadName = `ticket-${username || userId}-${ticketSuffix}`.toLowerCase().replace(/[^a-z0-9-_]/g, "").substring(0, 100);

        const createThreadRes = await fetch(`${DISCORD_API}/channels/${parentChannelId}/threads`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: threadName,
            type: 12, // GUILD_PRIVATE_THREAD
            auto_archive_duration: 10080, // 7 days
          }),
        });

        console.log("Thread creation status:", createThreadRes.status);

        if (!createThreadRes.ok) {
          const errText = await createThreadRes.text();
          console.error("Failed to create ticket thread:", errText);
          await editFollowup(interaction, botToken, "❌ Não foi possível criar o tópico do ticket. Verifique as permissões do bot.");
          return ok();
        }

        const ticketThread = await createThreadRes.json();

        // Add the ticket creator to the thread
        await fetch(`${DISCORD_API}/channels/${ticketThread.id}/thread-members/${userId}`, {
          method: "PUT",
          headers: { Authorization: `Bot ${botToken}` },
        });

        // Insert ticket in DB
        const { data: ticket, error: ticketErr } = await supabase
          .from("tickets")
          .insert({
            tenant_id: ticketTenantId,
            discord_user_id: userId,
            discord_username: username,
            discord_channel_id: ticketThread.id,
            status: "open",
          })
          .select()
          .single();

        if (ticketErr) {
          console.error("Ticket insert error:", ticketErr);
          await editFollowup(interaction, botToken, "❌ Erro ao criar ticket no banco de dados.");
          return ok();
        }

        // Send welcome embed with action buttons (including Rename)
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

        const actionButtonStyleMap: Record<string, number> = {
          primary: 1,
          secondary: 2,
          success: 3,
          danger: 4,
          glass: 2,
          link: 2,
        };

        const configuredPrimaryButtonStyle = actionButtonStyleMap[storeConfig?.ticket_embed_button_style || "glass"] || 2;

        const welcomeMsgRes = await fetch(`${DISCORD_API}/channels/${ticketThread.id}/messages`, {
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
                    style: configuredPrimaryButtonStyle,
                    label: "Lembrar",
                    custom_id: `ticket_remind_${ticket.id}`,
                  },
                  {
                    type: 2,
                    style: 2,
                    label: "Renomear",
                    custom_id: `ticket_rename_${ticket.id}`,
                  },
                  {
                    type: 2,
                    style: 2,
                    label: "Arquivar",
                    custom_id: `ticket_close_${ticket.id}`,
                  },
                  {
                    type: 2,
                    style: 4,
                    label: "Deletar",
                    custom_id: `ticket_delete_${ticket.id}`,
                  },
                ],
              },
              {
                type: 1,
                components: [
                  {
                    type: 5,
                    custom_id: `ticket_assign_${ticket.id}`,
                    placeholder: "Selecione algum membro para Ação",
                    min_values: 1,
                    max_values: 1,
                  },
                ],
              },
            ],
          }),
        });

        // Pin the welcome message
        if (welcomeMsgRes.ok) {
          const welcomeMsg = await welcomeMsgRes.json();
          try {
            await fetch(`${DISCORD_API}/channels/${ticketThread.id}/pins/${welcomeMsg.id}`, {
              method: "PUT",
              headers: { Authorization: `Bot ${botToken}` },
            });
          } catch (e) { console.error("Pin error:", e); }
        }

        await editFollowup(interaction, botToken, `✅ Ticket criado! Acesse <#${ticketThread.id}>`);
        return ok();
      }

      // ─── TICKET REMIND (send DM to ticket creator) ───────
      if (customId.startsWith("ticket_remind_")) {
        const ticketId = customId.replace("ticket_remind_", "");
        await respondDeferred(interaction, botToken);

        const { data: ticket } = await supabase
          .from("tickets")
          .select("discord_user_id, discord_channel_id, status, tenant_id")
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

        // Get tenant info for branding
        const { data: tenantInfo } = await supabase
          .from("tenants")
          .select("name, discord_guild_id")
          .eq("id", ticket.tenant_id)
          .single();

        // Determine time greeting
        const hour = new Date().getUTCHours() - 3; // BRT approximation
        const greeting = hour >= 0 && hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

        // Send DM to the ticket creator
        try {
          const dmChRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ recipient_id: ticket.discord_user_id }),
          });

          if (dmChRes.ok) {
            const dmCh = await dmChRes.json();
            const ticketUrl = `https://discord.com/channels/${tenantInfo?.discord_guild_id || "@me"}/${channelId}`;

            await fetch(`${DISCORD_API}/channels/${dmCh.id}/messages`, {
              method: "POST",
              headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                embeds: [{
                  description: `${greeting} <@${ticket.discord_user_id}>, você possui um ticket pendente de resposta; se não for respondido, poderá ser fechado.`,
                  color: 0x2B2D31,
                }],
                components: [{
                  type: 1,
                  components: [{
                    type: 2,
                    style: 5, // Link
                    label: "Ir para o ticket",
                    url: ticketUrl,
                  }],
                }],
              }),
            });
          }
        } catch (e) { console.error("DM remind error:", e); }

        // Also post in channel
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

      // ─── TICKET DELETE (permanently delete channel) ────────
      if (customId.startsWith("ticket_delete_")) {
        const ticketId = customId.replace("ticket_delete_", "");
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

        const channelId = interaction.channel_id || ticket.discord_channel_id;

        // Get tenant name for transcript
        const { data: delTenant } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", ticket.tenant_id)
          .single();

        await sendTicketLog(supabase, botToken, ticket, channelId, userId, username, "deleted", delTenant?.name || "Servidor");

        // Send closing message then delete
        if (channelId) {
          await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              embeds: [{
                title: "🗑️ Ticket Deletado",
                description: `Este ticket foi deletado por <@${userId}>.\nO tópico será excluído em 5 segundos.`,
                color: 0xED4245,
              }],
            }),
          });

          setTimeout(async () => {
            try {
              await fetch(`${DISCORD_API}/channels/${channelId}`, {
                method: "DELETE",
                headers: { Authorization: `Bot ${botToken}` },
              });
            } catch (e) { console.error("Failed to delete ticket thread:", e); }
          }, 5000);
        }

        return ok();
      }

      // ─── TICKET ASSIGN (user select menu) ─────────────────
      if (customId.startsWith("ticket_assign_")) {
        const ticketId = customId.replace("ticket_assign_", "");
        const selectedUserId = interaction.data?.values?.[0];
        if (!selectedUserId) return ok();

        await respondDeferred(interaction, botToken);

        const { data: ticket } = await supabase
          .from("tickets")
          .select("discord_channel_id, tenant_id")
          .eq("id", ticketId)
          .single();

        if (!ticket) {
          await editFollowup(interaction, botToken, "❌ Ticket não encontrado.");
          return ok();
        }

        const channelId = ticket.discord_channel_id || interaction.channel_id;

        // Add selected user to channel permissions
        const { data: tenantInfo } = await supabase
          .from("tenants")
          .select("discord_guild_id")
          .eq("id", ticket.tenant_id)
          .single();

        if (channelId) {
          // Grant VIEW_CHANNEL + SEND_MESSAGES to the assigned user
          await fetch(`${DISCORD_API}/channels/${channelId}/permissions/${selectedUserId}`, {
            method: "PUT",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              allow: "3072", // VIEW_CHANNEL (1024) + SEND_MESSAGES (2048)
              type: 1, // member
            }),
          });

          await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `👤 <@${selectedUserId}> foi adicionado ao ticket por <@${userId}>.`,
            }),
          });
        }

        await editFollowup(interaction, botToken, `✅ <@${selectedUserId}> adicionado ao ticket!`);
        return ok();
      }

      // ─── MARK DELIVERED (manual delivery button) ─────────
      if (customId.startsWith("mark_delivered_")) {
        const orderId = customId.replace("mark_delivered_", "");
        await respondDeferredUpdate(interaction, botToken);

        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
        if (!order) { await editFollowup(interaction, botToken, "❌ Pedido não encontrado."); return ok(); }

        // Update order to delivered
        await supabase.from("orders").update({ status: "delivered", updated_at: new Date().toISOString() }).eq("id", orderId);

        // Update ticket to delivered
        await supabase
          .from("tickets")
          .update({ status: "delivered", updated_at: new Date().toISOString() })
          .eq("order_id", orderId);

        // Send confirmation in channel
        const channelId = interaction.channel_id;
        if (channelId) {
          await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              embeds: [{
                title: "✅ Entrega Confirmada",
                description: `Pedido **#${order.order_number}** marcado como entregue por <@${userId}>.`,
                color: 0x57F287,
              }],
            }),
          });
        }

        await editFollowup(interaction, botToken, {
          embeds: [{
            title: "✅ Pedido Entregue",
            description: `Pedido **#${order.order_number}** (${order.product_name}) marcado como entregue.`,
            color: 0x57F287,
          }],
          components: [],
        });
        return ok();
      }

      // ─── CANCEL MANUAL ORDER (button in delivery thread) ──
      if (customId.startsWith("cancel_manual_")) {
        const orderId = customId.replace("cancel_manual_", "");
        await respondDeferredUpdate(interaction, botToken);

        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
        if (!order) { await editFollowup(interaction, botToken, "❌ Pedido não encontrado."); return ok(); }

        await supabase.from("orders").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("id", orderId);
        await supabase
          .from("tickets")
          .update({ status: "closed", closed_by: username || userId, closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("order_id", orderId);

        // Notify buyer via DM
        try {
          const dmChRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ recipient_id: order.discord_user_id }),
          });
          if (dmChRes.ok) {
            const dmCh = await dmChRes.json();
            await fetch(`${DISCORD_API}/channels/${dmCh.id}/messages`, {
              method: "POST",
              headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                embeds: [{
                  title: "❌ Pedido Cancelado",
                  description: `Seu pedido **#${order.order_number}** (${order.product_name}) foi cancelado.`,
                  color: 0xED4245,
                }],
              }),
            });
          }
        } catch (e) { console.error("DM cancel error:", e); }

        await editFollowup(interaction, botToken, {
          embeds: [{
            title: "❌ Pedido Cancelado",
            description: `Pedido **#${order.order_number}** cancelado por <@${userId}>.`,
            color: 0xED4245,
          }],
          components: [],
        });
        return ok();
      }

      // ─── TICKET RENAME (modal to rename the channel) ──────────
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

      // ─── TRANSCRIPT VIEW (button in log channel) ──────────
      if (customId.startsWith("transcript_view_")) {
        const ticketId = customId.replace("transcript_view_", "");
        await respondDeferred(interaction, botToken);

        const { data: ticket } = await supabase
          .from("tickets")
          .select("*, tenant_id")
          .eq("id", ticketId)
          .single();

        if (!ticket) {
          await editFollowup(interaction, botToken, "❌ Ticket não encontrado.");
          return ok();
        }

        // Get tenant name
        const { data: tTenant } = await supabase
          .from("tenants")
          .select("discord_guild_id")
          .eq("id", ticket.tenant_id)
          .single();

        let serverName = "Servidor";
        if (tTenant?.discord_guild_id) {
          try {
            const gRes = await fetch(`${DISCORD_API}/guilds/${tTenant.discord_guild_id}`, {
              headers: { Authorization: `Bot ${botToken}` },
            });
            if (gRes.ok) {
              const gData = await gRes.json();
              serverName = gData.name || serverName;
            }
          } catch {}
        }

        // Try to fetch messages from the ticket channel (thread)
        let msgs: any[] = [];
        const chId = ticket.discord_channel_id;
        if (chId) {
          try {
            const mRes = await fetch(`${DISCORD_API}/channels/${chId}/messages?limit=100`, {
              headers: { Authorization: `Bot ${botToken}` },
            });
            if (mRes.ok) {
              msgs = await mRes.json();
              msgs = msgs.reverse();
            }
          } catch {}
        }

        if (msgs.length === 0) {
          // If channel is deleted, try to get from the original message attachment
          // Fall back to a message saying transcript unavailable
          await editFollowup(interaction, botToken, "📜 O transcript está anexado como arquivo na mensagem acima. Clique no arquivo `.html` para visualizar.");
          return ok();
        }

        const ticketName = `ticket-${ticket.discord_username || ticket.discord_user_id}`;
        const htmlTranscript = generateHtmlTranscript(msgs, serverName, ticketName, "Suporte · transcript");

        // Send as ephemeral file via webhook followup
        const formData = new FormData();
        const blob = new Blob([htmlTranscript], { type: "text/html" });
        formData.append("files[0]", blob, `transcript-${ticket.id.slice(0, 8)}.html`);
        formData.append("payload_json", JSON.stringify({
          content: "📜 Aqui está o transcript do ticket:",
          flags: 64,
        }));

        const url = `${DISCORD_API}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
        await fetch(url, {
          method: "PATCH",
          headers: { Authorization: `Bot ${botToken}` },
          body: formData,
        });

        return ok();
      }

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

        const channelId = interaction.channel_id || ticket.discord_channel_id;

        // Get tenant name for transcript
        const { data: closeTenant } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", ticket.tenant_id)
          .single();

        await sendTicketLog(supabase, botToken, ticket, channelId, userId, username, "closed", closeTenant?.name || "Servidor");

        // Archive: send closing message and lock thread
        if (channelId) {
          await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              embeds: [{
                title: "📁 Ticket Arquivado",
                description: `Este ticket foi arquivado por <@${userId}>.\nO tópico está agora somente leitura.`,
                color: 0xFEE75C,
              }],
            }),
          });

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
  const { data: providers, error: provErr } = await supabase
    .from("payment_providers")
    .select("provider_key, api_key_encrypted, secret_key_encrypted, active, efi_cert_pem, efi_key_pem, efi_pix_key")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  console.log("Payment providers query:", { tenantId, providers: providers?.map((p: any) => ({ key: p.provider_key, hasApiKey: !!p.api_key_encrypted })), error: provErr?.message });

  const activeProvider = providers?.find((p: any) => p.api_key_encrypted);
  const amountBRL = priceCents / 100;
  const webhookBaseUrl = `${supabaseUrl}/functions/v1/payment-webhook`;
  let brcode = "";
  let paymentId = "";

  console.log("Purchase debug:", { activeProvider: activeProvider?.provider_key, amountBRL, priceCents });

  // ─── FREE PRODUCT: deliver immediately without payment ────
  if (priceCents <= 0) {
    // Mark order as paid and trigger delivery
    await supabase.from("orders").update({ 
      status: "paid", 
      payment_provider: "free",
      updated_at: new Date().toISOString() 
    }).eq("id", order.id);

    // Trigger delivery via deliver-order
    try {
      await fetch(`${supabaseUrl}/functions/v1/deliver-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ order_id: order.id }),
      });
    } catch (e) { console.error("Free delivery error:", e); }

    await editFollowup(interaction, botToken, `✅ Pedido **#${order.order_number}** — **${orderName}** entregue gratuitamente! Verifique sua DM.`);
    return;
  }

  if (activeProvider && amountBRL > 0) {
    const providerKey = activeProvider.provider_key;
    const apiKey = activeProvider.api_key_encrypted;
    const webhookUrl = `${webhookBaseUrl}/${providerKey}/${tenantId}`;
    const externalRef = `order_${order.id}`;

    if (providerKey === "mercadopago") {
      console.log("Generating Mercado Pago PIX...", { amountBRL, orderName, externalRef });
      try {
        const result = await generateMercadoPagoPix(apiKey, amountBRL, orderName, externalRef, webhookUrl);
        brcode = result.brcode;
        paymentId = result.payment_id;
        console.log("Mercado Pago PIX generated:", { brcode: brcode.substring(0, 30), paymentId });
      } catch (mpErr) {
        console.error("Mercado Pago PIX generation failed:", mpErr);
        throw mpErr;
      }
    } else if (providerKey === "pushinpay") {
      const result = await generatePushinPayPix(apiKey, priceCents, webhookUrl);
      brcode = result.brcode;
      paymentId = result.payment_id;
    } else if (providerKey === "efi") {
      const pixRes = await fetch(`${supabaseUrl}/functions/v1/generate-pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ tenant_id: tenantId, amount_cents: priceCents, product_name: orderName, tx_id: externalRef }),
      });
      const pixData = await pixRes.json();
      if (pixData.error) throw new Error(pixData.error);
      brcode = pixData.brcode || "";
      paymentId = pixData.payment_id || externalRef;
    } else if (providerKey === "misticpay") {
      const pixRes = await fetch(`${supabaseUrl}/functions/v1/generate-pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ tenant_id: tenantId, amount_cents: priceCents, product_name: orderName, tx_id: externalRef }),
      });
      const pixData = await pixRes.json();
      if (pixData.error) throw new Error(pixData.error);
      brcode = pixData.brcode || "";
      paymentId = pixData.payment_id || externalRef;
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
                type: 2,
                style: 3,
                label: "✅ Aprovar Pagamento",
                custom_id: `approve_order:${order.id}`,
              },
              {
                type: 2,
                style: 4,
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
    .select("store_banner_url, store_logo_url, store_title, payment_timeout_minutes, embed_color")
    .eq("tenant_id", tenantId)
    .single();

  const { data: tenantInfo } = await supabase
    .from("tenants")
    .select("name, logo_url")
    .eq("id", tenantId)
    .single();

  const storeName = storeConfigForCheckout?.store_title || tenantInfo?.name || "Loja";
  const storeLogo = storeConfigForCheckout?.store_logo_url || tenantInfo?.logo_url;
  const timeoutMin = storeConfigForCheckout?.payment_timeout_minutes || 30;
  const storeEmbedColor = storeConfigForCheckout?.embed_color
    ? parseInt(storeConfigForCheckout.embed_color.replace("#", ""), 16)
    : 0x2B2D31;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(brcode)}`;

  const checkoutEmbed: any = {
    title: `🛒 ${storeName} - Carrinho`,
    description: `> <@${userId}>, escaneie o QR Code ou copie o código PIX abaixo!`,
    color: storeEmbedColor,
    fields: [
      { name: "🕐 Informações do Pedido", value: `**${orderName}**`, inline: false },
      { name: "💠 Pagamento PIX", value: `→ **Preço:** ${formatBRL(priceCents)}\n→ **Tempo Limite:** ${timeoutMin} minutos`, inline: false },
      { name: "📋 PIX Copia e Cola", value: `\`\`\`\n${brcode}\n\`\`\``, inline: false },
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

  // Respond inline (ephemeral) with QR code + brcode + cancel button
  console.log("Sending checkout embed via editFollowup...", { orderId: order.id, hasBrcode: !!brcode });
  await editFollowup(interaction, botToken, {
    content: `↓ Após o pagamento, seu pedido será processado automaticamente!`,
    embeds: [checkoutEmbed],
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 4, // Danger (red)
        label: "Cancelar Compra",
        emoji: { name: "❌" },
        custom_id: `cancel_order:${order.id}`,
      }],
    }],
  });
  console.log("Checkout embed sent successfully for order:", order.id);
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
  const res = await fetch(`${DISCORD_API}/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: 5, data: { flags: 64 } }), // 64 = ephemeral
  });
  const resText = await res.text();
  if (!res.ok) {
    console.error("respondDeferred FAILED:", res.status, resText);
  } else {
    console.log("respondDeferred OK:", res.status);
  }
}

// Deferred update (updates EXISTING message, no new message created)
async function respondDeferredUpdate(interaction: any, botToken: string) {
  const res = await fetch(`${DISCORD_API}/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: 6 }), // DEFERRED_UPDATE_MESSAGE
  });
  const resText = await res.text();
  if (!res.ok) {
    console.error("respondDeferredUpdate FAILED:", res.status, resText);
  } else {
    console.log("respondDeferredUpdate OK:", res.status);
  }
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
  const url = `${DISCORD_API}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
  console.log("editFollowup URL:", url);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const resText = await res.text();
  if (!res.ok) {
    console.error("editFollowup FAILED:", res.status, resText);
  } else {
    console.log("editFollowup OK:", res.status);
  }
}

// ─── HTML Transcript Generator ──────────────────────────────
function generateHtmlTranscript(msgs: any[], serverName: string, ticketName: string, status: string): string {
  const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const now = new Date().toLocaleString("pt-BR");

  let rows = "";
  for (const m of msgs) {
    const ts = new Date(m.timestamp).toLocaleString("pt-BR");
    const author = m.author?.username || "Desconhecido";
    const avatar = m.author?.avatar
      ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=40`
      : `https://cdn.discordapp.com/embed/avatars/${(parseInt(m.author?.id || "0") >> 22) % 6}.png`;
    let content = escHtml(m.content || "");
    if (!content && m.embeds?.length) content = "<em>[embed]</em>";
    if (!content && m.attachments?.length) content = m.attachments.map((a: any) => `<a href="${escHtml(a.url)}">${escHtml(a.filename)}</a>`).join(", ");
    if (!content) content = "<em>[sem conteúdo]</em>";

    // Convert Discord mentions
    content = content.replace(/&lt;@!?(\d+)&gt;/g, '<span style="color:#7289da;font-weight:600">@user</span>');

    rows += `<div style="display:flex;gap:12px;padding:8px 16px;border-bottom:1px solid #2f3136;">
      <img src="${avatar}" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;margin-top:2px;" />
      <div>
        <div><strong style="color:#fff;">${escHtml(author)}</strong> <span style="color:#72767d;font-size:12px;">${ts}</span></div>
        <div style="color:#dcddde;margin-top:2px;">${content}</div>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(serverName)} - ${escHtml(status)} ${escHtml(ticketName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #36393f; color: #dcddde; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; }
    .header { background: #2f3136; padding: 20px; border-bottom: 2px solid #202225; }
    .header h1 { color: #fff; font-size: 18px; }
    .header p { color: #72767d; font-size: 12px; margin-top: 4px; }
    .messages { padding: 8px 0; }
    .footer { background: #2f3136; padding: 12px 16px; text-align: center; color: #72767d; font-size: 11px; border-top: 2px solid #202225; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escHtml(serverName)} — Transcript</h1>
    <p>${escHtml(ticketName)} · ${escHtml(status)} · Gerado em ${now}</p>
  </div>
  <div class="messages">${rows}</div>
  <div class="footer">Transcript gerado automaticamente por Drika Hub</div>
</body>
</html>`;
}

// ─── Send Ticket Log + Transcript ───────────────────────────
async function sendTicketLog(
  supabase: any,
  botToken: string,
  ticket: any,
  channelId: string | null,
  closedByUserId: string,
  closedByUsername: string,
  action: "closed" | "deleted",
  serverName: string
) {
  const { data: sc } = await supabase
    .from("store_configs")
    .select("ticket_logs_channel_id")
    .eq("tenant_id", ticket.tenant_id)
    .single();

  // Fetch messages for transcript
  let msgs: any[] = [];
  if (channelId) {
    try {
      const msgsRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages?limit=100`, {
        headers: { Authorization: `Bot ${botToken}` },
      });
      if (msgsRes.ok) {
        msgs = await msgsRes.json();
        msgs = msgs.reverse();
      }
    } catch (e) { console.error("Transcript fetch error:", e); }
  }

  const closedAt = new Date();
  const closedTs = Math.floor(closedAt.getTime() / 1000);
  const ticketName = `ticket-${ticket.discord_username || ticket.discord_user_id}`;
  const statusLabel = action === "deleted" ? "Deletado" : "Fechado";

  // Generate HTML transcript
  const htmlTranscript = msgs.length > 0
    ? generateHtmlTranscript(msgs, serverName, ticketName, `Suporte · ${statusLabel.toLowerCase()} esperando resposta...`)
    : "";

  if (sc?.ticket_logs_channel_id) {
    // Compact log embed matching reference style
    const logEmbed: any = {
      title: `Ticket - ${statusLabel}`,
      color: action === "deleted" ? 0xED4245 : 0x2B2D31,
      fields: [
        { name: "👤 Moderador", value: `<@${closedByUserId}>\n@${closedByUsername}`, inline: false },
      ],
      timestamp: closedAt.toISOString(),
    };

    if (ticket.product_name) {
      logEmbed.fields.push({ name: "📦 Produto", value: ticket.product_name, inline: false });
    }

    // Send embed + transcript as single message with button
    if (htmlTranscript) {
      const formData = new FormData();
      const blob = new Blob([htmlTranscript], { type: "text/html" });
      formData.append("files[0]", blob, `transcript-${ticket.discord_channel_id || ticket.id.slice(0, 8)}.html`);
      formData.append("payload_json", JSON.stringify({
        embeds: [logEmbed],
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 2,
            label: "Ver transcript",
            emoji: { name: "📜" },
            custom_id: `transcript_view_${ticket.id}`,
          }],
        }],
      }));

      await fetch(`${DISCORD_API}/channels/${sc.ticket_logs_channel_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}` },
        body: formData,
      });
    } else {
      await fetch(`${DISCORD_API}/channels/${sc.ticket_logs_channel_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [logEmbed] }),
      });
    }
  }

  // Send transcript to user DM
  try {
    const dmChRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: ticket.discord_user_id }),
    });

    if (dmChRes.ok && htmlTranscript) {
      const dmCh = await dmChRes.json();
      const dmFormData = new FormData();
      const dmBlob = new Blob([htmlTranscript], { type: "text/html" });
      dmFormData.append("files[0]", dmBlob, `transcript-${ticket.id.slice(0, 8)}.html`);
      dmFormData.append("payload_json", JSON.stringify({
        content: "📜 Aqui está o transcript do seu ticket encerrado.",
      }));

      await fetch(`${DISCORD_API}/channels/${dmCh.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}` },
        body: dmFormData,
      });
    }
  } catch (e) { console.error("DM transcript error:", e); }
}
