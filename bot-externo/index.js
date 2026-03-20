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

const { getTenantByGuild } = require("./supabase");

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

// ── Status polling ──
let lastAppliedStatus = null;

function normalizeStatus(rawStatus) {
  const fallback = "/panel";
  if (!rawStatus || typeof rawStatus !== "string") return fallback;

  const firstLine = rawStatus
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return (firstLine || fallback).slice(0, 128);
}

async function syncBotStatus() {
  const statusCandidates = [];

  for (const guild of client.guilds.cache.values()) {
    try {
      const tenant = await getTenantByGuild(guild.id);
      if (tenant) {
        tenantCache.set(guild.id, { data: tenant, ts: Date.now() });
      }

      statusCandidates.push({
        guildId: guild.id,
        status: normalizeStatus(tenant?.bot_status),
        updatedAt: tenant?.updated_at ? new Date(tenant.updated_at).getTime() : 0,
      });
    } catch (err) {
      console.error(`Erro ao sincronizar status para guild ${guild.id}:`, err.message);
    }
  }

  if (!statusCandidates.length) return;

  const selected = statusCandidates.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!selected?.status || selected.status === lastAppliedStatus) return;

  try {
    client.user.setPresence({
      activities: [{ name: selected.status, type: ActivityType.Playing }],
      status: "online",
    });
    lastAppliedStatus = selected.status;
    console.log(`🔄 Status atualizado (guild ${selected.guildId}): "${selected.status}"`);
  } catch (err) {
    console.error("Erro ao aplicar presença do bot:", err.message);
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

  // Sync status immediately and then every 15 seconds
  await syncBotStatus();
  setInterval(syncBotStatus, 15_000);
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
