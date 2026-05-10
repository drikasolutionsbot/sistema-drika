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

// ─── MisticPay stub — adjust endpoints when integrating ──────────────
async function withdrawViaMisticPay(opts: {
  apiKey: string;
  destinationKey: string;
  destinationKeyType: string;
  amountCents: number;
  description?: string;
}): Promise<{ payment_id: string; status: string }> {
  const res = await fetch("https://api.misticpay.com/v1/pix/withdraw", {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: opts.amountCents,
      pix_key: opts.destinationKey,
      pix_key_type: opts.destinationKeyType,
      description: opts.description || "Saque carteira",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MisticPay: ${res.status} ${err}`);
  }
  const data = await res.json();
  return { payment_id: data.id || data.transaction_id || crypto.randomUUID(), status: data.status || "processing" };
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

    // Check wallet balance up front (advisory; debit_wallet_withdrawal will recheck atomically)
    const { data: wallet } = await supabase
      .from("wallets").select("balance_cents").eq("tenant_id", tenant_id).maybeSingle();
    if (!wallet || (wallet as any).balance_cents < amount_cents) {
      return new Response(JSON.stringify({ error: "insufficient_balance" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        result = await withdrawViaMisticPay({
          apiKey: provider.api_key_encrypted || "",
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

    // Save payment_id then atomically debit wallet
    await supabase
      .from("wallet_transactions")
      .update({ payment_id: result.payment_id })
      .eq("id", tx.id);

    const { data: debited, error: rpcErr } = await supabase.rpc("debit_wallet_withdrawal", { _tx_id: tx.id });
    if (rpcErr || !debited) {
      // Wallet debit failed (e.g. balance changed). Money already left the gateway — flag for manual reconciliation
      await supabase
        .from("wallet_transactions")
        .update({ status: "rejected", description: "ATENÇÃO: PIX enviado mas saldo não pôde ser debitado. Verificar manualmente." })
        .eq("id", tx.id);
      return new Response(JSON.stringify({ error: "debit_failed_after_send", payment_id: result.payment_id, tx_id: tx.id }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
