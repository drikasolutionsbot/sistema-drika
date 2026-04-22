const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getTenantByGuild } = require("../supabase");

const data = new SlashCommandBuilder()
  .setName("verificar")
  .setDescription("Envia o embed de verificação no canal atual");

async function execute(interaction, tenant) {
  if (!tenant) {
    return interaction.reply({ content: "❌ Servidor não configurado.", ephemeral: true });
  }

  if (!tenant.verify_enabled) {
    return interaction.reply({ content: "⚠️ A verificação está desativada neste servidor.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const { DRIKA_TEMPLATES, DRIKA_COVER_URL } = require("../drikaTemplate");
    const title = DRIKA_TEMPLATES.verify.title;
    const description = DRIKA_TEMPLATES.verify.description;
    const color = parseInt((tenant.verify_embed_color || "#5865F2").replace("#", ""), 16);
    const buttonLabel = tenant.verify_button_label || "Verificar";
    const buttonStyleRaw = tenant.verify_button_style || "primary";

    // Parse emoji from button label
    let cleanLabel = buttonLabel;
    let emoji = null;

    const customMatch = buttonLabel.match(/^<(a?):(\w+):(\d+)>\s*/);
    if (customMatch) {
      emoji = { id: customMatch[3], name: customMatch[2], animated: customMatch[1] === "a" };
      cleanLabel = buttonLabel.slice(customMatch[0].length) || "Verificar";
    } else {
      const unicodeMatch = buttonLabel.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
      if (unicodeMatch) {
        emoji = { name: unicodeMatch[1] };
        cleanLabel = buttonLabel.slice(unicodeMatch[0].length) || "Verificar";
      }
    }

    // Build verification URL
    const verifyUrl = tenant.verify_slug
      ? `https://www.drikahub.com/verify/${tenant.verify_slug}`
      : `https://www.drikahub.com/verify/${tenant.id}`;

    // Build embed (capa fixa Drika)
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setImage(DRIKA_COVER_URL);

    // Build button (Link style = 5)
    const button = new ButtonBuilder()
      .setLabel(cleanLabel)
      .setStyle(ButtonStyle.Link)
      .setURL(verifyUrl);

    if (emoji) {
      button.setEmoji(emoji);
    }

    const row = new ActionRowBuilder().addComponents(button);

    // Send to current channel
    await interaction.channel.send({ embeds: [embed], components: [row] });

    await interaction.editReply({ content: "✅ Embed de verificação enviado com sucesso!" });
  } catch (err) {
    console.error("Erro ao enviar embed de verificação:", err);
    await interaction.editReply({ content: `❌ Erro ao enviar: ${err.message}` });
  }
}

module.exports = { data, execute };
