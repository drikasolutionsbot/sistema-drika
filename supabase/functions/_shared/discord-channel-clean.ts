const DISCORD_API = "https://discord.com/api/v10";

/**
 * Strictly requires Discord Administrator permission (0x8) or explicit guild/tenant ownership.
 * ManageMessages (0x2000) alone is intentionally NOT allowed when admin-only cleanup is enforced.
 */
export function isGuildAdministrator(opts: {
  memberPermissions?: string | number | bigint | null;
  userId?: string | null;
  ownerIds?: (string | null | undefined)[];
}): boolean {
  if (opts.userId && Array.isArray(opts.ownerIds)) {
    const uid = String(opts.userId).trim();
    if (uid && opts.ownerIds.some((o) => o && String(o).trim() === uid)) {
      return true;
    }
  }
  try {
    const perms = BigInt(opts.memberPermissions ?? "0");
    return (perms & BigInt(0x8)) === BigInt(0x8);
  } catch {
    return false;
  }
}

export interface CleanChannelOptions {
  limit?: number | null;
  keepPinned?: boolean;
  excludeMessageIds?: string[];
  maxPages?: number;
}

export async function cleanDiscordChannelMessages(
  botToken: string,
  channelId: string,
  opts: CleanChannelOptions = {}
): Promise<{ deletedCount: number; failed: boolean; error?: string }> {
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const keepPinned = opts.keepPinned !== false;
  const excludeSet = new Set((opts.excludeMessageIds || []).map(String));
  const targetLimit = typeof opts.limit === "number" && opts.limit > 0 ? Math.min(opts.limit, 1000) : null;
  const maxPages = opts.maxPages ?? 25;

  let totalDeleted = 0;
  let beforeId: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const remaining = targetLimit !== null ? targetLimit - totalDeleted : 100;
    if (remaining <= 0) break;

    const fetchLimit = Math.min(100, targetLimit !== null ? Math.max(remaining + excludeSet.size, 10) : 100);
    const qs = new URLSearchParams({ limit: String(Math.min(100, fetchLimit)) });
    if (beforeId) qs.set("before", beforeId);

    const msgsRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages?${qs.toString()}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (!msgsRes.ok) {
      const errText = await msgsRes.text().catch(() => "");
      if (page === 0) {
        return { deletedCount: totalDeleted, failed: true, error: `Discord API ${msgsRes.status}: ${errText}` };
      }
      break;
    }

    const msgs = await msgsRes.json().catch(() => []);
    if (!Array.isArray(msgs) || msgs.length === 0) break;

    beforeId = String(msgs[msgs.length - 1].id);

    const eligible: any[] = [];
    for (const m of msgs) {
      if (!m?.id) continue;
      const mid = String(m.id);
      if (excludeSet.has(mid)) continue;
      if (keepPinned && m.pinned) continue;
      eligible.push(m);
      if (targetLimit !== null && totalDeleted + eligible.length >= targetLimit) break;
    }

    const recent = eligible.filter((m) => new Date(m.timestamp).getTime() > twoWeeksAgo);
    const old = eligible.filter((m) => new Date(m.timestamp).getTime() <= twoWeeksAgo);

    if (recent.length >= 2) {
      const bulkRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages/bulk-delete`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: recent.slice(0, 100).map((m) => String(m.id)) }),
      });

      if (bulkRes.ok) {
        totalDeleted += Math.min(100, recent.length);
      } else {
        // Fallback: delete recent individually if bulk-delete rejects any message
        for (const m of recent) {
          try {
            const delRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${m.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bot ${botToken}` },
            });
            if (delRes.ok) totalDeleted += 1;
          } catch {
            // skip
          }
        }
      }
    } else if (recent.length === 1) {
      try {
        const delRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${recent[0].id}`, {
          method: "DELETE",
          headers: { Authorization: `Bot ${botToken}` },
        });
        if (delRes.ok) totalDeleted += 1;
      } catch {
        // skip
      }
    }

    for (const m of old) {
      try {
        const delRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${m.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bot ${botToken}` },
        });
        if (delRes.ok) totalDeleted += 1;
      } catch {
        // skip
      }
    }

    if (msgs.length < Math.min(100, fetchLimit)) break;
    if (targetLimit !== null && totalDeleted >= targetLimit) break;

    await new Promise((r) => setTimeout(r, 450));
  }

  return { deletedCount: totalDeleted, failed: false };
}

export function buildChannelCleanSummaryPayload(opts: {
  deletedCount: number;
  executorUserId?: string | null;
  unixTimestamp?: number;
}) {
  const ts = opts.unixTimestamp ?? Math.floor(Date.now() / 1000);
  const countText =
    opts.deletedCount === 1 ? "1 mensagem excluída" : `${opts.deletedCount} mensagens excluídas`;
  const actorText = opts.executorUserId ? `pelo <@${opts.executorUserId}>` : "automaticamente";

  return {
    embeds: [
      {
        description: `O canal teve **${countText}** ${actorText} <t:${ts}:f>`,
        color: 0x2b2d31,
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: "Limpeza Manual",
            custom_id: "manual_channel_clean",
          },
        ],
      },
    ],
    allowed_mentions: { parse: [] },
  };
}
