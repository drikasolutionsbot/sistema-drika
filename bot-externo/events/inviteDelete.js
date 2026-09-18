module.exports = async function handleInviteDelete(client, invite) {
  try {
    const guildId = invite.guild?.id;
    if (!guildId) return;

    let invites = client.guildInvites.get(guildId);
    if (invites) {
      invites.delete(invite.code);
    }
    
  } catch (err) {
    console.error("[Invite Tracker] Erro ao processar InviteDelete:", err.message);
  }
};
