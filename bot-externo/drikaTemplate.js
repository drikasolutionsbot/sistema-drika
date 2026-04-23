/**
 * Template oficial Drika — capa, título e descrição fixos para TODOS os embeds do bot.
 * Os clientes podem editar cor lateral, footer, thumbnail, botões, nome e avatar do bot.
 * Mas a "capa" (image grande), título e descrição são SEMPRE estes valores.
 *
 * Para trocar a imagem oficial, edite apenas a constante DRIKA_COVER_URL abaixo.
 */

const DRIKA_COVER_URL = process.env.DRIKA_COVER_URL || null;

const DRIKA_TEMPLATES = {
  purchase: {
    title: "🛒 Compra Confirmada",
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
 */
function applyDrikaCover(embed) {
  if (DRIKA_COVER_URL && embed && typeof embed.setImage === "function") {
    embed.setImage(DRIKA_COVER_URL);
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
  if (DRIKA_COVER_URL && typeof embed.setImage === "function") embed.setImage(DRIKA_COVER_URL);
  return embed;
}

module.exports = {
  DRIKA_COVER_URL,
  DRIKA_TEMPLATES,
  applyDrikaCover,
  applyDrikaTemplate,
};
