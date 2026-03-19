const { getProtectionSettings, logProtection } = require("../supabase");

// Rastreamento de anti-raid
const joinTracker = new Map(); // guildId -> [timestamps]

module.exports = {
  async onMemberJoin(client, member) {
    const tenant = await client.resolveTenant(member.guild.id);
    if (!tenant) return;

    const settings = await getProtectionSettings(tenant.id);
    const antiRaid = settings.find((s) => s.module_key === "anti_raid" && s.enabled);
    if (!antiRaid) return;

    const config = antiRaid.config || {};
    const maxJoins = config.max_joins || 10;
    const timeWindow = (config.time_window_seconds || 10) * 1000;
    const action = config.action || "kick";

    // Rastrear entradas
    const guildId = member.guild.id;
    if (!joinTracker.has(guildId)) joinTracker.set(guildId, []);
    const joins = joinTracker.get(guildId);
    const now = Date.now();
    joins.push(now);

    // Limpar antigos
    while (joins.length > 0 && now - joins[0] > timeWindow) {
      joins.shift();
    }

    // Verificar raid
    if (joins.length >= maxJoins) {
      console.log(`🚨 Anti-Raid ativado em ${member.guild.name}: ${joins.length} entradas em ${timeWindow / 1000}s`);

      try {
        if (action === "kick") {
          await member.kick("Anti-Raid: entrada em massa detectada");
        } else if (action === "ban") {
          await member.ban({ reason: "Anti-Raid: entrada em massa detectada" });
        }

        await logProtection(
          tenant.id,
          "anti_raid",
          action,
          member.id,
          member.user.username,
          { joins_in_window: joins.length, action }
        );
      } catch (err) {
        console.error("Erro ao executar anti-raid:", err);
      }
    }
  },

  async onMessage(client, message) {
    if (message.author.bot || !message.guild) return;

    const tenant = await client.resolveTenant(message.guild.id);
    if (!tenant) return;

    const settings = await getProtectionSettings(tenant.id);

    // Anti-Spam
    const antiSpam = settings.find((s) => s.module_key === "anti_spam" && s.enabled);
    if (antiSpam) {
      // Implementação básica: detectar mensagens repetidas rápidas
      const config = antiSpam.config || {};
      const maxMessages = config.max_messages || 5;
      const timeWindow = (config.time_window_seconds || 5) * 1000;

      // Cache simples por usuário
      const key = `spam_${message.guild.id}_${message.author.id}`;
      if (!client._spamCache) client._spamCache = new Map();
      if (!client._spamCache.has(key)) client._spamCache.set(key, []);

      const msgs = client._spamCache.get(key);
      msgs.push(Date.now());

      // Limpar antigos
      while (msgs.length > 0 && Date.now() - msgs[0] > timeWindow) {
        msgs.shift();
      }

      if (msgs.length >= maxMessages) {
        try {
          await message.member.timeout(60000, "Anti-Spam");
          await message.channel.send(
            `⚠️ ${message.author} silenciado por spam.`
          );
          await logProtection(
            tenant.id,
            "anti_spam",
            "timeout",
            message.author.id,
            message.author.username,
            { messages_in_window: msgs.length }
          );
          client._spamCache.delete(key);
        } catch {}
      }
    }

    // Anti-Link
    const antiLink = settings.find((s) => s.module_key === "anti_link" && s.enabled);
    if (antiLink) {
      const urlRegex = /(https?:\/\/[^\s]+)/gi;
      if (urlRegex.test(message.content)) {
        const config = antiLink.config || {};
        const allowedDomains = config.allowed_domains || [];
        const urls = message.content.match(urlRegex) || [];

        const hasBlocked = urls.some((url) => {
          try {
            const domain = new URL(url).hostname;
            return !allowedDomains.some((d) => domain.includes(d));
          } catch {
            return true;
          }
        });

        if (hasBlocked) {
          try {
            await message.delete();
            await message.channel.send({
              content: `⚠️ ${message.author}, links não são permitidos aqui.`,
            }).then((m) => setTimeout(() => m.delete().catch(() => {}), 5000));

            await logProtection(
              tenant.id,
              "anti_link",
              "delete_message",
              message.author.id,
              message.author.username,
              { content: message.content.slice(0, 200) }
            );
          } catch {}
        }
      }
    }
  },
};
