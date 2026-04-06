const { getProtectionSettings, getProtectionWhitelist, logProtection } = require("../supabase");

// ── Trackers (in-memory, per guild) ──
const joinTracker = new Map();       // guildId -> [timestamps]
const spamTracker = new Map();       // `guild_user` -> [{ts, content}]
const banTracker = new Map();        // `guild_executor` -> [timestamps]
const kickTracker = new Map();       // `guild_executor` -> [timestamps]
const channelDeleteTracker = new Map(); // `guild_executor` -> [timestamps]
const roleDeleteTracker = new Map();    // `guild_executor` -> [timestamps]

// ── Helpers ──
function getTracker(map, key) {
  if (!map.has(key)) map.set(key, []);
  return map.get(key);
}

function pruneOld(arr, windowMs) {
  const now = Date.now();
  while (arr.length > 0 && now - arr[0] > windowMs) arr.shift();
}

function pruneOldObjects(arr, windowMs) {
  const now = Date.now();
  while (arr.length > 0 && now - arr[0].ts > windowMs) arr.shift();
}

async function isWhitelisted(tenantId, userId, roleIds) {
  try {
    const whitelist = await getProtectionWhitelist(tenantId);
    if (!whitelist || whitelist.length === 0) return false;
    for (const entry of whitelist) {
      if (entry.type === "user" && entry.discord_id === userId) return true;
      if (entry.type === "role" && roleIds.includes(entry.discord_id)) return true;
    }
  } catch {}
  return false;
}

function getMemberRoleIds(member) {
  try {
    return member.roles?.cache?.map(r => r.id) || [];
  } catch { return []; }
}

// ── Actions ──
async function executeAction(action, member, reason, durationMin = 5) {
  if (!member) return;
  try {
    switch (action) {
      case "kick":
        await member.kick(reason);
        break;
      case "ban":
        await member.ban({ reason });
        break;
      case "mute":
      case "timeout":
        await member.timeout((durationMin || 5) * 60 * 1000, reason);
        break;
      case "warn":
        // Send a warning DM
        try { await member.send(`⚠️ **Aviso:** ${reason}`); } catch {}
        break;
      case "remove_roles":
        try {
          const roles = member.roles.cache.filter(r => r.id !== member.guild.id);
          await member.roles.remove(roles, reason);
        } catch {}
        break;
    }
  } catch (e) {
    console.error(`[protection] Action ${action} failed:`, e.message);
  }
}

// ═══════════════════════════════════════════
//  MEMBER JOIN — Anti-Raid + Anti-Token/Alt
// ═══════════════════════════════════════════
async function onMemberJoin(client, member) {
  const tenant = await client.resolveTenant(member.guild.id);
  if (!tenant) return;

  const settings = await getProtectionSettings(tenant.id);
  const guildId = member.guild.id;

  // ── Anti-Raid ──
  const antiRaid = settings.find(s => s.module_key === "anti_raid" && s.enabled);
  if (antiRaid) {
    const config = antiRaid.config || {};
    const maxJoins = config.join_threshold || 10;
    const timeWindow = (config.join_window || 10) * 1000;
    const action = config.action || "kick";

    const joins = getTracker(joinTracker, guildId);
    joins.push(Date.now());
    pruneOld(joins, timeWindow);

    if (joins.length >= maxJoins) {
      console.log(`🚨 Anti-Raid: ${joins.length} entradas em ${member.guild.name}`);

      if (!(await isWhitelisted(tenant.id, member.id, getMemberRoleIds(member)))) {
        await executeAction(action, member, "Anti-Raid: entrada em massa detectada");
        await logProtection(tenant.id, "anti_raid", action, member.id, member.user.username, {
          joins_in_window: joins.length, action,
        });
      }

      // Lockdown automático
      if (config.auto_lockdown) {
        try {
          const everyoneRole = member.guild.roles.everyone;
          await everyoneRole.setPermissions(everyoneRole.permissions.remove("SendMessages"), "Anti-Raid Lockdown");
          await logProtection(tenant.id, "anti_raid", "lockdown", null, null, { reason: "auto_lockdown" });
        } catch {}
      }
    }
  }

  // ── Anti-Token / Alt Detector ──
  const antiToken = settings.find(s => s.module_key === "anti_token" && s.enabled);
  if (antiToken) {
    const config = antiToken.config || {};
    const minAgeDays = config.min_account_age || 7;
    const noAvatarAction = config.no_avatar_action || "none";

    const accountAge = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);

    // Conta muito nova
    if (accountAge < minAgeDays) {
      if (!(await isWhitelisted(tenant.id, member.id, getMemberRoleIds(member)))) {
        await executeAction("kick", member, `Anti-Token: conta com ${Math.floor(accountAge)} dias (mínimo: ${minAgeDays})`);
        await logProtection(tenant.id, "anti_token", "kick", member.id, member.user.username, {
          account_age_days: Math.floor(accountAge), min_required: minAgeDays,
        });
        return;
      }
    }

    // Sem avatar
    if (noAvatarAction !== "none" && !member.user.avatar) {
      if (!(await isWhitelisted(tenant.id, member.id, getMemberRoleIds(member)))) {
        await executeAction(noAvatarAction, member, "Anti-Token: conta sem avatar");
        await logProtection(tenant.id, "anti_token", noAvatarAction, member.id, member.user.username, {
          reason: "no_avatar",
        });
      }
    }
  }
}

// ═══════════════════════════════════════════
//  MESSAGE — Anti-Spam, Anti-Link, Anti-Mention, Anti-Caps
// ═══════════════════════════════════════════
async function onMessage(client, message) {
  if (message.author.bot || !message.guild) return;

  const tenant = await client.resolveTenant(message.guild.id);
  if (!tenant) {
    console.log(`[protection] ❌ Tenant não encontrado para guild ${message.guild.id} (${message.guild.name})`);
    return;
  }

  const roleIds = getMemberRoleIds(message.member);
  const whitelisted = await isWhitelisted(tenant.id, message.author.id, roleIds);
  if (whitelisted) {
    console.log(`[protection] ⏭️ Usuário ${message.author.username} está na whitelist, ignorando`);
    return;
  }

  const settings = await getProtectionSettings(tenant.id);
  console.log(`[protection] 📋 Módulos carregados para ${message.guild.name}: ${settings.map(s => `${s.module_key}(${s.enabled ? 'ON' : 'OFF'})`).join(', ') || 'NENHUM'}`);
  console.log(`[protection] 📝 Mensagem de ${message.author.username}: "${message.content.slice(0, 100)}"`);

  // ── Anti-Spam ──
  const antiSpam = settings.find(s => s.module_key === "anti_spam" && s.enabled);
  if (antiSpam) {
    console.log(`[protection] 🔍 Anti-Spam ativo, verificando...`);
    const config = antiSpam.config || {};
    const maxMsgs = config.msg_threshold || 5;
    const timeWindow = (config.msg_window || 5) * 1000;
    const action = config.action || "mute";
    const muteDuration = config.mute_duration || 5;
    const deleteMessages = config.delete_messages !== false;
    const duplicateCheck = config.duplicate_check !== false;

    const key = `${message.guild.id}_${message.author.id}`;
    const msgs = getTracker(spamTracker, key);
    msgs.push({ ts: Date.now(), content: message.content });
    pruneOldObjects(msgs, timeWindow);

    let triggered = msgs.length >= maxMsgs;

    // Duplicate check: 3+ identical messages
    if (!triggered && duplicateCheck && msgs.length >= 3) {
      const last3 = msgs.slice(-3);
      if (last3.every(m => m.content === last3[0].content)) triggered = true;
    }

    if (triggered) {
      console.log(`[protection] 🚨 Anti-Spam TRIGGERED para ${message.author.username} (${msgs.length} msgs)`);
      try {
        if (deleteMessages) {
          try {
            const recent = await message.channel.messages.fetch({ limit: Math.min(msgs.length, 10) });
            const userMsgs = recent.filter(m => m.author.id === message.author.id);
            if (userMsgs.size > 1) await message.channel.bulkDelete(userMsgs).catch(e => console.error("[anti_spam] bulkDelete error:", e.message));
          } catch (e) { console.error("[anti_spam] Fetch/delete error:", e.message); }
        }

        await executeAction(action, message.member, "Anti-Spam", muteDuration);

        await message.channel.send(`⚠️ ${message.author} punido por spam.`)
          .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

        await logProtection(tenant.id, "anti_spam", action, message.author.id, message.author.username, {
          messages_in_window: msgs.length, action,
        });
        spamTracker.delete(key);
      } catch (e) { console.error("[anti_spam] Error:", e.message); }
    }
  }

  // ── Anti-Link ──
  const antiLink = settings.find(s => s.module_key === "anti_link" && s.enabled);
  if (antiLink) {
    const config = antiLink.config || {};
    const blockInvites = config.block_invites !== false;
    const blockExternal = config.block_external_links === true;
    const blockIpLoggers = config.block_ip_loggers !== false;
    const action = config.action || "delete";
    const allowedDomains = Array.isArray(config.allowed_domains) ? config.allowed_domains : 
      (typeof config.allowed_domains === "string" && config.allowed_domains ? config.allowed_domains.split(",").map(d => d.trim()) : []);

    const ipLoggerDomains = ["grabify.link", "iplogger.org", "2no.co", "iplogger.com", "iplogger.ru"];

    let shouldBlock = false;
    const content = message.content;

    // Discord invites
    if (blockInvites && /(discord\.gg|discord\.com\/invite)\//i.test(content)) {
      shouldBlock = true;
    }

    // External links
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = content.match(urlRegex) || [];

    if (urls.length > 0) {
      for (const url of urls) {
        try {
          const domain = new URL(url).hostname.toLowerCase();
          const isAllowed = allowedDomains.some(d => domain.includes(d.toLowerCase()));
          if (isAllowed) continue;

          if (blockIpLoggers && ipLoggerDomains.some(d => domain.includes(d))) {
            shouldBlock = true;
            break;
          }

          if (blockExternal && !domain.includes("discord.com") && !domain.includes("discord.gg")) {
            shouldBlock = true;
            break;
          }
        } catch {
          shouldBlock = true;
        }
      }
    }

    if (shouldBlock) {
      try {
        await message.delete().catch(() => {});

        const actionType = action.replace("delete", "").replace("_", "").trim();
        if (actionType === "warn" || action === "warn") {
          await message.channel.send(`⚠️ ${message.author}, links não são permitidos aqui.`)
            .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        } else if (actionType === "mute" || action === "mute") {
          await executeAction("mute", message.member, "Anti-Link", 5);
        } else if (actionType === "kick" || action === "kick") {
          await executeAction("kick", message.member, "Anti-Link");
        }

        await logProtection(tenant.id, "anti_link", action, message.author.id, message.author.username, {
          content: content.slice(0, 200),
        });
      } catch {}
    }
  }

  // ── Anti-Mention Spam ──
  const antiMention = settings.find(s => s.module_key === "anti_mention" && s.enabled);
  if (antiMention) {
    const config = antiMention.config || {};
    const maxMentions = config.max_mentions || 5;
    const action = config.action || "mute";
    const deleteMsgFlag = config.delete_message !== false;

    const totalMentions = (message.mentions.users?.size || 0) + (message.mentions.roles?.size || 0);

    if (totalMentions >= maxMentions) {
      try {
        if (deleteMsgFlag) await message.delete().catch(() => {});
        await executeAction(action, message.member, "Anti-Mention Spam", 5);

        await message.channel.send(`⚠️ ${message.author} punido por excesso de menções.`)
          .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

        await logProtection(tenant.id, "anti_mention", action, message.author.id, message.author.username, {
          mentions: totalMentions, max: maxMentions,
        });
      } catch {}
    }
  }

  // ── Anti-Caps Lock ──
  const antiCaps = settings.find(s => s.module_key === "auto_mod_caps" && s.enabled);
  if (antiCaps) {
    const config = antiCaps.config || {};
    const capsPercent = config.caps_percent || 70;
    const minLength = config.min_length || 8;
    const action = config.action || "delete";

    const text = message.content.replace(/[^a-zA-ZÀ-ÿ]/g, "");
    if (text.length >= minLength) {
      const upper = text.replace(/[^A-ZÀ-Ý]/g, "").length;
      const percent = (upper / text.length) * 100;

      if (percent >= capsPercent) {
        try {
          if (action === "delete" || action === "warn") {
            await message.delete().catch(() => {});
            if (action === "warn") {
              await message.channel.send(`⚠️ ${message.author}, evite usar muitas letras maiúsculas.`)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
            }
          } else if (action === "mute") {
            await message.delete().catch(() => {});
            await executeAction("mute", message.member, "Anti-Caps", 5);
          }

          await logProtection(tenant.id, "auto_mod_caps", action, message.author.id, message.author.username, {
            caps_percent: Math.round(percent), threshold: capsPercent,
          });
        } catch {}
      }
    }
  }
}

// ═══════════════════════════════════════════
//  AUDIT LOG — Anti-Mass Ban / Kick
// ═══════════════════════════════════════════
async function onGuildBanAdd(client, ban) {
  const tenant = await client.resolveTenant(ban.guild.id);
  if (!tenant) return;

  const settings = await getProtectionSettings(tenant.id);
  const mod = settings.find(s => s.module_key === "anti_massban" && s.enabled);
  if (!mod) return;

  const config = mod.config || {};
  const threshold = config.ban_threshold || 3;
  const window = (config.ban_window || 30) * 1000;
  const action = config.action || "remove_roles";

  // Try to find who did the ban via audit log
  try {
    const auditLogs = await ban.guild.fetchAuditLogs({ type: 22, limit: 1 }); // BAN type
    const entry = auditLogs.entries.first();
    if (!entry || entry.executor.bot && entry.executor.id === client.user.id) return;

    const executorId = entry.executor.id;
    if (await isWhitelisted(tenant.id, executorId, [])) return;

    const key = `${ban.guild.id}_${executorId}`;
    const bans = getTracker(banTracker, key);
    bans.push(Date.now());
    pruneOld(bans, window);

    if (bans.length >= threshold) {
      console.log(`🚨 Anti-Mass Ban: ${bans.length} bans por ${entry.executor.username}`);
      const executor = await ban.guild.members.fetch(executorId).catch(() => null);
      if (executor) {
        await executeAction(action, executor, "Anti-Mass Ban: banimentos em massa detectados");
      }

      // Restore banned user if configured
      if (config.restore_banned) {
        try { await ban.guild.bans.remove(ban.user.id, "Anti-Mass Ban: restauração"); } catch {}
      }

      await logProtection(tenant.id, "anti_massban", action, executorId, entry.executor.username, {
        bans_in_window: bans.length, target: ban.user.username,
      });
      banTracker.delete(key);
    }
  } catch (e) {
    console.error("[anti_massban] Error:", e.message);
  }
}

async function onGuildMemberRemove(client, member) {
  const tenant = await client.resolveTenant(member.guild.id);
  if (!tenant) return;

  const settings = await getProtectionSettings(tenant.id);
  const mod = settings.find(s => s.module_key === "anti_masskick" && s.enabled);
  if (!mod) return;

  const config = mod.config || {};
  const threshold = config.kick_threshold || 3;
  const window = (config.kick_window || 30) * 1000;
  const action = config.action || "remove_roles";

  try {
    const auditLogs = await member.guild.fetchAuditLogs({ type: 20, limit: 1 }); // KICK type
    const entry = auditLogs.entries.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (entry.target?.id !== member.id) return;
    if (entry.executor.bot && entry.executor.id === client.user.id) return;

    const executorId = entry.executor.id;
    if (await isWhitelisted(tenant.id, executorId, [])) return;

    const key = `${member.guild.id}_${executorId}`;
    const kicks = getTracker(kickTracker, key);
    kicks.push(Date.now());
    pruneOld(kicks, window);

    if (kicks.length >= threshold) {
      console.log(`🚨 Anti-Mass Kick: ${kicks.length} kicks por ${entry.executor.username}`);
      const executor = await member.guild.members.fetch(executorId).catch(() => null);
      if (executor) {
        await executeAction(action, executor, "Anti-Mass Kick: expulsões em massa detectadas");
      }

      await logProtection(tenant.id, "anti_masskick", action, executorId, entry.executor.username, {
        kicks_in_window: kicks.length, target: member.user.username,
      });
      kickTracker.delete(key);
    }
  } catch (e) {
    console.error("[anti_masskick] Error:", e.message);
  }
}

// ═══════════════════════════════════════════
//  AUDIT LOG — Anti-Channel Delete / Anti-Role Delete
// ═══════════════════════════════════════════
async function onChannelDelete(client, channel) {
  if (!channel.guild) return;
  const tenant = await client.resolveTenant(channel.guild.id);
  if (!tenant) return;

  const settings = await getProtectionSettings(tenant.id);
  const mod = settings.find(s => s.module_key === "anti_channel_delete" && s.enabled);
  if (!mod) return;

  const config = mod.config || {};
  const threshold = config.delete_threshold || 3;
  const window = (config.delete_window || 30) * 1000;
  const action = config.action || "remove_roles";

  try {
    const auditLogs = await channel.guild.fetchAuditLogs({ type: 12, limit: 1 }); // CHANNEL_DELETE
    const entry = auditLogs.entries.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (entry.executor.bot && entry.executor.id === client.user.id) return;

    const executorId = entry.executor.id;
    if (await isWhitelisted(tenant.id, executorId, [])) return;

    const key = `${channel.guild.id}_${executorId}`;
    const deletes = getTracker(channelDeleteTracker, key);
    deletes.push(Date.now());
    pruneOld(deletes, window);

    if (deletes.length >= threshold) {
      console.log(`🚨 Anti-Channel Delete: ${deletes.length} canais deletados por ${entry.executor.username}`);
      const executor = await channel.guild.members.fetch(executorId).catch(() => null);
      if (executor) {
        await executeAction(action, executor, "Anti-Nuke: exclusão em massa de canais");
      }

      await logProtection(tenant.id, "anti_channel_delete", action, executorId, entry.executor.username, {
        deletes_in_window: deletes.length, channel_name: channel.name,
      });
      channelDeleteTracker.delete(key);
    }
  } catch (e) {
    console.error("[anti_channel_delete] Error:", e.message);
  }
}

async function onRoleDelete(client, role) {
  if (!role.guild) return;
  const tenant = await client.resolveTenant(role.guild.id);
  if (!tenant) return;

  const settings = await getProtectionSettings(tenant.id);
  const mod = settings.find(s => s.module_key === "anti_role_delete" && s.enabled);
  if (!mod) return;

  const config = mod.config || {};
  const threshold = config.delete_threshold || 3;
  const window = (config.delete_window || 30) * 1000;
  const action = config.action || "remove_roles";

  try {
    const auditLogs = await role.guild.fetchAuditLogs({ type: 32, limit: 1 }); // ROLE_DELETE
    const entry = auditLogs.entries.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (entry.executor.bot && entry.executor.id === client.user.id) return;

    const executorId = entry.executor.id;
    if (await isWhitelisted(tenant.id, executorId, [])) return;

    const key = `${role.guild.id}_${executorId}`;
    const deletes = getTracker(roleDeleteTracker, key);
    deletes.push(Date.now());
    pruneOld(deletes, window);

    if (deletes.length >= threshold) {
      console.log(`🚨 Anti-Role Delete: ${deletes.length} cargos deletados por ${entry.executor.username}`);
      const executor = await role.guild.members.fetch(executorId).catch(() => null);
      if (executor) {
        await executeAction(action, executor, "Anti-Nuke: exclusão em massa de cargos");
      }

      await logProtection(tenant.id, "anti_role_delete", action, executorId, entry.executor.username, {
        deletes_in_window: deletes.length, role_name: role.name,
      });
      roleDeleteTracker.delete(key);
    }
  } catch (e) {
    console.error("[anti_role_delete] Error:", e.message);
  }
}

module.exports = {
  onMemberJoin,
  onMessage,
  onGuildBanAdd,
  onGuildMemberRemove,
  onChannelDelete,
  onRoleDelete,
};
