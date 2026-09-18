module.exports = async function handleInviteCreate(client, invite) {
  try {
    const guildId = invite.guild?.id;
    if (!guildId) return;

    let invites = client.guildInvites.get(guildId);
    if (!invites) {
      invites = new Map();
      client.guildInvites.set(guildId, invites);
    }
    
    // Armazena a quantidade de usos do convite e o ID do dono
    invites.set(invite.code, { uses: invite.uses || 0, inviter: invite.inviter?.id });
    
  } catch (err) {
    console.error("[Invite Tracker] Erro ao processar InviteCreate:", err.message);
  }
};
