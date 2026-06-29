const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { applyDrikaCover } = require("../drikaTemplate");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sorteio")
    .setDescription("Gerencia sorteios no servidor")
    .addSubcommand(sub =>
      sub.setName("criar")
        .setDescription("Cria um novo sorteio")
        .addStringOption(o => o.setName("titulo").setDescription("Título do sorteio").setRequired(true))
        .addStringOption(o => o.setName("premio").setDescription("Prêmio do sorteio").setRequired(true))
        .addIntegerOption(o => o.setName("duracao").setDescription("Duração em minutos").setRequired(true).setMinValue(1).setMaxValue(43200))
        .addIntegerOption(o => o.setName("vencedores").setDescription("Número de vencedores").setMinValue(1).setMaxValue(20))
        .addStringOption(o => o.setName("descricao").setDescription("Descrição do sorteio"))
        .addRoleOption(o => o.setName("cargo_requerido").setDescription("Cargo necessário para participar"))
    )
    .addSubcommand(sub =>
      sub.setName("sortear")
        .setDescription("Sorteia os vencedores de um sorteio ativo")
        .addStringOption(o => o.setName("id").setDescription("ID do sorteio (use /sorteio listar)").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("listar")
        .setDescription("Lista os sorteios ativos")
    )
    .addSubcommand(sub =>
      sub.setName("cancelar")
        .setDescription("Cancela um sorteio")
        .addStringOption(o => o.setName("id").setDescription("ID do sorteio").setRequired(true))
    ),

  async execute(interaction, client) {
    const tenant = await client.resolveTenant(interaction.guild.id);
    if (!tenant) {
      return interaction.reply({ content: "❌ Servidor não configurado.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const invokeEdge = async (body) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/manage-giveaways`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ ...body, tenant_id: tenant.id }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      return data;
    };

    // ── Criar ──
    if (sub === "criar") {
      await interaction.reply({ content: "<a:carregadeira:1515809475922100426> Criando sorteio...", ephemeral: true });

      try {
        const titulo = interaction.options.getString("titulo");
        const premio = interaction.options.getString("premio");
        const duracao = interaction.options.getInteger("duracao");
        const vencedores = interaction.options.getInteger("vencedores") || 1;
        const descricao = interaction.options.getString("descricao") || "";
        const cargoReq = interaction.options.getRole("cargo_requerido");

        const endsAt = new Date(Date.now() + duracao * 60 * 1000);

        const data = await invokeEdge({
          action: "create",
          title: titulo,
          prize: premio,
          description: descricao,
          winners_count: vencedores,
          ends_at: endsAt.toISOString(),
          channel_id: interaction.channel.id,
          require_role_id: cargoReq?.id || null,
          created_by: interaction.user.id,
        });

        await interaction.editReply({
          content: `✅ Sorteio **${titulo}** criado com sucesso!\n🎁 Prêmio: **${premio}**\n⏰ Encerra: <t:${Math.floor(endsAt.getTime() / 1000)}:R>\n👥 Vencedores: **${vencedores}**`,
        });
      } catch (err) {
        await interaction.editReply({ content: `❌ Erro: ${err.message}` });
      }
    }

    // ── Listar ──
    if (sub === "listar") {
      await interaction.reply({ content: "<a:carregadeira:1515809475922100426> Listando sorteios...", ephemeral: true });

      try {
        const giveaways = await invokeEdge({ action: "list" });
        const active = (Array.isArray(giveaways) ? giveaways : []).filter(g => g.status === "active");

        if (active.length === 0) {
          return interaction.editReply({ content: "📭 Nenhum sorteio ativo no momento." });
        }

        const lines = active.slice(0, 10).map((g, i) => {
          const endsTs = Math.floor(new Date(g.ends_at).getTime() / 1000);
          return `**${i + 1}.** ${g.title} — 🎁 ${g.prize} — ⏰ <t:${endsTs}:R> — 👥 ${g.entries_count || 0} participantes\n\`ID: ${g.id}\``;
        });

        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle("🎉 Sorteios Ativos")
          .setDescription(lines.join("\n\n"))
          .setFooter({ text: `${active.length} sorteio(s) ativo(s)` });
        applyDrikaCover(embed);

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply({ content: `❌ Erro: ${err.message}` });
      }
    }

    // ── Sortear ──
    if (sub === "sortear") {
      await interaction.reply({ content: "<a:carregadeira:1515809475922100426> Realizando sorteio..." });

      try {
        const id = interaction.options.getString("id");
        const result = await invokeEdge({ action: "draw", giveaway_id: id });
        const winners = result?.winners || [];

        if (winners.length === 0) {
          return interaction.editReply({ content: "❌ Nenhum participante para sortear." });
        }

        const winnerMentions = winners.map(w => `<@${w.discord_user_id}>`).join(", ");
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle(`🎉 Sorteio Encerrado!`)
          .setDescription(`🏆 **Vencedor${winners.length > 1 ? "es" : ""}:** ${winnerMentions}\n\nParabéns! 🥳`)
          .setTimestamp();
        applyDrikaCover(embed);

        await interaction.editReply({ content: `🎉 ${winnerMentions}`, embeds: [embed] });
      } catch (err) {
        await interaction.editReply({ content: `❌ Erro: ${err.message}` });
      }
    }

    // ── Cancelar ──
    if (sub === "cancelar") {
      await interaction.reply({ content: "<a:carregadeira:1515809475922100426> Cancelando sorteio...", ephemeral: true });

      try {
        const id = interaction.options.getString("id");
        await invokeEdge({ action: "cancel", giveaway_id: id });
        await interaction.editReply({ content: "✅ Sorteio cancelado com sucesso." });
      } catch (err) {
        await interaction.editReply({ content: `❌ Erro: ${err.message}` });
      }
    }
  },
};
