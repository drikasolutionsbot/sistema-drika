import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function testMercadoPago(apiKey: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch("https://api.mercadopago.com/v1/payment_methods", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.ok) return { success: true, message: "Conexão com Mercado Pago validada!" };
  return { success: false, message: `Erro ${res.status}: Token inválido ou sem permissão` };
}

async function testPushinPay(apiKey: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value: 100, webhook_url: "https://test.com" }),
  });
  if (res.ok || res.status === 400 || res.status === 422) {
    return { success: true, message: "Token PushinPay validado!" };
  }
  if (res.status === 401 || res.status === 403) {
    return { success: false, message: "Token PushinPay inválido ou expirado" };
  }
  return { success: false, message: `Erro ${res.status}: Verifique o token` };
}

async function testEfi(
  clientId: string,
  clientSecret: string,
  certPem?: string,
  keyPem?: string
): Promise<{ success: boolean; message: string }> {
  if (!certPem || !keyPem) {
    return { success: false, message: "Certificado e chave privada PEM são obrigatórios para a API PIX da Efí" };
  }

  try {
    const credentials = btoa(`${clientId}:${clientSecret}`);

    // Normalize PEM line endings
    const normalizedCert = certPem.replace(/\r\n/g, '\n').trim();
    const normalizedKey = keyPem.replace(/\r\n/g, '\n').trim();

    // Create HTTP client with mTLS certificate (try both old and new Deno API property names)
    const httpClient = Deno.createHttpClient({
      certChain: normalizedCert,
      privateKey: normalizedKey,
      cert: normalizedCert,
      key: normalizedKey,
    } as any);

    const res = await fetch("https://pix.api.efipay.com.br/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ grant_type: "client_credentials" }),
      client: httpClient,
    } as any);

    if (res.ok) {
      return { success: true, message: "Credenciais Efí validadas com mTLS!" };
    }
    const body = await res.text();
    console.error("Efí test error:", res.status, body);
    return { success: false, message: `Erro ${res.status}: Client ID, Client Secret ou certificado inválido` };
  } catch (err) {
    console.error("Efí mTLS error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("certificate") || msg.includes("ssl") || msg.includes("tls")) {
      return { success: false, message: "Certificado PEM inválido. Verifique se converteu o .p12 corretamente." };
    }
    return { success: false, message: `Erro de conexão: ${msg}` };
  }
}

async function testMisticPay(apiKey: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch("https://api.misticpay.com/v1/account", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.ok) return { success: true, message: "Token Mistic Pay validado!" };
  if (res.status === 401 || res.status === 403) {
    return { success: false, message: "Token Mistic Pay inválido" };
  }
  return { success: true, message: "Token registrado (API indisponível para validação)" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider_key, api_key, secret_key, cert_pem, key_pem } = await req.json();

    if (!provider_key) throw new Error("Missing provider_key");
    if (!api_key) throw new Error("Missing api_key");

    let result: { success: boolean; message: string };

    switch (provider_key) {
      case "mercadopago":
        result = await testMercadoPago(api_key);
        break;
      case "pushinpay":
        result = await testPushinPay(api_key);
        break;
      case "efi":
        result = await testEfi(api_key, secret_key || "", cert_pem, key_pem);
        break;
      case "misticpay":
        result = await testMisticPay(api_key);
        break;
      default:
        result = { success: false, message: `Provedor desconhecido: ${provider_key}` };
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("test-payment error:", message);
    return new Response(JSON.stringify({ success: false, message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
