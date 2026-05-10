// Wallet PIX OUT — sends PIX automatically via tenant's gateway
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface WithdrawBody {
  tenant_id: string;
  amount_cents: number;
  pix_key: string;
  pix_key_type?: "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
  provider_key: string; // efi | lofypay | misticpay
  description?: string;
}

function detectKeyType(key: string): string {
  const k = key.replace(/\D/g, "");
  if (/^\d{11}$/.test(k)) return "cpf";
  if (/^\d{14}$/.test(k)) return "cnpj";
  if (/^\d{10,13}$/.test(k)) return "telefone";
  if (/@/.test(key)) return "email";
  return "aleatoria";
}

// ─── Efí (Gerencianet) — official PIX send via mTLS ──────────────
async function withdrawViaEfi(opts: {
  clientId: string;
  clientSecret: string;
  certPem: string;
  keyPem: string;
  pixKey: string; // tenant's source PIX key (registered in Efí)
  destinationKey: string;
  amountBRL: number;
  description?: string;
}): Promise<{ payment_id: string; status: string }> {
  const normalizedCert = opts.certPem.replace(/\r\n/g, "\n").trim();
  const normalizedKey = opts.keyPem.replace(/\r\n/g, "\n").trim();
  const fetchOpts: any = {
    client: Deno.createHttpClient({
      certChain: normalizedCert,
      privateKey: normalizedKey,
      cert: normalizedCert,
      key: normalizedKey,
    } as any),
  };

  // OAuth
  const credentials = btoa(`${opts.clientId}:${opts.clientSecret}`);
  const tokenRes = await fetch("https://pix.api.efipay.com.br/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials" }),
    ...fetchOpts,
  } as any);
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Efí OAuth: ${tokenRes.status} ${err}`);
  }
  const { access_token } = await tokenRes.json();

  // Send PIX (envio): POST /v3/gn/pix/:idEnvio
  const idEnvio = crypto.randomUUID().replace(/-/g, "").slice(0, 35);
  const sendRes = await fetch(`https://pix.api.efipay.com.br/v3/gn/pix/${idEnvio}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      valor: opts.amountBRL.toFixed(2),
      pagador: { chave: opts.pixKey, infoPagador: (opts.description || "Saque carteira").substring(0, 140) },
      favorecido: { chave: opts.destinationKey },
    }),
    ...fetchOpts,
  } as any);

  if (!sendRes.ok) {
    const err = await sendRes.json().catch(() => ({}));
    throw new Error(err.mensagem || err.detail || `Efí PIX send: ${sendRes.status}`);
  }
  const data = await sendRes.json();
  return { payment_id: data.e2eId || idEnvio, status: data.status || "EM_PROCESSAMENTO" };
}

// ─── LofyPay — POST /api/c1/cashout/ (api-key no body, valor em REAIS) ──
function mapLofyPixKeyType(t: string): string {
  const v = (t || "").toLowerCase();
  if (v === "cpf") return "cpf";
  if (v === "cnpj") return "cnpj";
  if (v === "email") return "email";
  if (v === "phone" || v === "telefone" || v === "celular") return "phone";
  return "random";
}

async function withdrawViaLofyPay(opts: {
  apiKey: string;
  destinationKey: string;
  destinationKeyType: string;
  amountCents: number;
  description?: string;
}): Promise<{ payment_id: string; status: string }> {
  const res = await fetch("https://app.lofypay.com/api/c1/cashout/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "api-key": opts.apiKey,
      amount: Number((opts.amountCents / 100).toFixed(2)),
      pix_key: opts.destinationKey,
      pix_key_type: mapLofyPixKeyType(opts.destinationKeyType),
    }),
  });
  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { /* keep raw */ }
  if (!res.ok || data?.status === "error") {
    throw new Error(data?.message || data?.error || `LofyPay ${res.status}: ${text.slice(0, 200)}`);
  }
  return {
    payment_id: data.idTransaction || data.id || data.transaction_id || crypto.randomUUID(),
    status: data.status || "processing",
  };
}

// ─── MisticPay — POST /api/transactions/withdraw (headers ci/cs) ──────
function mapMisticPixKeyType(t: string): string {
  const v = (t || "").toUpperCase();
  if (v === "CPF") return "CPF";
  if (v === "CNPJ") return "CNPJ";
  if (v === "EMAIL") return "EMAIL";
  if (v === "PHONE" || v === "TELEFONE" || v === "CELULAR") return "TELEFONE";
  return "CHAVE_ALEATORIA";
}

async function withdrawViaMisticPay(opts: {
  clientId: string;
  clientSecret: string;
  destinationKey: string;
  destinationKeyType: string;
  amountCents: number;
  description?: string;
}): Promise<{ payment_id: string; status: string }> {
  const res = await fetch("https://api.misticpay.com/api/transactions/withdraw", {
    method: "POST",
    headers: {
      ci: opts.clientId,
      cs: opts.clientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Number((opts.amountCents / 100).toFixed(2)),
      pixKey: opts.destinationKey,
      pixKeyType: mapMisticPixKeyType(opts.destinationKeyType),
      description: opts.description || "Saque carteira",
    }),
  });
  const text = await res.text();
  let body: any = {};
  try { body = JSON.parse(text); } catch { /* keep raw */ }
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `MisticPay ${res.status}: ${text.slice(0, 200)}`);
  }
  const d = body?.data ?? {};
  return {
    payment_id: String(d.transactionId ?? d.jobId ?? crypto.randomUUID()),
    status: d.status || "QUEUED",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: WithdrawBody = await req.json();
    const { tenant_id, amount_cents, pix_key, provider_key, description } = body;

    if (!tenant_id || !amount_cents || amount_cents <= 0 || !pix_key || !provider_key) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load gateway config
    const { data: provider, error: provErr } = await supabase
      .from("payment_providers")
      .select("provider_key, api_key_encrypted, secret_key_encrypted, active, pix_out_enabled, efi_cert_pem, efi_key_pem, efi_pix_key")
      .eq("tenant_id", tenant_id)
      .eq("provider_key", provider_key)
      .maybeSingle();

    if (provErr || !provider) {
      return new Response(JSON.stringify({ error: "gateway_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!provider.active || !provider.pix_out_enabled) {
      return new Response(JSON.stringify({ error: "gateway_not_pix_out_enabled" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Source of truth for wallet funds is the GATEWAY balance (Efí/LofyPay/MisticPay),
    // not the local `wallets.balance_cents`. Verify the gateway has enough to send.
    try {
      const balRes = await supabase.functions.invoke("wallet-gateway-balance", {
        body: { tenant_id, provider_key },
      });
      const balData: any = balRes.data || {};
      // Only block when the gateway explicitly reports a balance lower than the amount.
      // If the gateway doesn't expose balance (unsupported), skip the check and let the gateway itself reject.
      if (!balData.unsupported && typeof balData.balance_cents === "number") {
        if (balData.balance_cents < amount_cents) {
          return new Response(JSON.stringify({ error: "insufficient_balance", available_cents: balData.balance_cents }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } catch { /* non-blocking — gateway will reject if truly insufficient */ }

    // Insert tx in 'processing' state (so it doesn't run twice)
    const keyType = body.pix_key_type || detectKeyType(pix_key);
    const { data: tx, error: txErr } = await supabase
      .from("wallet_transactions")
      .insert({
        tenant_id,
        type: "withdrawal",
        amount_cents,
        description: description || "Saque PIX automático",
        status: "processing",
        pix_key,
        provider: provider_key,
      } as any)
      .select("id")
      .single();
    if (txErr || !tx) throw new Error(txErr?.message || "tx_insert_failed");

    // Dispatch to gateway
    let result: { payment_id: string; status: string };
    try {
      if (provider_key === "efi") {
        if (!provider.efi_cert_pem || !provider.efi_key_pem || !provider.api_key_encrypted || !provider.secret_key_encrypted || !provider.efi_pix_key) {
          throw new Error("Efí mTLS credentials incomplete");
        }
        result = await withdrawViaEfi({
          clientId: provider.api_key_encrypted,
          clientSecret: provider.secret_key_encrypted,
          certPem: provider.efi_cert_pem,
          keyPem: provider.efi_key_pem,
          pixKey: provider.efi_pix_key,
          destinationKey: pix_key,
          amountBRL: amount_cents / 100,
          description,
        });
      } else if (provider_key === "lofypay") {
        result = await withdrawViaLofyPay({
          apiKey: provider.api_key_encrypted || "",
          destinationKey: pix_key,
          destinationKeyType: keyType,
          amountCents: amount_cents,
          description,
        });
      } else if (provider_key === "misticpay") {
        if (!provider.api_key_encrypted || !provider.secret_key_encrypted) {
          throw new Error("MisticPay precisa de Client ID (ci) e Client Secret (cs)");
        }
        result = await withdrawViaMisticPay({
          clientId: provider.api_key_encrypted,
          clientSecret: provider.secret_key_encrypted,
          destinationKey: pix_key,
          destinationKeyType: keyType,
          amountCents: amount_cents,
          description,
        });
      } else {
        throw new Error(`Provider ${provider_key} not supported for PIX OUT`);
      }
    } catch (gatewayErr: any) {
      await supabase
        .from("wallet_transactions")
        .update({ status: "rejected", description: `Falhou: ${gatewayErr.message}`.slice(0, 250) })
        .eq("id", tx.id);
      return new Response(JSON.stringify({ error: "gateway_error", message: gatewayErr.message }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save payment_id and mark transaction completed.
    // We do NOT call debit_wallet_withdrawal anymore: the funds live at the gateway,
    // not in `wallets.balance_cents`. We only track total_withdrawn_cents for history/UI.
    await supabase
      .from("wallet_transactions")
      .update({ payment_id: result.payment_id, status: "completed", completed_at: new Date().toISOString() })
      .eq("id", tx.id);

    await supabase
      .from("wallets")
      .upsert(
        { tenant_id, total_withdrawn_cents: amount_cents } as any,
        { onConflict: "tenant_id", ignoreDuplicates: false } as any,
      );
    // upsert won't increment; do an explicit increment via raw update if row exists
    const { data: w } = await supabase
      .from("wallets").select("total_withdrawn_cents").eq("tenant_id", tenant_id).maybeSingle();
    if (w) {
      await supabase
        .from("wallets")
        .update({ total_withdrawn_cents: ((w as any).total_withdrawn_cents || 0) + amount_cents, updated_at: new Date().toISOString() } as any)
        .eq("tenant_id", tenant_id);
    }

    return new Response(JSON.stringify({ ok: true, tx_id: tx.id, payment_id: result.payment_id, status: result.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[wallet-pix-withdraw] error", e);
    return new Response(JSON.stringify({ error: e.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
