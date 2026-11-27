import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTenantAccess } from "../_shared/tenant-auth.ts";
import {
  cleanDiscordChannelMessages,
  buildChannelCleanSummaryPayload,
} from "../_shared/discord-channel-clean.ts";

const DISCORD_API = "https://discord.com/api/v10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isServiceRoleRequest(req: Request): boolean {
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!serviceKey) return false;
  const auth = (req.headers.get("Authorization") || req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const apiKey = (req.headers.get("apikey") || "").trim();
  return auth === serviceKey || apiKey === serviceKey;
}

async function executeChannelClean(
  supabase: any,
  botToken: string,
  schedule: any,
  executorUserId?: string | null
) {
  const res = await cleanDiscordChannelMessages(botToken, schedule.discord_channel_id, {
    keepPinned: schedule.keep_pinned !== false,
  });

  if (res.failed) {
    throw new Error(res.error || "Falha ao limpar canal no Discord");
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("channel_clean_schedules")
    .update({
      last_cleaned_at: nowIso,
      last_deleted_count: res.deletedCount,
      updated_at: nowIso,
    })
    .eq("id", schedule.id);

  if (schedule.post_summary !== false) {
    const summaryPayload = buildChannelCleanSummaryPayload({
      deletedCount: res.deletedCount,
      executorUserId: executorUserId || null,
    });
    await fetch(`${DISCORD_API}/channels/${schedule.discord_channel_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(summaryPayload),
    }).catch((e) => console.warn("[manage-channel-clean] Failed to post summary:", e));
  }

  return res.deletedCount;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || "";

    const body = await req.json().catch(() => ({}));
    const { action, tenant_id } = body;

    // ─── Automated background runner (service_role only) ───
    if (action === "run_due") {
      if (!isServiceRoleRequest(req)) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!botToken) {
        return new Response(JSON.stringify({ skipped: true, reason: "missing_bot_token", cleaned: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: schedules, error: listErr } = await supabase
        .from("channel_clean_schedules")
        .select("*")
        .eq("enabled", true);

      if (listErr) throw listErr;

      const now = Date.now();
      let cleanedCount = 0;
      const results: any[] = [];

      for (const s of schedules || []) {
        const intervalMs = Math.max(5, Number(s.interval_minutes) || 60) * 60 * 1000;
        const lastMs = s.last_cleaned_at ? new Date(s.last_cleaned_at).getTime() : 0;
        if (lastMs > 0 && now - lastMs < intervalMs) continue;

        try {
          const deletedCount = await executeChannelClean(supabase, botToken, s, null);
          cleanedCount++;
          results.push({ id: s.id, channel_id: s.discord_channel_id, deleted: deletedCount });
        } catch (err: any) {
          results.push({ id: s.id, channel_id: s.discord_channel_id, error: err?.message || "err" });
        }
      }

      return new Response(JSON.stringify({ success: true, cleaned: cleanedCount, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { response: authErr } = await requireTenantAccess(req, supabase, tenant_id, body, corsHeaders);
    if (authErr) return authErr;

    switch (action) {
      case "list": {
        const { data, error } = await supabase
          .from("channel_clean_schedules")
          .select("*")
          .eq("tenant_id", tenant_id)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "upsert": {
        const { discord_channel_id, channel_name, interval_minutes, keep_pinned, post_summary, enabled } = body;
        if (!discord_channel_id) throw new Error("discord_channel_id obrigatório");

        const clampedInterval = Math.max(5, Math.min(10080, Number(interval_minutes) || 60));
        const { data, error } = await supabase
          .from("channel_clean_schedules")
          .upsert(
            {
              tenant_id,
              discord_channel_id: String(discord_channel_id).trim(),
              channel_name: channel_name || null,
              interval_minutes: clampedInterval,
              keep_pinned: keep_pinned !== false,
              post_summary: post_summary !== false,
              enabled: enabled !== false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,discord_channel_id" }
          )
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "toggle": {
        const { id, enabled } = body;
        if (!id) throw new Error("id obrigatório");
        const { data, error } = await supabase
          .from("channel_clean_schedules")
          .update({ enabled: Boolean(enabled), updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq("tenant_id", tenant_id)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { id } = body;
        if (!id) throw new Error("id obrigatório");
        const { error } = await supabase
          .from("channel_clean_schedules")
          .delete()
          .eq("id", id)
          .eq("tenant_id", tenant_id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "run_now": {
        const { id, discord_channel_id } = body;
        if (!botToken) throw new Error("Bot externo não configurado (DISCORD_BOT_TOKEN)");

        let schedule: any = null;
        if (id) {
          const { data } = await supabase
            .from("channel_clean_schedules")
            .select("*")
            .eq("id", id)
            .eq("tenant_id", tenant_id)
            .maybeSingle();
          schedule = data;
        }
        if (!schedule && discord_channel_id) {
          const res = await cleanDiscordChannelMessages(botToken, String(discord_channel_id), {
            keepPinned: body.keep_pinned !== false,
          });
          if (res.failed) throw new Error(res.error || "Falha ao limpar canal");
          if (body.post_summary !== false) {
            const payload = buildChannelCleanSummaryPayload({ deletedCount: res.deletedCount });
            await fetch(`${DISCORD_API}/channels/${discord_channel_id}/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            }).catch(() => {});
          }
          return new Response(JSON.stringify({ success: true, deleted_count: res.deletedCount }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!schedule) throw new Error("Regra de limpeza não encontrada");

        const deletedCount = await executeChannelClean(supabase, botToken, schedule, null);
        return new Response(JSON.stringify({ success: true, deleted_count: deletedCount }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Ação inválida: ${action}`);
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Erro interno" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
