const {
  Client,
  GatewayIntentBits,
  Collection,
  ActivityType,
  Events,
} = require("discord.js");
require("dotenv").config();

const { getTenantByGuild, getGlobalBotConfig } = require("./supabase");

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
const interactionHandler = require("./events/interaction");
const memberJoinHandler = require("./events/memberJoin");
const protectionHandler = require("./events/protection");
const verificationHandler = require("./handlers/verification");

// ── Status polling ──
let lastAppliedStatus = null;
let lastForceReapplyAt = null;

function normalizeStatus(rawStatus) {
  const fallback = "/panel";
  if (!rawStatus || typeof rawStatus !== "string") return fallback;

  const firstLine = rawStatus
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return (firstLine || fallback).slice(0, 128);
}

const { setGlobalCover } = require("./drikaTemplate");

async function syncBotStatus() {
  try {
    const config = await getGlobalBotConfig();
    const status = normalizeStatus(config?.global_bot_status);
    if (config?.global_bot_banner_url) {
      setGlobalCover(config.global_bot_banner_url);
      if (client.user && typeof client.user.setBanner === "function") {
        try { 
          console.log("[BANNER] Tentando baixar banner para o perfil do bot...");
          const { applyCdn } = require("./supabase");
          const bannerUrl = applyCdn(config.global_bot_banner_url);
          const res = await fetch(bannerUrl);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            console.log(`[BANNER] Imagem baixada (${arrayBuffer.byteLength} bytes). Aplicando no Discord...`);
            await client.user.setBanner(Buffer.from(arrayBuffer));
            console.log("[BANNER] Capa de perfil do bot atualizada com sucesso!");
          } else {
            console.error(`[BANNER] Falha ao baixar imagem do CDN. Status: ${res.status}`);
          }
        } catch (e) { 
          console.error("Banner set err:", e.message); 
          if (e.message.includes('RATE_LIMIT')) {
            console.warn("[ALERTA] O Discord bloqueou a troca de capa do perfil por excesso de tentativas (Rate Limit). Você precisa esperar algumas horas.");
          }
        }
      }
    }

    if (config?.global_bot_banner_force_reapply_at) {
      if (lastForceReapplyAt !== null && lastForceReapplyAt !== config.global_bot_banner_force_reapply_at) {
        console.log("[BANNER] Detectada solicitação de reaplicação global do banner. Invocando edge function...");
        fetch(`${process.env.SUPABASE_URL}/functions/v1/sync-global-banner`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          }
        }).catch(err => console.error("[BANNER] Falha ao invocar edge function:", err.message));
      }
      lastForceReapplyAt = config.global_bot_banner_force_reapply_at;
    }

    if (status === lastAppliedStatus) return;

    client.user.setPresence({
      activities: [{ name: status, type: ActivityType.Playing }],
      status: "online",
    });
    lastAppliedStatus = status;
    console.log(`🔄 Status atualizado: "${status}"`);
  } catch (err) {
    console.error("Erro ao sincronizar status do bot:", err.message);
  }
}

// ── Ready ──
client.on(Events.ClientReady, async () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  console.log(`📡 Conectado em ${client.guilds.cache.size} servidor(es)`);

  // Sync status immediately
  await syncBotStatus();

  // Use Realtime instead of polling
  const { supabase } = require("./supabase");
  supabase
    .channel('global_config_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'landing_config' },
      () => {
        syncBotStatus();
      }
    )
    .subscribe();

  // Inicia listener de realtime do Supabase para enviar DMs de reabastecimento
  const { initRealtimeListeners } = require("./handlers/realtime");
  initRealtimeListeners(client);

  // Auto-draw para Sorteios Expirados a cada 1 minuto
  setInterval(async () => {
    try {
      const { data: expiredGiveaways } = await supabase
        .from("giveaways")
        .select("id, tenant_id")
        .eq("status", "active")
        .lte("ends_at", new Date().toISOString());

      if (expiredGiveaways && expiredGiveaways.length > 0) {
        console.log(`[SORTEIO] Encontrados ${expiredGiveaways.length} sorteios expirados para sortear automaticamente...`);
        for (const g of expiredGiveaways) {
          try {
            const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/manage-giveaways`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
              },
              body: JSON.stringify({ action: "draw", giveaway_id: g.id, tenant_id: g.tenant_id })
            });
            if (res.ok) {
              console.log(`[SORTEIO] Ganhadores sorteados com sucesso para o sorteio ${g.id} (tenant: ${g.tenant_id})`);
            } else {
              const text = await res.text();
              console.error(`[SORTEIO] Falha ao sortear ${g.id}: ${res.status} ${text}`);
            }
          } catch (e) {
            console.error(`[SORTEIO] Erro na requisição para sortear ${g.id}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.error("[SORTEIO] Erro ao buscar sorteios expirados:", e.message);
    }
  }, 60 * 1000);
});

// ── Ao entrar em um novo servidor ──
client.on(Events.GuildCreate, async (guild) => {
  console.log(`📥 Bot adicionado em: ${guild.name} (${guild.id})`);
  await syncBotStatus();
});

// ── Interactions (buttons, modals, select menus) ──
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

// ── Anti-Rogue Nuke Event Trackers ──
client.on(Events.ChannelCreate, async (channel) => {
  try {
    await protectionHandler.onChannelCreate(client, channel);
  } catch (err) {
    console.error("Erro na proteção (channel create):", err);
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
