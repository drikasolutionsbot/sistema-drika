const { WebhookClient } = require("discord.js");

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
 * Envia mensagem via webhook com nome/avatar customizado do tenant
 * Fallback: envia via Bot API se webhook falhar
 */
async function sendWithIdentity(channel, tenant, options) {
  const botName = tenant?.bot_name || tenant?.name || "Drika Bot";
  const botAvatar = tenant?.bot_avatar_url || null;
  const webhookChannel = resolveWebhookChannel(channel);
  const isThreadTarget = channel?.isThread?.();
  const cacheKey = webhookChannel?.id || channel?.id;

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

    return await webhook.send({
      ...options,
      username: botName,
      avatarURL: botAvatar,
      ...(isThreadTarget ? { threadId: channel.id } : {}),
    });
  } catch (err) {
    webhookCache.delete(cacheKey);
    console.error("Webhook send failed, falling back to channel.send:", err.message);
    return channel.send(options);
  }
}

module.exports = { sendWithIdentity };
