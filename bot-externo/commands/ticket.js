const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");
const { getStoreConfig } = require("../supabase");
const { sendWithIdentity } = require("../handlers/webhookSender");

// Parse emoji from button label (same logic as other commands)
function parseEmojiFromLabel(label) {
  const customMatch = label.match(/^<(a?):(\w+):(\d+)>\s*/);
  if (customMatch) {
    return {
      emoji: { id: customMatch[3], name: customMatch[2], animated: customMatch[1] === "a" },
      cleanLabel: label.slice(customMatch[0].length) || "Abrir Ticket",
    };
  }
  const unicodeMatch = label.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
  if (unicodeMatch) {
    return {
      emoji: { name: unicodeMatch[1] },
      cleanLabel: label.slice(unicodeMatch[0].length) || "Abrir Ticket",
    };
  }
  return { emoji: null, cleanLabel: label };
}

const styleMap = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  glass: ButtonStyle.Secondary,
  link: ButtonStyle.Secondary,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Enviar painel de tickets no canal atual"),

  async execute(interaction, tenant) {
    await interaction.deferReply({ ephemeral: true });

    const storeConfig = await getStoreConfig(tenant.id);
    const embedColor = parseInt((storeConfig?.ticket_embed_color || storeConfig?.embed_color || "#5865F2").replace("#", ""), 16);

    const embed = new EmbedBuilder()
      .setTitle(storeConfig?.ticket_embed_title || "🎫 Ticket de Suporte")
      .setDescription(storeConfig?.ticket_embed_description || "Clique no botão abaixo para abrir um ticket de suporte.")
      .setColor(embedColor);

    if (storeConfig?.ticket_embed_footer) embed.setFooter({ text: storeConfig.ticket_embed_footer });
    if (storeConfig?.ticket_embed_image_url) embed.setImage(storeConfig.ticket_embed_image_url);
    if (storeConfig?.ticket_embed_thumbnail_url) embed.setThumbnail(storeConfig.ticket_embed_thumbnail_url);

    // Parse button label & emoji
    const rawLabel = storeConfig?.ticket_embed_button_label || "📩 Abrir Ticket";
    const { emoji, cleanLabel } = parseEmojiFromLabel(rawLabel);

    // Use configured button style
    const btnStyle = styleMap[storeConfig?.ticket_embed_button_style || "glass"] || ButtonStyle.Secondary;

    const button = new ButtonBuilder()
      .setCustomId(`ticket_open_${tenant.id}_${interaction.channel.id}`)
      .setLabel(cleanLabel)
      .setStyle(btnStyle);

    if (emoji) button.setEmoji(emoji);

    const row = new ActionRowBuilder().addComponents(button);

    await sendWithIdentity(interaction.channel, tenant, { embeds: [embed], components: [row] });
    await interaction.editReply({ content: "✅ Painel de tickets enviado!" });
  },
};
