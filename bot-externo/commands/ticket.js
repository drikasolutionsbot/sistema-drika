const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const { getStoreConfig } = require("../supabase");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Enviar painel de tickets no canal atual"),

  async execute(interaction, tenant) {
    const storeConfig = await getStoreConfig(tenant.id);

    const embedColor = parseInt(
      (storeConfig?.ticket_embed_color || "#5865F2").replace("#", ""),
      16
    );

    const embed = new EmbedBuilder()
      .setTitle(storeConfig?.ticket_embed_title || "🎫 Ticket de Suporte")
      .setDescription(
        storeConfig?.ticket_embed_description ||
          "Clique no botão abaixo para abrir um ticket de suporte."
      )
      .setColor(embedColor);

    if (storeConfig?.ticket_embed_footer) {
      embed.setFooter({ text: storeConfig.ticket_embed_footer });
    }
    if (storeConfig?.ticket_embed_image_url) {
      embed.setImage(storeConfig.ticket_embed_image_url);
    }
    if (storeConfig?.ticket_embed_thumbnail_url) {
      embed.setThumbnail(storeConfig.ticket_embed_thumbnail_url);
    }

    const button = new ButtonBuilder()
      .setCustomId("open_ticket")
      .setLabel(storeConfig?.ticket_embed_button_label || "📩 Abrir Ticket")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: "✅ Painel de tickets enviado!", ephemeral: true });
  },

  async openTicket(interaction, tenant) {
    await interaction.deferReply({ ephemeral: true });

    const storeConfig = await getStoreConfig(tenant.id);
    const guild = interaction.guild;
    const member = interaction.member;

    // Verificar se já tem ticket aberto
    const existingChannel = guild.channels.cache.find(
      (c) => c.name === `ticket-${member.user.username}` && c.type === ChannelType.GuildText
    );

    if (existingChannel) {
      return interaction.editReply({
        content: `❌ Você já tem um ticket aberto: ${existingChannel}`,
      });
    }

    // Criar canal do ticket
    const permissionOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
    ];

    // Adicionar staff role se configurado
    if (storeConfig?.ticket_staff_role_id) {
      permissionOverwrites.push({
        id: storeConfig.ticket_staff_role_id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    }

    const ticketChannel = await guild.channels.create({
      name: `ticket-${member.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites,
    });

    // Mensagem inicial do ticket
    const embed = new EmbedBuilder()
      .setTitle("🎫 Ticket Aberto")
      .setDescription(
        `Olá ${member}! Descreva sua dúvida ou problema.\nUm membro da equipe irá te atender em breve.`
      )
      .setColor(0x5865f2)
      .setTimestamp();

    const closeBtn = new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("🔒 Fechar Ticket")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeBtn);
    await ticketChannel.send({ embeds: [embed], components: [row] });

    await interaction.editReply({
      content: `✅ Ticket criado: ${ticketChannel}`,
    });
  },

  async closeTicket(interaction, tenant) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.channel;
    if (!channel.name.startsWith("ticket-")) {
      return interaction.editReply({ content: "❌ Este canal não é um ticket." });
    }

    await interaction.editReply({ content: "🔒 Fechando ticket em 5 segundos..." });

    setTimeout(async () => {
      try {
        await channel.delete("Ticket fechado");
      } catch (err) {
        console.error("Erro ao deletar ticket:", err);
      }
    }, 5000);
  },
};
