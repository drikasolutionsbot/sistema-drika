const { EmbedBuilder } = require("discord.js");
const { supabase, getStoreConfig } = require("../supabase");
const { sendWithIdentity } = require("../handlers/webhookSender");
const { applyDrikaCover } = require("../drikaTemplate");

// ── Cache for welcome configs (TTL 30s) ──
const welcomeCache = new Map();
const CACHE_TTL = 30_000;

async function getWelcomeConfig(tenantId) {
  const cached = welcomeCache.get(tenantId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const { data } = await supabase
    .from("welcome_configs")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  welcomeCache.set(tenantId, { data, ts: Date.now() });
  return data;
}

// ── Replace placeholders ──
function replacePlaceholders(text, member) {
  if (!text) return text;
  return text
    .replace(/\{user\}/gi, `<@${member.user.id}>`)
    .replace(/\{username\}/gi, member.user.username)
    .replace(/\{displayname\}/gi, member.displayName || member.user.username)
    .replace(/\{server\}/gi, member.guild.name)
    .replace(/\{memberCount\}/gi, String(member.guild.memberCount))
    .replace(/\{avatar\}/gi, member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .replace(/\{user_id\}/gi, member.user.id)
    .replace(/\{guild_id\}/gi, member.guild.id);
}

// ── Build embed from config ──
function buildEmbed(embedData, member) {
  if (!embedData) return null;

  const color = parseInt((embedData.color || "#2B2D31").replace("#", ""), 16);
  const embed = new EmbedBuilder().setColor(color);

  if (embedData.title) embed.setTitle(replacePlaceholders(embedData.title, member));
  if (embedData.description) embed.setDescription(replacePlaceholders(embedData.description, member));

  if (embedData.thumbnail_url) {
    const thumbUrl = replacePlaceholders(embedData.thumbnail_url, member);
    if (thumbUrl) embed.setThumbnail(thumbUrl);
  }

  if (embedData.image_url) {
    const imgUrl = replacePlaceholders(embedData.image_url, member);
    if (imgUrl) embed.setImage(imgUrl);
  }

  if (embedData.footer_text) {
    const footer = { text: replacePlaceholders(embedData.footer_text, member) };
    if (embedData.footer_icon_url) footer.icon_url = replacePlaceholders(embedData.footer_icon_url, member);
    embed.setFooter(footer);
  }

  if (embedData.timestamp) embed.setTimestamp();

  if (Array.isArray(embedData.fields) && embedData.fields.length > 0) {
    for (const f of embedData.fields) {
      embed.addFields({
        name: replacePlaceholders(f.name, member),
        value: replacePlaceholders(f.value, member),
        inline: f.inline ?? false,
      });
    }
  }

  applyDrikaCover(embed, tenant);
  return embed;
}

// ── Member Join ──
module.exports = async function handleMemberJoin(client, member) {
  const tenant = await client.resolveTenant(member.guild.id);
  if (!tenant) return;

  // Verificação: adicionar cargo ao entrar (se verificação desativada)
  if (!tenant.verify_enabled && tenant.verify_role_id) {
    try {
      await member.roles.add(tenant.verify_role_id);
    } catch {}
  }

  // ── Welcome System ──
  const welcomeConfig = await getWelcomeConfig(tenant.id);
  if (!welcomeConfig || !welcomeConfig.enabled) return;

  // 1. Auto Role
  if (welcomeConfig.auto_role_enabled && welcomeConfig.auto_role_id) {
    try {
      await member.roles.add(welcomeConfig.auto_role_id);
    } catch (e) {
      console.error(`[welcome] Auto role error:`, e.message);
    }
  }

  // 2. Channel Welcome Message
  if (welcomeConfig.channel_enabled && welcomeConfig.channel_id) {
    try {
      const channel = await member.guild.channels.fetch(welcomeConfig.channel_id);
      if (channel) {
        const embed = buildEmbed(welcomeConfig.embed_data, member);
        const content = replacePlaceholders(welcomeConfig.content || "", member);

        const payload = {};
        if (content) payload.content = content;
        if (embed) payload.embeds = [embed];

        if (payload.content || payload.embeds) {
          await sendWithIdentity(channel, tenant, payload);
        }
      }
    } catch (e) {
      console.error(`[welcome] Channel message error:`, e.message);
    }
  }

  // 3. DM Welcome Message
  if (welcomeConfig.dm_enabled) {
    try {
      const embed = buildEmbed(welcomeConfig.dm_embed_data, member);
      const content = replacePlaceholders(welcomeConfig.dm_content || "", member);

      const payload = {};
      if (content) payload.content = content;
      if (embed) payload.embeds = [embed];

      if (payload.content || payload.embeds) {
        await member.send(payload).catch(() => {
          // DMs may be disabled
        });
      }
    } catch (e) {
      // Silently fail for DMs
    }
  }
};

// ── Member Leave (Goodbye) ──
module.exports.handleMemberLeave = async function handleMemberLeave(client, member) {
  const tenant = await client.resolveTenant(member.guild.id);
  if (!tenant) return;

  const welcomeConfig = await getWelcomeConfig(tenant.id);
  if (!welcomeConfig || !welcomeConfig.enabled || !welcomeConfig.goodbye_enabled) return;

  if (!welcomeConfig.goodbye_channel_id) return;

  try {
    const channel = await member.guild.channels.fetch(welcomeConfig.goodbye_channel_id);
    if (!channel) return;

    const embed = buildEmbed(welcomeConfig.goodbye_embed_data, member);
    const content = replacePlaceholders(welcomeConfig.goodbye_content || "", member);

    const payload = {};
    if (content) payload.content = content;
    if (embed) payload.embeds = [embed];

    if (payload.content || payload.embeds) {
      await sendWithIdentity(channel, tenant, payload);
    }
  } catch (e) {
    console.error(`[goodbye] Message error:`, e.message);
  }
};
