const { EmbedBuilder } = require("discord.js");
const { supabase } = require("../supabase");
const { applyDrikaCover } = require("../drikaTemplate");

/**
 * Handle member join: if verification is disabled, auto-assign verify role
 * If verification is enabled, do nothing (member must verify via link)
 */
async function onMemberJoin(client, member, tenant) {
  if (!tenant) return;

  // If verification is disabled, auto-assign the role
  if (!tenant.verify_enabled && tenant.verify_role_id) {
    try {
      await member.roles.add(tenant.verify_role_id);
    } catch (e) {
      console.error(`[verification] Failed to add role on join:`, e.message);
    }
  }

  // If verification is enabled, we can optionally send a DM or a channel message
  if (tenant.verify_enabled && tenant.verify_channel_id) {
    try {
      const verifyUrl = tenant.verify_slug
        ? `https://www.drikahub.com/verify/${tenant.verify_slug}`
        : `https://www.drikahub.com/verify/${tenant.id}`;

      const dm = new EmbedBuilder()
        .setTitle("🔒 Verificação Necessária")
        .setDescription(
          `Olá **${member.user.username}**! Para acessar o servidor **${member.guild.name}**, ` +
          `você precisa se verificar.\n\n` +
          `👉 [Clique aqui para verificar](${verifyUrl})\n\n` +
          `Ou vá ao canal <#${tenant.verify_channel_id}> no servidor.`
        )
        .setColor(parseInt((tenant.verify_embed_color || "#5865F2").replace("#", ""), 16))
        .setTimestamp();

      if (tenant.logo_url) dm.setThumbnail(tenant.logo_url);
      applyDrikaCover(dm, tenant);

      await member.send({ embeds: [dm] }).catch(() => {
        // DMs may be disabled
      });
    } catch (e) {
      // Silently fail if DM can't be sent
    }
  }
}

module.exports = { onMemberJoin };
