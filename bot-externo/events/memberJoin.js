const { EmbedBuilder } = require("discord.js");
const { supabase, getStoreConfig, getChannelConfig, applyCdn } = require("../supabase");
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
function buildEmbed(embedData, member, tenant) {
  if (!embedData) return null;

  let fallbackColor = embedData.color || "#FF69B4";
  if (fallbackColor.toUpperCase() === "#2B2D31") fallbackColor = "#FF69B4";
  const color = parseInt(fallbackColor.replace("#", ""), 16);
  const embed = new EmbedBuilder().setColor(color);

  if (embedData.title) embed.setTitle(replacePlaceholders(embedData.title, member));
  if (embedData.description) embed.setDescription(replacePlaceholders(embedData.description, member));

  if (embedData.thumbnail_url) {
    const thumbUrl = applyCdn(replacePlaceholders(embedData.thumbnail_url, member));
    if (thumbUrl) embed.setThumbnail(thumbUrl);
  }

  if (embedData.image_url) {
    const imgUrl = applyCdn(replacePlaceholders(embedData.image_url, member));
    if (imgUrl) embed.setImage(imgUrl);
  }

  if (embedData.footer_text) {
    const footer = { text: replacePlaceholders(embedData.footer_text, member) };
    if (embedData.footer_icon_url) footer.iconURL = applyCdn(replacePlaceholders(embedData.footer_icon_url, member));
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

  // A capa (global ou do master) sempre sobrepõe qualquer image_url do embed config
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
  const welcomeConfig = await getWelcomeConfig(tenant.id) || {};

  // 1. Auto Role
  if (welcomeConfig.auto_role_enabled && welcomeConfig.auto_role_id) {
    try {
      await member.roles.add(welcomeConfig.auto_role_id);
    } catch (e) {
      console.error(`[welcome] Auto role error:`, e.message);
    }
  }

  // ── Log de Entrada (channel_configs: member_join) ──
  try {
    const joinConf = await getChannelConfig(tenant.id, "member_join");
    if (joinConf && joinConf.discord_channel_id) {
      const joinChannel = await member.guild.channels.fetch(joinConf.discord_channel_id).catch(() => null);
      if (joinChannel) {
        const payload = {};
        
        if (joinConf.embed_config) {
          const embed = buildEmbed(joinConf.embed_config, member, tenant);
          if (embed) payload.embeds = [embed];
        } else {
          const joinEmbed = new EmbedBuilder()
            .setColor("#3ba55c")
            .setAuthor({ name: "Membro Entrou", iconURL: member.user.displayAvatarURL() || undefined })
            .setDescription(`**${member.user.username}** (\`${member.user.id}\`) entrou no servidor.`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }) || null)
            .addFields({ name: "Conta criada em", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` })
            .setTimestamp();
          
          applyDrikaCover(joinEmbed, tenant);
          payload.embeds = [joinEmbed];
        }

        const contentStr = joinConf.content ? replacePlaceholders(joinConf.content, member) : "";
        if (contentStr) payload.content = contentStr;

        if (payload.content || payload.embeds) {
          await sendWithIdentity(joinChannel, tenant, payload);
        }
      }
    }
  } catch (e) {
    console.error(`[memberJoin] Log error:`, e.message);
  }

  // 2. Channel Welcome Message
  try {
    const welcomeConf = await getChannelConfig(tenant.id, "welcome");
    const targetChannelId = (welcomeConf && welcomeConf.discord_channel_id) || (welcomeConfig.channel_enabled ? welcomeConfig.channel_id : null);
    if (targetChannelId) {
      const channel = await member.guild.channels.fetch(targetChannelId).catch(()=>null);
      if (channel) {
        const finalEmbedData = (welcomeConf && welcomeConf.embed_config) ? welcomeConf.embed_config : welcomeConfig.embed_data;
        const finalContentText = (welcomeConf && welcomeConf.content !== undefined && welcomeConf.content !== null) ? welcomeConf.content : welcomeConfig.content;
        
        const embed = buildEmbed(finalEmbedData, member, tenant);
        const content = replacePlaceholders(finalContentText || "", member);

        const payload = {};
        if (content) payload.content = content;
        if (embed) payload.embeds = [embed];

        if (payload.content || payload.embeds) {
          await sendWithIdentity(channel, tenant, payload);
        }
      }
    }
  } catch (e) {
    console.error(`[welcome] Channel message error:`, e.message);
  }

  // 3. DM Welcome Message
  if (welcomeConfig.dm_enabled) {
    try {
      const embed = buildEmbed(welcomeConfig.dm_embed_data, member, tenant);
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

  // ── Log de Saída (channel_configs: member_leave) ──
  try {
    const leaveConf = await getChannelConfig(tenant.id, "member_leave");
    if (leaveConf && leaveConf.discord_channel_id) {
      const leaveChannel = await member.guild.channels.fetch(leaveConf.discord_channel_id).catch(() => null);
      if (leaveChannel) {
        const payload = {};
        
        if (leaveConf.embed_config) {
          const embed = buildEmbed(leaveConf.embed_config, member, tenant);
          if (embed) payload.embeds = [embed];
        } else {
          const leaveEmbed = new EmbedBuilder()
            .setColor("#ed4245")
            .setAuthor({ name: "Membro Saiu", iconURL: member.user.displayAvatarURL() || undefined })
            .setDescription(`**${member.user.username}** (\`${member.user.id}\`) saiu do servidor.`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }) || null)
            .addFields({ name: "Entrou em", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Desconhecido" })
            .setTimestamp();
          
          applyDrikaCover(leaveEmbed, tenant);
          payload.embeds = [leaveEmbed];
        }

        const contentStr = leaveConf.content ? replacePlaceholders(leaveConf.content, member) : "";
        if (contentStr) payload.content = contentStr;

        if (payload.content || payload.embeds) {
          await sendWithIdentity(leaveChannel, tenant, payload);
        }
      }
    }
  } catch (e) {
    console.error(`[memberLeave] Log error:`, e.message);
  }

  const welcomeConfig = await getWelcomeConfig(tenant.id) || {};
  const goodbyeChannelId = welcomeConfig.goodbye_enabled ? welcomeConfig.goodbye_channel_id : null;
  if (!goodbyeChannelId) return;

  try {
    const channel = await member.guild.channels.fetch(goodbyeChannelId).catch(()=>null);
    if (!channel) return;

    const embed = buildEmbed(welcomeConfig.goodbye_embed_data, member, tenant);
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
