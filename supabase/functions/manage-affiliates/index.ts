import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, tenant_id, affiliate, affiliate_id, payout, payout_id } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // LIST affiliates
    if (action === "list") {
      const { data, error } = await supabase
        .from("affiliates")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ affiliates: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STATS — orders linked to affiliate + payout totals
    if (action === "stats") {
      if (!affiliate_id) throw new Error("Missing affiliate_id");

      const [ordersRes, payoutsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, product_name, total_cents, status, discord_username, created_at")
          .eq("tenant_id", tenant_id)
          .eq("affiliate_id", affiliate_id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("affiliate_payouts")
          .select("*")
          .eq("tenant_id", tenant_id)
          .eq("affiliate_id", affiliate_id)
          .order("created_at", { ascending: false }),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (payoutsRes.error) throw payoutsRes.error;

      return new Response(JSON.stringify({
        orders: ordersRes.data ?? [],
        payouts: payoutsRes.data ?? [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REFERRAL STATS — for client panel (tenant sees their own referrals)
    if (action === "referral_stats") {
      // Find tenants referred by this tenant
      const { data: referrals, error: refErr } = await supabase
        .from("tenants")
        .select("id, name, plan, created_at")
        .eq("referred_by_tenant_id", tenant_id)
        .order("created_at", { ascending: false });
      if (refErr) throw refErr;

      const total_referrals = referrals?.length ?? 0;
      const total_paid_referrals = referrals?.filter((r: any) => r.plan === "pro").length ?? 0;

      // Get config for bonus calculation
      const { data: configData } = await supabase
        .from("landing_config")
        .select("referral_bonus_days, referral_bonus_credits_cents")
        .limit(1)
        .single();

      const bonusDays = configData?.referral_bonus_days ?? 7;
      const bonusCredits = configData?.referral_bonus_credits_cents ?? 500;

      return new Response(JSON.stringify({
        total_referrals,
        total_paid_referrals,
        total_bonus_days_earned: total_paid_referrals * bonusDays,
        total_credits_earned: total_paid_referrals * bonusCredits,
        referrals: referrals ?? [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ANALYTICS — aggregate data for charts
    if (action === "analytics") {
      const [affiliatesRes, ordersRes, payoutsRes] = await Promise.all([
        supabase.from("affiliates").select("*").eq("tenant_id", tenant_id),
        supabase
          .from("orders")
          .select("id, total_cents, status, affiliate_id, created_at")
          .eq("tenant_id", tenant_id)
          .not("affiliate_id", "is", null)
          .order("created_at", { ascending: true }),
        supabase
          .from("affiliate_payouts")
          .select("*")
          .eq("tenant_id", tenant_id),
      ]);

      if (affiliatesRes.error) throw affiliatesRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (payoutsRes.error) throw payoutsRes.error;

      return new Response(JSON.stringify({
        affiliates: affiliatesRes.data ?? [],
        orders: ordersRes.data ?? [],
        payouts: payoutsRes.data ?? [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE affiliate
    if (action === "create") {
      if (!affiliate?.name || !affiliate?.code) throw new Error("name e code obrigatórios");
      const { data, error } = await supabase
        .from("affiliates")
        .insert({
          tenant_id,
          name: affiliate.name,
          code: affiliate.code.toUpperCase().replace(/\s+/g, ""),
          commission_type: affiliate.commission_type ?? "percent",
          commission_percent: affiliate.commission_percent ?? 5,
          commission_fixed_cents: affiliate.commission_fixed_cents ?? 0,
          active: true,
          discord_username: affiliate.discord_username ?? null,
          email: affiliate.email ?? null,
          whatsapp: affiliate.whatsapp ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ affiliate: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE affiliate
    if (action === "update") {
      if (!affiliate_id) throw new Error("Missing affiliate_id");
      const updates: Record<string, unknown> = {};
      if (affiliate?.name !== undefined) updates.name = affiliate.name;
      if (affiliate?.code !== undefined) updates.code = affiliate.code.toUpperCase().replace(/\s+/g, "");
      if (affiliate?.commission_type !== undefined) updates.commission_type = affiliate.commission_type;
      if (affiliate?.commission_percent !== undefined) updates.commission_percent = affiliate.commission_percent;
      if (affiliate?.commission_fixed_cents !== undefined) updates.commission_fixed_cents = affiliate.commission_fixed_cents;
      if (affiliate?.active !== undefined) updates.active = affiliate.active;
      if (affiliate?.discord_username !== undefined) updates.discord_username = affiliate.discord_username;
      if (affiliate?.email !== undefined) updates.email = affiliate.email;
      if (affiliate?.whatsapp !== undefined) updates.whatsapp = affiliate.whatsapp;

      const { data, error } = await supabase
        .from("affiliates")
        .update(updates)
        .eq("id", affiliate_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ affiliate: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE affiliate
    if (action === "delete") {
      if (!affiliate_id) throw new Error("Missing affiliate_id");
      const { error } = await supabase
        .from("affiliates")
        .delete()
        .eq("id", affiliate_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE PAYOUT
    if (action === "create_payout") {
      if (!affiliate_id || !payout?.amount_cents) throw new Error("affiliate_id e amount_cents obrigatórios");
      const { data, error } = await supabase
        .from("affiliate_payouts")
        .insert({
          tenant_id,
          affiliate_id,
          amount_cents: payout.amount_cents,
          status: payout.status ?? "pending",
          notes: payout.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ payout: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE PAYOUT (mark as paid, etc.)
    if (action === "update_payout") {
      if (!payout_id) throw new Error("Missing payout_id");
      const updates: Record<string, unknown> = {};
      if (payout?.status !== undefined) {
        updates.status = payout.status;
        if (payout.status === "paid") updates.paid_at = new Date().toISOString();
      }
      if (payout?.notes !== undefined) updates.notes = payout.notes;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("affiliate_payouts")
        .update(updates)
        .eq("id", payout_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ payout: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE PAYOUT
    if (action === "delete_payout") {
      if (!payout_id) throw new Error("Missing payout_id");
      const { error } = await supabase
        .from("affiliate_payouts")
        .delete()
        .eq("id", payout_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
