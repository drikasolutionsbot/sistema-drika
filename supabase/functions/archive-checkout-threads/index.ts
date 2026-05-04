import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v10";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: dueOrders, error } = await supabase
      .from("orders")
      .select("id, checkout_thread_id, checkout_thread_archive_attempts")
      .eq("status", "delivered")
      .not("checkout_thread_id", "is", null)
      .not("checkout_thread_archive_at", "is", null)
      .is("checkout_thread_archived_at", null)
      .lte("checkout_thread_archive_at", new Date().toISOString())
      .lt("checkout_thread_archive_attempts", 10)
      .limit(50);

    if (error) throw error;

    let archived = 0;
    const failures: Array<{ order_id: string; thread_id: string; error: string }> = [];

    for (const order of dueOrders || []) {
      const orderId = order.id as string;
      const threadId = order.checkout_thread_id as string;
      const attempts = Number(order.checkout_thread_archive_attempts || 0) + 1;

      try {
        await supabase
          .from("orders")
          .update({ checkout_thread_archive_attempts: attempts, checkout_thread_archive_error: null })
          .eq("id", orderId)
          .is("checkout_thread_archived_at", null);

        const res = await fetch(`${DISCORD_API}/channels/${threadId}`, {
          method: "PATCH",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true, locked: true }),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`${res.status} ${body}`.trim());
        }

        await supabase
          .from("orders")
          .update({ checkout_thread_archived_at: new Date().toISOString(), checkout_thread_archive_error: null })
          .eq("id", orderId);
        archived += 1;
      } catch (e) {
        const message = e instanceof Error ? e.message : "unknown_error";
        failures.push({ order_id: orderId, thread_id: threadId, error: message });
        await supabase
          .from("orders")
          .update({ checkout_thread_archive_error: message.slice(0, 500) })
          .eq("id", orderId);
      }
    }

    return new Response(JSON.stringify({ success: true, scanned: dueOrders?.length || 0, archived, failures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    console.error("archive-checkout-threads error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
