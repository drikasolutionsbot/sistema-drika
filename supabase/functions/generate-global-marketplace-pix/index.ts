// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { order_id } = await req.json();
    if (!order_id) throw new Error("Missing order_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, tenant_id, total_cents, product_name, is_global, status")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !order) throw new Error("Order not found");
    if (!order.is_global) throw new Error("Order is not a global marketplace order");

    const amountCents = order.total_cents;
    const amountBRL = amountCents / 100;
    if (amountCents < 100) throw new Error("Minimum amount is R$ 1,00");

    const { data: config } = await supabase
      .from("landing_config")
      .select("efi_active, efi_client_id, efi_client_secret, efi_cert_pem, efi_key_pem, efi_pix_key, pushinpay_active, pushinpay_api_key, abacatepay_active, abacatepay_api_key")
      .limit(1)
      .maybeSingle();

    if (!config) throw new Error("Configuração global de pagamento não encontrada");

    let provider = "";
    let brcode = "";
    let paymentId = "";

    // Order: Efí → PushinPay → AbacatePay (same priority as subscription PIX)
    if (config.efi_active && config.efi_client_id && config.efi_client_secret && config.efi_cert_pem && config.efi_key_pem) {
      provider = "efi";
      const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 30);
      const normalizedCert = (config.efi_cert_pem || "").replace(/\r\n/g, "\n").trim();
      const normalizedKey = (config.efi_key_pem || "").replace(/\r\n/g, "\n").trim();
      const httpClient = (Deno as any).createHttpClient({
        certChain: normalizedCert,
        privateKey: normalizedKey,
        cert: normalizedCert,
        key: normalizedKey,
      });
      const credentials = btoa(`${config.efi_client_id}:${config.efi_client_secret}`);
      const tokenRes = await fetch("https://pix.api.efipay.com.br/oauth/token", {
        method: "POST",
        headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "client_credentials" }),
        client: httpClient,
      } as any);
      if (!tokenRes.ok) throw new Error(`Erro Efí OAuth: ${tokenRes.status}`);
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      const cobRes = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          calendario: { expiracao: 1800 },
          valor: { original: amountBRL.toFixed(2) },
          chave: config.efi_pix_key || "",
          infoAdicionais: [{ nome: "Marketplace", valor: `Drika Hub - ${order.product_name}`.slice(0, 50) }],
        }),
        client: httpClient,
      } as any);
      if (!cobRes.ok) {
        const e = await cobRes.text();
        throw new Error(`Efí cob: ${cobRes.status} ${e.slice(0, 200)}`);
      }
      const cobData = await cobRes.json();
      brcode = cobData.pixCopiaECola || "";
      const locId = cobData.loc?.id;
      if (locId) {
        const qrRes = await fetch(`https://pix.api.efipay.com.br/v2/loc/${locId}/qrcode`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          client: httpClient,
        } as any);
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          brcode = qrData.qrcode || brcode;
        }
      }
      paymentId = cobData.txid || txId;
    } else if (config.pushinpay_active && config.pushinpay_api_key) {
      provider = "pushinpay";
      const res = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.pushinpay_api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value: amountCents }),
      });
      if (!res.ok) throw new Error(`PushinPay: ${res.status}`);
      const data = await res.json();
      brcode = data.qr_code || data.brcode || "";
      paymentId = String(data.id || data.transaction_id || crypto.randomUUID());
    } else if (config.abacatepay_active && config.abacatepay_api_key) {
      provider = "abacatepay";
      const res = await fetch("https://api.abacatepay.com/v1/pixQrCode/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.abacatepay_api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountCents,
          expiresIn: 1800,
          description: `Marketplace Global - ${order.product_name}`.slice(0, 100),
          externalId: `gml_${order.id}`,
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`AbacatePay: ${res.status} ${text.slice(0, 200)}`);
      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch { /* ignore */ }
      const d = parsed?.data || parsed;
      brcode = d.brCode || d.brcode || d.qrCode || d.qrcode || d.pixCopyPaste || d.pixCopiaECola || "";
      paymentId = String(d.id || d.transactionId || crypto.randomUUID());
    } else {
      throw new Error("Nenhum gateway global ativo. Ative Efí, PushinPay ou AbacatePay no painel admin.");
    }

    await supabase
      .from("orders")
      .update({ payment_id: paymentId, payment_provider: provider })
      .eq("id", order.id);

    return json({ brcode, payment_id: paymentId, provider });
  } catch (e: any) {
    console.error("[generate-global-marketplace-pix]", e?.message || e);
    return json({ error: e?.message || String(e) }, 400);
  }
});
