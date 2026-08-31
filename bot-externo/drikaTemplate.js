/**
 * Template oficial Drika — capa, título e descrição fixos para TODOS os embeds do bot.
 * Os clientes podem editar cor lateral, footer, thumbnail, botões, nome e avatar do bot.
 * Mas a "capa" (image grande), título e descrição são SEMPRE estes valores.
 *
 * Para trocar a imagem oficial, edite apenas a constante DRIKA_COVER_URL abaixo.
 */

const { applyCdn } = require("./supabase");

let DRIKA_COVER_URL = process.env.DRIKA_COVER_URL || null;

function setGlobalCover(url) {
  DRIKA_COVER_URL = url;
  console.log(`[DRIKA_COVER] setGlobalCover chamado → ${url ? url.substring(0, 80) + '...' : 'null'}`);
}

const DRIKA_TEMPLATES = {
  purchase: {
    title: "<:car:1521242918290194493> Compra Confirmada",
    description: "Sua compra foi processada com sucesso! Confira os detalhes abaixo.",
  },
  ticket: {
    title: "🎫 Ticket de Suporte",
    description: "Seu ticket foi criado com sucesso! Aguarde atendimento da nossa equipe.",
  },
  verify: {
    title: "👑 Verificação",
    description: "Clique no botão abaixo para se verificar em nosso servidor.\nA verificação é necessária para liberar acesso aos canais.",
  },
  welcome: {
    title: "👋 Bem-vindo(a)!",
    description: "Olá **{username}**, seja bem-vindo(a) ao **{server}**! 🥳\n\nVocê é nosso membro **#{memberCount}**. Aproveite sua estadia!",
  },
};

/**
 * Aplica capa fixa Drika em um EmbedBuilder (discord.js).
 * Chamar SEMPRE depois das outras configurações para garantir override.
 *
 * Prioridade:
 *  1. Plano Master com bot_banner_url → banner personalizado do cliente
 *  2. Qualquer outro plano (free, pro) → capa global do bot (DRIKA_COVER_URL)
 */
function applyDrikaCover(embed, tenant = null) {
  if (!embed || typeof embed.setImage !== "function") return embed;

  const isMaster = tenant && typeof tenant.plan === "string" && tenant.plan.toLowerCase() === "master";
  const plan = tenant?.plan ?? "(sem tenant)";

  if (isMaster && tenant.bot_banner_url) {
    // Master com banner próprio → usa o banner do cliente
    console.log(`[DRIKA_COVER] Master com banner próprio → ${tenant.bot_banner_url.substring(0, 60)}`);
    embed.setImage(applyCdn(tenant.bot_banner_url));
  } else if (DRIKA_COVER_URL) {
    // Free / Pro (ou master sem banner) → aplica a capa global do bot
    console.log(`[DRIKA_COVER] Aplicando capa global (plano: ${plan}) → ${DRIKA_COVER_URL.substring(0, 60)}`);
    embed.setImage(applyCdn(DRIKA_COVER_URL));
  } else {
    console.warn(`[DRIKA_COVER] ⚠️ Nenhuma capa aplicada! DRIKA_COVER_URL=${DRIKA_COVER_URL}, plano=${plan}, master=${isMaster}`);
  }

  return embed;
}

/**
 * Aplica template Drika completo (título + descrição + capa) em um EmbedBuilder.
 */
function applyDrikaTemplate(embed, type) {
  const tpl = DRIKA_TEMPLATES[type];
  if (!tpl || !embed) return embed;
  if (typeof embed.setTitle === "function") embed.setTitle(tpl.title);
  if (typeof embed.setDescription === "function") embed.setDescription(tpl.description);
  
  // Here we don't have tenant, but this function is actually unused right now.
  if (DRIKA_COVER_URL && typeof embed.setImage === "function") embed.setImage(applyCdn(DRIKA_COVER_URL));
  return embed;
}

module.exports = {
  setGlobalCover,
  DRIKA_COVER_URL,
  DRIKA_TEMPLATES,
  applyDrikaCover,
  applyDrikaTemplate,
};
