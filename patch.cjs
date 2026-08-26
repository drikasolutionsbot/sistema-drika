const fs = require('fs');
let content = fs.readFileSync('bot-externo/handlers/tickets.js', 'utf8');

const newFunc = `
// ── Open Ticket From Category (Select Menu) ──
async function openTicketCategory(interaction, tenant, categoryId) {
  try {
    await interaction.reply({ content: '<a:loading:1521565470686445678> Aguarde, abrindo ticket...', ephemeral: true });

    const userId = interaction.user.id;
    const username = interaction.user.username;

    const { data: category } = await supabase.from('ticket_categories').select('*').eq('id', categoryId).eq('tenant_id', tenant.id).maybeSingle();
    if (!category) return interaction.editReply({ content: '❌ Categoria não encontrada.' });

    const topicName = \`\${category.emoji || '🎫'} \${category.name}\`.trim();

    const existing = await getOpenTickets(tenant.id, userId);
    let realOpenCount = 0;
    for (const t of existing) {
      if (!t.discord_channel_id) continue;
      try {
        const ch = await interaction.client.channels.fetch(t.discord_channel_id);
        if (ch && !ch.archived) { realOpenCount++; }
        else { await closeTicket(t.id, 'system'); }
      } catch { await closeTicket(t.id, 'system'); }
    }

    if (realOpenCount >= 3) return interaction.editReply({ content: '⚠️ Você já possui 3 tickets abertos.' });

    const storeConfig = await getStoreConfig(tenant.id);
    let parentChannelId = storeConfig?.ticket_channel_id || interaction.channel.id;
    let staffRoleIds = filterTicketStaffRoleIds(normalizeRoleIds(storeConfig?.ticket_staff_role_id), storeConfig, tenant);

    const ticketSuffix = Date.now().toString(36).slice(-4);
    const safeUsername = username.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    const threadName = \`ticket-\${safeUsername}-\${ticketSuffix}\`.substring(0, 100);

    let ticketChannel;
    try {
      const parentCh = await interaction.guild.channels.fetch(parentChannelId).catch(() => null);
      const parentCategoryId = parentCh?.type === ChannelType.GuildCategory ? parentCh.id : parentCh?.parentId;

      const permissionOverwrites = [
        { id: interaction.guild.id, deny: ['ViewChannel'] },
        { id: userId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks'] },
        { id: interaction.client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels', 'ManageMessages'] }
      ];

      const guildRoles = interaction.guild.roles.cache;
      const validStaffRoleIds = staffRoleIds.filter(roleId => guildRoles.has(roleId));
      for (const roleId of validStaffRoleIds) {
        permissionOverwrites.push({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks'] });
      }

      ticketChannel = await interaction.guild.channels.create({
        name: threadName,
        type: ChannelType.GuildText,
        parent: parentCategoryId,
        permissionOverwrites,
        reason: 'Ticket de suporte',
      });
    } catch (err) {
      return interaction.editReply({ content: '❌ Erro ao criar canal. Verifique as permissões do bot e categorias.' });
    }

    const ticket = await createTicket({
      tenant_id: tenant.id, discord_user_id: userId, discord_username: username,
      discord_channel_id: ticketChannel.id, status: 'open', product_name: topicName, topic_name: topicName
    });

    const embedColor = parseInt((storeConfig?.ticket_embed_color || storeConfig?.embed_color || '#5865F2').replace('#', ''), 16);
    const btnStyle = 2; // Secondary

    const welcomeEmbed = new EmbedBuilder()
      .setTitle(\`\${category.emoji || '🎫'} Ticket de Suporte\`)
      .setDescription(\`**Tipo:** \${topicName}\\n\\n<@\${userId}>\\nSeu ticket foi criado com sucesso!\\nAguarde atendimento da nossa equipe.\`)
      .setColor(embedColor)
      .setTimestamp();

    applyDrikaCover(welcomeEmbed, tenant);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(\`ticket_remind_\${ticket.id}\`).setLabel('Lembrar').setStyle(btnStyle).setEmoji('1521188814498959481'),
      new ButtonBuilder().setCustomId(\`ticket_rename_\${ticket.id}\`).setLabel('Renomear').setStyle(btnStyle).setEmoji('1521192422753833244'),
      new ButtonBuilder().setCustomId(\`ticket_close_\${ticket.id}\`).setLabel('Arquivar').setStyle(2).setEmoji('1521192463044317376'),
      new ButtonBuilder().setCustomId(\`ticket_delete_\${ticket.id}\`).setLabel('Apagar').setStyle(4).setEmoji('1521192495516487932')
    );
    const row2 = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId(\`ticket_assign_\${ticket.id}\`).setPlaceholder('Selecione algum membro').setMinValues(1).setMaxValues(1)
    );

    const staffMentionContent = staffRoleIds.map((rid) => \`<@&\${rid}>\`).join(' ');
    const ghostContent = \`<@\${userId}> \${staffMentionContent}\`.trim();

    if (ghostContent) {
      ticketChannel.send({ content: ghostContent }).then(m => setTimeout(() => m.delete().catch(() => {}), 1500)).catch(() => {});
    }

    await sendWithIdentity(ticketChannel, tenant, { embeds: [welcomeEmbed], components: [row1, row2] });

    await interaction.editReply({
      content: \`<a:certopreto:1369628807929008228> Ticket criado! Acesse <#\${ticketChannel.id}>\`
    });
  } catch (e) {
    console.error('[openTicketCategory] error:', e);
    await interaction.editReply({ content: '❌ Ocorreu um erro interno.' }).catch(() => {});
  }
}
`;

content = content.replace('// ── Close Ticket ──', newFunc + '\n// ── Close Ticket ──');
content = content.replace('handleTranscriptView,', 'handleTranscriptView,\n  openTicketCategory,');
fs.writeFileSync('bot-externo/handlers/tickets.js', content);
console.log('Done!');
