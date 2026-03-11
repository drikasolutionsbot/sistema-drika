import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, tenant_id } = body;
    if (!tenant_id) throw new Error("tenant_id required");

    const json = (data: any) =>
      new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // List giveaways
    if (action === "list") {
      const { data, error } = await supabase
        .from("giveaways")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get entry counts
      const ids = (data || []).map((g: any) => g.id);
      let entryCounts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: entries } = await supabase
          .from("giveaway_entries")
          .select("giveaway_id")
          .in("giveaway_id", ids);
        for (const e of entries || []) {
          entryCounts[e.giveaway_id] = (entryCounts[e.giveaway_id] || 0) + 1;
        }
      }

      const result = (data || []).map((g: any) => ({ ...g, entries_count: entryCounts[g.id] || 0 }));
      return json(result);
    }

    // Create giveaway
    if (action === "create") {
      const { title, description, prize, winners_count, ends_at, channel_id, require_role_id, created_by } = body;
      if (!title || !prize || !ends_at) throw new Error("title, prize, ends_at required");
      const { data, error } = await supabase
        .from("giveaways")
        .insert({
          tenant_id, title, description: description || "", prize,
          winners_count: winners_count || 1, ends_at, channel_id,
          require_role_id, created_by,
        })
        .select()
        .single();
      if (error) throw error;

      // Optionally announce in Discord channel
      if (channel_id) {
        try {
          const { data: tenant } = await supabase
            .from("tenants")
            .select("bot_token_encrypted")
            .eq("id", tenant_id)
            .single();
          const botToken = tenant?.bot_token_encrypted || Deno.env.get("DISCORD_BOT_TOKEN");
          if (botToken) {
            const embed = {
              color: 0xFEE75C,
              title: `🎉 SORTEIO: ${title}`,
              description: `**Prêmio:** ${prize}\n\n${description || "Participe reagindo abaixo!"}\n\n⏰ **Encerra:** <t:${Math.floor(new Date(ends_at).getTime() / 1000)}:R>\n👥 **Vencedores:** ${winners_count || 1}`,
              footer: { text: "Reaja com 🎉 para participar!" },
              timestamp: new Date().toISOString(),
            };
            const res = await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bot ${tenant.bot_token_encrypted}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ embeds: [embed] }),
            });
            if (res.ok) {
              const msg = await res.json();
              // Save message_id
              await supabase.from("giveaways").update({ message_id: msg.id }).eq("id", data.id);
              // Add 🎉 reaction
              await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages/${msg.id}/reactions/%F0%9F%8E%89/@me`, {
                method: "PUT",
                headers: { Authorization: `Bot ${tenant.bot_token_encrypted}` },
              });
            }
          }
        } catch (e) {
          console.error("Discord announce failed:", e);
        }
      }

      return json(data);
    }

    // Update giveaway
    if (action === "update") {
      const { giveaway_id, ...fields } = body;
      delete fields.action;
      delete fields.tenant_id;
      fields.updated_at = new Date().toISOString();
      const { data, error } = await supabase
        .from("giveaways")
        .update(fields)
        .eq("id", giveaway_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    // Delete giveaway
    if (action === "delete") {
      const { giveaway_id } = body;
      const { error } = await supabase.from("giveaways").delete().eq("id", giveaway_id).eq("tenant_id", tenant_id);
      if (error) throw error;
      return json({ success: true });
    }

    // List entries
    if (action === "list_entries") {
      const { giveaway_id } = body;
      const { data, error } = await supabase
        .from("giveaway_entries")
        .select("*")
        .eq("giveaway_id", giveaway_id)
        .eq("tenant_id", tenant_id)
        .order("entered_at", { ascending: true });
      if (error) throw error;
      return json(data);
    }

    // Add entry
    if (action === "add_entry") {
      const { giveaway_id, discord_user_id, discord_username, discord_avatar } = body;
      const { data, error } = await supabase
        .from("giveaway_entries")
        .insert({ giveaway_id, tenant_id, discord_user_id, discord_username, discord_avatar })
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    // Remove entry
    if (action === "remove_entry") {
      const { entry_id } = body;
      const { error } = await supabase.from("giveaway_entries").delete().eq("id", entry_id).eq("tenant_id", tenant_id);
      if (error) throw error;
      return json({ success: true });
    }

    // Draw winners
    if (action === "draw") {
      const { giveaway_id } = body;
      if (!giveaway_id) throw new Error("giveaway_id required");

      // Get giveaway
      const { data: giveaway, error: gErr } = await supabase
        .from("giveaways")
        .select("*")
        .eq("id", giveaway_id)
        .eq("tenant_id", tenant_id)
        .single();
      if (gErr || !giveaway) throw new Error("Giveaway not found");

      // Get entries
      const { data: entries } = await supabase
        .from("giveaway_entries")
        .select("*")
        .eq("giveaway_id", giveaway_id)
        .eq("tenant_id", tenant_id);

      if (!entries || entries.length === 0) throw new Error("No entries to draw from");

      // Shuffle and pick winners
      const shuffled = [...entries].sort(() => Math.random() - 0.5);
      const winnersCount = Math.min(giveaway.winners_count || 1, shuffled.length);
      const winners = shuffled.slice(0, winnersCount).map((e: any) => ({
        discord_user_id: e.discord_user_id,
        discord_username: e.discord_username,
      }));

      // Update giveaway
      const { data: updated, error: uErr } = await supabase
        .from("giveaways")
        .update({ winners, status: "ended", updated_at: new Date().toISOString() })
        .eq("id", giveaway_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (uErr) throw uErr;

      // Announce winners in Discord
      if (giveaway.channel_id) {
        try {
          const { data: tenant } = await supabase
            .from("tenants")
            .select("bot_token_encrypted")
            .eq("id", tenant_id)
            .single();
          if (tenant?.bot_token_encrypted) {
            const winnerMentions = winners.map((w: any) => `<@${w.discord_user_id}>`).join(", ");
            const embed = {
              color: 0x57F287,
              title: `🎉 Sorteio Encerrado: ${giveaway.title}`,
              description: `**Prêmio:** ${giveaway.prize}\n\n🏆 **Vencedor${winnersCount > 1 ? "es" : ""}:** ${winnerMentions}\n\nParabéns! 🥳`,
              footer: { text: `${entries.length} participantes` },
              timestamp: new Date().toISOString(),
            };
            await fetch(`https://discord.com/api/v10/channels/${giveaway.channel_id}/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bot ${tenant.bot_token_encrypted}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ content: `🎉 ${winnerMentions}`, embeds: [embed] }),
            });
          }
        } catch (e) {
          console.error("Discord winner announce failed:", e);
        }
      }

      return json({ ...updated, entries_count: entries.length });
    }

    // Reroll - pick new winner(s)
    if (action === "reroll") {
      const { giveaway_id, count } = body;
      const { data: entries } = await supabase
        .from("giveaway_entries")
        .select("*")
        .eq("giveaway_id", giveaway_id)
        .eq("tenant_id", tenant_id);

      if (!entries || entries.length === 0) throw new Error("No entries");

      const { data: giveaway } = await supabase
        .from("giveaways")
        .select("winners")
        .eq("id", giveaway_id)
        .single();

      const prevWinnerIds = (giveaway?.winners || []).map((w: any) => w.discord_user_id);
      const eligible = entries.filter((e: any) => !prevWinnerIds.includes(e.discord_user_id));

      if (eligible.length === 0) throw new Error("No eligible entries for reroll");

      const shuffled = [...eligible].sort(() => Math.random() - 0.5);
      const newWinners = shuffled.slice(0, count || 1).map((e: any) => ({
        discord_user_id: e.discord_user_id,
        discord_username: e.discord_username,
      }));

      const { data: updated, error } = await supabase
        .from("giveaways")
        .update({ winners: [...(giveaway?.winners || []), ...newWinners], updated_at: new Date().toISOString() })
        .eq("id", giveaway_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;

      return json(updated);
    }

    // Cancel giveaway
    if (action === "cancel") {
      const { giveaway_id } = body;
      const { data, error } = await supabase
        .from("giveaways")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", giveaway_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
