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
const interactionHandler = require("./events/interaction");
const memberJoinHandler = require("./events/memberJoin");
const protectionHandler = require("./events/protection");

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

      // Setar status do bot baseado no tenant
      const tenant = await resolveTenant(guild.id);
      if (tenant?.bot_status) {
        client.user.setActivity(tenant.bot_status, { type: ActivityType.Playing });
      }
    } catch (err) {
      console.error(`Erro ao registrar comandos em ${guild.name}:`, err.message);
    }
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
  } catch (err) {
    console.error("Erro ao processar novo membro:", err);
  }
});

// ── Proteção anti-raid ──
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await protectionHandler.onMemberJoin(client, member);
  } catch (err) {
    console.error("Erro na proteção:", err);
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await protectionHandler.onMessage(client, message);
  } catch (err) {
    console.error("Erro na proteção de mensagem:", err);
  }
});

// ── Login ──
client.login(process.env.DISCORD_BOT_TOKEN).catch((err) => {
  console.error("❌ Falha ao fazer login:", err.message);
  process.exit(1);
});
