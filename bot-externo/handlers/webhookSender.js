const { WebhookClient } = require("discord.js");

// Cache de webhooks por canal
const webhookCache = new Map();

async function resolveChannelWebhooks(channel) {
  if (typeof channel?.fetchWebhooks === "function") {
    return channel.fetchWebhooks();
  }

  if (typeof channel?.parent?.fetchWebhooks === "function") {
    return channel.parent.fetchWebhooks();
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

  try {
    let webhook = webhookCache.get(channel.id);

    if (!webhook) {
      const webhooks = await resolveChannelWebhooks(channel).catch(() => null);
      const botUserId = channel.client.user?.id;
      const existing = webhooks?.find(
        (w) => w.name === "Drika Webhook" && w.token && (!botUserId || w.owner?.id === botUserId)
      );

      if (existing) {
        webhook = new WebhookClient({ id: existing.id, token: existing.token });
      } else {
        const created = await channel.createWebhook({ name: "Drika Webhook" });
        webhook = new WebhookClient({ id: created.id, token: created.token });
      }

      webhookCache.set(channel.id, webhook);
    }

    return await webhook.send({
      ...options,
      username: botName,
      avatarURL: botAvatar,
    });
  } catch (err) {
    webhookCache.delete(channel.id);
    console.error("Webhook send failed, falling back to channel.send:", err.message);
    return channel.send(options);
  }
}

module.exports = { sendWithIdentity };
