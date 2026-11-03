/**
 * Template oficial Drika - configuracoes dos embeds do bot.
 * Banners so aparecem onde o cliente configurar explicitamente
 * no painel (ex: banner de produto, banner de ticket, banner de boas-vindas).
 * Nenhum banner e aplicado automaticamente por padrao.
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
 * Banners so aparecem onde o cliente configurou explicitamente na respectiva tela/funcionalidade.
 * Nao aplica nenhum banner global ou de perfil automaticamente.
 */
function applyDrikaCover(embed, tenant = null) {
  // Retorna o embed sem injetar nenhum banner automatico
  return embed;
}

/**
 * Aplica template Drika completo (titulo + descricao) em um EmbedBuilder.
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
