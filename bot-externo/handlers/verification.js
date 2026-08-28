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

  // Envio de DM desativado globalmente a pedido do cliente
  /*
  if (tenant.verify_enabled && tenant.verify_channel_id) {
    ...
  }
  */
}

module.exports = { onMemberJoin };
