import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── EMV TLV helpers (static PIX fallback) ─────────────────────────
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

interface PixParams {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txId?: string;
  description?: string;
}

function generateStaticBRCode(params: PixParams): string {
  const { pixKey, merchantName, merchantCity, amount, txId, description } = params;
  let payload = tlv("00", "01");
  payload += tlv("01", amount ? "12" : "11");
  let mai = tlv("00", "br.gov.bcb.pix");
  mai += tlv("01", pixKey);
  if (description) mai += tlv("02", description.substring(0, 72));
  payload += tlv("26", mai);
  payload += tlv("52", "0000");
  payload += tlv("53", "986");
  if (amount && amount > 0) payload += tlv("54", amount.toFixed(2));
  payload += tlv("58", "BR");
  payload += tlv("59", merchantName.substring(0, 25));
  payload += tlv("60", merchantCity.substring(0, 15));
  const refLabel = txId || "***";
  payload += tlv("62", tlv("05", refLabel.substring(0, 25)));
  payload += "6304";
  payload += crc16(payload);
  return payload;
}

// ─── Gateway: Mercado Pago ─────────────────────────────────────────
async function generateViaMercadoPago(
  apiKey: string,
  amountBRL: number,
  description: string,
  externalRef: string,
  webhookUrl: string
): Promise<{ brcode: string; qr_code_base64?: string; payment_id: string; expires_at?: string }> {
  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Idempotency-Key": externalRef,
    },
    body: JSON.stringify({
      transaction_amount: amountBRL,
      payment_method_id: "pix",
      description,
      statement_descriptor: "Drika Solutions",
      external_reference: externalRef,
      notification_url: webhookUrl,
      payer: { email: "customer@email.com" },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Mercado Pago error: ${res.status}`);
  }

  const data = await res.json();
  const ptp = data.point_of_interaction?.transaction_data;

  return {
    brcode: ptp?.qr_code || "",
    qr_code_base64: ptp?.qr_code_base64 || undefined,
    payment_id: String(data.id),
    expires_at: data.date_of_expiration || undefined,
  };
}

// ─── Gateway: PushinPay ────────────────────────────────────────────
async function generateViaPushinPay(
  apiKey: string,
  amountCents: number,
  webhookUrl: string
): Promise<{ brcode: string; qr_code_base64?: string; payment_id: string }> {
  const res = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      value: amountCents,
      webhook_url: webhookUrl || undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `PushinPay error: ${res.status}`);
  }

  const data = await res.json();

  return {
    brcode: data.qr_code || "",
    qr_code_base64: data.qr_code_base64 || undefined,
    payment_id: data.id,
  };
}

// ─── Gateway: Efí (Gerencianet) ────────────────────────────────────
async function generateViaEfi(
  clientId: string,
  clientSecret: string,
  amountBRL: number,
  txId: string,
  webhookUrl: string
): Promise<{ brcode: string; qr_code_base64?: string; payment_id: string }> {
  // Step 1: Get OAuth token
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const tokenRes = await fetch("https://pix.api.efipay.com.br/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Efí OAuth error: ${tokenRes.status}`);
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
      chave: "", // Will use the default key from Efí account
      infoAdicionais: [{ nome: "Pagamento", valor: "PIX via Drika" }],
    }),
  });

  if (!cobRes.ok) {
    const err = await cobRes.json().catch(() => ({}));
    throw new Error(err.mensagem || `Efí cob error: ${cobRes.status}`);
  }

  const cobData = await cobRes.json();

  // Step 3: Get QR Code for the charge
  const locId = cobData.loc?.id;
  if (locId) {
    const qrRes = await fetch(`https://pix.api.efipay.com.br/v2/loc/${locId}/qrcode`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (qrRes.ok) {
      const qrData = await qrRes.json();
      return {
        brcode: qrData.qrcode || "",
        qr_code_base64: qrData.imagemQrcode || undefined,
        payment_id: cobData.txid || txId,
      };
    }
  }

  return {
    brcode: cobData.pixCopiaECola || "",
    payment_id: cobData.txid || txId,
  };
}

// ─── Gateway: Mistic Pay ──────────────────────────────────────────
async function generateViaMisticPay(
  apiKey: string,
  amountCents: number,
  externalRef: string,
  webhookUrl: string
): Promise<{ brcode: string; qr_code_base64?: string; payment_id: string }> {
  const res = await fetch("https://api.misticpay.com/v1/pix/charge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      amount: amountCents,
      external_reference: externalRef,
      webhook_url: webhookUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Mistic Pay error: ${res.status}`);
  }

  const data = await res.json();

  return {
    brcode: data.qr_code || data.brcode || data.pix_code || "",
    qr_code_base64: data.qr_code_base64 || data.qr_code_image || undefined,
    payment_id: data.id || data.charge_id || externalRef,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, amount_cents, product_name, tx_id } = await req.json();

    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Check for active payment provider (all supported providers)
    const { data: providers } = await supabase
      .from("payment_providers")
      .select("provider_key, api_key_encrypted, secret_key_encrypted, active")
      .eq("tenant_id", tenant_id)
      .eq("active", true);

    const activeProvider = providers?.find((p: any) => p.api_key_encrypted);
    const amount = amount_cents ? amount_cents / 100 : undefined;
    const webhookBaseUrl = `${supabaseUrl}/functions/v1/payment-webhook`;

    // 2. If we have an active gateway AND an amount, use dynamic PIX
    if (activeProvider && amount && amount > 0) {
      const providerKey = activeProvider.provider_key;
      const apiKey = activeProvider.api_key_encrypted;
      const secretKey = activeProvider.secret_key_encrypted || "";
      const externalRef = tx_id || `PIX${Date.now()}`;
      const webhookUrl = `${webhookBaseUrl}/${providerKey}/${tenant_id}`;
      const description = product_name || "Pagamento PIX";

      let result: { brcode: string; qr_code_base64?: string; payment_id: string; expires_at?: string };

      switch (providerKey) {
        case "mercadopago":
          result = await generateViaMercadoPago(apiKey, amount, description, externalRef, webhookUrl);
          break;
        case "pushinpay":
          result = await generateViaPushinPay(apiKey, amount_cents, webhookUrl);
          break;
        case "efi":
          result = await generateViaEfi(apiKey, secretKey, amount, externalRef, webhookUrl);
          break;
        case "misticpay":
          result = await generateViaMisticPay(apiKey, amount_cents, externalRef, webhookUrl);
          break;
        default:
          throw new Error(`Provider ${providerKey} não suporta PIX dinâmico`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          method: "dynamic",
          provider: providerKey,
          brcode: result.brcode,
          qr_code_base64: result.qr_code_base64 || null,
          payment_id: result.payment_id,
          amount: amount.toFixed(2),
          expires_at: result.expires_at || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fallback: static PIX using tenant's pix_key
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name, pix_key, pix_key_type")
      .eq("id", tenant_id)
      .single();

    if (tenantError) throw tenantError;
    if (!tenant.pix_key) {
      throw new Error(
        activeProvider && (!amount || amount <= 0)
          ? "Informe um valor para gerar PIX dinâmico via gateway."
          : "Chave PIX não configurada e nenhum gateway ativo. Configure em Configurações > PIX ou Pagamentos."
      );
    }

    const brCode = generateStaticBRCode({
      pixKey: tenant.pix_key,
      merchantName: tenant.name || "Loja",
      merchantCity: "Brasil",
      amount,
      txId: tx_id || undefined,
      description: product_name ? `Pgto ${product_name}`.substring(0, 72) : undefined,
    });

    return new Response(
      JSON.stringify({
        success: true,
        method: "static",
        provider: null,
        brcode: brCode,
        qr_code_base64: null,
        pix_key: tenant.pix_key,
        pix_key_type: tenant.pix_key_type,
        amount: amount ? amount.toFixed(2) : null,
        expires_at: null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("generate-pix error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
