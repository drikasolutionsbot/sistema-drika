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
    const { item_id, tenant_id, action } = await req.json();
    if (!item_id || !tenant_id) throw new Error("Missing item_id or tenant_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check payment status
    if (action === "check_status") {
      const { data: item } = await supabase
        .from("marketplace_items")
        .select("id, status, payment_id")
        .eq("id", item_id)
        .single();

      if (!item) throw new Error("Item não encontrado");

      // Already sold to this tenant
      if (item.status === "sold") {
        return respond({ status: "paid" });
      }

      // If there's a payment_id, check with provider
      if (item.payment_id && item.status === "available") {
        const { data: config } = await supabase
          .from("landing_config")
          .select("*")
          .limit(1)
          .single();

        if (config?.pushinpay_active && config?.pushinpay_api_key) {
          const paid = await checkPushinPay(config.pushinpay_api_key, item.payment_id);
          if (paid) {
            await markAsSold(supabase, item_id, tenant_id);
            return respond({ status: "paid" });
          }
        }

        if (config?.efi_active && config?.efi_client_id && config?.efi_client_secret && config?.efi_cert_pem && config?.efi_key_pem) {
          const paid = await checkEfi(config, item.payment_id);
          if (paid) {
            await markAsSold(supabase, item_id, tenant_id);
            return respond({ status: "paid" });
          }
        }
      }

      return respond({ status: "pending" });
    }

    // Generate PIX
    const { data: item, error: itemErr } = await supabase
      .from("marketplace_items")
      .select("*")
      .eq("id", item_id)
      .eq("status", "available")
      .single();

    if (itemErr || !item) throw new Error("Item não disponível");

    const amountCents = item.resale_price_cents;
    if (!amountCents || amountCents <= 0) throw new Error("Item é gratuito, use a ação de resgate");

    const { data: config, error: configErr } = await supabase
      .from("landing_config")
      .select("*")
      .limit(1)
      .single();

    if (configErr || !config) throw new Error("Configuração de pagamento não encontrada");

    if (config.efi_active && config.efi_client_id && config.efi_client_secret && config.efi_cert_pem && config.efi_key_pem) {
      return await generateViaEfi(config, supabase, item, tenant_id, amountCents);
    } else if (config.pushinpay_active && config.pushinpay_api_key) {
      return await generateViaPushinPay(config, supabase, item, tenant_id, amountCents);
    } else {
      throw new Error("Nenhum provedor de pagamento ativo no painel admin.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("generate-marketplace-pix error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function respond(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function markAsSold(supabase: any, itemId: string, tenantId: string) {
  await supabase
    .from("marketplace_items")
    .update({
      status: "sold",
      bought_by_tenant_id: tenantId,
      bought_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("status", "available");
}

async function generateViaEfi(config: any, supabase: any, item: any, tenantId: string, amountCents: number) {
  const amountBRL = amountCents / 100;
  const txId = crypto.randomUUID().replace(/-/g, "").slice(0, 30);

  const normalizedCert = (config.efi_cert_pem || "").replace(/\r\n/g, "\n").trim();
  const normalizedKey = (config.efi_key_pem || "").replace(/\r\n/g, "\n").trim();
  const httpClient = Deno.createHttpClient({
    certChain: normalizedCert,
    privateKey: normalizedKey,
    cert: normalizedCert,
    key: normalizedKey,
  } as any);

  const credentials = btoa(`${config.efi_client_id}:${config.efi_client_secret}`);
  const tokenRes = await fetch("https://pix.api.efipay.com.br/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials" }),
    client: httpClient,
  } as any);

  if (!tokenRes.ok) throw new Error(`Erro autenticação Efí: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  const cobRes = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      calendario: { expiracao: 900 },
      valor: { original: amountBRL.toFixed(2) },
      chave: config.efi_pix_key || "",
      infoAdicionais: [{ nome: "Marketplace", valor: item.title.slice(0, 60) }],
    }),
    client: httpClient,
  } as any);

  if (!cobRes.ok) {
    const cobErr = await cobRes.json().catch(() => ({}));
    throw new Error(cobErr.mensagem || `Erro cobrança Efí: ${cobRes.status}`);
  }

  const cobData = await cobRes.json();
  let brcode = cobData.pixCopiaECola || "";
  let qrCodeBase64: string | null = null;

  const locId = cobData.loc?.id;
  if (locId) {
    const qrRes = await fetch(`https://pix.api.efipay.com.br/v2/loc/${locId}/qrcode`, {
      headers: { Authorization: `Bearer ${access_token}` },
      client: httpClient,
    } as any);
    if (qrRes.ok) {
      const qrData = await qrRes.json();
      brcode = qrData.qrcode || brcode;
      qrCodeBase64 = qrData.imagemQrcode || null;
    }
  }

  const paymentId = cobData.txid || txId;

  // Save payment_id on the item
  await supabase
    .from("marketplace_items")
    .update({ payment_id: paymentId, updated_at: new Date().toISOString() })
    .eq("id", item.id);

  console.log(`Marketplace PIX generated via Efí for item ${item.id}, txid ${paymentId}`);

  return respond({
    success: true,
    brcode,
    qr_code_base64: qrCodeBase64,
    payment_id: paymentId,
    amount_cents: amountCents,
    amount: amountBRL.toFixed(2),
    provider: "efi",
  });
}

async function generateViaPushinPay(config: any, supabase: any, item: any, tenantId: string, amountCents: number) {
  const res = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.pushinpay_api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      value: amountCents,
      webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/marketplace-webhook`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("PushinPay error:", errText);
    throw new Error(`Erro PushinPay: ${res.status}`);
  }

  const data = await res.json();
  const brcode = data.qr_code || data.brcode || "";
  const qrCodeBase64 = data.qr_code_base64 || null;
  const paymentId = String(data.id || data.transaction_id || crypto.randomUUID());

  // Save payment_id on the item
  await supabase
    .from("marketplace_items")
    .update({ payment_id: paymentId, updated_at: new Date().toISOString() })
    .eq("id", item.id);

  console.log(`Marketplace PIX generated via PushinPay for item ${item.id}, id ${paymentId}`);

  return respond({
    success: true,
    brcode,
    qr_code_base64: qrCodeBase64,
    payment_id: paymentId,
    amount_cents: amountCents,
    amount: (amountCents / 100).toFixed(2),
    provider: "pushinpay",
  });
}

async function checkPushinPay(apiKey: string, paymentId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.pushinpay.com.br/api/transactions/${paymentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "paid" || data.status === "completed" || data.status === "approved";
  } catch {
    return false;
  }
}

async function checkEfi(config: any, txId: string): Promise<boolean> {
  try {
    const normalizedCert = (config.efi_cert_pem || "").replace(/\r\n/g, "\n").trim();
    const normalizedKey = (config.efi_key_pem || "").replace(/\r\n/g, "\n").trim();
    const httpClient = Deno.createHttpClient({
      certChain: normalizedCert,
      privateKey: normalizedKey,
      cert: normalizedCert,
      key: normalizedKey,
    } as any);

    const credentials = btoa(`${config.efi_client_id}:${config.efi_client_secret}`);
    const tokenRes = await fetch("https://pix.api.efipay.com.br/oauth/token", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials" }),
      client: httpClient,
    } as any);
    if (!tokenRes.ok) return false;
    const { access_token } = await tokenRes.json();

    const cobRes = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txId}`, {
      headers: { Authorization: `Bearer ${access_token}` },
      client: httpClient,
    } as any);
    if (!cobRes.ok) return false;
    const cob = await cobRes.json();
    return cob.status === "CONCLUIDA";
  } catch {
    return false;
  }
}
