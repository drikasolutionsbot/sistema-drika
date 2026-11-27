export const DISCORD_PERMISSION_ADMINISTRATOR = BigInt(0x8);

export const ADMIN_ONLY_SLASH_COMMANDS = new Set(["/clear", "/limpar", "/painel"]);

export function hasDiscordAdminPermission(
  memberPermissions?: string | number | bigint | null,
  userId?: string | null,
  ownerIds?: (string | null | undefined)[]
): boolean {
  if (userId && Array.isArray(ownerIds)) {
    const uid = String(userId).trim();
    if (uid && ownerIds.some((o) => o && String(o).trim() === uid)) {
      return true;
    }
  }
  try {
    const perms = BigInt(memberPermissions ?? "0");
    return (perms & DISCORD_PERMISSION_ADMINISTRATOR) === DISCORD_PERMISSION_ADMINISTRATOR;
  } catch {
    return false;
  }
}

export function isAdminOnlyCommand(commandName?: string | null): boolean {
  if (!commandName) return false;
  const normalized = commandName.trim().toLowerCase();
  return ADMIN_ONLY_SLASH_COMMANDS.has(normalized.startsWith("/") ? normalized : `/${normalized}`);
}

export function formatChannelCleanSummary(
  deletedCount: number,
  executorUserId?: string | null,
  unixTimestamp = Math.floor(Date.now() / 1000)
): string {
  const countText = deletedCount === 1 ? "1 mensagem excluída" : `${deletedCount} mensagens excluídas`;
  const actorText = executorUserId ? `pelo <@${executorUserId}>` : "automaticamente";
  return `O canal teve **${countText}** ${actorText} <t:${unixTimestamp}:f>`;
}
