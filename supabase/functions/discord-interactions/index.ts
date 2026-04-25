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
      publicKeyBytes as any,
      { name: "Ed25519", namedCurve: "Ed25519" } as any,
      false,
      ["verify"]
    );

    return await crypto.subtle.verify("Ed25519", key, signatureBytes as any, messageBytes as any);
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

function applyPurchaseFooterTemplate(template: string | null | undefined, context: Record<string, string | number | null | undefined>) {
  if (!template || !String(template).trim()) return "";
  return String(template)
    .replace(/\{store\}/gi, String(context.storeName ?? ""))
    .replace(/\{loja\}/gi, String(context.storeName ?? ""))
    .replace(/\{product\}/gi, String(context.productName ?? ""))
    .replace(/\{order\}/gi, context.orderNumber ? `#${context.orderNumber}` : "")
    .replace(/\{expires\}/gi, context.timeoutMin ? `${context.timeoutMin} minutos` : "")
    .replace(/\{date\}/gi, String(context.date ?? ""))
    .replace(/\{data\}/gi, [context.date, context.time].filter(Boolean).join(" "))
    .replace(/\{time\}/gi, String(context.time ?? ""))
    .replace(/\{user\}/gi, String(context.username ?? ""));
}

function parseProductEmbedConfig(rawConfig: unknown): Record<string, unknown> {
  if (!rawConfig) return {};
  if (typeof rawConfig === "string") {
    try {
      const parsed = JSON.parse(rawConfig);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof rawConfig === "object" ? rawConfig as Record<string, unknown> : {};
}

function resolveHexColor(value: unknown, fallback = "#5865F2") {
  const raw = typeof value === "string" ? value.trim() : "";
  const normalized = raw ? (raw.startsWith("#") ? raw : `#${raw}`) : fallback;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
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

// ─── Store Log Helper ───────────────────────────────────────
async function sendStoreLog(
  supabase: any,
  botToken: string,
  tenantId: string,
  opts: { title: string; description: string; color?: number; fields?: any[] }
) {
  try {
    const { data: sc } = await supabase
      .from("store_configs")
      .select("logs_channel_id, store_title, store_logo_url, embed_color")
      .eq("tenant_id", tenantId)
      .single();
    if (!sc?.logs_channel_id) return;

    const { data: t } = await supabase.from("tenants").select("name, logo_url").eq("id", tenantId).single();
    const storeName = sc.store_title || t?.name || "Loja";
    const storeLogo = sc.store_logo_url || t?.logo_url;
    const embedColor = opts.color ?? (sc.embed_color ? parseInt(sc.embed_color.replace("#", ""), 16) : 0x2B2D31);
    const d = new Date().toLocaleDateString("pt-BR");
    const tm = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const embed: any = {
      title: opts.title,
      description: opts.description,
      color: embedColor,
      footer: { text: `${storeName} | ${d}, ${tm}`, icon_url: storeLogo || undefined },
      timestamp: new Date().toISOString(),
    };
    if (opts.fields?.length) embed.fields = opts.fields;

    const res = await fetch(`${DISCORD_API}/channels/${sc.logs_channel_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) console.error(`sendStoreLog failed [${opts.title}]:`, res.status, await res.text());
    else console.log(`[LOG] ${opts.title} sent for tenant ${tenantId}`);
  } catch (err: any) {
    console.error(`sendStoreLog error [${opts.title}]:`, err.message);
  }
}

function extractProductIdCandidates(rawProductId: string): string[] {
  if (!rawProductId) return [];

  const raw = String(rawProductId).trim();
  const candidates = new Set<string>();
  if (raw) candidates.add(raw);

  raw
    .split(/[:|,;\/\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => candidates.add(part));

  const uuidMatches = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi) || [];
  uuidMatches.forEach((id) => candidates.add(id));

  return [...candidates];
}

async function resolveProductFromCustomId(supabase: any, rawProductId: string, guildId: string) {
  const candidates = extractProductIdCandidates(rawProductId);
  if (!candidates.length) return null;

  let tenantId: string | null = null;
  if (guildId) {
    const { data: tenantByGuild } = await supabase
      .from("tenants")
      .select("id")
      .eq("discord_guild_id", guildId)
      .maybeSingle();
    tenantId = tenantByGuild?.id || null;
  }

  for (const candidateId of candidates) {
    let q = supabase.from("products").select("*").eq("id", candidateId);
    if (tenantId) q = q.eq("tenant_id", tenantId);

    const { data, error } = await q.maybeSingle();
    if (error) {
      console.error("[discord-interactions] Product candidate lookup failed:", candidateId, error.message);
      continue;
    }
    if (data) return data;
  }

  if (tenantId) {
    const { data: tenantProducts, error: tenantProductsError } = await supabase
      .from("products")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (!tenantProductsError && (tenantProducts?.length || 0) === 1) {
      console.warn("[discord-interactions] Using single active-product fallback for tenant", tenantId);
      return tenantProducts![0];
    }
  }

  return null;
}

// ─── Check ticket staff permission ──────────────────────────
async function checkTicketStaffPermission(
  supabase: any,
  botToken: string,
  tenantId: string,
  guildId: string,
  userId: string,
  member: any
): Promise<boolean> {
  // Always allow server Administrators
  const memberPerms = BigInt(member?.permissions || "0");
  if (memberPerms & BigInt(0x8)) return true;

  // Fetch configured staff role
  const { data: config } = await supabase
    .from("store_configs")
    .select("ticket_staff_role_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const staffRoleIdRaw = config?.ticket_staff_role_id;
  
  // If no staff role configured, only admins can manage
  if (!staffRoleIdRaw) return false;

  // Support comma-separated role IDs
  const staffRoleIds = staffRoleIdRaw.split(",").map((id: string) => id.trim()).filter(Boolean);
  if (staffRoleIds.length === 0) return false;

  // Check if user has any of the staff roles
  const memberRoles: string[] = member?.roles || [];
  return staffRoleIds.some((roleId: string) => memberRoles.includes(roleId));
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const publicKey = Deno.env.get("DISCORD_PUBLIC_KEY");
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

  // Usa sempre o bot externo 24h (token único)
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || "";
  const interactionGuildId = interaction.guild_id;
  if (!botToken) {
    console.error("DISCORD_BOT_TOKEN not configured");
    return new Response(JSON.stringify({ type: 4, data: { content: "❌ Bot externo não configurado.", flags: 64 } }), {
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
            color: 0x2B2D31,
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
            color: 0x2B2D31,
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
          .select("id, discord_channel_id")
          .eq("tenant_id", tenant.id)
          .eq("discord_user_id", userId)
          .in("status", ["open", "in_progress"]);

        // Verify threads still exist in Discord; auto-close stale ones
        let hasRealOpenTicket = false;
        if (existingTickets && existingTickets.length > 0) {
          for (const t of existingTickets) {
            if (!t.discord_channel_id) {
              await supabase.from("tickets").update({ status: "closed" }).eq("id", t.id);
              continue;
            }
            try {
              const chRes = await fetch(`${DISCORD_API}/channels/${t.discord_channel_id}`, {
                headers: { Authorization: `Bot ${botToken}` },
              });
              if (!chRes.ok) {
                // Thread no longer exists — auto-close
                await supabase.from("tickets").update({ status: "closed" }).eq("id", t.id);
              } else {
                const chData = await chRes.json();
                // Check if thread is archived
                if (chData.thread_metadata?.archived) {
                  await supabase.from("tickets").update({ status: "closed" }).eq("id", t.id);
                } else {
                  hasRealOpenTicket = true;
                }
              }
            } catch {
              // On error, assume stale
              await supabase.from("tickets").update({ status: "closed" }).eq("id", t.id);
            }
          }
        }

        if (hasRealOpenTicket) {
          await editFollowup(interaction, botToken, "⚠️ Você já possui um ticket aberto.");
          return ok();
        }

        const { data: storeConfig } = await supabase
          .from("store_configs")
          .select("ticket_channel_id, ticket_staff_role_id, ticket_embed_title, ticket_embed_description, ticket_embed_color, ticket_embed_footer, ticket_embed_button_label, ticket_embed_button_style")
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
          const embedColor = parseInt((storeConfig?.ticket_embed_color || "#2B2D31").replace("#", ""), 16);
          // Build staff mentions so the thread appears for staff
          const staffRoleIds = (storeConfig?.ticket_staff_role_id || "").split(",").map((s: string) => s.trim()).filter(Boolean);
          const staffMentions = staffRoleIds.map((rid: string) => `<@&${rid}>`).join(" ");
          const contentMention = staffMentions ? `<@${userId}> ${staffMentions}` : `<@${userId}>`;

          await fetch(`${DISCORD_API}/channels/${ticketThread.id}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              content: contentMention,
              allowed_mentions: { users: [userId], roles: staffRoleIds },
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
        // Find tenant by guild_id to check staff role
        const { data: fecharTenant } = await supabase.from("tenants").select("id").eq("discord_guild_id", guildId).single();
        if (!fecharTenant) return respondImmediate(interaction, "❌ Servidor não configurado.");

        const isStaff = await checkTicketStaffPermission(supabase, botToken, fecharTenant.id, guildId, userId, interaction.member);
        if (!isStaff) {
          return respondImmediate(interaction, "❌ Você não tem permissão para fechar tickets.");
        }

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
          body: JSON.stringify({ embeds: [{ title: "📁 Ticket Arquivado", description: `Ticket arquivado por <@${userId}>.`, color: 0x2B2D31 }] }),
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
    console.log(`[INTERACTION] Type 3 button click: customId=${customId}, userId=${userId}`);

    // Helper to get store embed color for a tenant (returns undefined for default = no border)
    const getStoreEmbedColor = async (tid: string): Promise<number | undefined> => {
      const { data: sc } = await supabase
        .from("store_configs")
        .select("embed_color")
        .eq("tenant_id", tid)
        .single();
      if (!sc?.embed_color || sc.embed_color === "#2B2D31") return undefined;
      return parseInt(sc.embed_color.replace("#", ""), 16);
    };

    // Helper to resolve product-specific embed color: product color > store color > fallback
    const resolveProductEmbedColor = async (product: any, tid: string): Promise<number | undefined> => {
      const embedConfig = parseProductEmbedConfig(product?.embed_config);
      const { data: sc } = await supabase
        .from("store_configs")
        .select("embed_color")
        .eq("tenant_id", tid)
        .single();
      const storeColor = sc?.embed_color || "#5865F2";
      const hex = resolveHexColor(embedConfig.color, resolveHexColor(storeColor));
      if (hex === "#2B2D31") return undefined;
      return parseInt(hex.replace("#", ""), 16);
    };

    // Helper to resolve embed color from an order (fetches product if available)
    const resolveOrderEmbedColor = async (order: any): Promise<number | undefined> => {
      if (order?.product_id) {
        const { data: product } = await supabase.from("products").select("embed_config").eq("id", order.product_id).single();
        if (product) return resolveProductEmbedColor(product, order.tenant_id);
      }
      return getStoreEmbedColor(order.tenant_id);
    };

    try {
      // ─── BUY PRODUCT ─────────────────────────────────────
      if (customId.startsWith("buy_product:")) {
        const productId = customId.replace("buy_product:", "");

        // Defer with ephemeral (only the user sees it)
        await respondDeferred(interaction, botToken);

        const product = await resolveProductFromCustomId(supabase, productId, interaction.guild_id);

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
          .eq("product_id", product.id)
          .eq("tenant_id", tenantId)
          .order("sort_order", { ascending: true });

        // ── Stock check: block purchase if stock is 0 ──
        if (fields && fields.length > 0) {
          const fieldIds = fields.map((f: any) => f.id);
          const { count: totalFieldStock } = await supabase
            .from("product_stock_items")
            .select("id", { count: "exact", head: true })
            .in("field_id", fieldIds)
            .eq("tenant_id", tenantId)
            .eq("delivered", false);

          // Also check general stock (field_id IS NULL)
          const { count: generalStock } = await supabase
            .from("product_stock_items")
            .select("id", { count: "exact", head: true })
            .eq("product_id", product.id)
            .eq("tenant_id", tenantId)
            .is("field_id", null)
            .eq("delivered", false);

          const combinedStock = (totalFieldStock || 0) + (generalStock || 0);
          if (combinedStock <= 0) {
            await editFollowup(interaction, botToken, "❌ Este produto está **sem estoque** no momento. Tente novamente mais tarde.");
            return ok();
          }
        } else {
          const { count: productStock } = await supabase
            .from("product_stock_items")
            .select("id", { count: "exact", head: true })
            .eq("product_id", product.id)
            .eq("tenant_id", tenantId)
            .eq("delivered", false);

          if (productStock !== null && productStock <= 0) {
            await editFollowup(interaction, botToken, "❌ Este produto está **sem estoque** no momento. Tente novamente mais tarde.");
            return ok();
          }
        }

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

          const embedColorVal = await resolveProductEmbedColor(product, tenantId);
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

        const product = await resolveProductFromCustomId(supabase, productId, interaction.guild_id);
        if (!product) { await editFollowup(interaction, botToken, "❌ Produto não encontrado."); return ok(); }

        const { data: field } = await supabase.from("product_fields").select("*").eq("id", fieldId).single();
        if (!field) { await editFollowup(interaction, botToken, "❌ Variação não encontrada."); return ok(); }

        // ── Stock check for this variation ──
        const { count: fieldStock } = await supabase
          .from("product_stock_items")
          .select("id", { count: "exact", head: true })
          .eq("field_id", fieldId)
          .eq("tenant_id", product.tenant_id)
          .eq("delivered", false);

        // Fallback: check general stock (field_id IS NULL)
        let totalStock = fieldStock || 0;
        if (totalStock === 0) {
          const { count: generalStock } = await supabase
            .from("product_stock_items")
            .select("id", { count: "exact", head: true })
            .eq("product_id", product.id)
            .eq("tenant_id", product.tenant_id)
            .is("field_id", null)
            .eq("delivered", false);
          totalStock = generalStock || 0;
        }

        if (totalStock <= 0) {
          await editFollowup(interaction, botToken, "❌ Esta variação está **sem estoque** no momento. Tente novamente mais tarde.");
          return ok();
        }

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

        const varEmbedColor = await resolveProductEmbedColor(product, product.tenant_id);
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

        const detailEmbedColor = await resolveProductEmbedColor(product, product.tenant_id);
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

        const isStaff = await checkTicketStaffPermission(supabase, botToken, order.tenant_id, interaction.guild_id, userId, interaction.member);
        if (!isStaff) {
          await editFollowup(interaction, botToken, "❌ Você não tem permissão para confirmar manualmente este pedido.");
          return ok();
        }

        if (order.status !== "pending_payment") {
          await editFollowup(interaction, botToken, `ℹ️ Pedido #${order.order_number} já está com status: **${order.status}**`);
          return ok();
        }

        await supabase.from("orders").update({ status: "paid", payment_provider: "manual_confirmation" }).eq("id", orderId);

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
                  color: 0x2B2D31,
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
            color: 0x2B2D31,
            fields: [
              { name: "📦 Produto", value: order.product_name, inline: true },
              { name: "💰 Valor", value: formatBRL(order.total_cents), inline: true },
              { name: "👤 Comprador", value: `<@${order.discord_user_id}>`, inline: true },
            ],
            timestamp: new Date().toISOString(),
          }],
        });

        // Log: Pedido aprovado
        await sendStoreLog(supabase, botToken, order.tenant_id, {
          title: "✅ Pedido aprovado",
          description: `Pedido **#${order.order_number}** aprovado por <@${userId}>.`,
          color: 0x57F287,
          fields: [
            { name: "**Detalhes**", value: `\`1x ${order.product_name} | ${formatBRL(order.total_cents)}\``, inline: false },
            { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
            { name: "**Comprador**", value: `<@${order.discord_user_id}>`, inline: false },
          ],
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
                  color: 0x2B2D31,
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
            color: 0x2B2D31,
            fields: [
              { name: "📦 Produto", value: order.product_name, inline: true },
              { name: "👤 Comprador", value: `<@${order.discord_user_id}>`, inline: true },
            ],
            timestamp: new Date().toISOString(),
          }],
        });

        // Log: Pedido recusado
        await sendStoreLog(supabase, botToken, order.tenant_id, {
          title: "🚫 Pedido recusado",
          description: `Pedido **#${order.order_number}** recusado por <@${userId}>.`,
          color: 0xED4245,
          fields: [
            { name: "**Detalhes**", value: `\`1x ${order.product_name} | ${formatBRL(order.total_cents)}\``, inline: false },
            { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
            { name: "**Comprador**", value: `<@${order.discord_user_id}>`, inline: false },
          ],
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
            color: 0x2B2D31,
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

        // Send loading message with product color
        const channelId = interaction.channel_id;
        const loadingColor = await resolveOrderEmbedColor(order) || 0x2B2D31;
        await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{ description: "⏳ | Gerando QR Code...\nQuase lá, só mais um instante!", color: loadingColor }],
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
        const cancelColor = await resolveOrderEmbedColor(order) || 0x2B2D31;
        await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{ title: "❌ Compra Cancelada", description: `Pedido **#${order.order_number}** foi cancelado.\nO tópico será arquivado.`, color: cancelColor }],
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

        // Log: Pedido cancelado pelo cliente
        await sendStoreLog(supabase, botToken, order.tenant_id, {
          title: "🗑️ Pedido cancelado",
          description: `Usuário <@${order.discord_user_id}> cancelou o pedido.`,
          color: 0xED4245,
          fields: [
            { name: "**Detalhes**", value: `\`1x ${order.product_name} | ${formatBRL(order.total_cents)}\``, inline: false },
            { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
          ],
        });

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
      }

      // ─── COPY PIX CODE (ephemeral) ────────────────────────
      if (customId.startsWith("copy_pix:")) {
        const orderId = customId.replace("copy_pix:", "");
        const { data: order } = await supabase.from("orders").select("payment_id, tenant_id, total_cents, product_name, order_number").eq("id", orderId).single();
        if (!order) return respondImmediate(interaction, "❌ Pedido não encontrado.");
        
        // Regenerate brcode for display
        const { data: tenant } = await supabase.from("tenants").select("name, pix_key").eq("id", order.tenant_id).single();
        if (tenant?.pix_key) {
          const brcode = generateStaticBRCode(tenant.pix_key, tenant.name || "Loja", order.total_cents / 100, `PED${order.order_number}`);
          return respondImmediate(interaction, `📋 **Código PIX Copia e Cola:**\n\`\`\`\n${brcode}\n\`\`\``);
        }
        return respondImmediate(interaction, "📋 O código PIX está na mensagem acima.");
      }

      // ─── COPY DELIVERED PRODUCT (ephemeral) ───────────────
      if (customId.startsWith("copy_delivered:")) {
        const orderId = customId.replace("copy_delivered:", "");
        const { data: order } = await supabase.from("orders").select("id, tenant_id, product_id, discord_user_id, order_number").eq("id", orderId).single();
        if (!order) return respondImmediate(interaction, "❌ Pedido não encontrado.");

        // Get delivered stock items for this order
        const { data: items } = await supabase
          .from("product_stock_items")
          .select("content")
          .eq("product_id", order.product_id)
          .eq("tenant_id", order.tenant_id)
          .eq("delivered_to", order.discord_user_id)
          .eq("delivered", true)
          .order("delivered_at", { ascending: false })
          .limit(10);

        if (!items || items.length === 0) {
          return respondImmediate(interaction, "❌ Nenhum conteúdo entregue encontrado para este pedido.");
        }

        const content = items.map((i: any) => i.content).join("\n");
        return respondImmediate(interaction, `📋 **Produto entregue:**\n\`\`\`\n${content}\n\`\`\``);
      }

      // ─── BUY AGAIN (link to server) ───────────────────────
      // This is handled as a Link button (style 5) so no handler needed here.

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
          .select("ticket_channel_id, ticket_staff_role_id, ticket_embed_title, ticket_embed_description, ticket_embed_color, ticket_embed_footer, ticket_logs_channel_id, ticket_embed_button_label, ticket_embed_button_style")
          .eq("tenant_id", ticketTenantId)
          .single();

        const guildId = tenant.discord_guild_id;

        // Check for existing open tickets
        const { data: existingTickets } = await supabase
          .from("tickets")
          .select("id, discord_channel_id")
          .eq("tenant_id", ticketTenantId)
          .eq("discord_user_id", userId)
          .in("status", ["open", "in_progress"]);

        let hasRealOpenTicket = false;
        if (existingTickets && existingTickets.length > 0) {
          for (const t of existingTickets) {
            if (!t.discord_channel_id) continue;
            try {
              const chRes = await fetch(`${DISCORD_API}/channels/${t.discord_channel_id}`, {
                headers: { Authorization: `Bot ${botToken}` },
              });
              if (chRes.ok) {
                hasRealOpenTicket = true;
                break;
              } else {
                await supabase.from("tickets").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", t.id);
              }
            } catch { /* ignore */ }
          }
        }

        if (hasRealOpenTicket) {
          await editFollowup(interaction, botToken, "⚠️ Você já possui um ticket aberto.");
          return ok();
        }

        // Determine parent channel for thread creation
        let parentChannelId = targetChannelId || storeConfig?.ticket_channel_id || interaction.channel_id;

        // If it's a category, find first text channel
        if (parentChannelId) {
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

        // Ensure the user can talk inside threads on the parent channel
        try {
          const threadSendPermission = (274877906944n).toString(); // SendMessagesInThreads
          const overwriteRes = await fetch(`${DISCORD_API}/channels/${parentChannelId}/permissions/${userId}`, {
            method: "PUT",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              allow: threadSendPermission,
              deny: "0",
              type: 1,
            }),
          });

          if (!overwriteRes.ok) {
            console.error("[TICKET_OPEN_BTN] Failed to set thread permission:", await overwriteRes.text());
          }
        } catch (e) {
          console.error("[TICKET_OPEN_BTN] Permission overwrite error:", e);
        }

        // Create private thread
        const ticketSuffix = Date.now().toString(36).slice(-4);
        const threadName = `ticket-${username || userId}-${ticketSuffix}`.toLowerCase().replace(/[^a-z0-9-_]/g, "").substring(0, 100);
        const createThreadRes = await fetch(`${DISCORD_API}/channels/${parentChannelId}/threads`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: threadName, type: 12, auto_archive_duration: 10080 }),
        });

        if (!createThreadRes.ok) {
          const errText = await createThreadRes.text();
          console.error("[TICKET_OPEN_BTN] Failed to create thread:", errText);
          await editFollowup(interaction, botToken, "❌ Não foi possível criar o ticket.");
          return ok();
        }

        const ticketThread = await createThreadRes.json();

        // Add the user to the thread
        await fetch(`${DISCORD_API}/channels/${ticketThread.id}/thread-members/${userId}`, {
          method: "PUT",
          headers: { Authorization: `Bot ${botToken}` },
        });

        const configuredStaffRoleIds = (storeConfig?.ticket_staff_role_id || "")
          .split(",")
          .map((roleId: string) => roleId.trim())
          .filter(Boolean);

        // Fallback: if explicit ticket staff roles are empty, use internal management roles
        let staffRoleIds = [...configuredStaffRoleIds];
        if (staffRoleIds.length === 0) {
          const managementRoleFilter = [
            "can_manage_app.eq.true",
            "can_manage_permissions.eq.true",
            "can_manage_store.eq.true",
            "can_manage_stock.eq.true",
            "can_manage_resources.eq.true",
            "can_manage_protection.eq.true",
          ].join(",");

          const { data: fallbackTenantRoles, error: fallbackRolesErr } = await supabase
            .from("tenant_roles")
            .select("discord_role_id")
            .eq("tenant_id", ticketTenantId)
            .or(managementRoleFilter);

          if (fallbackRolesErr) {
            console.warn("[TICKET_OPEN] failed to load fallback tenant roles:", fallbackRolesErr.message || fallbackRolesErr);
          } else {
            staffRoleIds = Array.from(
              new Set(
                (fallbackTenantRoles || [])
                  .map((r: any) => r?.discord_role_id)
                  .filter((rid: string | null) => typeof rid === "string" && rid.trim().length > 0)
                  .map((rid: string) => rid.trim())
              )
            );

            if (staffRoleIds.length > 0) {
              console.log(`[TICKET_OPEN] using fallback tenant_roles for staff (${staffRoleIds.length})`);
            }
          }
        }

        // Also include panel users with management permissions (direct user-based fallback)
        const managementUserFilter = [
          "can_manage_app.eq.true",
          "can_manage_permissions.eq.true",
          "can_manage_store.eq.true",
          "can_manage_stock.eq.true",
          "can_manage_resources.eq.true",
          "can_manage_protection.eq.true",
        ].join(",");

        const { data: panelStaffRows, error: panelStaffErr } = await supabase
          .from("tenant_permissions")
          .select("discord_user_id")
          .eq("tenant_id", ticketTenantId)
          .or(managementUserFilter);

        const panelStaffUserIds = panelStaffErr
          ? []
          : Array.from(
              new Set(
                (panelStaffRows || [])
                  .map((row: any) => row?.discord_user_id)
                  .filter((id: string | null) => typeof id === "string" && id.trim().length > 0)
                  .map((id: string) => id.trim())
              )
            );

        if (panelStaffErr) {
          console.warn("[TICKET_OPEN] failed to load panel staff users:", panelStaffErr.message || panelStaffErr);
        }

        // Add staff members to the private thread
        if (staffRoleIds.length > 0 || panelStaffUserIds.length > 0) {
          try {
            const [membersRes, rolesRes] = await Promise.all([
              fetch(`${DISCORD_API}/guilds/${guildId}/members?limit=1000`, {
                headers: { Authorization: `Bot ${botToken}` },
              }),
              fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
                headers: { Authorization: `Bot ${botToken}` },
              }),
            ]);

            if (membersRes.ok) {
              const members = await membersRes.json();

              let effectiveStaffRoleIds = new Set(staffRoleIds);

              if (rolesRes.ok) {
                const guildRoles = await rolesRes.json();
                const adminRoleIds = new Set(
                  (guildRoles || [])
                    .filter((role: any) => {
                      try {
                        return (BigInt(role?.permissions || "0") & BigInt(0x8)) === BigInt(0x8);
                      } catch {
                        return false;
                      }
                    })
                    .map((role: any) => String(role.id))
                );

                effectiveStaffRoleIds = new Set([...effectiveStaffRoleIds, ...adminRoleIds]);
              }

              const roleBasedStaffIds = Array.from(
                new Set(
                  (members || [])
                    .filter((m: any) => !m?.user?.bot)
                    .filter((m: any) => m?.user?.id && m.user.id !== userId)
                    .filter(
                      (m: any) =>
                        Array.isArray(m.roles) &&
                        m.roles.some((roleId: string) => effectiveStaffRoleIds.has(roleId))
                    )
                    .map((m: any) => m.user.id)
                )
              );

              const staffMemberIds = Array.from(
                new Set([
                  ...roleBasedStaffIds,
                  ...panelStaffUserIds.filter((id: string) => id && id !== userId),
                ])
              );

              for (const staffUserId of staffMemberIds) {
                const addRes = await fetch(`${DISCORD_API}/channels/${ticketThread.id}/thread-members/${staffUserId}`, {
                  method: "PUT",
                  headers: { Authorization: `Bot ${botToken}` },
                });

                if (!addRes.ok) {
                  const addErrText = await addRes.text();
                  console.warn(`[TICKET_OPEN] failed to add staff member ${staffUserId}: ${addRes.status} ${addErrText}`);
                }
              }

              console.log(`[TICKET_OPEN] staff auto-add attempted: ${staffMemberIds.length} users`);
            } else {
              const membersErr = await membersRes.text();
              console.warn(`[TICKET_OPEN] failed to list guild members: ${membersRes.status} ${membersErr}`);
            }
          } catch (staffAddErr) {
            console.error("[TICKET_OPEN] error while adding staff members:", staffAddErr);
          }
        } else {
          console.warn("[TICKET_OPEN] no staff roles/users configured for auto-add");
        }

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
        const embedColor = parseInt((storeConfig?.ticket_embed_color || "#2B2D31").replace("#", ""), 16);
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
        const staffMentions = staffRoleIds.map((rid: string) => `<@&${rid}>`).join(" ");
        const welcomeContent = staffMentions ? `<@${userId}> ${staffMentions}` : `<@${userId}>`;

        const welcomeMsgRes = await fetch(`${DISCORD_API}/channels/${ticketThread.id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content: welcomeContent,
            allowed_mentions: { users: [userId], roles: staffRoleIds },
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
        console.log(`[TICKET_REMIND] ticketId=${ticketId}`);
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
        const ticketIdDel = customId.replace("ticket_delete_", "");
        console.log(`[TICKET_DELETE] ticketId=${ticketIdDel}`);
        const { data: delTicket } = await supabase.from("tickets").select("tenant_id").eq("id", ticketIdDel).single();
        const delTenantId = delTicket?.tenant_id;
        
        const isStaffDel = delTenantId ? await checkTicketStaffPermission(supabase, botToken, delTenantId, interaction.guild_id, userId, interaction.member) : false;
        if (!isStaffDel) {
          return respondImmediate(interaction, "❌ Você não tem permissão para deletar tickets.");
        }

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
                color: 0x2B2D31,
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
        console.log(`[TICKET_ASSIGN] ticketId=${ticketId}, selectedUserId=${selectedUserId}`);
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

        if (channelId) {
          // Add user to the private thread as a member
          const addMemberRes = await fetch(`${DISCORD_API}/channels/${channelId}/thread-members/${selectedUserId}`, {
            method: "PUT",
            headers: { Authorization: `Bot ${botToken}` },
          });
          console.log(`[TICKET_ASSIGN] addMember status=${addMemberRes.status}`);

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

        // 🔒 Bloqueia clientes: somente staff (ADMINISTRATOR ou MANAGE_GUILD) pode confirmar
        const memberPerms = BigInt(interaction.member?.permissions || "0");
        const ADMIN = BigInt(0x8);
        const MANAGE_GUILD = BigInt(0x20);
        const isStaff = (memberPerms & ADMIN) === ADMIN || (memberPerms & MANAGE_GUILD) === MANAGE_GUILD;
        if (!isStaff) {
          return respondImmediate(interaction, "🔒 Apenas a equipe da loja pode confirmar a entrega deste pedido.");
        }

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
                color: 0x2B2D31,
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

        // Log: Entrega manual confirmada
        await sendStoreLog(supabase, botToken, order.tenant_id, {
          title: "📦 Entrega manual confirmada",
          description: `Pedido **#${order.order_number}** marcado como entregue por <@${userId}>.`,
          color: 0x57F287,
          fields: [
            { name: "**Detalhes**", value: `\`${order.product_name} | ${formatBRL(order.total_cents)}\``, inline: false },
            { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
            { name: "**Comprador**", value: `<@${order.discord_user_id}>`, inline: false },
          ],
        });

        return ok();
      }

      // ─── CANCEL MANUAL ORDER (button in delivery thread) ──
      if (customId.startsWith("cancel_manual_")) {
        const orderId = customId.replace("cancel_manual_", "");

        // 🔒 Bloqueia clientes: somente staff pode cancelar
        const memberPerms2 = BigInt(interaction.member?.permissions || "0");
        const ADMIN2 = BigInt(0x8);
        const MANAGE_GUILD2 = BigInt(0x20);
        const isStaff2 = (memberPerms2 & ADMIN2) === ADMIN2 || (memberPerms2 & MANAGE_GUILD2) === MANAGE_GUILD2;
        if (!isStaff2) {
          return respondImmediate(interaction, "🔒 Apenas a equipe da loja pode cancelar este pedido.");
        }

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

        // Log: Cancelamento manual pelo admin
        await sendStoreLog(supabase, botToken, order.tenant_id, {
          title: "⛔ Cancelamento manual",
          description: `Pedido **#${order.order_number}** cancelado manualmente por <@${userId}>.`,
          color: 0xED4245,
          fields: [
            { name: "**Detalhes**", value: `\`${order.product_name} | ${formatBRL(order.total_cents)}\``, inline: false },
            { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
            { name: "**Comprador**", value: `<@${order.discord_user_id}>`, inline: false },
          ],
        });

        return ok();
      }

      // ─── TICKET RENAME (modal to rename the channel) ──────────
      if (customId.startsWith("ticket_rename_")) {
        const ticketId = customId.replace("ticket_rename_", "");
        console.log(`[TICKET_RENAME] ticketId=${ticketId}, opening modal`);

        // Show a modal for the new name
        const modalRes = await fetch(`${DISCORD_API}/interactions/${interaction.id}/${interaction.token}/callback`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
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
        console.log(`[TICKET_RENAME] modal response status=${modalRes.status}`);
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
          // Check if transcript exists in storage
          const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(`transcripts/${ticket.tenant_id}/${ticket.id}.html`);
          if (urlData?.publicUrl) {
            await editFollowup(interaction, botToken, `📜 Acesse o transcript: ${urlData.publicUrl}`);
          } else {
            await editFollowup(interaction, botToken, "📜 O transcript está anexado como arquivo na mensagem acima. Clique no arquivo `.html` para visualizar.");
          }
          return ok();
        }

        const ticketName = `ticket-${ticket.discord_username || ticket.discord_user_id}`;
        const htmlTranscript = generateHtmlTranscript(msgs, serverName, ticketName, "Suporte · transcript");

        // Upload to storage for easy access
        let transcriptUrl: string | null = null;
        try {
          const fileName = `transcripts/${ticket.tenant_id}/${ticket.id}.html`;
          await supabase.storage.from("tenant-assets").upload(fileName, htmlTranscript, { contentType: "text/html", upsert: true });
          const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(fileName);
          transcriptUrl = urlData?.publicUrl || null;
        } catch {}

        if (transcriptUrl) {
          await editFollowup(interaction, botToken, `📜 Acesse o transcript: ${transcriptUrl}`);
        } else {
          // Fallback: send as ephemeral file
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
        }

        return ok();
      }

      if (customId.startsWith("ticket_close_")) {
        const ticketIdClose = customId.replace("ticket_close_", "");
        console.log(`[TICKET_CLOSE] ticketId=${ticketIdClose}`);
        const { data: closeTicketPerm } = await supabase.from("tickets").select("tenant_id").eq("id", ticketIdClose).single();
        const closeTenantId = closeTicketPerm?.tenant_id;
        
        const isStaffClose = closeTenantId ? await checkTicketStaffPermission(supabase, botToken, closeTenantId, interaction.guild_id, userId, interaction.member) : false;
        if (!isStaffClose) {
          return respondImmediate(interaction, "❌ Você não tem permissão para arquivar tickets.");
        }

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

      // ─── FEEDBACK BUTTON: opens rating modal ──────────────
      if (customId.startsWith("feedback_order:")) {
        const orderId = customId.replace("feedback_order:", "");

        const { data: existingFb } = await supabase
          .from("order_feedbacks")
          .select("id")
          .eq("order_id", orderId)
          .eq("discord_user_id", userId)
          .maybeSingle();

        if (existingFb) {
          return respondImmediate(interaction, "⭐ Você já avaliou esta compra. Obrigado!");
        }

        return new Response(JSON.stringify({
          type: 9,
          data: {
            custom_id: `feedback_modal:${orderId}`,
            title: "Avaliar sua compra",
            components: [
              {
                type: 1,
                components: [{
                  type: 4,
                  custom_id: "rating",
                  label: "Nota de 1 a 5 (estrelas)",
                  style: 1,
                  min_length: 1,
                  max_length: 1,
                  placeholder: "5",
                  required: true,
                }],
              },
              {
                type: 1,
                components: [{
                  type: 4,
                  custom_id: "comment",
                  label: "Comentário (opcional)",
                  style: 2,
                  max_length: 500,
                  placeholder: "Conte como foi sua experiência...",
                  required: false,
                }],
              },
            ],
          },
        }), { headers: { "Content-Type": "application/json" } });
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

      // ─── COUPON MODAL SUBMIT ─────────────────────────────
      if (customId.startsWith("coupon_modal_")) {
        const orderId = customId.replace("coupon_modal_", "");
        await respondDeferred(interaction, botToken);

        const couponCode = interaction.data?.components?.[0]?.components?.[0]?.value?.trim()?.toUpperCase();
        if (!couponCode) { await editFollowup(interaction, botToken, "❌ Código inválido."); return ok(); }

        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
        if (!order || order.status !== "pending_payment") {
          await editFollowup(interaction, botToken, "❌ Pedido não encontrado ou já processado.");
          return ok();
        }

        // Find coupon
        const { data: coupon } = await supabase
          .from("coupons")
          .select("*")
          .eq("tenant_id", order.tenant_id)
          .eq("code", couponCode)
          .eq("active", true)
          .single();

        if (!coupon) {
          await editFollowup(interaction, botToken, "❌ Cupom não encontrado ou inativo.");
          return ok();
        }

        if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
          await editFollowup(interaction, botToken, "❌ Este cupom atingiu o limite de uso.");
          return ok();
        }

        if (coupon.product_id && coupon.product_id !== order.product_id) {
          await editFollowup(interaction, botToken, "❌ Este cupom não é válido para este produto.");
          return ok();
        }

        // Calculate discount
        let discount = 0;
        if (coupon.type === "percent") {
          discount = Math.floor(order.total_cents * coupon.value / 100);
        } else {
          discount = coupon.value;
        }
        const newTotal = Math.max(0, order.total_cents - discount);

        // Update order
        await supabase.from("orders").update({ total_cents: newTotal, coupon_id: coupon.id }).eq("id", orderId);
        await supabase.from("coupons").update({ used_count: coupon.used_count + 1 }).eq("id", coupon.id);

        const channelId = interaction.channel_id;
        const couponColor = 0x57F287;
        // Send updated review in the thread
        await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: "🏷️ Cupom Aplicado!",
              description: `Cupom **${couponCode}** aplicado com sucesso!\n\n~~${formatBRL(order.total_cents)}~~ → **${formatBRL(newTotal)}**\nDesconto: **-${formatBRL(discount)}**`,
              color: couponColor,
            }],
          }),
        });

        await editFollowup(interaction, botToken, `✅ Cupom aplicado!`);

        // Log: Cupom aplicado
        await sendStoreLog(supabase, botToken, order.tenant_id, {
          title: "🏷️ Cupom aplicado",
          description: `Usuário <@${userId}> aplicou um cupom.`,
          fields: [
            { name: "**Cupom**", value: `\`${couponCode}\``, inline: true },
            { name: "**Desconto**", value: `\`-${formatBRL(discount)}\``, inline: true },
            { name: "**Novo Total**", value: `\`${formatBRL(newTotal)}\``, inline: true },
            { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
          ],
        });

        return ok();
      }

      // ─── QUANTITY MODAL SUBMIT ────────────────────────────
      if (customId.startsWith("quantity_modal_")) {
        const orderId = customId.replace("quantity_modal_", "");
        await respondDeferred(interaction, botToken);

        const qtyStr = interaction.data?.components?.[0]?.components?.[0]?.value?.trim();
        const qty = parseInt(qtyStr || "1");
        if (isNaN(qty) || qty < 1 || qty > 99) {
          await editFollowup(interaction, botToken, "❌ Quantidade inválida (1-99).");
          return ok();
        }

        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
        if (!order || order.status !== "pending_payment") {
          await editFollowup(interaction, botToken, "❌ Pedido não encontrado ou já processado.");
          return ok();
        }

        // Get original unit price
        let unitPrice = order.total_cents; // if qty was 1
        if (order.field_id) {
          const { data: field } = await supabase.from("product_fields").select("price_cents").eq("id", order.field_id).single();
          if (field) unitPrice = field.price_cents;
        } else if (order.product_id) {
          const { data: prod } = await supabase.from("products").select("price_cents").eq("id", order.product_id).single();
          if (prod) unitPrice = prod.price_cents;
        }

        const newTotal = unitPrice * qty;
        await supabase.from("orders").update({ total_cents: newTotal }).eq("id", orderId);

        const channelId = interaction.channel_id;
        const qtyColor = 0x2B2D31;
        await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: "✏️ Quantidade Atualizada",
              description: `Quantidade: **${qty}x**\nNovo total: **${formatBRL(newTotal)}**`,
              color: qtyColor,
            }],
          }),
        });

        await editFollowup(interaction, botToken, `✅ Quantidade atualizada para ${qty}x!`);

        // Log: Quantidade editada
        await sendStoreLog(supabase, botToken, order.tenant_id, {
          title: "✏️ Quantidade editada",
          description: `Usuário <@${userId}> alterou a quantidade do pedido.`,
          fields: [
            { name: "**Produto**", value: `\`${order.product_name}\``, inline: true },
            { name: "**Quantidade**", value: `\`${qty}x\``, inline: true },
            { name: "**Novo Total**", value: `\`${formatBRL(newTotal)}\``, inline: true },
            { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
          ],
        });

        return ok();
      }

      // ─── FEEDBACK MODAL SUBMIT ────────────────────────────
      if (customId.startsWith("feedback_modal:")) {
        const orderId = customId.replace("feedback_modal:", "");
        const ratingRaw = interaction.data?.components?.[0]?.components?.[0]?.value?.trim() || "";
        const comment = interaction.data?.components?.[1]?.components?.[0]?.value?.trim() || null;
        const rating = parseInt(ratingRaw);

        if (isNaN(rating) || rating < 1 || rating > 5) {
          return respondImmediate(interaction, "❌ Nota inválida. Use um número de 1 a 5.");
        }

        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
        if (!order) {
          return respondImmediate(interaction, "❌ Pedido não encontrado.");
        }

        const { error: insertErr } = await supabase.from("order_feedbacks").insert({
          tenant_id: order.tenant_id,
          order_id: order.id,
          discord_user_id: userId,
          discord_username: interaction.member?.user?.username || interaction.user?.username || null,
          rating,
          comment,
        });

        if (insertErr) {
          if (insertErr.code === "23505") {
            return respondImmediate(interaction, "⭐ Você já avaliou esta compra. Obrigado!");
          }
          return respondImmediate(interaction, `❌ Erro ao salvar avaliação: ${insertErr.message}`);
        }

        // Envia para o canal de logs da loja
        const stars = "⭐".repeat(rating) + "☆".repeat(5 - rating);
        await sendStoreLog(supabase, botToken, order.tenant_id, {
          title: "⭐ Nova avaliação recebida",
          description: `<@${userId}> avaliou o pedido **#${order.order_number}**.`,
          color: rating >= 4 ? 0x57F287 : rating === 3 ? 0xFEE75C : 0xED4245,
          fields: [
            { name: "**Nota**", value: `${stars} (${rating}/5)`, inline: true },
            { name: "**Produto**", value: `\`${order.product_name}\``, inline: true },
            { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
            ...(comment ? [{ name: "**Comentário**", value: comment, inline: false }] : []),
          ],
        });

        return respondImmediate(interaction, `✅ Obrigado pela sua avaliação de ${stars}!`);
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

// ─── Process Purchase: create order + checkout thread ────────
async function processPurchase(
  supabase: any,
  interaction: any,
  botToken: string,
  product: any,
  tenantId: string,
  userId: string,
  username: string,
  priceCents: number,
  guildId: string,
  channelId: string,
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

  // ─── FREE PRODUCT: deliver immediately without payment ────
  if (priceCents <= 0) {
    await supabase.from("orders").update({ 
      status: "paid", 
      payment_provider: "free",
      updated_at: new Date().toISOString() 
    }).eq("id", order.id);

    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/deliver-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ order_id: order.id }),
      });
    } catch (e) { console.error("Free delivery error:", e); }

    await editFollowup(interaction, botToken, `✅ Pedido **#${order.order_number}** — **${orderName}** entregue gratuitamente! Verifique sua DM.`);
    return;
  }

  // ─── Create private thread for checkout ───────────────────
  const threadName = `🛒 • ${username || userId} • ${order.order_number}`.substring(0, 100);

  const createThreadRes = await fetch(`${DISCORD_API}/channels/${channelId}/threads`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: threadName,
      type: 12, // GUILD_PRIVATE_THREAD
      auto_archive_duration: 1440, // 24h
    }),
  });

  if (!createThreadRes.ok) {
    const errText = await createThreadRes.text();
    console.error("Failed to create checkout thread:", errText);
    await editFollowup(interaction, botToken, "❌ Não foi possível criar o tópico de compra. Verifique as permissões do bot.");
    return;
  }

  const checkoutThread = await createThreadRes.json();

  // Store checkout thread ID on order
  await supabase.from("orders").update({ checkout_thread_id: checkoutThread.id }).eq("id", order.id);

  // Add buyer to thread
  await fetch(`${DISCORD_API}/channels/${checkoutThread.id}/thread-members/${userId}`, {
    method: "PUT",
    headers: { Authorization: `Bot ${botToken}` },
  });

  // Get store config for branding
  const { data: storeConfigForCheckout } = await supabase
    .from("store_configs")
    .select("store_logo_url, store_title, embed_color, payment_timeout_minutes, purchase_embed_footer")
    .eq("tenant_id", tenantId)
    .single();

  const { data: tenantInfo } = await supabase
    .from("tenants")
    .select("name, logo_url")
    .eq("id", tenantId)
    .single();

  const storeName = storeConfigForCheckout?.store_title || tenantInfo?.name || "Loja";
  const storeLogo = storeConfigForCheckout?.store_logo_url || tenantInfo?.logo_url;
  const productEmbedConfig = parseProductEmbedConfig(product.embed_config);
  const resolvedEmbedHex = resolveHexColor(productEmbedConfig.color, resolveHexColor(storeConfigForCheckout?.embed_color || "#5865F2"));
  const reviewEmbedColor = parseInt(resolvedEmbedHex.replace("#", ""), 16);

  // Get stock count
  let stockCount = "∞";
  if (fieldId) {
    const { count } = await supabase
      .from("product_stock_items")
      .select("id", { count: "exact", head: true })
      .eq("field_id", fieldId)
      .eq("tenant_id", tenantId)
      .eq("delivered", false);
    if (count !== null) stockCount = String(count);
  } else {
    // Count actual stock items for the product (global pool)
    const { count } = await supabase
      .from("product_stock_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", product.id)
      .eq("tenant_id", tenantId)
      .eq("delivered", false);
    if (count !== null) stockCount = String(count);
  }

  // Build description from product description
  const descLines: string[] = [];
  if (product.description) {
    descLines.push(product.description);
  }
  if (product.auto_delivery) {
    descLines.unshift("⚡ **Entrega Automática!**");
  }

  const checkoutDate = new Date().toLocaleDateString("pt-BR");
  const checkoutTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const reviewFooterText = applyPurchaseFooterTemplate(storeConfigForCheckout?.purchase_embed_footer, {
    storeName,
    productName: orderName,
    orderNumber: order.order_number,
    timeoutMin: storeConfigForCheckout?.payment_timeout_minutes || 30,
    date: checkoutDate,
    time: checkoutTime,
    username,
  }) || `${storeName} • ${checkoutDate} ${checkoutTime}`;

  // Send order review embed with buttons
  const reviewEmbed: any = {
    author: { name: username || userId, icon_url: `https://cdn.discordapp.com/embed/avatars/${(parseInt(userId) >> 22) % 6}.png` },
    title: "Revisão do Pedido",
    description: descLines.join("\n\n") || undefined,
    color: reviewEmbedColor,
    fields: [
      { name: "Valor à vista", value: formatBRL(priceCents), inline: true },
      { name: "📦 Em estoque", value: stockCount, inline: true },
    ],
    footer: {
      text: reviewFooterText,
      icon_url: storeLogo || undefined,
    },
  };

  // Always show cart field
  reviewEmbed.fields.unshift({ name: "🛒 Carrinho", value: `1x ${orderName}`, inline: false });

  if (product.banner_url) reviewEmbed.image = { url: product.banner_url };
  if (product.icon_url) reviewEmbed.thumbnail = { url: product.icon_url };

  await fetch(`${DISCORD_API}/channels/${checkoutThread.id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [reviewEmbed],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "Ir para o Pagamento", emoji: { name: "✅" }, custom_id: `checkout_pay:${order.id}` },
            { type: 2, style: 2, label: "Editar Quantidade", emoji: { name: "✏️" }, custom_id: `checkout_quantity:${order.id}` },
            { type: 2, style: 1, label: "Confirmar manualmente", emoji: { name: "🛠️" }, custom_id: `approve_order:${order.id}` },
          ],
        },
        {
          type: 1,
          components: [
            { type: 2, style: 2, label: "Usar Cupom", emoji: { name: "🏷️" }, custom_id: `checkout_coupon:${order.id}` },
            { type: 2, style: 4, label: "Cancelar", emoji: { name: "🗑️" }, custom_id: `checkout_cancel:${order.id}` },
          ],
        },
      ],
      allowed_mentions: { parse: [] },
    }),
  });

  // Tell the user to go to the thread with a link button
  const guildIdForLink = interaction.guild_id;
  const threadLink = `https://discord.com/channels/${guildIdForLink}/${checkoutThread.id}`;
  await editFollowup(interaction, botToken, {
    content: "✅ | Seu carrinho foi criado com êxito.",
    embeds: [],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5, // Link button
            label: "Ir para o carrinho",
            url: threadLink,
          },
        ],
      },
    ],
  });

  await sendStoreLog(supabase, botToken, tenantId, {
    title: "🛒 Carrinho aberto",
    description: `Usuário <@${userId}> abriu um carrinho.`,
    fields: [
      { name: "**Detalhes**", value: `\`1x ${orderName} | ${formatBRL(priceCents)}\``, inline: false },
      { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
    ],
  });
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

// ─── Generate PIX and send in checkout thread ───────────────
async function generatePixInThread(
  supabase: any,
  botToken: string,
  order: any,
  channelId: string,
  userId: string
) {
  const tenantId = order.tenant_id;
  const priceCents = order.total_cents;
  const orderName = order.product_name;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Check for active payment provider
  const { data: providers } = await supabase
    .from("payment_providers")
    .select("provider_key, api_key_encrypted, secret_key_encrypted, active, efi_cert_pem, efi_key_pem, efi_pix_key")
    .eq("tenant_id", tenantId)
    .eq("active", true);

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
    } else if (providerKey === "efi" || providerKey === "misticpay") {
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

    await supabase.from("orders").update({ payment_id: paymentId, payment_provider: providerKey }).eq("id", order.id);

    // Log: Pedido solicitado (gateway)
    await sendPixGeneratedLog(supabase, botToken, order, providerKey);
  } else {
    // Static PIX fallback
    const { data: tenant } = await supabase.from("tenants").select("name, pix_key, pix_key_type").eq("id", tenantId).single();
    if (!tenant?.pix_key) {
      await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [{ title: "❌ Erro", description: "Nenhum método de pagamento configurado.", color: 0xED4245 }] }),
      });
      return;
    }
    brcode = generateStaticBRCode(tenant.pix_key, tenant.name || "Loja", amountBRL, `PED${order.order_number}`);
    await supabase.from("orders").update({ payment_provider: "static_pix" }).eq("id", order.id);

    // Send admin notification
    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("logs_channel_id")
      .eq("tenant_id", tenantId)
      .single();

    if (storeConfig?.logs_channel_id) {
      await fetch(`${DISCORD_API}/channels/${storeConfig.logs_channel_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "🔔 Novo Pedido — PIX Estático",
            description: `Aguardando confirmação manual do pagamento.`,
            color: 0xFEE75C,
            fields: [
              { name: "📦 Produto", value: orderName, inline: true },
              { name: "💰 Valor", value: formatBRL(priceCents), inline: true },
              { name: "🔢 Pedido", value: `#${order.order_number}`, inline: true },
              { name: "👤 Comprador", value: `<@${order.discord_user_id}> (${order.discord_username})`, inline: false },
            ],
            timestamp: new Date().toISOString(),
          }],
          components: [{
            type: 1,
            components: [
              { type: 2, style: 3, label: "Aprovar Pagamento", emoji: { name: "✅" }, custom_id: `approve_order:${order.id}` },
              { type: 2, style: 4, label: "Recusar", emoji: { name: "❌" }, custom_id: `reject_order:${order.id}` },
            ],
          }],
        }),
      });
    }
  }

  // Get store branding
  const { data: scBrand } = await supabase
    .from("store_configs")
    .select("store_logo_url, store_title, payment_timeout_minutes, embed_color, purchase_embed_footer")
    .eq("tenant_id", tenantId)
    .single();

  const { data: tInfo } = await supabase.from("tenants").select("name, logo_url").eq("id", tenantId).single();
  const storeName = scBrand?.store_title || tInfo?.name || "Loja";
  const storeLogo = scBrand?.store_logo_url || tInfo?.logo_url;
  const timeoutMin = scBrand?.payment_timeout_minutes || 30;
  // Resolve product-specific color for PIX embed
  let embedColor = scBrand?.embed_color ? parseInt(scBrand.embed_color.replace("#", ""), 16) : 0x2B2D31;
  if (order.product_id) {
    const { data: pixProduct } = await supabase.from("products").select("embed_config").eq("id", order.product_id).single();
    if (pixProduct) {
      const pixEmbedConfig = parseProductEmbedConfig(pixProduct.embed_config);
      const pixHex = resolveHexColor(pixEmbedConfig.color, resolveHexColor(scBrand?.embed_color || "#5865F2"));
      embedColor = parseInt(pixHex.replace("#", ""), 16);
    }
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(brcode)}`;

  const paymentDate = new Date().toLocaleDateString("pt-BR");
  const paymentTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const pixFooterText = applyPurchaseFooterTemplate(scBrand?.purchase_embed_footer, {
    storeName,
    productName: order.product_name,
    orderNumber: order.order_number,
    timeoutMin,
    date: paymentDate,
    time: paymentTime,
    username: order.discord_username || userId,
  }) || `${storeName} – Pagamento expira em ${timeoutMin} minutos.\n• Hoje às ${paymentTime}`;

  // Send PIX embed in the thread
  const pixEmbed: any = {
    author: { name: order.discord_username || userId },
    title: "Pagamento via PIX criado",
    description: [
      "🟢 **Ambiente Seguro**",
      "Seu pagamento será processado em um ambiente 100% seguro e protegido.\n",
      "🟢 **Pagamento Instantâneo**",
      "Assim que o pagamento for confirmado, o seu pedido será processado imediatamente.\n",
      "**Código copia e cola**",
      `\`\`\`\n${brcode}\n\`\`\``,
    ].join("\n"),
    color: embedColor,
    image: { url: qrImageUrl },
    footer: {
      text: pixFooterText,
      icon_url: storeLogo || undefined,
    },
  };

  if (storeLogo) pixEmbed.thumbnail = { url: storeLogo };

  await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [pixEmbed],
      components: [{
        type: 1,
        components: [
          { type: 2, style: 2, label: "Código copia e cola", emoji: { name: "📋" }, custom_id: `copy_pix:${order.id}` },
          { type: 2, style: 4, label: "Cancelar", custom_id: `checkout_cancel:${order.id}` },
        ],
      }],
    }),
  });

  // Rename thread to show payment status
  try {
    await fetch(`${DISCORD_API}/channels/${channelId}`, {
      method: "PATCH",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `🛒 • ${order.discord_username || userId} • ${order.order_number}` }),
    });
  } catch {}

  // Log: Pedido solicitado (static pix) — only if no gateway log was sent above
  if (!activeProvider || amountBRL <= 0) {
    await sendPixGeneratedLog(supabase, botToken, order, "static_pix");
  }
}

// ─── Send "Pedido solicitado" log when PIX is generated ─────
async function sendPixGeneratedLog(
  supabase: any,
  botToken: string,
  order: any,
  providerKey: string,
) {
  const provLabel = providerKey === "pushinpay" ? "Pix – PushinPay"
    : providerKey === "efi" ? "Pix – Efi Bank"
    : providerKey === "mercadopago" ? "Pix – Mercado Pago"
    : providerKey === "misticpay" ? "Pix – Mistic Pay"
    : providerKey === "static_pix" ? "Pix – Estático"
    : `Pix – ${providerKey}`;

  await sendStoreLog(supabase, botToken, order.tenant_id, {
    title: "🆕 Pedido solicitado",
    description: `Usuário <@${order.discord_user_id}> solicitou um pedido.`,
    fields: [
      { name: "**Detalhes**", value: `\`1x ${order.product_name} | ${formatBRL(order.total_cents)}\``, inline: false },
      { name: "**ID do Pedido**", value: `\`${order.id}\``, inline: false },
      { name: "**Forma de Pagamento**", value: `\`💎 ${provLabel}\``, inline: false },
    ],
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
      // Upload transcript to Supabase Storage for direct browser viewing
      let transcriptUrl: string | null = null;
      try {
        const fileName = `transcripts/${ticket.tenant_id}/${ticket.id}.html`;
        const { error: uploadErr } = await supabase.storage
          .from("tenant-assets")
          .upload(fileName, htmlTranscript, {
            contentType: "text/html",
            upsert: true,
          });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(fileName);
          transcriptUrl = urlData?.publicUrl || null;
        } else {
          console.error("Transcript upload error:", uploadErr);
        }
      } catch (e) {
        console.error("Transcript storage error:", e);
      }

      const formData = new FormData();
      const blob = new Blob([htmlTranscript], { type: "text/html" });
      formData.append("files[0]", blob, `transcript-${ticket.discord_channel_id || ticket.id.slice(0, 8)}.html`);

      const msgPayload: any = {
        embeds: [logEmbed],
      };

      if (transcriptUrl) {
        // Use a Link button (style 5) that opens in the browser
        msgPayload.components = [{
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: "Ver transcript",
            emoji: { name: "📜" },
            url: transcriptUrl,
          }],
        }];
      } else {
        // Fallback to interactive button if upload failed
        msgPayload.components = [{
          type: 1,
          components: [{
            type: 2,
            style: 2,
            label: "Ver transcript",
            emoji: { name: "📜" },
            custom_id: `transcript_view_${ticket.id}`,
          }],
        }];
      }

      formData.append("payload_json", JSON.stringify(msgPayload));

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
