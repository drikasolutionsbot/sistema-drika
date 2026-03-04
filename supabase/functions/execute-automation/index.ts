import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v10";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { tenant_id, trigger_type, trigger_data } = body;

    if (!tenant_id || !trigger_type) throw new Error("tenant_id and trigger_type required");

    // 1. Get tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("discord_guild_id, bot_token_encrypted, name, logo_url")
      .eq("id", tenant_id)
      .single();

    const botToken = tenant?.bot_token_encrypted || Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = tenant?.discord_guild_id;
    if (!botToken) throw new Error("No bot token");

    // 2. Get matching enabled automations
    const { data: automations, error } = await supabase
      .from("automations")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("trigger_type", trigger_type)
      .eq("enabled", true);

    if (error) throw error;
    if (!automations || automations.length === 0) {
      return json({ executed: 0, message: "No matching automations" });
    }

    let executed = 0;
    const results: any[] = [];

    for (const auto of automations) {
      try {
        // 3. Check conditions
        const conditionsMet = await checkConditions(auto.conditions || [], trigger_data, botToken, guildId);
        if (!conditionsMet) {
          await logExecution(supabase, tenant_id, auto.id, "skipped", "Condições não atendidas", trigger_data);
          results.push({ id: auto.id, result: "skipped" });
          continue;
        }

        // 4. Execute actions
        const actionResults: string[] = [];
        for (const action of (auto.actions || [])) {
          const result = await executeAction(action, trigger_data, botToken, guildId, tenant);
          actionResults.push(`${action.type}: ${result}`);
        }

        // 5. Log success and update counters
        await logExecution(supabase, tenant_id, auto.id, "success", actionResults.join(" | "), trigger_data);
        await supabase
          .from("automations")
          .update({
            executions: (auto.executions || 0) + 1,
            last_executed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", auto.id);

        executed++;
        results.push({ id: auto.id, result: "success" });
      } catch (err: any) {
        await logExecution(supabase, tenant_id, auto.id, "error", err.message, trigger_data);
        results.push({ id: auto.id, result: "error", error: err.message });
      }
    }

    return json({ executed, total: automations.length, results });
  } catch (err: any) {
    console.error("execute-automation error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logExecution(
  supabase: any, tenantId: string, automationId: string,
  result: string, details: string, triggerData: any
) {
  await supabase.from("automation_logs").insert({
    tenant_id: tenantId,
    automation_id: automationId,
    result,
    details,
    trigger_data: triggerData || {},
  });
}

// ─── Condition Checker ─────────────────────────────────
async function checkConditions(
  conditions: any[], triggerData: any, botToken: string, guildId: string | null
): Promise<boolean> {
  if (!conditions || conditions.length === 0) return true;

  for (const cond of conditions) {
    const userId = triggerData?.discord_user_id;

    switch (cond.type) {
      case "has_role": {
        if (!userId || !guildId || !cond.value) return false;
        const member = await fetchMember(botToken, guildId, userId);
        if (!member || !member.roles?.includes(cond.value)) return false;
        break;
      }
      case "not_has_role": {
        if (!userId || !guildId || !cond.value) return false;
        const member2 = await fetchMember(botToken, guildId, userId);
        if (member2?.roles?.includes(cond.value)) return false;
        break;
      }
      case "in_channel": {
        if (triggerData?.channel_id !== cond.value) return false;
        break;
      }
      case "account_age_days": {
        if (!userId) return false;
        // Discord snowflake to timestamp
        const timestamp = Number(BigInt(userId) >> BigInt(22)) + 1420070400000;
        const ageDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
        if (ageDays < Number(cond.value)) return false;
        break;
      }
    }
  }
  return true;
}

async function fetchMember(botToken: string, guildId: string, userId: string) {
  try {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ─── Action Executor ─────────────────────────────────
async function executeAction(
  action: any, triggerData: any, botToken: string,
  guildId: string | null, tenant: any
): Promise<string> {
  const config = action.config || {};
  const userId = triggerData?.discord_user_id;
  const username = triggerData?.discord_username || "usuário";

  // Replace variables in text
  const replaceVars = (text: string, extraVars?: Record<string, string>): string => {
    if (!text) return text;
    let result = text
      .replace(/\{user\}/g, userId ? `<@${userId}>` : username)
      .replace(/\{username\}/g, username)
      .replace(/\{server\}/g, tenant?.name || "servidor")
      .replace(/\{member_count\}/g, triggerData?.member_count?.toString() || "?")
      .replace(/\{product\}/g, triggerData?.product_name || "")
      .replace(/\{order\}/g, triggerData?.order_number ? `#${triggerData.order_number}` : "")
      .replace(/\{channel\}/g, triggerData?.channel_id ? `<#${triggerData.channel_id}>` : "");
    if (extraVars) {
      for (const [k, v] of Object.entries(extraVars)) {
        result = result.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      }
    }
    return result;
  };

  switch (action.type) {
    case "send_message": {
      const channelId = config.channel_id;
      if (!channelId || !config.content) return "skip: missing config";
      const content = replaceVars(config.content);
      const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      return res.ok ? "sent" : `failed: ${res.status}`;
    }

    case "send_embed": {
      const channelId = config.channel_id;
      if (!channelId) return "skip: no channel";
      const embed: any = {
        title: replaceVars(config.title || ""),
        description: replaceVars(config.description || ""),
        color: parseInt((config.color || "#5865F2").replace("#", ""), 16),
      };
      if (config.thumbnail_url) embed.thumbnail = { url: config.thumbnail_url };
      if (config.image_url) embed.image = { url: config.image_url };
      embed.timestamp = new Date().toISOString();
      const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });
      return res.ok ? "sent" : `failed: ${res.status}`;
    }

    case "send_dm": {
      if (!userId || !config.content) return "skip: missing config";
      const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: userId }),
      });
      if (!dmRes.ok) return `dm_fail: ${dmRes.status}`;
      const dm = await dmRes.json();
      const content = replaceVars(config.content);
      const res = await fetch(`${DISCORD_API}/channels/${dm.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      return res.ok ? "dm_sent" : `dm_fail: ${res.status}`;
    }

    case "add_role": {
      if (!userId || !guildId || !config.role_id) return "skip: missing config";
      const res = await fetch(
        `${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${config.role_id}`,
        { method: "PUT", headers: { Authorization: `Bot ${botToken}` } }
      );
      return res.ok || res.status === 204 ? "role_added" : `fail: ${res.status}`;
    }

    case "remove_role": {
      if (!userId || !guildId || !config.role_id) return "skip: missing config";
      const res = await fetch(
        `${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${config.role_id}`,
        { method: "DELETE", headers: { Authorization: `Bot ${botToken}` } }
      );
      return res.ok || res.status === 204 ? "role_removed" : `fail: ${res.status}`;
    }

    case "kick_member": {
      if (!userId || !guildId) return "skip: missing config";
      const res = await fetch(
        `${DISCORD_API}/guilds/${guildId}/members/${userId}`,
        { method: "DELETE", headers: { Authorization: `Bot ${botToken}` } }
      );
      return res.ok || res.status === 204 ? "kicked" : `fail: ${res.status}`;
    }

    case "ban_member": {
      if (!userId || !guildId) return "skip: missing config";
      const res = await fetch(
        `${DISCORD_API}/guilds/${guildId}/bans/${userId}`,
        {
          method: "PUT",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ delete_message_seconds: Number(config.delete_days || 0) * 86400 }),
        }
      );
      return res.ok || res.status === 204 ? "banned" : `fail: ${res.status}`;
    }

    case "change_nickname": {
      if (!userId || !guildId) return "skip: missing config";
      const nick = replaceVars(config.nickname || "");
      const res = await fetch(
        `${DISCORD_API}/guilds/${guildId}/members/${userId}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ nick }),
        }
      );
      return res.ok ? "nick_changed" : `fail: ${res.status}`;
    }

    case "send_webhook": {
      if (!config.url) return "skip: no url";
      const method = (config.method || "POST").toUpperCase();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.authorization) headers["Authorization"] = config.authorization;
      const extraVars: Record<string, string> = {};
      if (config.channel_id) extraVars["channel_id"] = config.channel_id;
      const payload = config.body_template
        ? JSON.parse(replaceVars(config.body_template, extraVars))
        : { trigger_type: triggerData?.trigger_type, channel_id: config.channel_id, ...triggerData };
      const fetchOpts: any = { method, headers };
      if (method !== "GET") fetchOpts.body = JSON.stringify(payload);
      const res = await fetch(config.url, fetchOpts);
      return res.ok ? "webhook_sent" : `fail: ${res.status}`;
    }

    case "send_announcement": {
      const channelId = config.channel_id;
      if (!channelId) return "skip: no channel";
      const embed: any = {
        title: replaceVars(config.title || ""),
        description: replaceVars(config.description || ""),
        color: parseInt((config.color || "#FF69B4").replace("#", ""), 16),
        timestamp: new Date().toISOString(),
      };
      if (tenant?.logo_url) embed.footer = { text: tenant.name, icon_url: tenant.logo_url };
      const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });
      return res.ok ? "announced" : `fail: ${res.status}`;
    }

    default:
      return `unknown_action: ${action.type}`;
  }
}
