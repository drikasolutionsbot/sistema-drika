import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCORD_API = "https://discord.com/api/v10";
const MAX_MEMBERS_PER_TENANT = 1000;
const MAX_JOINS_PROCESSED_PER_TENANT = 20;

const CYCLES_PER_INVOCATION = 3;
const CYCLE_INTERVAL_MS = 20_000; // 20 seconds

async function runSyncCycle(supabase: any, tenantFilter?: string) {
  let query = supabase
    .from("welcome_configs")
    .select("tenant_id, auto_role_enabled, auto_role_id")
    .eq("auto_role_enabled", true)
    .not("auto_role_id", "is", null);

  if (tenantFilter) query = query.eq("tenant_id", tenantFilter);

  const { data: configs, error: configError } = await query;
  if (configError) throw configError;

  if (!configs || configs.length === 0) {
    return { processed_tenants: 0, processed_members: 0 };
  }

  const summary: Array<Record<string, unknown>> = [];
  let totalMembersProcessed = 0;

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;
  if (!botToken) {
    throw new Error("Bot externo não configurado (DISCORD_BOT_TOKEN)");
  }

  for (const config of configs) {
    const tenantId = config.tenant_id;
    const autoRoleId = config.auto_role_id;
    if (!tenantId || !autoRoleId) continue;

    const tenantResult: Record<string, unknown> = {
      tenant_id: tenantId,
      scanned: 0,
      candidates: 0,
      processed: 0,
      errors: [] as string[],
    };

    try {
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("discord_guild_id")
        .eq("id", tenantId)
        .single();

      if (tenantError) throw tenantError;
      if (!tenant?.discord_guild_id) {
        (tenantResult.errors as string[]).push("tenant without discord_guild_id");
        summary.push(tenantResult);
        continue;
      }

      const guildId = tenant.discord_guild_id;
      const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members?limit=${MAX_MEMBERS_PER_TENANT}`, {
        headers: { Authorization: `Bot ${botToken}` },
      });

      if (!res.ok) {
        const err = await res.text();
        (tenantResult.errors as string[]).push(`list members failed (${res.status}): ${err}`);
        summary.push(tenantResult);
        continue;
      }

      const members = await res.json();
      if (!Array.isArray(members)) {
        (tenantResult.errors as string[]).push("invalid members payload");
        summary.push(tenantResult);
        continue;
      }

      tenantResult.scanned = members.length;

      const candidates = members
        .filter((m: any) => !m?.user?.bot)
        .filter((m: any) => Array.isArray(m.roles) && !m.roles.includes(autoRoleId))
        .slice(0, MAX_JOINS_PROCESSED_PER_TENANT);

      tenantResult.candidates = candidates.length;

      for (const member of candidates) {
        try {
          const userId = member?.user?.id;
          if (!userId) {
            (tenantResult.errors as string[]).push("member sem user.id");
            continue;
          }

          const roleRes = await fetch(
            `${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${autoRoleId}`,
            {
              method: "PUT",
              headers: { Authorization: `Bot ${botToken}` },
            }
          );

          if (!roleRes.ok && roleRes.status !== 204) {
            const err = await roleRes.text();
            (tenantResult.errors as string[]).push(
              `auto_role assign failed for ${userId} (${roleRes.status}): ${err}`
            );
            continue;
          }

          tenantResult.processed = Number(tenantResult.processed) + 1;
          totalMembersProcessed += 1;
        } catch (err: any) {
          (tenantResult.errors as string[]).push(`member process error: ${err?.message || "unknown"}`);
        }
      }
    } catch (err: any) {
      (tenantResult.errors as string[]).push(err?.message || "unknown tenant error");
    }

    summary.push(tenantResult);
  }

  return { processed_tenants: summary.length, processed_members: totalMembersProcessed, summary };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const tenantFilter = body?.tenant_id as string | undefined;

    const allResults: any[] = [];

    for (let cycle = 0; cycle < CYCLES_PER_INVOCATION; cycle++) {
      const result = await runSyncCycle(supabase, tenantFilter);
      allResults.push({ cycle: cycle + 1, ...result });

      // Don't sleep after the last cycle
      if (cycle < CYCLES_PER_INVOCATION - 1) {
        await sleep(CYCLE_INTERVAL_MS);
      }
    }

    return json({
      success: true,
      cycles: CYCLES_PER_INVOCATION,
      interval_seconds: CYCLE_INTERVAL_MS / 1000,
      results: allResults,
    });
  } catch (err: any) {
    console.error("sync-welcome-members error:", err);
    return new Response(JSON.stringify({ error: err?.message || "unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
