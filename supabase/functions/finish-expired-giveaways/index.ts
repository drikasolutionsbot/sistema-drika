import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getBotToken(): Promise<string | null> {
  return Deno.env.get("DISCORD_BOT_TOKEN") || null;
}

async function syncEntriesFromDiscord(
  botToken: string,
  giveaway: any,
  supabase: any
) {
  if (!giveaway.channel_id || !giveaway.message_id) return;

  try {
    const allUsers: any[] = [];
    let after = "0";
    while (true) {
      const url = `https://discord.com/api/v10/channels/${giveaway.channel_id}/messages/${giveaway.message_id}/reactions/%F0%9F%8E%89?limit=100&after=${after}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bot ${botToken}` },
      });
      if (!res.ok) break;
      const users = await res.json();
      if (!Array.isArray(users) || users.length === 0) break;
      for (const u of users) {
        if (!u.bot) allUsers.push(u);
      }
      if (users.length < 100) break;
      after = users[users.length - 1].id;
    }

    if (allUsers.length === 0) return;

    const { data: existing } = await supabase
      .from("giveaway_entries")
      .select("discord_user_id")
      .eq("giveaway_id", giveaway.id)
      .eq("tenant_id", giveaway.tenant_id);

    const existingIds = new Set((existing || []).map((e: any) => e.discord_user_id));
    const newEntries = allUsers
      .filter((u: any) => !existingIds.has(u.id))
      .map((u: any) => ({
        giveaway_id: giveaway.id,
        tenant_id: giveaway.tenant_id,
        discord_user_id: u.id,
        discord_username: u.username || u.global_name || null,
        discord_avatar: u.avatar
          ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`
          : null,
      }));

    if (newEntries.length > 0) {
      await supabase.from("giveaway_entries").insert(newEntries);
    }
  } catch (e) {
    console.error("syncEntriesFromDiscord error:", e);
  }
}

async function hydrateWinner(botToken: string, winner: any) {
  try {
    const res = await fetch(`https://discord.com/api/v10/users/${winner.discord_user_id}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) return winner;
    const user = await res.json();
    return {
      ...winner,
      discord_username: user?.username || winner.discord_username || winner.discord_user_id,
      discord_avatar: user?.avatar
        ? `https://cdn.discordapp.com/avatars/${winner.discord_user_id}/${user.avatar}.png`
        : winner.discord_avatar || null,
    };
  } catch {
    return winner;
  }
}

async function finishGiveaway(supabase: any, botToken: string | null, giveaway: any) {
  console.log(`[finish-expired-giveaways] Processing giveaway ${giveaway.id} - "${giveaway.title}"`);

  // 1. Sync reactions from Discord before drawing
  if (botToken && giveaway.message_id) {
    await syncEntriesFromDiscord(botToken, giveaway, supabase);
  }

  // 2. Fetch all entries
  const { data: entries } = await supabase
    .from("giveaway_entries")
    .select("*")
    .eq("giveaway_id", giveaway.id)
    .eq("tenant_id", giveaway.tenant_id);

  const winnersCount = giveaway.winners_count || 1;

  if (!entries || entries.length === 0) {
    // No participants — end with no winners
    await supabase
      .from("giveaways")
      .update({ status: "ended", winners: [], updated_at: new Date().toISOString() })
      .eq("id", giveaway.id);

    if (giveaway.channel_id && botToken) {
      await fetch(`https://discord.com/api/v10/channels/${giveaway.channel_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            color: 0xED4245,
            title: `❌ Sorteio Encerrado: ${giveaway.title}`,
            description: `**Prêmio:** ${giveaway.prize}\n\nNenhum participante válido encontrado.`,
            footer: { text: "0 participantes" },
            timestamp: new Date().toISOString(),
          }],
        }),
      });
    }
    console.log(`[finish-expired-giveaways] Giveaway ${giveaway.id} ended with no participants`);
    return;
  }

  // 3. Draw random winners
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  const winnerCount = Math.min(winnersCount, shuffled.length);
  let winners = shuffled.slice(0, winnerCount).map((e: any) => ({
    discord_user_id: e.discord_user_id,
    discord_username: e.discord_username || e.discord_user_id,
    discord_avatar: e.discord_avatar || null,
    entered_at: e.entered_at || null,
  }));

  // 4. Hydrate winner profiles from Discord
  if (botToken) {
    winners = await Promise.all(winners.map((w: any) => hydrateWinner(botToken, w)));
  }

  // 5. Save winners + mark ended
  await supabase
    .from("giveaways")
    .update({ winners, status: "ended", updated_at: new Date().toISOString() })
    .eq("id", giveaway.id);

  // 6. Announce winners in Discord
  if (giveaway.channel_id && botToken) {
    const winnerMentions = winners.map((w: any) => `<@${w.discord_user_id}>`).join(", ");
    const embed: any = {
      color: 0x57F287,
      title: `🎉 Sorteio Encerrado: ${giveaway.title}`,
      description: `**Prêmio:** ${giveaway.prize}\n\n🏆 **Vencedor${winnerCount > 1 ? "es" : ""}:** ${winnerMentions}\n\nParabéns! 🥳`,
      footer: { text: `${entries.length} participantes` },
      timestamp: new Date().toISOString(),
    };

    // Include image from embed_config if available
    const cfg = giveaway.embed_config;
    if (cfg?.image_url) embed.image = { url: cfg.image_url };
    if (cfg?.thumbnail_url) embed.thumbnail = { url: cfg.thumbnail_url };

    await fetch(`https://discord.com/api/v10/channels/${giveaway.channel_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: `🎉 ${winnerMentions}`, embeds: [embed] }),
    });

    // 7. Update original giveaway message to show it ended
    if (giveaway.message_id) {
      const endedEmbed: any = {
        color: parseInt((cfg?.color || "#FEE75C").replace("#", ""), 16),
        title: `🎉 SORTEIO ENCERRADO: ${giveaway.title}`,
        description: `**Prêmio:** ${giveaway.prize}\n\n🏆 **Vencedor${winnerCount > 1 ? "es" : ""}:** ${winnerMentions}\n\nParabéns! 🥳`,
        footer: { text: `${entries.length} participantes • Sorteio encerrado` },
        timestamp: new Date().toISOString(),
      };
      if (cfg?.image_url) endedEmbed.image = { url: cfg.image_url };
      if (cfg?.thumbnail_url) endedEmbed.thumbnail = { url: cfg.thumbnail_url };

      await fetch(`https://discord.com/api/v10/channels/${giveaway.channel_id}/messages/${giveaway.message_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [endedEmbed] }),
      });
    }
  }

  console.log(`[finish-expired-giveaways] Giveaway ${giveaway.id} ended. Winners: ${winners.map((w: any) => w.discord_username).join(", ")}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const botToken = await getBotToken();

    // Find all active giveaways that have expired
    const { data: expiredGiveaways, error } = await supabase
      .from("giveaways")
      .select("*")
      .eq("status", "active")
      .lte("ends_at", new Date().toISOString());

    if (error) throw error;

    if (!expiredGiveaways || expiredGiveaways.length === 0) {
      console.log("[finish-expired-giveaways] No expired giveaways found.");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[finish-expired-giveaways] Found ${expiredGiveaways.length} expired giveaway(s).`);

    const results = [];
    for (const giveaway of expiredGiveaways) {
      try {
        await finishGiveaway(supabase, botToken, giveaway);
        results.push({ id: giveaway.id, title: giveaway.title, success: true });
      } catch (err: any) {
        console.error(`[finish-expired-giveaways] Error processing ${giveaway.id}:`, err);
        results.push({ id: giveaway.id, title: giveaway.title, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[finish-expired-giveaways] Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
