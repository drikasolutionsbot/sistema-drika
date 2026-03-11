import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SENTINEL_TENANT = "00000000-0000-0000-0000-000000000000";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Subscription webhook received:", JSON.stringify(body));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Efí sends: { pix: [{ txid, valor, horario, endToEndId, ... }] }
    const pixArray = body?.pix;
    if (!pixArray || !Array.isArray(pixArray) || pixArray.length === 0) {
      const paymentId = body?.id || body?.payment_id;
      if (!paymentId) {
        return new Response(JSON.stringify({ success: true, ignored: true, reason: "No PIX data" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return await processByPaymentId(supabase, String(paymentId));
    }

    for (const pix of pixArray) {
      const txid = pix.txid;
      if (!txid) continue;

      const { data: subPayment, error: subErr } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("payment_id", txid)
        .single();

      if (subErr || !subPayment) {
        console.log("No matching subscription for txid:", txid);
        continue;
      }

      if (subPayment.status === "paid") {
        console.log("Already processed:", txid);
        continue;
      }

      await activateSubscription(supabase, subPayment);
      console.log(`Efí PIX confirmed for subscription ${subPayment.id}, txid ${txid}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("subscription-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processByPaymentId(supabase: any, paymentId: string) {
  const { data: subPayment, error: subErr } = await supabase
    .from("subscription_payments")
    .select("*")
    .eq("payment_id", paymentId)
    .single();

  if (subErr || !subPayment) {
    return new Response(JSON.stringify({ success: true, ignored: true, reason: "No matching subscription" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (subPayment.status === "paid") {
    return new Response(JSON.stringify({ success: true, already_processed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await activateSubscription(supabase, subPayment);

  return new Response(
    JSON.stringify({ success: true, tenant_id: subPayment.tenant_id, plan: "pro" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function activateSubscription(supabase: any, subPayment: any) {
  const { data: config } = await supabase
    .from("landing_config")
    .select("auto_activate_plan, referral_bonus_days, referral_bonus_credits_cents")
    .limit(1)
    .single();

  const autoActivate = config?.auto_activate_plan !== false;

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  const isNewSubscriber = subPayment.tenant_id === SENTINEL_TENANT;
  const meta = subPayment.metadata || {};
  const refCode = meta.ref_code || null;

  if (isNewSubscriber) {
    // Create tenant + user + token from metadata
    const { email, password, whatsapp, name } = meta;

    if (!email || !password) {
      console.error("Missing registration data in metadata for new subscriber");
      await supabase.from("subscription_payments").update({
        status: "error",
        metadata: { ...meta, error: "Missing registration data" },
        updated_at: now.toISOString(),
      }).eq("id", subPayment.id);
      return;
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { whatsapp: whatsapp || null },
    });

    if (authError) {
      console.error("Failed to create user for new subscriber:", authError.message);
      await supabase.from("subscription_payments").update({
        status: "error",
        metadata: { ...meta, error: authError.message },
        updated_at: now.toISOString(),
      }).eq("id", subPayment.id);
      return;
    }

    const userId = authData.user.id;
    const tenantName = name || email.split("@")[0];

    // Look up referring tenant by ref_code
    let referredByTenantId: string | null = null;
    if (refCode) {
      const { data: referrer } = await supabase
        .from("tenants")
        .select("id")
        .eq("referral_code", refCode)
        .eq("affiliate_active", true)
        .maybeSingle();
      if (referrer) referredByTenantId = referrer.id;
    }

    // 2. Create tenant with Pro plan
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: tenantName,
        email: email,
        whatsapp: whatsapp || null,
        plan: "pro",
        plan_started_at: now.toISOString(),
        plan_expires_at: periodEnd.toISOString(),
        referred_by_tenant_id: referredByTenantId,
      })
      .select()
      .single();

    if (tenantError) {
      console.error("Failed to create tenant:", tenantError.message);
      await supabase.auth.admin.deleteUser(userId);
      await supabase.from("subscription_payments").update({
        status: "error",
        metadata: { ...meta, error: tenantError.message },
        updated_at: now.toISOString(),
      }).eq("id", subPayment.id);
      return;
    }

    // 3. Assign owner role
    await supabase.from("user_roles").insert({
      user_id: userId,
      tenant_id: tenant.id,
      role: "owner",
    });

    // 4. Generate access token (30 days for Pro)
    const tokenExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: tokenData } = await supabase
      .from("access_tokens")
      .insert({
        tenant_id: tenant.id,
        label: `Token Pro - ${tenantName}`,
        created_by: userId,
        expires_at: tokenExpires,
      })
      .select("token")
      .single();

    // 5. Update subscription payment with real tenant_id and token
    await supabase.from("subscription_payments").update({
      status: "paid",
      paid_at: now.toISOString(),
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      tenant_id: tenant.id,
      metadata: {
        ...meta,
        password: "***", // Don't keep password
        token: tokenData?.token || null,
        tenant_name: tenantName,
        registered: true,
      },
      updated_at: now.toISOString(),
    }).eq("id", subPayment.id);

    // 6. Auto-create referral payout if referred by an affiliate
    if (referredByTenantId) {
      await processReferralReward(supabase, referredByTenantId, refCode, config, tenantName);
    }

    console.log(`New Pro subscriber registered: tenant ${tenant.id}, email ${email}`);
  } else {
    // Existing tenant renewal
    await supabase.from("subscription_payments").update({
      status: "paid",
      paid_at: now.toISOString(),
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    }).eq("id", subPayment.id);

    if (autoActivate) {
      await supabase.from("tenants").update({
        plan: "pro",
        plan_started_at: now.toISOString(),
        plan_expires_at: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      }).eq("id", subPayment.tenant_id);

      console.log(`Subscription renewed for tenant ${subPayment.tenant_id} until ${periodEnd.toISOString()}`);
    }
  }
}

async function processReferralReward(supabase: any, referrerTenantId: string, refCode: string, config: any, referredName: string) {
  try {
    // Find the affiliate record for the referring tenant
    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("id")
      .eq("tenant_id", referrerTenantId)
      .eq("code", refCode)
      .eq("active", true)
      .maybeSingle();

    if (!affiliate) {
      console.log(`No active affiliate record found for tenant ${referrerTenantId} with code ${refCode}`);
      return;
    }

    const bonusDays = config?.referral_bonus_days ?? 7;
    const bonusCredits = config?.referral_bonus_credits_cents ?? 500;

    // Create a pending payout for admin approval
    await supabase.from("affiliate_payouts").insert({
      tenant_id: referrerTenantId,
      affiliate_id: affiliate.id,
      amount_cents: bonusCredits,
      status: "pending",
      notes: `Indicação Pro: ${referredName} | +${bonusDays} dias bônus | Auto-gerado`,
    });

    // Update affiliate stats
    await supabase.from("affiliates")
      .update({
        total_sales: (await supabase.from("affiliates").select("total_sales").eq("id", affiliate.id).single()).data?.total_sales + 1 || 1,
      })
      .eq("id", affiliate.id);

    console.log(`Referral payout created for affiliate ${affiliate.id}, referrer tenant ${referrerTenantId}`);
  } catch (err: any) {
    console.error("processReferralReward error:", err.message);
  }
}
