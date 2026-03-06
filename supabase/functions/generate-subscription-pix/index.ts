import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, email } = await req.json();

    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get admin Efí config from landing_config
    const { data: config, error: configErr } = await supabase
      .from("landing_config")
      .select("efi_client_id, efi_client_secret, efi_active, efi_pix_key, efi_cert_pem, efi_key_pem, pro_price_cents")
      .limit(1)
      .single();

    if (configErr || !config) {
      throw new Error("Configuração de pagamento não encontrada");
    }

    if (!config.efi_client_id || !config.efi_client_secret || !config.efi_active) {
      throw new Error("Efí não configurado. Configure no painel admin.");
    }

    if (!config.efi_cert_pem || !config.efi_key_pem) {
      throw new Error("Certificado mTLS não configurado. Configure no painel admin.");
    }

    const amountCents = config.pro_price_cents || 2690;
    const amountBRL = amountCents / 100;
    const webhookUrl = `${supabaseUrl}/functions/v1/subscription-webhook`;
    // Efí exige txid com 26-35 caracteres alfanuméricos
    const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 30);

    // Normalize PEM line endings and create HTTP client with mTLS
    const normalizedCert = (config.efi_cert_pem || '').replace(/\r\n/g, '\n').trim();
    const normalizedKey = (config.efi_key_pem || '').replace(/\r\n/g, '\n').trim();
    const httpClient = Deno.createHttpClient({
      certChain: normalizedCert,
      privateKey: normalizedKey,
      cert: normalizedCert,
      key: normalizedKey,
    } as any);

    // Step 1: Get OAuth token
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
      const tokenErr = await tokenRes.text();
      console.error("Efí OAuth error:", tokenErr);
      throw new Error(`Erro de autenticação Efí: ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Step 2: Create immediate charge (cob)
    const cobRes = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        calendario: { expiracao: 3600 },
        valor: { original: amountBRL.toFixed(2) },
        chave: config.efi_pix_key || "",
        infoAdicionais: [{ nome: "Plano", valor: "Pro - Drika Hub" }],
      }),
      client: httpClient,
    } as any);

    if (!cobRes.ok) {
      const cobErr = await cobRes.json().catch(() => ({}));
      console.error("Efí cob error:", JSON.stringify(cobErr));
      throw new Error(cobErr.mensagem || `Erro ao criar cobrança: ${cobRes.status}`);
    }

    const cobData = await cobRes.json();
    let brcode = cobData.pixCopiaECola || "";
    let qrCodeBase64: string | null = null;

    // Step 3: Get QR Code
    const locId = cobData.loc?.id;
    if (locId) {
      const qrRes = await fetch(`https://pix.api.efipay.com.br/v2/loc/${locId}/qrcode`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        client: httpClient,
      } as any);
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        brcode = qrData.qrcode || brcode;
        qrCodeBase64 = qrData.imagemQrcode || null;
      }
    }

    const paymentId = cobData.txid || txId;

    // Create a subscription_payment record
    await supabase.from("subscription_payments").insert({
      tenant_id,
      plan: "pro",
      amount_cents: amountCents,
      payment_provider: "efi",
      payment_id: paymentId,
      payer_email: email || null,
      status: "pending",
    });

    console.log(`Subscription PIX generated via Efí for tenant ${tenant_id}, txid ${paymentId}`);

    return new Response(
      JSON.stringify({
        success: true,
        brcode,
        qr_code_base64: qrCodeBase64,
        payment_id: paymentId,
        amount_cents: amountCents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("generate-subscription-pix error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
