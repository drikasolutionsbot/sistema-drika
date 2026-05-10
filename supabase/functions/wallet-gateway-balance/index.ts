// Fetches the CURRENT BALANCE on the selected PIX OUT gateway (Efí, LofyPay, MisticPay)
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Body {
  tenant_id: string;
  provider_key: string; // efi | lofypay | misticpay
}

async function efiBalance(p: any): Promise<{ balance_cents: number; currency: string; raw?: any }> {
  const certPem = (p.efi_cert_pem || "").replace(/\r\n/g, "\n").trim();
  const keyPem = (p.efi_key_pem || "").replace(/\r\n/g, "\n").trim();
  if (!certPem || !keyPem) throw new Error("Certificado Efí não configurado");

  const httpClient = Deno.createHttpClient({
    certChain: certPem,
    privateKey: keyPem,
    cert: certPem,
    key: keyPem,
  } as any);

  const credentials = btoa(`${p.api_key_encrypted}:${p.secret_key_encrypted}`);
  const tokenRes = await fetch("https://pix.api.efipay.com.br/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials" }),
    client: httpClient,
  } as any);
  if (!tokenRes.ok) throw new Error(`Efí OAuth ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  // Efí: GET /v1/gn/saldo  → { "saldo": "123.45" }
  const balRes = await fetch("https://pix.api.efipay.com.br/v1/gn/saldo", {
    method: "GET",
    headers: { Authorization: `Bearer ${access_token}` },
    client: httpClient,
  } as any);
  if (!balRes.ok) {
    const errText = await balRes.text();
    throw new Error(`Efí saldo ${balRes.status}: ${errText.slice(0, 200)}`);
  }
  const data = await balRes.json();
  const reais = parseFloat(String(data.saldo ?? data.value ?? "0").replace(",", "."));
  return { balance_cents: Math.round(reais * 100), currency: "BRL", raw: data };
}

async function lofyBalance(_p: any): Promise<{ balance_cents: number; currency: string; unsupported: boolean; note: string }> {
  // LofyPay não expõe endpoint público de saldo. O saque debita do saldo interno da conta LofyPay
  // — sinalizamos para a UI mostrar "consultar no painel" em vez de R$ 0,00.
  return {
    balance_cents: 0,
    currency: "BRL",
    unsupported: true,
    note: "LofyPay não disponibiliza API de saldo. Consulte em app.lofypay.com.",
  };
}

async function misticBalance(p: any): Promise<{ balance_cents: number; currency: string; raw?: any }> {
  if (!p.api_key_encrypted || !p.secret_key_encrypted) {
    throw new Error("MisticPay precisa de Client ID (ci) e Client Secret (cs)");
  }
  const res = await fetch("https://api.misticpay.com/api/users/balance", {
    method: "GET",
    headers: {
      ci: p.api_key_encrypted,
      cs: p.secret_key_encrypted,
    },
  });
  const text = await res.text();
  let body: any = {};
  try { body = JSON.parse(text); } catch { /* keep raw */ }
  if (!res.ok) {
    throw new Error(body?.message || `MisticPay saldo ${res.status}: ${text.slice(0, 200)}`);
  }
  const reais = Number(body?.data?.balance ?? 0);
  return { balance_cents: Math.round(reais * 100), currency: "BRL", raw: body?.data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    if (!body.tenant_id || !body.provider_key) {
      return new Response(JSON.stringify({ error: "tenant_id e provider_key obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: provider, error } = await sb
      .from("payment_providers")
      .select("*")
      .eq("tenant_id", body.tenant_id)
      .eq("provider_key", body.provider_key)
      .maybeSingle();

    if (error || !provider) {
      return new Response(JSON.stringify({ error: "Gateway não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;
    if (body.provider_key === "efi") result = await efiBalance(provider);
    else if (body.provider_key === "lofypay") result = await lofyBalance(provider);
    else if (body.provider_key === "mistic_pay" || body.provider_key === "misticpay") result = await misticBalance(provider);
    else {
      return new Response(JSON.stringify({ error: "Gateway não suporta consulta de saldo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ provider_key: body.provider_key, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Erro ao consultar saldo" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
