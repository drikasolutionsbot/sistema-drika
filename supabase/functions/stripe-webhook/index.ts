// Stripe Webhook: recebe eventos de pagamento e dispara entrega.
// Valida assinatura usando o webhook secret do tenant.
// Edge function pública (verify_jwt = false).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Valida assinatura t=...,v1=... usando HMAC-SHA256
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
  toleranceSec = 300
): Promise<boolean> {
  try {
    const parts = sigHeader.split(",").reduce((acc: Record<string, string[]>, part) => {
      const [k, v] = part.split("=");
      if (!k || !v) return acc;
      if (!acc[k]) acc[k] = [];
      acc[k].push(v);
      return acc;
    }, {});
    const t = parts["t"]?.[0];
    const v1List = parts["v1"] || [];
    if (!t || !v1List.length) return false;

    const tsNum = parseInt(t, 10);
    if (Math.abs(Date.now() / 1000 - tsNum) > toleranceSec) {
      console.warn("Stripe signature timestamp out of tolerance");
      // Não bloquear retries antigos da Stripe
    }

    const signedPayload = `${t}.${payload}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(signedPayload));
    const expected = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return v1List.some((v1) => v1 === expected);
  } catch (e) {
    console.error("verifyStripeSignature error:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get("stripe-signature") || "";

    const event = JSON.parse(rawBody);
    const eventType: string = event?.type || "";
    const obj = event?.data?.object || {};

    // Resolver order_id e tenant_id a partir do objeto
    let orderId: string | null = obj?.metadata?.order_id || obj?.client_reference_id || null;
    let tenantId: string | null = obj?.metadata?.tenant_id || null;
    let paymentId: string | null = obj?.id || null;

    if (!orderId && paymentId) {
      const { data: maybeOrder } = await supabase
        .from("orders")
        .select("id, tenant_id")
        .eq("payment_id", paymentId)
        .maybeSingle();
      if (maybeOrder) {
        orderId = maybeOrder.id;
        tenantId = maybeOrder.tenant_id;
      }
    }

    if (!tenantId && orderId) {
      const { data: ord } = await supabase
        .from("orders")
        .select("tenant_id")
        .eq("id", orderId)
        .maybeSingle();
      if (ord) tenantId = ord.tenant_id;
    }

    if (!tenantId) {
      console.warn("stripe-webhook: tenant não resolvido", { eventType, paymentId });
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar webhook secret e API key do tenant para validar assinatura ou consultar Stripe API
    const { data: provider } = await supabase
      .from("payment_providers")
      .select("stripe_webhook_secret, api_key_encrypted")
      .eq("tenant_id", tenantId)
      .eq("provider_key", "stripe")
      .maybeSingle();

    const webhookSecret = provider?.stripe_webhook_secret;
    let verifiedByStripe = false;
    let verifiedAmountCents: number | null = null;

    if (webhookSecret) {
      if (!sigHeader) {
        console.error("Missing stripe-signature header");
        return new Response(JSON.stringify({ error: "Missing signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ok = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
      if (!ok) {
        console.error("Invalid Stripe signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      verifiedByStripe = true;
    }

    // Eventos que confirmam pagamento
    const PAID_EVENTS = new Set([
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "payment_intent.succeeded",
    ]);

    if (PAID_EVENTS.has(eventType) && orderId) {
      const { data: order } = await supabase
        .from("orders")
        .select("id, status, tenant_id, total_cents, payment_id")
        .eq("id", orderId)
        .maybeSingle();

      if (!order) {
        return new Response(JSON.stringify({ received: true, ignored: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!verifiedByStripe) {
        const stripeApiKey = provider?.api_key_encrypted;
        const lookupId = String(paymentId || order.payment_id || "");
        if (!stripeApiKey || !lookupId) {
          console.error("stripe-webhook: secret ausente e sem api_key/payment_id para validação server-to-server");
          return new Response(JSON.stringify({ error: "Webhook signature or API verification required" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const isSession = lookupId.startsWith("cs_");
        const stripeEndpoint = isSession
          ? `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(lookupId)}`
          : `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(lookupId)}`;
        const stripeRes = await fetch(stripeEndpoint, {
          headers: { Authorization: `Bearer ${stripeApiKey}` },
        });
        if (!stripeRes.ok) {
          return new Response(JSON.stringify({ error: "Stripe API verification failed" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const stripeObj = await stripeRes.json();
        const apiPaid = isSession
          ? (stripeObj.payment_status === "paid" || stripeObj.status === "complete")
          : stripeObj.status === "succeeded";
        if (!apiPaid) {
          return new Response(JSON.stringify({ received: true, paid: false }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const rawAmt = isSession ? stripeObj.amount_total : stripeObj.amount_received;
        if (rawAmt != null && Number.isFinite(Number(rawAmt))) {
          verifiedAmountCents = Math.round(Number(rawAmt));
        }
        verifiedByStripe = true;
      } else {
        const obj = event?.data?.object;
        const rawAmt = obj?.amount_total ?? obj?.amount_received ?? obj?.amount;
        if (rawAmt != null && Number.isFinite(Number(rawAmt))) {
          verifiedAmountCents = Math.round(Number(rawAmt));
        }
      }

      if (!verifiedByStripe) {
        return new Response(JSON.stringify({ error: "Unverified Stripe event" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (verifiedAmountCents !== null && order.total_cents != null && verifiedAmountCents + 1 < order.total_cents) {
        console.error(`stripe-webhook: amount mismatch for order=${orderId}, paid=${verifiedAmountCents}, expected=${order.total_cents}`);
        return new Response(JSON.stringify({ error: "Amount below order total" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (order.status === "pending_payment") {
        const { data: claimedOrder } = await supabase
          .from("orders")
          .update({
            status: "paid",
            payment_provider: "stripe",
            payment_id: paymentId || order.payment_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .eq("status", "pending_payment")
          .select("id")
          .maybeSingle();

        if (claimedOrder) {
          // Dispara entrega com tenant_id explícito
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/deliver-order`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ order_id: orderId, tenant_id: order.tenant_id || tenantId }),
            });
          } catch (e) {
            console.error("deliver-order trigger failed:", e);
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("stripe-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
