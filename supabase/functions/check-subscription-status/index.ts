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
    const { payment_id } = await req.json();
    if (!payment_id) throw new Error("Missing payment_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("payment_id", payment_id)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ status: "not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already paid - return immediately
    if (data.status === "paid") {
      const result: any = { status: "paid" };
      if (data.metadata?.token) {
        result.token = data.metadata.token;
        result.tenant_name = data.metadata.tenant_name || null;
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If still pending, actively check the payment provider
    if (data.status === "pending") {
      const provider = data.payment_provider;

      if (provider === "efi") {
        const confirmed = await checkEfiPayment(supabase, data);
        if (confirmed) {
          // Re-fetch after activation
          const { data: updated } = await supabase
            .from("subscription_payments")
            .select("status, metadata")
            .eq("payment_id", payment_id)
            .single();

          if (updated?.status === "paid") {
            const result: any = { status: "paid" };
            if (updated.metadata?.token) {
              result.token = updated.metadata.token;
              result.tenant_name = updated.metadata.tenant_name || null;
            }
            return new Response(JSON.stringify(result), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } else if (provider === "pushinpay") {
        const confirmed = await checkPushinPayPayment(supabase, data);
        if (confirmed) {
          const { data: updated } = await supabase
            .from("subscription_payments")
            .select("status, metadata")
            .eq("payment_id", payment_id)
            .single();

          if (updated?.status === "paid") {
            const result: any = { status: "paid" };
            if (updated.metadata?.token) {
              result.token = updated.metadata.token;
              result.tenant_name = updated.metadata.tenant_name || null;
            }
            return new Response(JSON.stringify(result), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
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
      console.log("EFI config incomplete, skipping active check");
      return false;
    }

    const normalizedCert = (config.efi_cert_pem || '').replace(/\r\n/g, '\n').trim();
    const normalizedKey = (config.efi_key_pem || '').replace(/\r\n/g, '\n').trim();
    const httpClient = Deno.createHttpClient({
      certChain: normalizedCert,
      privateKey: normalizedKey,
      cert: normalizedCert,
      key: normalizedKey,
    } as any);

    // Get OAuth token
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

    // Check charge status
    const txid = subPayment.payment_id;
    const cobRes = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txid}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      client: httpClient,
    } as any);

    if (!cobRes.ok) {
      const errBody = await cobRes.text();
      console.error("EFI cob check failed:", cobRes.status, errBody);
      return false;
    }

    const cobData = await cobRes.json();
    console.log(`EFI cob status for ${txid}: ${cobData.status}`);

    // Efí statuses: ATIVA, CONCLUIDA, REMOVIDA_PELO_USUARIO_RECEBEDOR, REMOVIDA_PELO_PSP
    if (cobData.status === "CONCLUIDA") {
      // Payment confirmed! Activate subscription
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

    const res = await fetch(`https://api.pushinpay.com.br/api/transactions/${subPayment.payment_id}`, {
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
    console.log(`PushinPay status for ${subPayment.payment_id}: ${data.status}`);

    if (data.status === "paid" || data.status === "completed" || data.status === "approved") {
      await activateSubscription(supabase, subPayment);
      return true;
    }

    return false;
  } catch (err: any) {
    console.error("checkPushinPayPayment error:", err.message);
    return false;
  }
}

const SENTINEL_TENANT = "00000000-0000-0000-0000-000000000000";

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
      console.error("Failed to create user:", authError.message);
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

    // 2. Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: tenantName,
        email,
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

    // 4. Generate access token
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

    // 5. Update subscription payment
    await supabase.from("subscription_payments").update({
      status: "paid",
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
      },
      updated_at: now.toISOString(),
    }).eq("id", subPayment.id);

    // 6. Auto-create referral payout if referred
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

      console.log(`Subscription renewed for tenant ${subPayment.tenant_id}`);
    }
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
      console.log(`No active affiliate found for tenant ${referrerTenantId} code ${refCode}`);
      return;
    }

    const bonusDays = config?.referral_bonus_days ?? 7;
    const bonusCredits = config?.referral_bonus_credits_cents ?? 500;

    // Create pending payout for admin approval
    await supabase.from("affiliate_payouts").insert({
      tenant_id: referrerTenantId,
      affiliate_id: affiliate.id,
      amount_cents: bonusCredits,
      status: "pending",
      notes: `Indicação Pro: ${referredName} | +${bonusDays} dias bônus | Auto-gerado`,
    });

    // Increment affiliate sales count
    await supabase.from("affiliates")
      .update({ total_sales: (affiliate.total_sales || 0) + 1 })
      .eq("id", affiliate.id);

    console.log(`Referral payout created for affiliate ${affiliate.id}`);
  } catch (err: any) {
    console.error("processReferralReward error:", err.message);
  }
}
