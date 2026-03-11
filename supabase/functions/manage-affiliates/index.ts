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

    // TOGGLE AFFILIATE MODE for a tenant
    if (action === "toggle_affiliate") {
      const { data: tenantData, error: tErr } = await supabase
        .from("tenants")
        .select("affiliate_active, referral_code, name, email, whatsapp")
        .eq("id", tenant_id)
        .single();
      if (tErr) throw tErr;

      const newActive = !tenantData.affiliate_active;
      const updates: Record<string, unknown> = { affiliate_active: newActive };

      // Generate referral_code if activating and doesn't have one
      let referralCode = tenantData.referral_code;
      if (newActive && !referralCode) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code = "";
        for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
        referralCode = code;
        updates.referral_code = referralCode;
      }

      const { data, error } = await supabase
        .from("tenants")
        .update(updates)
        .eq("id", tenant_id)
        .select("affiliate_active, referral_code")
        .single();
      if (error) throw error;

      // Create or update a REAL affiliate record so it shows in admin affiliate list
      if (newActive) {
        // Check if affiliate record already exists for this tenant
        const { data: existingAff } = await supabase
          .from("affiliates")
          .select("id")
          .eq("tenant_id", tenant_id)
          .eq("code", referralCode)
          .maybeSingle();

        if (!existingAff) {
          await supabase.from("affiliates").insert({
            tenant_id,
            name: tenantData.name,
            code: referralCode,
            commission_type: "percent",
            commission_percent: 0,
            commission_fixed_cents: 0,
            active: true,
            email: tenantData.email || null,
            whatsapp: tenantData.whatsapp || null,
            discord_username: null,
          });
        } else {
          await supabase.from("affiliates")
            .update({ active: true })
            .eq("id", existingAff.id);
        }
      } else {
        // Deactivate the affiliate record
        if (referralCode) {
          await supabase.from("affiliates")
            .update({ active: false })
            .eq("tenant_id", tenant_id)
            .eq("code", referralCode);
        }
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ADMIN LIST TENANT AFFILIATES — tenants with affiliate_active = true
    if (action === "admin_tenant_affiliates") {
      const [tenantsRes, configRes] = await Promise.all([
        supabase
          .from("tenants")
          .select("id, name, plan, referral_code, referral_credits_cents, created_at, referred_by_tenant_id, affiliate_active")
          .eq("affiliate_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("landing_config")
          .select("referral_bonus_days, referral_bonus_credits_cents")
          .limit(1)
          .single(),
      ]);
      if (tenantsRes.error) throw tenantsRes.error;

      // For each tenant-affiliate, count their referrals
      const tenants = tenantsRes.data ?? [];
      const tenantIds = tenants.map((t: any) => t.id);

      let referralCounts: Record<string, { total: number; paid: number }> = {};
      if (tenantIds.length > 0) {
        const { data: allTenants } = await supabase
          .from("tenants")
          .select("id, plan, referred_by_tenant_id")
          .in("referred_by_tenant_id", tenantIds);

        (allTenants ?? []).forEach((t: any) => {
          const refId = t.referred_by_tenant_id;
          if (!referralCounts[refId]) referralCounts[refId] = { total: 0, paid: 0 };
          referralCounts[refId].total += 1;
          if (t.plan === "pro") referralCounts[refId].paid += 1;
        });
      }

      return new Response(JSON.stringify({
        tenants,
        referral_counts: referralCounts,
        config: configRes.data ?? { referral_bonus_days: 7, referral_bonus_credits_cents: 500 },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ADMIN GLOBAL — fetch all affiliates, orders, payouts across tenants + SaaS affiliates
    if (action === "admin_global") {
      const [affiliatesRes, ordersRes, payoutsRes, tenantAffsRes] = await Promise.all([
        supabase.from("affiliates").select("*").order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("id, order_number, product_name, total_cents, status, discord_username, created_at, affiliate_id, tenant_id")
          .not("affiliate_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("affiliate_payouts")
          .select("*")
          .order("created_at", { ascending: false }),
        // Fetch tenants who activated SaaS affiliate mode
        supabase
          .from("tenants")
          .select("id, name, referral_code, email, whatsapp, plan, plan_expires_at, created_at, affiliate_active, referral_credits_cents")
          .eq("affiliate_active", true)
          .order("created_at", { ascending: false }),
      ]);
      if (affiliatesRes.error) throw affiliatesRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (payoutsRes.error) throw payoutsRes.error;

      // Transform SaaS tenant affiliates into Affiliate-compatible shape
      const saasAffiliates = (tenantAffsRes.data ?? []).map((t: any) => ({
        id: `saas_${t.id}`,
        name: t.name,
        code: t.referral_code || "",
        commission_type: "percent",
        commission_percent: 0,
        commission_fixed_cents: 0,
        total_sales: 0,
        total_revenue_cents: t.referral_credits_cents || 0,
        active: true,
        created_at: t.created_at,
        discord_username: null,
        email: t.email || null,
        whatsapp: t.whatsapp || null,
        // Extra SaaS fields for admin display
        is_saas_affiliate: true,
        plan: t.plan,
        plan_expires_at: t.plan_expires_at,
        tenant_id_ref: t.id,
      }));

      // Count referrals for each SaaS affiliate
      const saasIds = (tenantAffsRes.data ?? []).map((t: any) => t.id);
      let referralCounts: Record<string, { total: number; paid: number }> = {};
      if (saasIds.length > 0) {
        const { data: referredTenants } = await supabase
          .from("tenants")
          .select("id, plan, referred_by_tenant_id")
          .in("referred_by_tenant_id", saasIds);
        (referredTenants ?? []).forEach((rt: any) => {
          const refId = rt.referred_by_tenant_id;
          if (!referralCounts[refId]) referralCounts[refId] = { total: 0, paid: 0 };
          referralCounts[refId].total += 1;
          if (rt.plan === "pro") referralCounts[refId].paid += 1;
        });
        // Update saas affiliates with referral stats
        saasAffiliates.forEach((sa: any) => {
          const counts = referralCounts[sa.tenant_id_ref] || { total: 0, paid: 0 };
          sa.total_sales = counts.total;
        });
      }

      // Merge: SaaS affiliates first, then store affiliates
      const allAffiliates = [...saasAffiliates, ...(affiliatesRes.data ?? [])];

      return new Response(JSON.stringify({
        affiliates: allAffiliates,
        orders: ordersRes.data ?? [],
        payouts: payoutsRes.data ?? [],
        referral_counts: referralCounts,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
