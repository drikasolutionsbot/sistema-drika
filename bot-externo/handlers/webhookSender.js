const { WebhookClient } = require("discord.js");

// Cache de webhooks por canal
const webhookCache = new Map();

/**
 * Envia mensagem via webhook com nome/avatar customizado do tenant
 * Fallback: envia via Bot API se webhook falhar
 */
async function sendWithIdentity(channel, tenant, options) {
  const botName = tenant?.bot_name || tenant?.name || "Drika Bot";
  const botAvatar = tenant?.bot_avatar_url || null;

  try {
    // Tenta pegar webhook do cache
    let webhook = webhookCache.get(channel.id);

    if (!webhook) {
      // Buscar webhooks existentes no canal
      const webhooks = await channel.fetchWebhooks().catch(() => null);
      const botUserId = channel.client.user?.id;
      const existing = webhooks?.find(
        (w) => w.name === "Drika Webhook" && w.token && (!botUserId || w.owner?.id === botUserId)
      );

      if (existing) {
        webhook = new WebhookClient({ id: existing.id, token: existing.token });
      } else {
        // Criar novo webhook
        const created = await channel.createWebhook({ name: "Drika Webhook" });
        webhook = new WebhookClient({ id: created.id, token: created.token });
      }

      webhookCache.set(channel.id, webhook);
    }

    // Enviar via webhook com identidade customizada
    const msg = await webhook.send({
      ...options,
      username: botName,
      avatarURL: botAvatar,
    });

    return msg;
  } catch (err) {
    webhookCache.delete(channel.id);
    console.error("Webhook send failed, falling back to channel.send:", err.message);
    // Fallback para envio direto
    return channel.send(options);
  }
}

module.exports = { sendWithIdentity };
