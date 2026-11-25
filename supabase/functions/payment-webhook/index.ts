import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Provider-specific verification & webhook helpers ────────────────────────

interface VerifiedGatewayPayment {
  verifiedPaid: boolean;
  mappedStatus: "paid" | "pending_payment" | "canceled";
  paidCents: number | null;
  endToEndId?: string;
  externalRef?: string;
  reason?: string;
}

async function resolveGatewayCredentials(
  supabase: any,
  provider: string,
  tenantId: string,
  order: any,
  allowLandingFallback = false,
): Promise<any | null> {
  const isCentral = tenantId === "central" || tenantId === "platform";
  const effectiveTenantId = order?.tenant_id || (!isCentral ? tenantId : null);

  if (!order?.is_global && !order?.is_split && effectiveTenantId) {
    const { data: pc } = await supabase
      .from("payment_providers")
      .select("api_key_encrypted, secret_key_encrypted, efi_cert_pem, efi_key_pem, efi_pix_key")
      .eq("tenant_id", effectiveTenantId)
      .eq("provider_key", provider)
      .eq("active", true)
      .maybeSingle();
    if (pc) return pc;
  }

  if (isCentral || order?.is_global || order?.is_split || allowLandingFallback || provider === "misticpay") {
    const { data: lc } = await supabase
      .from("landing_config")
      .select("misticpay_client_id, misticpay_client_secret, misticpay_active, efi_client_id, efi_client_secret, efi_cert_pem, efi_key_pem, efi_pix_key, pushinpay_api_key, abacatepay_api_key")
      .limit(1)
      .maybeSingle();
    if (lc) {
      return {
        api_key_encrypted:
          provider === "misticpay" ? (lc as any).misticpay_client_id :
          provider === "efi" ? lc.efi_client_id :
          provider === "pushinpay" ? lc.pushinpay_api_key :
          provider === "abacatepay" ? lc.abacatepay_api_key :
          null,
        secret_key_encrypted:
          provider === "misticpay" ? (lc as any).misticpay_client_secret :
          provider === "efi" ? lc.efi_client_secret :
          null,
        efi_cert_pem: lc.efi_cert_pem,
        efi_key_pem: lc.efi_key_pem,
        efi_pix_key: lc.efi_pix_key,
      };
    }
  }

  return null;
}

async function verifyPaymentWithGateway(
  supabase: any,
  provider: string,
  paymentId: string,
  tenantId: string,
  order: any,
  allowLandingFallback = false,
): Promise<VerifiedGatewayPayment> {
  const cfg = await resolveGatewayCredentials(supabase, provider, tenantId, order, allowLandingFallback);

  if (provider === "mercadopago") {
    if (!cfg?.api_key_encrypted) return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: "No API key" };
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${cfg.api_key_encrypted}` },
    });
    if (!res.ok) return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: `MP API error: ${res.status}` };
    const payment = await res.json();
    let mappedStatus: "paid" | "pending_payment" | "canceled" = "pending_payment";
    if (payment.status === "approved") mappedStatus = "paid";
    else if (["cancelled", "refunded", "charged_back"].includes(payment.status)) mappedStatus = "canceled";
    const rawAmount = payment.transaction_amount;
    const paidCents = rawAmount != null && Number.isFinite(Number(rawAmount)) ? Math.round(Number(rawAmount) * 100) : null;
    return {
      verifiedPaid: mappedStatus === "paid",
      mappedStatus,
      paidCents,
      externalRef: payment.external_reference || undefined,
    };
  }

  if (provider === "pushinpay") {
    if (!cfg?.api_key_encrypted) return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: "No PushinPay API key" };
    const res = await fetch(`https://api.pushinpay.com.br/api/pix/cashIn/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `Bearer ${cfg.api_key_encrypted}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: `PushinPay API error: ${res.status}` };
    const data = await res.json();
    const st = String(data?.status || "").toLowerCase();
    const verifiedPaid = st === "paid" || st === "completed" || st === "approved";
    const paidCents = data?.value != null && Number.isFinite(Number(data.value)) ? Math.round(Number(data.value)) : null;
    return { verifiedPaid, mappedStatus: verifiedPaid ? "paid" : "pending_payment", paidCents };
  }

  if (provider === "efi") {
    if (!cfg?.api_key_encrypted || !cfg?.secret_key_encrypted) {
      return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: "Missing Efí credentials" };
    }
    const fetchOpts: any = {};
    if (cfg.efi_cert_pem && cfg.efi_key_pem) {
      const normalizedCert = String(cfg.efi_cert_pem).replace(/\r\n/g, "\n").trim();
      const normalizedKey = String(cfg.efi_key_pem).replace(/\r\n/g, "\n").trim();
      fetchOpts.client = Deno.createHttpClient({
        certChain: normalizedCert,
        privateKey: normalizedKey,
        cert: normalizedCert,
        key: normalizedKey,
      } as any);
    }
    const credentials = btoa(`${cfg.api_key_encrypted}:${cfg.secret_key_encrypted}`);
    const tokenRes = await fetch("https://pix.api.efipay.com.br/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ grant_type: "client_credentials" }),
      ...fetchOpts,
    } as any);
    if (!tokenRes.ok) {
      return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: `Efí OAuth error: ${tokenRes.status}` };
    }
    const tokenData = await tokenRes.json();
    const cobRes = await fetch(`https://pix.api.efipay.com.br/v2/cob/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      ...fetchOpts,
    } as any);
    if (!cobRes.ok) {
      return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: `Efí cob lookup error: ${cobRes.status}` };
    }
    const cobData = await cobRes.json();
    const verifiedPaid = cobData?.status === "CONCLUIDA";
    const pixValor = cobData?.pix?.[0]?.valor ?? cobData?.valor?.original;
    const paidCents = pixValor != null && Number.isFinite(Number(pixValor)) ? Math.round(Number(pixValor) * 100) : null;
    const endToEndId = cobData?.pix?.[0]?.endToEndId;
    return { verifiedPaid, mappedStatus: verifiedPaid ? "paid" : "pending_payment", paidCents, endToEndId };
  }

  if (provider === "misticpay") {
    const ci = cfg?.api_key_encrypted || "";
    const cs = cfg?.secret_key_encrypted || "";
    if (!ci || !cs) return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: "Missing MisticPay credentials" };
    const basicAuth = btoa(`${ci}:${cs}`);
    const res = await fetch("https://api.misticpay.com/api/transactions/check", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "ci": ci,
        "cs": cs,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactionId: paymentId }),
    });
    if (!res.ok) return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: `MisticPay API error: ${res.status}` };
    const data = await res.json();
    const txState = String(
      data?.transaction?.transactionState ||
      data?.data?.transactionState ||
      data?.transactionState ||
      data?.status ||
      ""
    ).toUpperCase();
    const verifiedPaid = txState === "COMPLETO" || txState === "PAID" || txState === "COMPLETED" || txState === "APROVADO";
    return { verifiedPaid, mappedStatus: verifiedPaid ? "paid" : "pending_payment", paidCents: null };
  }

  if (provider === "abacatepay") {
    if (!cfg?.api_key_encrypted) return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: "Missing AbacatePay API key" };
    const res = await fetch(`https://api.abacatepay.com/v1/pixQrCode/check?id=${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `Bearer ${cfg.api_key_encrypted}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: `AbacatePay API error: ${res.status}` };
    const json = await res.json();
    const data = json?.data || json;
    const status = String(data?.status || "").toUpperCase();
    const verifiedPaid = status === "PAID";
    const paidCents = data?.amount != null && Number.isFinite(Number(data.amount)) ? Math.round(Number(data.amount)) : null;
    return { verifiedPaid, mappedStatus: verifiedPaid ? "paid" : "pending_payment", paidCents };
  }

  if (provider === "lofypay") {
    const res = await fetch("https://app.lofypay.com/api/v1/webhook/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idtransaction: paymentId }),
    });
    if (!res.ok) return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: `LofyPay API error: ${res.status}` };
    const data = await res.json();
    const status = String(data?.status || "").toUpperCase();
    const verifiedPaid = status === "PAID";
    return {
      verifiedPaid,
      mappedStatus: verifiedPaid ? "paid" : "pending_payment",
      paidCents: null,
      externalRef: data?.external_reference || undefined,
    };
  }

  return { verifiedPaid: false, mappedStatus: "pending_payment", paidCents: null, reason: `Unsupported provider: ${provider}` };
}

async function claimPendingOrderAsPaid(
  supabase: any,
  order: any,
  updateFields: Record<string, any>,
): Promise<boolean> {
  const { data: updated, error } = await supabase
    .from("orders")
    .update({ ...updateFields, status: "paid", updated_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("status", "pending_payment")
    .select("id")
    .maybeSingle();
  return !error && Boolean(updated);
}

// ─── Provider-specific webhook handlers ──────────────────────────────────────
async function handleMercadoPago(body: any, tenantId: string, supabase: any) {
  const action = body?.action;
  if (!action?.startsWith("payment.")) return { handled: false, reason: "Not a payment event" };

  const paymentId = body?.data?.id;
  if (!paymentId) return { handled: false, reason: "No payment ID" };

  const verification = await verifyPaymentWithGateway(supabase, "mercadopago", String(paymentId), tenantId, null);
  if (verification.reason) return { handled: false, reason: verification.reason };

  if (!verification.externalRef) return { handled: false, reason: "No external_reference" };
  const orderId = verification.externalRef.replace(/^order_/, "");

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, tenant_id, total_cents, payment_id")
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!order) return { handled: false, reason: "Order not found" };

  if (verification.mappedStatus === "paid") {
    if (order.status !== "pending_payment") {
      return { handled: false, reason: `Order already in status ${order.status}` };
    }
    if (verification.paidCents !== null && order.total_cents != null && verification.paidCents + 1 < order.total_cents) {
      console.error(`MercadoPago amount mismatch for order ${orderId}: paid=${verification.paidCents}, expected=${order.total_cents}`);
      return { handled: false, reason: "Payment amount below order total" };
    }
    const claimed = await claimPendingOrderAsPaid(supabase, order, {
      payment_id: String(paymentId),
      payment_provider: "mercadopago",
    });
    if (!claimed) return { handled: false, reason: "Order already processed concurrently" };
    return { handled: true, order_status: "paid", payment_id: paymentId, order_id: orderId };
  }

  if (verification.mappedStatus === "canceled" && order.status === "pending_payment") {
    await supabase
      .from("orders")
      .update({ status: "canceled", payment_id: String(paymentId), payment_provider: "mercadopago", updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending_payment");
    return { handled: true, order_status: "canceled", payment_id: paymentId, order_id: orderId };
  }

  return { handled: false, order_status: verification.mappedStatus, reason: "Payment not yet approved" };
}

async function handlePushinPay(body: any, tenantId: string, supabase: any) {
  const paymentId = body?.id || body?.payment_id || body?.transaction_id;
  const status = String(body?.status || "").toLowerCase();

  if (!paymentId) return { handled: false, reason: "No payment ID in webhook" };

  const isPaid = status === "paid" || status === "completed" || status === "approved";
  if (!isPaid) return { handled: false, reason: `Status not paid: ${status}` };

  const { data: orderByPid } = await supabase
    .from("orders")
    .select("id, status, tenant_id, total_cents, payment_id, is_global, is_split")
    .eq("payment_id", String(paymentId))
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let order = orderByPid;
  if (!order) {
    const extRef = body?.external_reference || body?.metadata?.order_id;
    if (extRef) {
      const orderId = String(extRef).replace(/^order_/, "");
      const { data: orderByExt } = await supabase
        .from("orders")
        .select("id, status, tenant_id, total_cents, payment_id, is_global, is_split")
        .eq("id", orderId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (orderByExt && (!orderByExt.payment_id || orderByExt.payment_id === String(paymentId))) {
        order = orderByExt;
      }
    }
  }

  if (!order) {
    console.error(`PushinPay: No order found for payment_id=${paymentId} in tenant=${tenantId}`);
    return { handled: false, reason: "Order not found by payment_id" };
  }

  if (order.status !== "pending_payment") {
    return { handled: false, reason: "Order already processed" };
  }

  // Server-to-server verification against PushinPay API
  const verification = await verifyPaymentWithGateway(supabase, "pushinpay", String(paymentId), tenantId, order);
  if (!verification.verifiedPaid) {
    console.warn(`PushinPay webhook rejected by API check for payment=${paymentId}: ${verification.reason || "unpaid"}`);
    return { handled: false, reason: verification.reason || "Payment not confirmed by gateway API" };
  }

  if (verification.paidCents !== null && order.total_cents != null && verification.paidCents + 1 < order.total_cents) {
    console.error(`PushinPay amount mismatch for order ${order.id}: paid=${verification.paidCents}, expected=${order.total_cents}`);
    return { handled: false, reason: "Payment amount below order total" };
  }

  const claimed = await claimPendingOrderAsPaid(supabase, order, {
    payment_id: String(paymentId),
    payment_provider: "pushinpay",
  });
  if (!claimed) return { handled: false, reason: "Order already processed" };

  return { handled: true, order_status: "paid", payment_id: paymentId, order_id: order.id };
}

async function handleEfi(body: any, tenantId: string, supabase: any) {
  const pix = body?.pix?.[0];
  if (!pix) return { handled: false, reason: "No PIX data" };

  const txid = pix.txid ? String(pix.txid) : "";
  const endToEndId = pix.endToEndId ? String(pix.endToEndId) : "";

  if (!txid && !endToEndId) return { handled: false, reason: "No txid or endToEndId" };

  const isCentral = tenantId === "central" || tenantId === "platform";
  let order: any = null;
  if (txid) {
    let q = supabase
      .from("orders")
      .select("id, status, tenant_id, total_cents, payment_id, is_global, is_split")
      .eq("payment_id", txid);
    if (!isCentral) q = q.eq("tenant_id", tenantId);
    const { data } = await q.maybeSingle();
    order = data;
  }

  if (!order && endToEndId) {
    let q = supabase
      .from("orders")
      .select("id, status, tenant_id, total_cents, payment_id, is_global, is_split")
      .eq("payment_id", endToEndId);
    if (!isCentral) q = q.eq("tenant_id", tenantId);
    const { data } = await q.maybeSingle();
    order = data;
  }

  if (!order) {
    console.error(`Efí: No order found for txid=${txid} endToEndId=${endToEndId} in tenant=${tenantId}`);
    return { handled: false, reason: "Order not found" };
  }

  if (order.status !== "pending_payment") {
    return { handled: false, reason: "Order already processed" };
  }

  const cobLookupId = txid || order.payment_id;
  if (!cobLookupId) {
    return { handled: false, reason: "Missing txid for Efí verification" };
  }

  // Server-to-server verification against Efí API
  const verification = await verifyPaymentWithGateway(supabase, "efi", cobLookupId, tenantId, order);
  if (!verification.verifiedPaid) {
    console.warn(`Efí webhook rejected by API check for txid=${cobLookupId}: ${verification.reason || "unpaid"}`);
    return { handled: false, reason: verification.reason || "Payment not confirmed by Efí API" };
  }

  if (verification.paidCents !== null && order.total_cents != null && verification.paidCents + 1 < order.total_cents) {
    console.error(`Efí amount mismatch for order ${order.id}: paid=${verification.paidCents}, expected=${order.total_cents}`);
    return { handled: false, reason: "Payment amount below order total" };
  }

  const finalPaymentId = verification.endToEndId || endToEndId || cobLookupId;
  const claimed = await claimPendingOrderAsPaid(supabase, order, {
    payment_id: finalPaymentId,
    payment_provider: "efi",
  });
  if (!claimed) return { handled: false, reason: "Order already processed" };

  return { handled: true, order_status: "paid", payment_id: finalPaymentId, order_id: order.id, tenant_id: order.tenant_id };
}

async function handleMisticPay(body: any, tenantId: string, supabase: any) {
  const data = body?.data || body;
  const transactionId = data?.transactionId || body?.transactionId || data?.id || body?.id;
  const status = String(data?.status || data?.transactionState || body?.status || body?.transactionState || "").toUpperCase();
  const transactionType = String(data?.transactionType || body?.transactionType || "").toUpperCase();

  if (!transactionId) return { handled: false, reason: "No transactionId in webhook" };

  if (["RETIRADA", "WITHDRAW", "WITHDRAWAL", "CASHOUT", "PIX_OUT"].includes(transactionType)) {
    const { data: wTx } = await supabase
      .from("wallet_transactions")
      .select("id, status, payment_id")
      .eq("payment_id", String(transactionId))
      .eq("type", "withdrawal")
      .maybeSingle();

    if (!wTx) {
      return { handled: false, reason: `Withdrawal not found for transactionId=${transactionId}` };
    }

    const cfg = await resolveGatewayCredentials(supabase, "misticpay", "central", { is_global: true }, true);
    let verifiedTx: any = null;
    if (cfg?.api_key_encrypted && cfg?.secret_key_encrypted) {
      try {
        const basicAuth = btoa(`${cfg.api_key_encrypted}:${cfg.secret_key_encrypted}`);
        const checkRes = await fetch("https://api.misticpay.com/api/transactions/check", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${basicAuth}`,
            ci: cfg.api_key_encrypted,
            cs: cfg.secret_key_encrypted,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ transactionId: String(transactionId) }),
        });
        if (checkRes.ok) {
          const checkJson = await checkRes.json().catch(() => null);
          verifiedTx = checkJson?.transaction ?? checkJson?.data ?? checkJson ?? null;
        }
      } catch { /* fallback safely */ }
    }

    if (!verifiedTx) {
      return { handled: false, reason: `MisticPay withdrawal check failed for transactionId=${transactionId}` };
    }

    const verifiedState = String(verifiedTx?.transactionState || verifiedTx?.status || status).toUpperCase();
    const ben = verifiedTx?.beneficiary && typeof verifiedTx.beneficiary === "object"
      ? verifiedTx.beneficiary
      : null;

    const patch: Record<string, string> = {};
    if (ben?.name) patch.recipient_name = String(ben.name).trim();
    if (ben?.document) patch.recipient_document = String(ben.document).trim();
    if (ben?.bankName) patch.recipient_bank = String(ben.bankName).trim();
    if (ben?.ispb) patch.recipient_ispb = String(ben.ispb).trim();
    const e2e = verifiedTx?.endToEndId || verifiedTx?.end_to_end_id || data?.endToEndId;
    if (e2e) patch.end_to_end_id = String(e2e).trim();

    if (["COMPLETO", "COMPLETED", "PAID", "APROVADO", "APROVADA", "CONCLUIDO", "CONCLUIDA"].includes(verifiedState)) {
      if (wTx.status === "pending" || wTx.status === "processing") {
        await supabase.rpc("approve_wallet_withdrawal", {
          _tx_id: wTx.id,
          _admin_notes: "Saque PIX confirmado via webhook MisticPay",
        });
      }
    } else if (["FALHA", "FALHOU", "FAILED", "FAIL", "CANCELADO", "CANCELADA", "CANCELED", "CANCELLED", "RECUSADO", "RECUSADA", "ESTORNADO", "ESTORNADA", "REVERTED", "REJEITADO", "REJEITADA", "REJECTED", "ERRO", "ERROR"].includes(verifiedState)) {
      const failReason = `PIX recusado/falhou na MisticPay (${verifiedState}) — saldo estornado automaticamente`;
      if (wTx.status === "pending" || wTx.status === "processing") {
        await supabase.rpc("reject_wallet_withdrawal", {
          _tx_id: wTx.id,
          _rejection_reason: failReason,
        });
      } else if (wTx.status === "completed") {
        // Permite correção segura se um webhook posterior (ou "Reenviar Webhook") confirmar FALHA
        await supabase.rpc("refund_failed_completed_withdrawal", {
          _tx_id: wTx.id,
          _rejection_reason: failReason,
        });
      }
    }

    if (Object.keys(patch).length > 0) {
      try {
        await supabase.from("wallet_transactions").update(patch as any).eq("id", wTx.id);
      } catch (err) {
        console.warn("[payment-webhook] non-blocking recipient save error:", err);
      }
    }

    return { handled: true, withdrawal_tx_id: wTx.id, payment_id: String(transactionId), state: verifiedState };
  }

  if (transactionType && transactionType !== "DEPOSITO" && transactionType !== "CASHIN" && transactionType !== "PIX_IN") {
    return { handled: false, reason: `Not a deposit: ${transactionType}` };
  }

  if (status !== "COMPLETO" && status !== "PAID" && status !== "COMPLETED" && status !== "APROVADO") {
    return { handled: false, reason: `Status not COMPLETO: ${status}` };
  }

  const isCentral = tenantId === "central" || tenantId === "platform";
  let orderQuery = supabase
    .from("orders")
    .select("id, status, tenant_id, total_cents, payment_id, is_global, is_split")
    .eq("payment_id", String(transactionId));

  if (!isCentral) {
    orderQuery = orderQuery.eq("tenant_id", tenantId);
  }

  let { data: order } = await orderQuery.maybeSingle();

  if (!order && !isCentral) {
    const { data: globalOrder } = await supabase
      .from("orders")
      .select("id, status, tenant_id, total_cents, payment_id, is_global, is_split")
      .eq("payment_id", String(transactionId))
      .maybeSingle();
    if (globalOrder && (globalOrder.is_split || globalOrder.is_global)) {
      order = globalOrder;
    }
  }

  if (!order) {
    console.error(`MisticPay: No order found for transactionId=${transactionId} in tenant=${tenantId}`);
    return { handled: false, reason: "Order not found by payment_id" };
  }

  if (order.status !== "pending_payment") {
    return { handled: false, reason: "Order already processed" };
  }

  // Server-to-server verification against MisticPay API
  const verification = await verifyPaymentWithGateway(supabase, "misticpay", String(transactionId), tenantId, order);
  if (!verification.verifiedPaid) {
    console.warn(`MisticPay webhook rejected by API check for tx=${transactionId}: ${verification.reason || "unpaid"}`);
    return { handled: false, reason: verification.reason || "Payment not confirmed by MisticPay API" };
  }

  const claimed = await claimPendingOrderAsPaid(supabase, order, {
    payment_provider: "misticpay",
  });
  if (!claimed) return { handled: false, reason: "Order already processed" };

  return { handled: true, order_status: "paid", payment_id: String(transactionId), order_id: order.id };
}

async function handleAbacatePay(body: any, tenantId: string, supabase: any) {
  const event = body?.event || body?.type;
  const data = body?.data || body;
  const paymentId = data?.id || data?.pixQrCodeId || body?.id;
  const status = (data?.status || body?.status || "").toString().toUpperCase();

  if (!paymentId) return { handled: false, reason: "No payment ID in webhook" };

  const isPaid = status === "PAID" || event === "billing.paid" || event === "pix.paid";
  if (!isPaid) return { handled: false, reason: `Status not paid: ${status} / ${event}` };

  const { data: orderByPid } = await supabase
    .from("orders")
    .select("id, status, tenant_id, total_cents, payment_id, is_global, is_split")
    .eq("payment_id", String(paymentId))
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let order = orderByPid;
  if (!order) {
    const extRef = data?.externalId || body?.externalId;
    if (extRef) {
      const orderId = String(extRef).replace(/^order_/, "").replace(/^PIX/, "");
      const { data: orderByExt } = await supabase
        .from("orders")
        .select("id, status, tenant_id, total_cents, payment_id, is_global, is_split")
        .eq("id", orderId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (orderByExt && (!orderByExt.payment_id || orderByExt.payment_id === String(paymentId))) {
        order = orderByExt;
      }
    }
  }

  if (!order) {
    console.error(`AbacatePay: No order found for payment_id=${paymentId} in tenant=${tenantId}`);
    return { handled: false, reason: "Order not found by payment_id" };
  }

  if (order.status !== "pending_payment") {
    return { handled: false, reason: "Order already processed" };
  }

  // Server-to-server verification against AbacatePay API
  const verification = await verifyPaymentWithGateway(supabase, "abacatepay", String(paymentId), tenantId, order);
  if (!verification.verifiedPaid) {
    console.warn(`AbacatePay webhook rejected by API check for payment=${paymentId}: ${verification.reason || "unpaid"}`);
    return { handled: false, reason: verification.reason || "Payment not confirmed by AbacatePay API" };
  }

  if (verification.paidCents !== null && verification.paidCents > 0 && order.total_cents != null && verification.paidCents + 1 < order.total_cents) {
    console.error(`AbacatePay amount mismatch for order ${order.id}: paid=${verification.paidCents}, expected=${order.total_cents}`);
    return { handled: false, reason: "Payment amount below order total" };
  }

  const claimed = await claimPendingOrderAsPaid(supabase, order, {
    payment_id: String(paymentId),
    payment_provider: "abacatepay",
  });
  if (!claimed) return { handled: false, reason: "Order already processed" };

  return { handled: true, order_status: "paid", payment_id: paymentId, order_id: order.id };
}

async function handleLofyPay(body: any, tenantId: string, supabase: any) {
  const status = (body?.status || "").toString().toUpperCase();
  const paymentId = body?.idTransaction || body?.id;
  const extRef = body?.external_reference;

  if (status !== "PAID") return { handled: false, reason: `Status not PAID: ${status}` };
  if (!paymentId && !extRef) return { handled: false, reason: "No payment ID or external_reference" };

  let order: any = null;
  if (paymentId) {
    const { data } = await supabase
      .from("orders")
      .select("id, status, tenant_id, total_cents, payment_id, is_global, is_split")
      .eq("payment_id", String(paymentId))
      .eq("tenant_id", tenantId)
      .maybeSingle();
    order = data;
  }

  if (!order && extRef) {
    const orderId = String(extRef).replace(/^order_/, "");
    const { data } = await supabase
      .from("orders")
      .select("id, status, tenant_id, total_cents, payment_id, is_global, is_split")
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (data && (!data.payment_id || !paymentId || data.payment_id === String(paymentId))) {
      order = data;
    }
  }

  if (!order) {
    console.error(`LofyPay: No order found for extRef=${extRef}, paymentId=${paymentId} in tenant=${tenantId}`);
    return { handled: false, reason: "Order not found" };
  }

  if (order.status !== "pending_payment") {
    return { handled: false, reason: "Order already processed" };
  }

  const lookupTxId = String(paymentId || order.payment_id || "");
  if (!lookupTxId) {
    return { handled: false, reason: "No LofyPay transaction ID to verify" };
  }

  // Server-to-server verification against LofyPay API
  const verification = await verifyPaymentWithGateway(supabase, "lofypay", lookupTxId, tenantId, order);
  if (!verification.verifiedPaid) {
    console.warn(`LofyPay webhook rejected by API check for tx=${lookupTxId}: ${verification.reason || "unpaid"}`);
    return { handled: false, reason: verification.reason || "Payment not confirmed by LofyPay API" };
  }

  const claimed = await claimPendingOrderAsPaid(supabase, order, {
    payment_id: lookupTxId,
    payment_provider: "lofypay",
  });
  if (!claimed) return { handled: false, reason: "Order already processed" };

  return { handled: true, order_status: "paid", payment_id: lookupTxId, order_id: order.id };
}

// â”€â”€â”€ Main handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts[pathParts.length - 1] === "pix") {
      pathParts = pathParts.slice(0, -1);
    }

    // Expected path: /payment-webhook/{provider_key}/{tenant_id}
    const provider = pathParts[pathParts.length - 2];
    const tenantId = pathParts[pathParts.length - 1];

    if (!provider || !tenantId) {
      throw new Error("Missing provider or tenant_id in URL path.");
    }

    // Parse body: aceita JSON ou form-urlencoded (PushinPay envia form-urlencoded)
    const contentType = req.headers.get("content-type") || "";
    const rawBody = await req.text();
    let body: any = {};
    try {
      if (contentType.includes("application/json")) {
        body = JSON.parse(rawBody);
      } else if (contentType.includes("application/x-www-form-urlencoded") || rawBody.includes("=")) {
        const params = new URLSearchParams(rawBody);
        body = Object.fromEntries(params.entries());
        // PushinPay envia ID em maiÃºsculo (A18F2001...) â€” converter para o formato salvo (lowercase com hÃ­fens)
        if (body.id && typeof body.id === "string") {
          body.id = body.id.toLowerCase();
          // Se vier sem hÃ­fens, reformatar UUID
          if (body.id.length === 32 && !body.id.includes("-")) {
            body.id = `${body.id.slice(0,8)}-${body.id.slice(8,12)}-${body.id.slice(12,16)}-${body.id.slice(16,20)}-${body.id.slice(20)}`;
          }
        }
      } else {
        try { body = JSON.parse(rawBody); } catch { body = {}; }
      }
    } catch (e) {
      console.error("Failed to parse webhook body:", e, "raw:", rawBody.slice(0, 200));
    }
    // console.log(`payment-webhook received: provider=${pathParts[pathParts.length-2]}, content-type=${contentType}, parsed=`, JSON.stringify(body).slice(0, 500));

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify tenant exists (or allow central platform webhook)
    const isCentralWebhook = tenantId === "central" || tenantId === "platform";
    if (!isCentralWebhook) {
      const { data: tenant, error: tenantErr } = await supabase
        .from("tenants")
        .select("id")
        .eq("id", tenantId)
        .single();

      if (tenantErr || !tenant) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let result;
    const eventType = body?.action || body?.event || body?.type || "unknown";

    // Check if this gateway is platform-disabled â€” if so, ignore webhook silently
    const { data: gwRow } = await supabase
      .from("platform_gateway_settings")
      .select("enabled")
      .eq("gateway_key", provider)
      .maybeSingle();
    if (gwRow && !gwRow.enabled) {
      // console.log(`payment-webhook: gateway ${provider} is platform-disabled, ignoring.`);
      return new Response(JSON.stringify({ success: true, handled: false, reason: "gateway_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper: extract a payment_id from the webhook body for any provider
    const extractPaymentId = (): string | null => {
      const id =
        body?.pix?.[0]?.txid ||
        body?.data?.id ||
        body?.data?.transactionId ||
        body?.id ||
        body?.payment_id ||
        body?.transaction_id ||
        body?.transactionId ||
        body?.idTransaction ||
        body?.txid ||
        body?.pixQrCode?.id ||
        body?.pix?.[0]?.endToEndId ||
        null;
      return id ? String(id) : null;
    };

    switch (provider) {
      case "mercadopago":
        result = await handleMercadoPago(body, tenantId, supabase);
        break;
      case "pushinpay":
        result = await handlePushinPay(body, tenantId, supabase);
        break;
      case "efi":
        result = await handleEfi(body, tenantId, supabase);
        break;
      case "misticpay":
        result = await handleMisticPay(body, tenantId, supabase);
        break;
      case "abacatepay":
        result = await handleAbacatePay(body, tenantId, supabase);
        break;
      case "lofypay":
        result = await handleLofyPay(body, tenantId, supabase);
        break;
      default:
        result = { handled: false, reason: `Unknown provider: ${provider}` };
    }

    // ─── Wallet deposit & subscription fallbacks: credit ONLY after server-to-server provider confirmation ───
    if (!result?.handled) {
      try {
        const pid = extractPaymentId();
        if (pid) {
          let walletQuery = supabase
            .from("wallet_transactions")
            .select("id, tenant_id, status, type, amount_cents")
            .in("payment_id", [pid, pid.toLowerCase()])
            .eq("type", "deposit")
            .eq("status", "pending");
          if (!isCentralWebhook) {
            walletQuery = walletQuery.eq("tenant_id", tenantId);
          }
          const { data: walletTx } = await walletQuery.maybeSingle();

          if (walletTx) {
            const verification = await verifyPaymentWithGateway(supabase, provider, pid, tenantId, null, true);
            const amountOk =
              verification.paidCents === null ||
              !walletTx.amount_cents ||
              verification.paidCents + 1 >= walletTx.amount_cents;

            if (verification.verifiedPaid && amountOk) {
              await supabase.rpc("credit_wallet_deposit", { _tx_id: walletTx.id });
              result = { handled: true, wallet_credited: true, payment_id: pid };
            } else {
              console.warn(`Wallet deposit ${walletTx.id} rejected by provider check: verified=${verification.verifiedPaid}, reason=${verification.reason}`);
            }
          } else if (provider === "efi") {
            const { data: subTx } = await supabase
              .from("subscription_payments")
              .select("id")
              .eq("payment_id", pid)
              .eq("status", "pending")
              .maybeSingle();

            if (subTx) {
              const fwdRes = await fetch(`${supabaseUrl}/functions/v1/subscription-webhook`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify(body),
              });
              if (fwdRes.ok) {
                result = { handled: true, forwarded_to: "subscription-webhook", payment_id: pid };
              }
            }
          }
        }
      } catch (e) {
        console.error("Wallet/subscription fallback failed:", e);
      }
    }

    // Log webhook (tenant_id column is uuid NOT NULL; skip insert if central/unresolved)
    const logTenantId = result?.tenant_id || (!isCentralWebhook ? tenantId : null);
    if (logTenantId) {
      try {
        await supabase.from("webhook_logs").insert({
          tenant_id: logTenantId,
          provider_key: provider,
          event_type: eventType,
          payload: body,
          result,
          status: result?.handled ? "processed" : "ignored",
        });
      } catch (logErr) {
        console.error("Failed to log webhook:", logErr);
      }
    }

    // console.log(`Webhook ${provider}/${tenantId}:`, JSON.stringify(result));

    // If payment was confirmed, trigger auto-delivery
    if (result?.handled && result?.order_status === "paid") {
      const orderId = result.order_id;

      if (orderId) {
        try {
          // --- Resolve the REAL tenant_id from the order ---
          // When the webhook arrives at /<provider>/central, tenantId is "central" (not a UUID).
          // We must always use the tenant_id stored in the order row.
          const { data: paidOrder } = await supabase
            .from("orders")
            .select("id, tenant_id, order_number, product_name, discord_user_id, discord_username, total_cents, is_split")
            .eq("id", orderId)
            .single();

          // Determine effective tenant: prefer order.tenant_id, fallback to tenantId only if it looks like a UUID
          const isCentralRoute = tenantId === "central" || tenantId === "platform";
          const effectiveTenantId: string | null =
            paidOrder?.tenant_id ||
            (!isCentralRoute ? tenantId : null);

          if (!effectiveTenantId) {
            console.error(`[Webhook] Cannot resolve tenant_id for order ${orderId}. tenantId=${tenantId}`);
          } else {
            // console.log(`[Webhook] Resolved effectiveTenantId=${effectiveTenantId} for order ${orderId}`);
          }

          // Call deliver-order function with the real tenant_id
          const deliverRes = await fetch(
            `${supabaseUrl}/functions/v1/deliver-order`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                order_id: orderId,
                tenant_id: effectiveTenantId,
              }),
            }
          );
          const deliverResult = await deliverRes.json();
          // console.log("Auto-delivery result:", JSON.stringify(deliverResult));

          if (paidOrder && effectiveTenantId) {
            // Verifica se o pedido é do modo Split (Free / Expirado > 2 dias / Global) ou Gateway Própria (Plano Pago)
            const isSplitOrder = Boolean((paidOrder as any)?.is_split) || Boolean((paidOrder as any)?.is_global);

            if (isSplitOrder && paidOrder.total_cents && paidOrder.total_cents > 0) {
              // ─── 1. MODO FREE / CENTRAL: Desconta taxas e credita valor líquido na Carteira Drika ───
              try {
                const desc = `Venda Pedido #${paidOrder.order_number || String(orderId).slice(0, 8)} - ${paidOrder.product_name || "Produto"}`;

                const walletResult = await supabase.rpc("credit_order_to_wallet", {
                  _tenant_id: effectiveTenantId,
                  _order_id: String(orderId),
                  _amount_cents: paidOrder.total_cents,
                  _description: desc,
                });

                if (walletResult?.data) {
                  const feeCents = walletResult.data.fee_cents ?? 0;
                  const netCents = walletResult.data.net_amount_cents ?? Math.max(0, paidOrder.total_cents - feeCents);
                  await supabase
                    .from("orders")
                    .update({
                      commission_cents: feeCents,
                      seller_received_cents: netCents,
                      is_split: true,
                    })
                    .eq("id", orderId);
                }
              } catch (walletErr) {
                console.error("[Wallet] Failed to credit wallet for order:", walletErr);
              }
            } else if (!isSplitOrder && paidOrder.total_cents && paidOrder.total_cents > 0) {
              // ─── 2. MODO PLANO PAGO: 100% recebido direto na conta/gateway do lojista (0% taxa Drika) ───
              try {
                await supabase
                  .from("orders")
                  .update({
                    commission_cents: 0,
                    seller_received_cents: paidOrder.total_cents,
                    is_split: false,
                  })
                  .eq("id", orderId);
              } catch (updateErr) {
                console.error("[Plano Pago] Erro ao registrar pedido sem taxa:", updateErr);
              }
            }

            // Trigger order_paid automations
            try {
              await fetch(`${supabaseUrl}/functions/v1/execute-automation`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
                body: JSON.stringify({
                  tenant_id: effectiveTenantId,
                  trigger_type: "order_paid",
                  trigger_data: {
                    discord_user_id: paidOrder.discord_user_id,
                    discord_username: paidOrder.discord_username,
                    order_id: orderId,
                    order_number: paidOrder.order_number,
                    product_name: paidOrder.product_name,
                    total_cents: paidOrder.total_cents,
                  },
                }),
              });
              // console.log("Automation order_paid triggered");
            } catch (autoErr) {
              console.error("Automation trigger failed:", autoErr);
            }
          }
        } catch (deliverErr) {
          console.error("Auto-delivery failed:", deliverErr);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("payment-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
