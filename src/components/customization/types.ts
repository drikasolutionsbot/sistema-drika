export interface EmbedField {
  id: string;
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedButton {
  id: string;
  label: string;
  emoji: string;
  style: "primary" | "secondary" | "success" | "danger" | "link" | "glass";
  url: string;
  enabled: boolean;
}

export interface EmbedData {
  color: string;
  author_name: string;
  author_icon_url: string;
  author_url: string;
  title: string;
  url: string;
  description: string;
  thumbnail_url: string;
  image_url: string;
  footer_text: string;
  footer_icon_url: string;
  timestamp: boolean;
  fields: EmbedField[];
  buttons: EmbedButton[];
}

export const defaultEmbed: EmbedData = {
  color: "#5865F2",
  author_name: "",
  author_icon_url: "",
  author_url: "",
  title: "Título do Embed",
  url: "",
  description: "Esta é a descrição do embed. Você pode usar **negrito**, *itálico* e outros formatos.",
  thumbnail_url: "",
  image_url: "",
  footer_text: "",
  footer_icon_url: "",
  timestamp: false,
  fields: [],
  buttons: [],
};

export interface EmbedTemplate {
  id: string;
  name: string;
  icon: string;
  data: EmbedData;
}

export const embedTemplates: EmbedTemplate[] = [
  {
    id: "welcome",
    name: "Boas-vindas",
    icon: "👋",
    data: {
      color: "#57F287",
      author_name: "",
      author_icon_url: "",
      author_url: "",
      title: "Bem-vindo(a) ao servidor! 🎉",
      url: "",
      description: "Ficamos felizes em ter você aqui! Confira os canais abaixo para começar.\n\n**📜 Regras** — Leia nossas regras\n**💬 Chat** — Converse com a comunidade\n**🎫 Tickets** — Precisa de ajuda?",
      thumbnail_url: "",
      image_url: "",
      footer_text: "Aproveite sua estadia!",
      footer_icon_url: "",
      timestamp: true,
      fields: [],
      buttons: [],
    },
  },
  {
    id: "purchase",
    name: "Compra",
    icon: "🛒",
    data: {
      color: "#FFD700",
      author_name: "",
      author_icon_url: "",
      author_url: "",
      title: "Compra Confirmada ✅",
      url: "",
      description: "Sua compra foi processada com sucesso! Confira os detalhes abaixo.",
      thumbnail_url: "",
      image_url: "",
      footer_text: "Obrigado pela compra!",
      footer_icon_url: "",
      timestamp: true,
      fields: [
        { id: "f1", name: "🛍️ Produto", value: "Nome do Produto", inline: true },
        { id: "f2", name: "💰 Valor", value: "R$ 0,00", inline: true },
        { id: "f3", name: "📦 Status", value: "Entregue", inline: true },
      ],
      buttons: [],
    },
  },
  {
    id: "ticket",
    name: "Ticket",
    icon: "🎫",
    data: {
      color: "#5865F2",
      author_name: "",
      author_icon_url: "",
      author_url: "",
      title: "Ticket Aberto 🎫",
      url: "",
      description: "Um novo ticket foi aberto. Aguarde atendimento de nossa equipe.\n\n> Por favor, descreva seu problema com detalhes para agilizar o atendimento.",
      thumbnail_url: "",
      image_url: "",
      footer_text: "Suporte",
      footer_icon_url: "",
      timestamp: true,
      fields: [
        { id: "f1", name: "👤 Aberto por", value: "{user}", inline: true },
        { id: "f2", name: "📋 Categoria", value: "Geral", inline: true },
      ],
      buttons: [],
    },
  },
  {
    id: "announcement",
    name: "Anúncio",
    icon: "📢",
    data: {
      color: "#ED4245",
      author_name: "",
      author_icon_url: "",
      author_url: "",
      title: "📢 Anúncio Importante",
      url: "",
      description: "Temos uma novidade para compartilhar com vocês!\n\nDescreva aqui o conteúdo do anúncio para a comunidade.",
      thumbnail_url: "",
      image_url: "",
      footer_text: "Equipe de Administração",
      footer_icon_url: "",
      timestamp: true,
      fields: [],
      buttons: [],
    },
  },
];
