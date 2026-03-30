import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, tenant_id } = await req.json();
    if (!order_id || !tenant_id) throw new Error("Missing order_id or tenant_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, status, payment_id, payment_provider, tenant_id, total_cents, product_name")
      .eq("id", order_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (orderErr || !order) throw new Error("Order not found");
    if (order.status !== "pending_payment") {
      return new Response(JSON.stringify({ status: order.status, changed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider = order.payment_provider;
    const paymentId = order.payment_id;

    if (!provider || !paymentId) {
      return new Response(JSON.stringify({ status: "pending_payment", changed: false, reason: "No provider or payment_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get provider credentials
    const { data: providerConfig } = await supabase
      .from("payment_providers")
      .select("api_key_encrypted, secret_key_encrypted, efi_cert_pem, efi_key_pem, efi_pix_key")
      .eq("tenant_id", tenant_id)
      .eq("provider_key", provider)
      .eq("active", true)
      .single();

    if (!providerConfig) {
      return new Response(JSON.stringify({ status: "pending_payment", changed: false, reason: "Provider not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let isPaid = false;

    // ── Efí: Check charge status via API ──
    if (provider === "efi") {
      const clientId = providerConfig.api_key_encrypted;
      const clientSecret = providerConfig.secret_key_encrypted;
      const certPem = providerConfig.efi_cert_pem;
      const keyPem = providerConfig.efi_key_pem;

      if (!clientId || !clientSecret) throw new Error("Efí credentials missing");

      const fetchOpts: any = {};
      if (certPem && keyPem) {
        const normalizedCert = certPem.replace(/\r\n/g, '\n').trim();
        const normalizedKey = keyPem.replace(/\r\n/g, '\n').trim();
        fetchOpts.client = Deno.createHttpClient({
          certChain: normalizedCert,
          privateKey: normalizedKey,
          cert: normalizedCert,
          key: normalizedKey,
        } as any);
      }

      // Get OAuth token
      const credentials = btoa(`${clientId}:${clientSecret}`);
      const tokenRes = await fetch("https://pix.api.efipay.com.br/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ grant_type: "client_credentials" }),
        ...fetchOpts,
      } as any);

      if (!tokenRes.ok) throw new Error(`Efí OAuth error: ${tokenRes.status}`);
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Check charge status - paymentId is the txid
      const cobRes = await fetch(`https://pix.api.efipay.com.br/v2/cob/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        ...fetchOpts,
      } as any);

      if (cobRes.ok) {
        const cobData = await cobRes.json();
        console.log(`Efí cob status for ${paymentId}: ${cobData.status}`, JSON.stringify(cobData));
        // Efí statuses: ATIVA (active), CONCLUIDA (paid), REMOVIDA_PELO_USUARIO_RECEBEDOR, REMOVIDA_PELO_PSP
        if (cobData.status === "CONCLUIDA") {
          isPaid = true;
          // Get endToEndId from pix array if available
          const endToEndId = cobData.pix?.[0]?.endToEndId;
          if (endToEndId) {
            await supabase.from("orders").update({ payment_id: endToEndId }).eq("id", order_id);
          }
        }
      }
    }

    // ── Mercado Pago: Check payment status ──
    if (provider === "mercadopago" && paymentId) {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${providerConfig.api_key_encrypted}` },
      });
      if (res.ok) {
        const payment = await res.json();
        if (payment.status === "approved") isPaid = true;
      }
    }

    // ── PushinPay: Check payment status ──
    if (provider === "pushinpay" && paymentId) {
      const res = await fetch(`https://api.pushinpay.com.br/api/pix/cashIn/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${providerConfig.api_key_encrypted}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "paid" || data.status === "completed" || data.status === "approved") isPaid = true;
      }
    }

    // If paid, update order and trigger delivery
    if (isPaid) {
      await supabase
        .from("orders")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", order_id)
        .eq("tenant_id", tenant_id);

      // Log webhook equivalent
      try {
        await supabase.from("webhook_logs").insert({
          tenant_id,
          provider_key: provider,
          event_type: "polling_confirmed",
          payload: { order_id, payment_id: paymentId, source: "polling" },
          result: { handled: true, order_status: "paid" },
          status: "processed",
        });
      } catch {}

      // Trigger delivery
      try {
        await fetch(`${supabaseUrl}/functions/v1/deliver-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ order_id, tenant_id }),
        });
      } catch (e) {
        console.error("Delivery trigger failed:", e);
      }

      // Trigger automation
      try {
        const { data: paidOrder } = await supabase
          .from("orders")
          .select("order_number, product_name, discord_user_id, discord_username, total_cents")
          .eq("id", order_id)
          .single();

        if (paidOrder) {
          await fetch(`${supabaseUrl}/functions/v1/execute-automation`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              tenant_id,
              trigger_type: "order_paid",
              trigger_data: {
                discord_user_id: paidOrder.discord_user_id,
                discord_username: paidOrder.discord_username,
                order_id,
                order_number: paidOrder.order_number,
                product_name: paidOrder.product_name,
                total_cents: paidOrder.total_cents,
              },
            }),
          });
        }
      } catch {}

      return new Response(JSON.stringify({ status: "paid", changed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "pending_payment", changed: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("check-payment-status error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
