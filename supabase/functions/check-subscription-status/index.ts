import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SENTINEL_TENANT = "00000000-0000-0000-0000-000000000000";

function buildPaidResponse(paymentRow: any) {
  const result: any = { status: "paid", matched_payment_id: paymentRow.payment_id };
  if (paymentRow.metadata?.token) {
    result.token = paymentRow.metadata.token;
    result.tenant_name = paymentRow.metadata.tenant_name || null;
  }
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function checkSinglePayment(supabase: any, subPayment: any): Promise<any | null> {
  if (!subPayment || subPayment.status !== "pending") return null;

  const provider = String(subPayment.payment_provider || "").toLowerCase();
  let confirmed = false;

  if (provider === "efi") {
    confirmed = await checkEfiPayment(supabase, subPayment);
  } else if (provider === "pushinpay") {
    confirmed = await checkPushinPayPayment(supabase, subPayment);
  } else if (provider === "abacatepay") {
    confirmed = await checkAbacatePayPayment(supabase, subPayment);
  }

  if (!confirmed) return null;

  const { data: updated } = await supabase
    .from("subscription_payments")
    .select("payment_id, status, metadata")
    .eq("id", subPayment.id)
    .maybeSingle();

  return updated?.status === "paid" ? updated : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const payment_id = body?.payment_id ? String(body.payment_id) : null;
    const requestedTenantId = body?.tenant_id ? String(body.tenant_id) : null;
    if (!payment_id && !requestedTenantId) throw new Error("Missing payment_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let data: any = null;
    if (payment_id) {
      const { data: row } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("payment_id", payment_id)
        .maybeSingle();
      data = row;
    }

    if (data?.status === "paid") {
      return buildPaidResponse(data);
    }

    if (data?.status === "pending") {
      const paidRow = await checkSinglePayment(supabase, data);
      if (paidRow) return buildPaidResponse(paidRow);
    }

    // Fallback: if the user clicked "Gerar Novo PIX" shortly after paying the previous QR code,
    // also check up to 5 recent pending payments for the same tenant from the last 2 hours.
    const effectiveTenantId =
      requestedTenantId ||
      (data?.tenant_id && data.tenant_id !== SENTINEL_TENANT ? String(data.tenant_id) : null);

    if (effectiveTenantId && effectiveTenantId !== SENTINEL_TENANT) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      let siblingsQuery = supabase
        .from("subscription_payments")
        .select("*")
        .eq("tenant_id", effectiveTenantId)
        .eq("status", "pending")
        .gte("created_at", twoHoursAgo)
        .order("created_at", { ascending: false })
        .limit(5);

      if (payment_id) {
        siblingsQuery = siblingsQuery.neq("payment_id", payment_id);
      }

      const { data: pendingSiblings } = await siblingsQuery;
      for (const sibling of pendingSiblings || []) {
        const paidSibling = await checkSinglePayment(supabase, sibling);
        if (paidSibling) return buildPaidResponse(paidSibling);
      }
    }

    if (!data) {
      return new Response(JSON.stringify({ status: "not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: data.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("check-subscription-status error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function checkEfiPayment(supabase: any, subPayment: any): Promise<boolean> {
  try {
    const { data: config } = await supabase
      .from("landing_config")
      .select("efi_client_id, efi_client_secret, efi_cert_pem, efi_key_pem")
      .limit(1)
      .single();

    if (!config?.efi_client_id || !config?.efi_client_secret || !config?.efi_cert_pem || !config?.efi_key_pem) {
      return false;
    }

    const normalizedCert = (config.efi_cert_pem || "").replace(/\r\n/g, "\n").trim();
    const normalizedKey = (config.efi_key_pem || "").replace(/\r\n/g, "\n").trim();
    const httpClient = Deno.createHttpClient({
      certChain: normalizedCert,
      privateKey: normalizedKey,
      cert: normalizedCert,
      key: normalizedKey,
    } as any);

    const credentials = btoa(`${config.efi_client_id}:${config.efi_client_secret}`);
    const tokenRes = await fetch("https://pix.api.efipay.com.br/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ grant_type: "client_credentials" }),
      client: httpClient,
    } as any);

    if (!tokenRes.ok) {
      console.error("EFI OAuth failed:", await tokenRes.text());
      return false;
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const txid = subPayment.payment_id;
    const cobRes = await fetch(`https://pix.api.efipay.com.br/v2/cob/${encodeURIComponent(txid)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      client: httpClient,
    } as any);

    if (!cobRes.ok) {
      const errBody = await cobRes.text();
      console.error("EFI cob check failed:", cobRes.status, errBody);
      return false;
    }

    const cobData = await cobRes.json();

    if (cobData.status === "CONCLUIDA") {
      const pixValor = cobData?.pix?.[0]?.valor ?? cobData?.valor?.original;
      const paidCents = pixValor != null && Number.isFinite(Number(pixValor)) ? Math.round(Number(pixValor) * 100) : null;
      if (paidCents !== null && subPayment.amount_cents && paidCents + 1 < subPayment.amount_cents) {
        console.warn(`EFI amount mismatch for txid=${txid}: paid=${paidCents}, expected=${subPayment.amount_cents}`);
        return false;
      }
      await activateSubscription(supabase, subPayment);
      return true;
    }

    return false;
  } catch (err: any) {
    console.error("checkEfiPayment error:", err.message);
    return false;
  }
}

async function checkPushinPayPayment(supabase: any, subPayment: any): Promise<boolean> {
  try {
    const { data: config } = await supabase
      .from("landing_config")
      .select("pushinpay_api_key")
      .limit(1)
      .single();

    if (!config?.pushinpay_api_key) return false;

    const res = await fetch(`https://api.pushinpay.com.br/api/transactions/${encodeURIComponent(subPayment.payment_id)}`, {
      headers: {
        Authorization: `Bearer ${config.pushinpay_api_key}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("PushinPay check failed:", res.status);
      return false;
    }

    const data = await res.json();
    const st = String(data?.status || "").toLowerCase();

    if (st === "paid" || st === "completed" || st === "approved") {
      const rawVal = data?.value ?? data?.amount;
      const paidCents = rawVal != null && Number.isFinite(Number(rawVal)) ? Math.round(Number(rawVal)) : null;
      if (paidCents !== null && subPayment.amount_cents && paidCents + 1 < subPayment.amount_cents) {
        console.warn(`PushinPay amount mismatch for ${subPayment.payment_id}: paid=${paidCents}, expected=${subPayment.amount_cents}`);
        return false;
      }
      await activateSubscription(supabase, subPayment);
      return true;
    }

    return false;
  } catch (err: any) {
    console.error("checkPushinPayPayment error:", err.message);
    return false;
  }
}

async function checkAbacatePayPayment(supabase: any, subPayment: any): Promise<boolean> {
  try {
    const { data: config } = await supabase
      .from("landing_config")
      .select("abacatepay_api_key")
      .limit(1)
      .single();

    if (!config?.abacatepay_api_key) return false;

    const res = await fetch(`https://api.abacatepay.com/v1/pixQrCode/check?id=${encodeURIComponent(subPayment.payment_id)}`, {
      headers: {
        Authorization: `Bearer ${config.abacatepay_api_key}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) return false;
    const json = await res.json();
    const data = json?.data || json;
    const st = String(data?.status || "").toUpperCase();
    if (st !== "PAID") return false;

    const paidCents = data?.amount != null && Number.isFinite(Number(data.amount)) ? Math.round(Number(data.amount)) : null;
    if (paidCents !== null && subPayment.amount_cents && paidCents + 1 < subPayment.amount_cents) {
      console.warn(`AbacatePay amount mismatch for ${subPayment.payment_id}: paid=${paidCents}, expected=${subPayment.amount_cents}`);
      return false;
    }

    await activateSubscription(supabase, subPayment);
    return true;
  } catch (err: any) {
    console.error("checkAbacatePayPayment error:", err.message);
    return false;
  }
}

async function activateSubscription(supabase: any, subPayment: any) {
  const now = new Date();
  const { data: claimed, error: claimErr } = await supabase
    .from("subscription_payments")
    .update({ status: "processing", updated_at: now.toISOString() })
    .eq("id", subPayment.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (claimErr || !claimed) {
    return;
  }

  try {
    const { data: config } = await supabase
      .from("landing_config")
      .select("auto_activate_plan, referral_bonus_days, referral_bonus_credits_cents")
      .limit(1)
      .single();

    const autoActivate = config?.auto_activate_plan !== false;

    const isNewSubscriber = claimed.tenant_id === SENTINEL_TENANT;
    const meta = claimed.metadata || {};
    const refCode = meta.ref_code || null;
    const cycleDays = meta.cycle_days || (meta.cycle === "semiannual" ? 180 : meta.cycle === "quarterly" ? 90 : 30);
    const planToSet: "pro" | "master" = (claimed.plan === "master" || meta.plan === "master") ? "master" : "pro";
    const cycleToSet = meta.cycle || (cycleDays === 180 ? "semiannual" : cycleDays === 90 ? "quarterly" : "monthly");

    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + cycleDays);

    if (isNewSubscriber) {
      const { email, password, whatsapp, name } = meta;

      if (!email || !password) {
        console.error("Missing registration data in metadata for new subscriber");
        await supabase.from("subscription_payments").update({
          status: "error",
          metadata: { ...meta, error: "Missing registration data" },
          updated_at: now.toISOString(),
        }).eq("id", claimed.id);
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
        console.error("Failed to create user:", authError.message);
        await supabase.from("subscription_payments").update({
          status: "error",
          metadata: { ...meta, error: authError.message },
          updated_at: now.toISOString(),
        }).eq("id", claimed.id);
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

      // 2. Create tenant
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          name: tenantName,
          email,
          whatsapp: whatsapp || null,
          plan: planToSet,
          plan_cycle: cycleToSet,
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
        }).eq("id", claimed.id);
        return;
      }

      // 3. Assign owner role
      await supabase.from("user_roles").insert({
        user_id: userId,
        tenant_id: tenant.id,
        role: "owner",
      });

      // 4. Generate access token
      const tokenExpires = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000).toISOString();
      const { data: tokenData } = await supabase
        .from("access_tokens")
        .insert({
          tenant_id: tenant.id,
          label: `Token ${planToSet === "master" ? "Master" : "Básico"} - ${tenantName}`,
          created_by: userId,
          expires_at: tokenExpires,
        })
        .select("token")
        .single();

      // 5. Update subscription payment
      await supabase.from("subscription_payments").update({
        status: "paid",
        plan: planToSet,
        paid_at: now.toISOString(),
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
        tenant_id: tenant.id,
        metadata: {
          ...meta,
          password: "***",
          token: tokenData?.token || null,
          tenant_name: tenantName,
          registered: true,
          plan: planToSet,
        },
        updated_at: now.toISOString(),
      }).eq("id", claimed.id);

      // 6. Auto-create referral payout if referred
      if (referredByTenantId) {
        await processReferralReward(supabase, referredByTenantId, refCode, config, tenantName);
      }
    } else {
      // Existing tenant renewal/upgrade
      const { data: currentTenant } = await supabase
        .from("tenants")
        .select("plan, plan_expires_at")
        .eq("id", claimed.tenant_id)
        .single();

      let renewalPeriodEnd = new Date(now);
      // Only extend remaining time if already on a paid plan (ignore 4-day free trial expiry)
      if (
        currentTenant?.plan &&
        currentTenant.plan !== "free" &&
        currentTenant.plan_expires_at &&
        new Date(currentTenant.plan_expires_at) > now
      ) {
        renewalPeriodEnd = new Date(currentTenant.plan_expires_at);
      }
      renewalPeriodEnd.setDate(renewalPeriodEnd.getDate() + cycleDays);

      await supabase.from("subscription_payments").update({
        status: "paid",
        plan: planToSet,
        paid_at: now.toISOString(),
        period_start: now.toISOString(),
        period_end: renewalPeriodEnd.toISOString(),
        updated_at: now.toISOString(),
      }).eq("id", claimed.id);

      if (autoActivate) {
        await supabase.from("tenants").update({
          plan: planToSet,
          plan_cycle: cycleToSet,
          plan_started_at: now.toISOString(),
          plan_expires_at: renewalPeriodEnd.toISOString(),
          reminder_d1_sent_at: null,
          reminder_d0_sent_at: null,
          updated_at: now.toISOString(),
        }).eq("id", claimed.tenant_id);
      }

      const { data: tenantData } = await supabase
        .from("tenants")
        .select("referred_by_tenant_id, name")
        .eq("id", claimed.tenant_id)
        .single();

      if (tenantData?.referred_by_tenant_id) {
        const { data: existingReward } = await supabase
          .from("subscription_payments")
          .select("id")
          .eq("tenant_id", claimed.tenant_id)
          .eq("status", "paid")
          .neq("id", claimed.id)
          .limit(1);

        if (!existingReward || existingReward.length === 0) {
          const { data: referrerTenant } = await supabase
            .from("tenants")
            .select("referral_code")
            .eq("id", tenantData.referred_by_tenant_id)
            .single();

          if (referrerTenant?.referral_code) {
            await processReferralReward(
              supabase,
              tenantData.referred_by_tenant_id,
              referrerTenant.referral_code,
              config,
              tenantData.name || "Unknown"
            );
          }
        }
      }
    }
  } catch (err) {
    await supabase
      .from("subscription_payments")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", claimed.id)
      .eq("status", "processing");
    throw err;
  }
}

async function processReferralReward(supabase: any, referrerTenantId: string, refCode: string, config: any, referredName: string) {
  try {
    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("id, total_sales")
      .eq("tenant_id", referrerTenantId)
      .eq("code", refCode)
      .eq("active", true)
      .maybeSingle();

    if (!affiliate) return;

    const bonusDays = config?.referral_bonus_days ?? 7;
    const bonusCredits = config?.referral_bonus_credits_cents ?? 500;

    await supabase.from("affiliate_payouts").insert({
      tenant_id: referrerTenantId,
      affiliate_id: affiliate.id,
      amount_cents: bonusCredits,
      status: "pending",
      notes: `Indicação Pro: ${referredName} | +${bonusDays} dias bônus | Auto-gerado`,
    });

    await supabase.from("affiliates")
      .update({ total_sales: (affiliate.total_sales || 0) + 1 })
      .eq("id", affiliate.id);
  } catch (err: any) {
    console.error("processReferralReward error:", err.message);
  }
}
