const { WebhookClient } = require("discord.js");
const { applyCdn } = require("../supabase");

// Cache de webhooks por canal-base (canal pai quando for tópico)
const webhookCache = new Map();

function resolveWebhookChannel(channel) {
  return channel?.isThread?.() ? channel.parent : channel;
}

async function resolveChannelWebhooks(channel) {
  const webhookChannel = resolveWebhookChannel(channel);

  if (typeof webhookChannel?.fetchWebhooks === "function") {
    return webhookChannel.fetchWebhooks();
  }

  return null;
}

/**
 * Resolve o avatar URL para o webhook.
 * Prioridade: bot_avatar_url do tenant → avatar real do bot Discord → omite (undefined)
 * NUNCA passa null — o Discord rejeita avatarURL: null e derruba o webhook.
 */
function resolveBotAvatarURL(tenant, client) {
  const tenantAvatar = applyCdn(tenant?.bot_avatar_url);
  if (tenantAvatar) return tenantAvatar;

  // Fallback: avatar real do bot no Discord
  const botDiscordAvatar = client?.user?.displayAvatarURL?.({ extension: "png", size: 256 });
  if (botDiscordAvatar) return botDiscordAvatar;

  // Não passa avatarURL se não tiver nenhum — Discord usa o default do webhook
  return undefined;
}

/**
 * Envia mensagem via webhook com nome/avatar customizado do tenant
 * Fallback: envia via Bot API se webhook falhar
 */
async function sendWithIdentity(channel, tenant, options) {
  const botName = tenant?.bot_name || tenant?.name || "Drika Bot";
  const botAvatarURL = resolveBotAvatarURL(tenant, channel?.client);
  const webhookChannel = resolveWebhookChannel(channel);
  const isThreadTarget = channel?.isThread?.();
  const cacheKey = webhookChannel?.id || channel?.id;

  // Monta payload base: omite avatarURL se undefined para evitar rejeição do Discord
  const webhookExtra = { username: botName };
  if (botAvatarURL) webhookExtra.avatarURL = botAvatarURL;
  if (isThreadTarget) webhookExtra.threadId = channel.id;

  try {
    let webhook = webhookCache.get(cacheKey);

    if (!webhook) {
      const webhooks = await resolveChannelWebhooks(channel).catch(() => null);
      const botUserId = channel.client.user?.id;
      const existing = webhooks?.find(
        (w) => w.name === "Drika Webhook" && w.token && (!botUserId || w.owner?.id === botUserId)
      );

      if (existing) {
        webhook = new WebhookClient({ id: existing.id, token: existing.token });
      } else {
        const created = await webhookChannel.createWebhook({ name: "Drika Webhook" });
        webhook = new WebhookClient({ id: created.id, token: created.token });
      }

      webhookCache.set(cacheKey, webhook);
    }

    return await webhook.send({ ...options, ...webhookExtra });
  } catch (err) {
    webhookCache.delete(cacheKey);
    console.error(`[webhookSender] Webhook falhou (${err.message}), tentando recriar...`);

    // Segunda tentativa: recriar o webhook do zero
    try {
      const webhooks2 = await resolveChannelWebhooks(channel).catch(() => null);
      const botUserId2 = channel.client.user?.id;
      // Remove webhooks antigos do Drika para evitar conflito
      if (webhooks2) {
        for (const w of webhooks2.values()) {
          if (w.name === "Drika Webhook" && w.token && (!botUserId2 || w.owner?.id === botUserId2)) {
            await w.delete("Recriando webhook corrompido").catch(() => {});
          }
        }
      }
      const created2 = await webhookChannel.createWebhook({ name: "Drika Webhook" });
      const webhook2 = new WebhookClient({ id: created2.id, token: created2.token });
      webhookCache.set(cacheKey, webhook2);
      return await webhook2.send({ ...options, ...webhookExtra });
    } catch (err2) {
      console.error(`[webhookSender] Segunda tentativa falhou (${err2.message}), usando channel.send sem identidade`);
      return channel.send(options);
    }
  }
}

async function editWithIdentity(channel, messageId, options) {
  const webhookChannel = resolveWebhookChannel(channel);
  const cacheKey = webhookChannel?.id || channel?.id;
  const isThreadTarget = channel?.isThread?.();

  try {
    let webhook = webhookCache.get(cacheKey);
    if (!webhook) return null;

    return await webhook.editMessage(messageId, {
      ...options,
      ...(isThreadTarget ? { threadId: channel.id } : {}),
    });
  } catch (err) {
    console.error("Webhook edit failed:", err.message);
    // Fallback if it was a normal message
    try {
      const msg = await channel.messages.fetch(messageId);
      if (msg && msg.edit) return await msg.edit(options);
    } catch (e) {}
    return null;
  }
}

module.exports = { sendWithIdentity, editWithIdentity };
