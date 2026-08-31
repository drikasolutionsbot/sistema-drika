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
 * Envia mensagem via webhook com nome/avatar customizado do tenant
 * Fallback: envia via Bot API se webhook falhar
 */
async function sendWithIdentity(channel, tenant, options) {
  const botName = tenant?.bot_name || tenant?.name || "Drika Bot";
  const botAvatar = applyCdn(tenant?.bot_avatar_url) || null;
  const webhookChannel = resolveWebhookChannel(channel);
  const isThreadTarget = channel?.isThread?.();
  const cacheKey = webhookChannel?.id || channel?.id;

  try {
    let webhook = webhookCache.get(cacheKey);

    if (!webhook) {
      const webhooks = await resolveChannelWebhooks(channel).catch(() => null);
      const botUserId = channel.client.user?.id;
      // Procura um webhook nosso no canal
      const existing = webhooks?.find(
        (w) => w.token && (!botUserId || w.owner?.id === botUserId)
      );

      if (existing) {
        webhook = existing; // Use the full Webhook object to allow editing
      } else {
        webhook = await webhookChannel.createWebhook({ name: botName.substring(0, 32) });
      }
      
      webhookCache.set(cacheKey, webhook);
    }

    // Burlação: O Discord remove a capa e biografia se usarmos `username` e `avatarURL` no .send().
    // Se nós alterarmos o NOME REAL do webhook, ele pode puxar o perfil do App nativamente.
    // Atualiza apenas se estiver diferente para evitar rate limits pesados do Discord.
    let needsUpdate = false;
    if (webhook.name !== botName.substring(0, 32)) needsUpdate = true;
    
    if (needsUpdate && typeof webhook.edit === "function") {
      try {
        await webhook.edit({ name: botName.substring(0, 32) });
      } catch (e) {
        console.warn("Failed to edit webhook name:", e.message);
      }
    }

    // Usa o WebhookClient para enviar caso o objeto não tenha o método send (se vier de cache puro)
    const whClient = new WebhookClient({ id: webhook.id, token: webhook.token });
    
    return await whClient.send({
      ...options,
      // REMOVIDO: username e avatarURL daqui. O webhook usará seu nome real editado acima.
      ...(isThreadTarget ? { threadId: channel.id } : {}),
    });
  } catch (err) {
    webhookCache.delete(cacheKey);
    console.error("Webhook send failed, falling back to channel.send:", err.message);
    return channel.send(options);
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
