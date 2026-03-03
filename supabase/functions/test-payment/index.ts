import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Provider test functions ───────────────────────────────────────

async function testMercadoPago(apiKey: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch("https://api.mercadopago.com/v1/payment_methods", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.ok) return { success: true, message: "Conexão com Mercado Pago validada!" };
  const body = await res.text();
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
  // 400 with valid auth means token works but params may differ
  if (res.ok || res.status === 400 || res.status === 422) {
    return { success: true, message: "Token PushinPay validado!" };
  }
  if (res.status === 401 || res.status === 403) {
    return { success: false, message: "Token PushinPay inválido ou expirado" };
  }
  return { success: false, message: `Erro ${res.status}: Verifique o token` };
}

async function testEfi(apiKey: string, secretKey: string): Promise<{ success: boolean; message: string }> {
  // Efí uses client_credentials OAuth2
  const credentials = btoa(`${apiKey}:${secretKey}`);
  const res = await fetch("https://pix.api.efipay.com.br/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });
  if (res.ok) {
    return { success: true, message: "Credenciais Efí validadas!" };
  }
  return { success: false, message: `Erro ${res.status}: Client ID ou Client Secret inválidos` };
}

async function testMisticPay(apiKey: string): Promise<{ success: boolean; message: string }> {
  // Mistic Pay - test auth endpoint
  const res = await fetch("https://api.misticpay.com/v1/account", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.ok) return { success: true, message: "Token Mistic Pay validado!" };
  if (res.status === 401 || res.status === 403) {
    return { success: false, message: "Token Mistic Pay inválido" };
  }
  // If we can't reach API, assume format is ok
  return { success: true, message: "Token registrado (API indisponível para validação)" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider_key, api_key, secret_key } = await req.json();

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
        result = await testEfi(api_key, secret_key || "");
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
