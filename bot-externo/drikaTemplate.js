/**
 * Template oficial Drika - capa e configuracoes dos embeds do bot.
 * O banner so aparece se o cliente (plano Master) configurou explicitamente
 * o bot_banner_url no painel. Sem configuracao = sem banner.
 */

const { applyCdn } = require("./supabase");

let DRIKA_COVER_URL = process.env.DRIKA_COVER_URL || null;

function setGlobalCover(url) {
  DRIKA_COVER_URL = url;
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
    description: "Olá {user}, seja bem-vindo(a) ao **{server}**! 🥳\n\nVocê é nosso membro **#{memberCount}**.\n{user} foi convidado(a) por {inviter} e agora tem {invites} convites.\n\nAproveite sua estadia!",
  },
};

/**
 * Aplica capa em um EmbedBuilder (discord.js).
 * So aplica banner se o cliente (Master) configurou explicitamente
 * o bot_banner_url no painel. Sem configuracao = sem banner.
 */
function applyDrikaCover(embed, tenant = null) {
  if (!embed || typeof embed.setImage !== "function") return embed;

  const isMaster = tenant && typeof tenant.plan === "string" && tenant.plan.toLowerCase() === "master";

  // So aplica se o cliente configurou um banner proprio no painel
  if (isMaster && tenant.bot_banner_url) {
    embed.setImage(applyCdn(tenant.bot_banner_url));
  }
  // Sem banner configurado = sem imagem automatica

  return embed;
}

/**
 * Aplica template Drika completo (titulo + descricao + capa) em um EmbedBuilder.
 */
function applyDrikaTemplate(embed, type) {
  const tpl = DRIKA_TEMPLATES[type];
  if (!tpl || !embed) return embed;
  if (typeof embed.setTitle === "function") embed.setTitle(tpl.title);
  if (typeof embed.setDescription === "function") embed.setDescription(tpl.description);
  return embed;
}

module.exports = {
  setGlobalCover,
  DRIKA_COVER_URL,
  DRIKA_TEMPLATES,
  applyDrikaCover,
  applyDrikaTemplate,
};
