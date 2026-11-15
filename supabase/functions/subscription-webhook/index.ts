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
    const rawBody = await req.text();
    let body: any = {};
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        const params = new URLSearchParams(rawBody);
        body = Object.fromEntries(params.entries());
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // AbacatePay envia: { event: "billing.paid"|"pix.paid", data: { id, status, ... } }
    const abacateEvent = body?.event || body?.type;
    const abacateData = body?.data;
    if (abacateEvent && abacateData?.id) {
      const status = (abacateData?.status || "").toString().toUpperCase();
      const isPaid = status === "PAID" || abacateEvent === "billing.paid" || abacateEvent === "pix.paid";
      if (isPaid) {
        return await processByPaymentId(supabase, String(abacateData.id));
      }
      return new Response(JSON.stringify({ success: true, ignored: true, reason: `AbacatePay status: ${status}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Efí sends: { pix: [{ txid, valor, horario, endToEndId, ... }] }
    const pixArray = body?.pix;
    if (!pixArray || !Array.isArray(pixArray) || pixArray.length === 0) {
      const paymentId = body?.id || body?.payment_id || body?.transaction_id || body?.transactionId;
      if (!paymentId) {
        return new Response(JSON.stringify({ success: true, ignored: true, reason: "No PIX data" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return await processByPaymentId(supabase, String(paymentId));
    }

    const unmatchedPix: any[] = [];

    for (const pix of pixArray) {
      const txid = pix?.txid ? String(pix.txid) : "";
      if (!txid) continue;

      const { data: subPayment, error: subErr } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("payment_id", txid)
        .maybeSingle();

      if (subErr || !subPayment) {
        unmatchedPix.push(pix);
        continue;
      }

      if (subPayment.status === "paid" || subPayment.status === "processing") {
        continue;
      }

      const verification = await verifySubscriptionPaymentWithGateway(supabase, subPayment);
      if (!verification.verifiedPaid) {
        console.warn(`subscription-webhook rejected txid=${txid}: ${verification.reason || "unpaid"}`);
        continue;
      }

      await activateSubscription(supabase, subPayment);
    }

    // Forward unmatched Efí PIX events (e.g. central orders or wallet deposits) to payment-webhook/efi/central
    if (unmatchedPix.length > 0) {
      try {
        const forwardRes = await fetch(`${supabaseUrl}/functions/v1/payment-webhook/efi/central`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ ...body, pix: unmatchedPix }),
        });
        if (!forwardRes.ok) {
          console.error(`subscription-webhook forward to payment-webhook failed: ${forwardRes.status}`);
        }
      } catch (fwdErr: any) {
        console.error("subscription-webhook forward error:", fwdErr?.message || fwdErr);
      }
    }

    return new Response(JSON.stringify({ success: true, forwarded: unmatchedPix.length }), {
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

async function verifySubscriptionPaymentWithGateway(
  supabase: any,
  subPayment: any,
): Promise<{ verifiedPaid: boolean; reason?: string }> {
  const provider = String(subPayment.payment_provider || "").toLowerCase();
  const paymentId = String(subPayment.payment_id || "");
  if (!paymentId) return { verifiedPaid: false, reason: "Missing payment_id" };

  const { data: config } = await supabase
    .from("landing_config")
    .select("efi_client_id, efi_client_secret, efi_cert_pem, efi_key_pem, pushinpay_api_key, abacatepay_api_key")
    .limit(1)
    .maybeSingle();

  if (!config) return { verifiedPaid: false, reason: "Missing landing_config" };

  if (provider === "efi") {
    if (!config.efi_client_id || !config.efi_client_secret || !config.efi_cert_pem || !config.efi_key_pem) {
      return { verifiedPaid: false, reason: "Incomplete Efí credentials" };
    }
    const normalizedCert = String(config.efi_cert_pem).replace(/\r\n/g, "\n").trim();
    const normalizedKey = String(config.efi_key_pem).replace(/\r\n/g, "\n").trim();
    const httpClient = Deno.createHttpClient({
      certChain: normalizedCert,
      privateKey: normalizedKey,
      cert: normalizedCert,
      key: normalizedKey,
    } as any);

    const credentials = btoa(`${config.efi_client_id}:${config.efi_client_secret}`);
    const tokenRes = await fetch("https://pix.api.efipay.com.br/oauth/token", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials" }),
      client: httpClient,
    } as any);
    if (!tokenRes.ok) {
      return { verifiedPaid: false, reason: `Efí OAuth error: ${tokenRes.status}` };
    }
    const { access_token } = await tokenRes.json();

    const cobRes = await fetch(`https://pix.api.efipay.com.br/v2/cob/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${access_token}` },
      client: httpClient,
    } as any);
    if (!cobRes.ok) {
      return { verifiedPaid: false, reason: `Efí cob lookup error: ${cobRes.status}` };
    }
    const cobData = await cobRes.json();
    if (cobData?.status !== "CONCLUIDA") {
      return { verifiedPaid: false, reason: `Efí status=${cobData?.status || "unknown"}` };
    }
    const pixValor = cobData?.pix?.[0]?.valor ?? cobData?.valor?.original;
    const paidCents = pixValor != null && Number.isFinite(Number(pixValor)) ? Math.round(Number(pixValor) * 100) : null;
    if (paidCents !== null && subPayment.amount_cents && paidCents + 1 < subPayment.amount_cents) {
      return { verifiedPaid: false, reason: `Efí amount mismatch: paid=${paidCents}, expected=${subPayment.amount_cents}` };
    }
    return { verifiedPaid: true };
  }

  if (provider === "pushinpay") {
    if (!config.pushinpay_api_key) return { verifiedPaid: false, reason: "Missing PushinPay API key" };
    const res = await fetch(`https://api.pushinpay.com.br/api/transactions/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `Bearer ${config.pushinpay_api_key}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return { verifiedPaid: false, reason: `PushinPay lookup error: ${res.status}` };
    const data = await res.json();
    const status = String(data?.status || "").toLowerCase();
    const isPaid = status === "paid" || status === "completed" || status === "approved";
    if (!isPaid) return { verifiedPaid: false, reason: `PushinPay status=${status}` };
    const rawVal = data?.value ?? data?.amount;
    const paidCents = rawVal != null && Number.isFinite(Number(rawVal)) ? Math.round(Number(rawVal)) : null;
    if (paidCents !== null && subPayment.amount_cents && paidCents + 1 < subPayment.amount_cents) {
      return { verifiedPaid: false, reason: `PushinPay amount mismatch: paid=${paidCents}, expected=${subPayment.amount_cents}` };
    }
    return { verifiedPaid: true };
  }

  if (provider === "abacatepay") {
    if (!config.abacatepay_api_key) return { verifiedPaid: false, reason: "Missing AbacatePay API key" };
    const res = await fetch(`https://api.abacatepay.com/v1/pixQrCode/check?id=${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `Bearer ${config.abacatepay_api_key}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return { verifiedPaid: false, reason: `AbacatePay lookup error: ${res.status}` };
    const json = await res.json();
    const data = json?.data || json;
    const status = String(data?.status || "").toUpperCase();
    if (status !== "PAID") return { verifiedPaid: false, reason: `AbacatePay status=${status}` };
    const paidCents = data?.amount != null && Number.isFinite(Number(data.amount)) ? Math.round(Number(data.amount)) : null;
    if (paidCents !== null && subPayment.amount_cents && paidCents + 1 < subPayment.amount_cents) {
      return { verifiedPaid: false, reason: `AbacatePay amount mismatch: paid=${paidCents}, expected=${subPayment.amount_cents}` };
    }
    return { verifiedPaid: true };
  }

  return { verifiedPaid: false, reason: `Unsupported provider: ${provider}` };
}

async function processByPaymentId(supabase: any, paymentId: string) {
  const { data: subPayment, error: subErr } = await supabase
    .from("subscription_payments")
    .select("*")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (subErr || !subPayment) {
    return new Response(JSON.stringify({ success: true, ignored: true, reason: "No matching subscription" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (subPayment.status === "paid" || subPayment.status === "processing") {
    return new Response(JSON.stringify({ success: true, already_processed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const verification = await verifySubscriptionPaymentWithGateway(supabase, subPayment);
  if (!verification.verifiedPaid) {
    console.warn(`processByPaymentId rejected payment=${paymentId}: ${verification.reason || "unpaid"}`);
    return new Response(JSON.stringify({ success: true, ignored: true, reason: verification.reason || "Payment not verified" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await activateSubscription(supabase, subPayment);

  const planKey = (subPayment.plan === "master" || subPayment.metadata?.plan === "master") ? "master" : "pro";
  return new Response(
    JSON.stringify({ success: true, tenant_id: subPayment.tenant_id, plan: planKey }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function activateSubscription(supabase: any, subPayment: any) {
  // Atomically claim pending -> processing so concurrent webhook/polling calls never double-activate
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
    const cycleToSet = meta.cycle || (cycleDays === 180 ? "semiannual" : cycleDays === 90 ? "quarterly" : "monthly");
    // Resolve plan: subPayment.plan column is canonical; fall back to metadata
    const planKey: "pro" | "master" = (claimed.plan === "master" || meta.plan === "master") ? "master" : "pro";

    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + cycleDays);

    if (isNewSubscriber) {
      // Create tenant + user + token from metadata
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
        console.error("Failed to create user for new subscriber:", authError.message);
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

      // 2. Create tenant with the purchased plan
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          name: tenantName,
          email: email,
          whatsapp: whatsapp || null,
          plan: planKey,
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
      const planLabelCap = planKey === "master" ? "Master" : "Básico";
      const tokenExpires = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000).toISOString();
      const { data: tokenData } = await supabase
        .from("access_tokens")
        .insert({
          tenant_id: tenant.id,
          label: `Token ${planLabelCap} - ${tenantName}`,
          created_by: userId,
          expires_at: tokenExpires,
        })
        .select("token")
        .single();

      // 5. Update subscription payment with real tenant_id and token
      await supabase.from("subscription_payments").update({
        status: "paid",
        plan: planKey,
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
          plan: planKey,
        },
        updated_at: now.toISOString(),
      }).eq("id", claimed.id);

      // 6. Auto-create referral payout if referred by an affiliate
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
        plan: planKey,
        paid_at: now.toISOString(),
        period_start: now.toISOString(),
        period_end: renewalPeriodEnd.toISOString(),
        updated_at: now.toISOString(),
      }).eq("id", claimed.id);

      if (autoActivate) {
        await supabase.from("tenants").update({
          plan: planKey,
          plan_cycle: cycleToSet,
          plan_started_at: now.toISOString(),
          plan_expires_at: renewalPeriodEnd.toISOString(),
          reminder_d1_sent_at: null,
          reminder_d0_sent_at: null,
          updated_at: now.toISOString(),
        }).eq("id", claimed.tenant_id);
      }

      // Check if this tenant was referred and this is their first Pro payment
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
    // Revert lock back to pending only if still in processing state
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

    if (!affiliate) {
      return;
    }

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
      .update({
        total_sales: (affiliate.total_sales || 0) + 1,
      })
      .eq("id", affiliate.id);
  } catch (err: any) {
    console.error("processReferralReward error:", err.message);
  }
}
