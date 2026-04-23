const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  ActivityType,
  Events,
} = require("discord.js");
require("dotenv").config();

const { getTenantByGuild, getGlobalBotConfig, autoLinkGuildToPendingTenant } = require("./supabase");

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

// Cache de tenants por guild_id (TTL: 60s)
const tenantCache = new Map();
const CACHE_TTL = 60_000;

async function resolveTenant(guildId) {
  const cached = tenantCache.get(guildId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  const tenant = await getTenantByGuild(guildId);
  tenantCache.set(guildId, { data: tenant, ts: Date.now() });
  return tenant;
}

// ── Client ──
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.tenantCache = tenantCache;
client.resolveTenant = resolveTenant;

// ── Carregar handlers ──
const pingCommand = require("./commands/ping");
const lojaCommand = require("./commands/loja");
const comprarHandler = require("./commands/comprar");
const ticketCommand = require("./commands/ticket");
const painelCommand = require("./commands/painel");
const estoqueCommand = require("./commands/estoque");
const verificarCommand = require("./commands/verificar");
const sorteioCommand = require("./commands/sorteio");
const interactionHandler = require("./events/interaction");
const memberJoinHandler = require("./events/memberJoin");
const protectionHandler = require("./events/protection");
const verificationHandler = require("./handlers/verification");

// ── Status + identidade global polling ──
let lastAppliedStatus = null;
let lastAppliedUserBannerUrl = undefined;
let lastAppliedApplicationCoverUrl = undefined;
let lastAppliedGuildProfileBannerUrl = undefined;

function normalizeStatus(rawStatus) {
  const fallback = "/panel";
  if (!rawStatus || typeof rawStatus !== "string") return fallback;

  const firstLine = rawStatus
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return (firstLine || fallback).slice(0, 128);
}

async function fetchImageBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar banner: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") || "image/png",
  };
}

function toBase64DataUri(imageAsset) {
  if (!imageAsset?.buffer) return null;
  return `data:${imageAsset.contentType || "image/png"};base64,${imageAsset.buffer.toString("base64")}`;
}

async function updateBotUserBanner(imageAsset) {
  const banner = imageAsset ? toBase64DataUri(imageAsset) : null;

  await rest.patch(Routes.user(), {
    body: { banner },
  });
}

async function updateBotGuildProfileBanner(guildId, imageAsset) {
  const banner = imageAsset ? toBase64DataUri(imageAsset) : null;
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/@me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ banner }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status} ${errorText}`);
  }
}

async function syncGuildProfileBannerForAllGuilds(imageAsset) {
  const guilds = [...client.guilds.cache.values()];
  let syncedCount = 0;

  for (const guild of guilds) {
    try {
      await updateBotGuildProfileBanner(guild.id, imageAsset);
      syncedCount += 1;
    } catch (guildErr) {
      console.error(`❌ Falha ao aplicar banner do perfil do bot no servidor ${guild.name} (${guild.id}):`, guildErr?.message || guildErr);
    }
  }

  return syncedCount;
}

async function syncBotIdentity(forceGuildProfileBanner = false) {
  try {
    const config = await getGlobalBotConfig();
    const status = normalizeStatus(config?.global_bot_status);
    const bannerUrl = config?.global_bot_banner_url?.trim() || null;

    if (status !== lastAppliedStatus) {
      client.user.setPresence({
        activities: [{ name: status, type: ActivityType.Playing }],
        status: "online",
      });
      lastAppliedStatus = status;
      console.log(`🔄 Status atualizado: "${status}"`);
    }

    const shouldUpdateUserBanner = bannerUrl !== lastAppliedUserBannerUrl;
    const shouldUpdateApplicationCover = bannerUrl !== lastAppliedApplicationCoverUrl;
    const shouldUpdateGuildProfileBanner = forceGuildProfileBanner || bannerUrl !== lastAppliedGuildProfileBannerUrl;

    if (shouldUpdateUserBanner || shouldUpdateApplicationCover || shouldUpdateGuildProfileBanner) {
      const bannerAsset = bannerUrl ? await fetchImageBuffer(bannerUrl) : null;

      if (shouldUpdateUserBanner) {
        try {
          await updateBotUserBanner(bannerAsset);
          lastAppliedUserBannerUrl = bannerUrl;
          console.log(
            bannerUrl
              ? "🖼️ Banner do usuário do bot atualizado:"
              : "🖼️ Banner do usuário do bot removido.",
            bannerUrl || ""
          );
        } catch (bannerErr) {
          console.error("❌ Falha ao aplicar banner do usuário do bot:", bannerErr?.message || bannerErr);
          console.error("   Detalhes:", bannerErr?.code, bannerErr?.rawError);
        }
      }

      if (shouldUpdateApplicationCover) {
        try {
          const application = await client.application?.fetch();
          if (!application?.edit) {
            throw new Error("Aplicação do bot não disponível para edição");
          }

          await application.edit({ coverImage: bannerAsset?.buffer || null });
          lastAppliedApplicationCoverUrl = bannerUrl;
          console.log(
            bannerUrl
              ? "🖼️ Capa do aplicativo do bot atualizada:"
              : "🖼️ Capa do aplicativo do bot removida.",
            bannerUrl || ""
          );
        } catch (coverErr) {
          console.error("❌ Falha ao aplicar capa do aplicativo do bot:", coverErr?.message || coverErr);
          console.error("   Detalhes:", coverErr?.code, coverErr?.rawError);
        }
      }

      if (shouldUpdateGuildProfileBanner) {
        const syncedCount = await syncGuildProfileBannerForAllGuilds(bannerAsset);
        lastAppliedGuildProfileBannerUrl = bannerUrl;
        console.log(
          bannerUrl
            ? `🖼️ Banner do perfil do bot aplicado em ${syncedCount} servidor(es).`
            : `🖼️ Banner do perfil do bot removido em ${syncedCount} servidor(es).`
        );
      }
    }
  } catch (err) {
    console.error("Erro ao sincronizar identidade do bot:", err.message);
  }
}

// ── Ready ──
client.on(Events.ClientReady, async () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  console.log(`📡 Conectado em ${client.guilds.cache.size} servidor(es)`);

  // Registrar slash commands em cada guild
  const { SlashCommandBuilder } = require("discord.js");

  const commands = [
    pingCommand.data,
    lojaCommand.data,
    comprarHandler.data,
    ticketCommand.data,
    painelCommand.data,
    estoqueCommand.data,
    verificarCommand.data,
    sorteioCommand.data,
    // Moderation commands
    new SlashCommandBuilder().setName("clear").setDescription("Limpa todas as mensagens do canal"),
    new SlashCommandBuilder().setName("ban").setDescription("Bane um usuário do servidor")
      .addUserOption(o => o.setName("usuario").setDescription("Usuário para banir").setRequired(true))
      .addStringOption(o => o.setName("motivo").setDescription("Motivo do ban")),
    new SlashCommandBuilder().setName("kick").setDescription("Expulsa um usuário do servidor")
      .addUserOption(o => o.setName("usuario").setDescription("Usuário para expulsar").setRequired(true))
      .addStringOption(o => o.setName("motivo").setDescription("Motivo da expulsão")),
    new SlashCommandBuilder().setName("fechar").setDescription("Fecha o ticket atual"),
  ];

  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), {
        body: commands,
      });
      console.log(`📝 Comandos registrados em: ${guild.name}`);
    } catch (err) {
      console.error(`Erro ao registrar comandos em ${guild.name}:`, err.message);
    }
  }

  // Sync identidade global imediatamente e depois a cada 15 segundos
  await syncBotIdentity(true);
  setInterval(syncBotIdentity, 15_000);
});
// ── Ao entrar em um novo servidor, registrar os comandos ──
client.on(Events.GuildCreate, async (guild) => {
  console.log(`📥 Bot adicionado em: ${guild.name} (${guild.id})`);
  const { SlashCommandBuilder } = require("discord.js");

  const commands = [
    pingCommand.data,
    lojaCommand.data,
    comprarHandler.data,
    ticketCommand.data,
    painelCommand.data,
    estoqueCommand.data,
    verificarCommand.data,
    sorteioCommand.data,
    new SlashCommandBuilder().setName("clear").setDescription("Limpa todas as mensagens do canal"),
    new SlashCommandBuilder().setName("ban").setDescription("Bane um usuário do servidor")
      .addUserOption(o => o.setName("usuario").setDescription("Usuário para banir").setRequired(true))
      .addStringOption(o => o.setName("motivo").setDescription("Motivo do ban")),
    new SlashCommandBuilder().setName("kick").setDescription("Expulsa um usuário do servidor")
      .addUserOption(o => o.setName("usuario").setDescription("Usuário para expulsar").setRequired(true))
      .addStringOption(o => o.setName("motivo").setDescription("Motivo da expulsão")),
    new SlashCommandBuilder().setName("fechar").setDescription("Fecha o ticket atual"),
  ];

  try {
    const resolveOwnerDiscordId = async () => {
      if (guild.ownerId) return guild.ownerId;

      try {
        const owner = await guild.fetchOwner();
        if (owner?.id) return owner.id;
      } catch (ownerError) {
        console.error(`Erro ao resolver owner do servidor ${guild.name}:`, ownerError.message);
      }

      try {
        await guild.fetch();
        if (guild.ownerId) return guild.ownerId;
      } catch (guildError) {
        console.error(`Erro ao atualizar dados do servidor ${guild.name}:`, guildError.message);
      }

      return null;
    };

    let linkedTenant = await autoLinkGuildToPendingTenant({
      guildId: guild.id,
      guildName: guild.name,
      ownerDiscordId: await resolveOwnerDiscordId(),
    });

    if (!linkedTenant) {
      linkedTenant = await autoLinkGuildToPendingTenant({
        guildId: guild.id,
        guildName: guild.name,
        ownerDiscordId: null,
      });
    }

    if (linkedTenant) {
      console.log(`🔗 Servidor ${guild.name} vinculado automaticamente ao tenant ${linkedTenant.name}`);
      tenantCache.delete(guild.id);
    }

    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), {
      body: commands,
    });
    console.log(`📝 Comandos registrados no novo servidor: ${guild.name}`);

    await syncBotStatus();
  } catch (err) {
    console.error(`Erro ao registrar comandos em ${guild.name}:`, err.message);
  }
});

// ── Interactions (slash commands + buttons) ──
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await interactionHandler(client, interaction);
  } catch (err) {
    console.error("Erro na interação:", err);
    const reply = { content: "❌ Ocorreu um erro ao processar esta ação.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

// ── Member Join (verificação, boas-vindas) ──
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await memberJoinHandler(client, member);
    // Handle verification-specific logic
    const tenant = await resolveTenant(member.guild.id);
    if (tenant) await verificationHandler.onMemberJoin(client, member, tenant);
  } catch (err) {
    console.error("Erro ao processar novo membro:", err);
  }
});

// ── Member Leave (despedida) ──
client.on(Events.GuildMemberRemove, async (member) => {
  try {
    if (memberJoinHandler.handleMemberLeave) {
      await memberJoinHandler.handleMemberLeave(client, member);
    }
  } catch (err) {
    console.error("Erro ao processar saída de membro:", err);
  }
});

// ── Proteção ──
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await protectionHandler.onMemberJoin(client, member);
  } catch (err) {
    console.error("Erro na proteção (join):", err);
  }
});

client.on(Events.MessageCreate, async (message) => {
  // DEBUG: Log every message event to verify the event fires
  console.log(`[DEBUG] MessageCreate: guild=${message.guild?.name || 'DM'} | author=${message.author.username} | bot=${message.author.bot} | content="${(message.content || '').slice(0, 80)}"`);
  try {
    await protectionHandler.onMessage(client, message);
  } catch (err) {
    console.error("Erro na proteção (message):", err);
  }
});

// Anti-Mass Ban
client.on(Events.GuildBanAdd, async (ban) => {
  try {
    await protectionHandler.onGuildBanAdd(client, ban);
  } catch (err) {
    console.error("Erro na proteção (ban):", err);
  }
});

// Anti-Mass Kick (via member remove + audit log)
client.on(Events.GuildMemberRemove, async (member) => {
  try {
    await protectionHandler.onGuildMemberRemove(client, member);
  } catch (err) {
    console.error("Erro na proteção (kick):", err);
  }
});

// Anti-Channel Delete
client.on(Events.ChannelDelete, async (channel) => {
  try {
    await protectionHandler.onChannelDelete(client, channel);
  } catch (err) {
    console.error("Erro na proteção (channel delete):", err);
  }
});

// Anti-Role Delete
client.on(Events.GuildRoleDelete, async (role) => {
  try {
    await protectionHandler.onRoleDelete(client, role);
  } catch (err) {
    console.error("Erro na proteção (role delete):", err);
  }
});

// ── Login ──
client.login(process.env.DISCORD_BOT_TOKEN).catch((err) => {
  console.error("❌ Falha ao fazer login:", err.message);
  process.exit(1);
});
