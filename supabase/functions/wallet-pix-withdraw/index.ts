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
  provider_key: string; // efi | misticpay
  description?: string;
  existing_tx_id?: string;
}

export interface RecipientInfo {
  name: string | null;
  document: string | null;
  document_type: string | null;
  bank_name: string | null;
  ispb: string | null;
  end_to_end_id: string | null;
}

function cleanOptionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractMisticRecipient(tx: any): RecipientInfo | undefined {
  if (!tx || typeof tx !== "object") return undefined;
  const ben = tx.beneficiary && typeof tx.beneficiary === "object" ? tx.beneficiary : null;
  const name = cleanOptionalText(ben?.name);
  const document = cleanOptionalText(ben?.document);
  const document_type = cleanOptionalText(ben?.documentType)?.toLowerCase() || null;
  const bank_name = cleanOptionalText(ben?.bankName);
  const ispb = cleanOptionalText(ben?.ispb);
  const end_to_end_id = cleanOptionalText(
    tx.endToEndId ?? tx.end_to_end_id ?? tx.e2eId ?? tx.e2e
  );

  if (!name && !document && !bank_name && !ispb && !end_to_end_id) {
    return undefined;
  }

  return { name, document, document_type, bank_name, ispb, end_to_end_id };
}

function mergeRecipientInfo(
  primary?: RecipientInfo,
  fallback?: RecipientInfo
): RecipientInfo | undefined {
  if (!primary && !fallback) return undefined;
  return {
    name: primary?.name ?? fallback?.name ?? null,
    document: primary?.document ?? fallback?.document ?? null,
    document_type: primary?.document_type ?? fallback?.document_type ?? null,
    bank_name: primary?.bank_name ?? fallback?.bank_name ?? null,
    ispb: primary?.ispb ?? fallback?.ispb ?? null,
    end_to_end_id: primary?.end_to_end_id ?? fallback?.end_to_end_id ?? null,
  };
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
  tenantId: string;
  clientId: string;
  clientSecret: string;
  certPem: string;
  keyPem: string;
  pixKey: string; // tenant's source PIX key (registered in Efí)
  destinationKey: string;
  amountBRL: number;
  description?: string;
  isCentral?: boolean;
}): Promise<{ payment_id: string; status: string; recipient?: RecipientInfo }> {
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

  // Ensure webhook is registered for the source PIX key (Efí requires it for /envio).
  // For the central PIX key, preserve existing Drika Supabase webhook (e.g. subscription-webhook) instead of clobbering it.
  const targetSegment = opts.isCentral ? "central" : opts.tenantId;
  const webhookUrl = `${SUPABASE_URL}/functions/v1/payment-webhook/efi/${targetSegment}?ignorar=`;
  let needsRegister = true;
  if (opts.isCentral) {
    try {
      const checkRes = await fetch(`https://pix.api.efipay.com.br/v2/webhook/${encodeURIComponent(opts.pixKey)}`, {
        headers: { Authorization: `Bearer ${access_token}` },
        ...fetchOpts,
      } as any);
      if (checkRes.ok) {
        const current = await checkRes.json();
        const currentUrl = String(current?.webhookUrl || "");
        if (
          currentUrl.startsWith(`${SUPABASE_URL}/functions/v1/subscription-webhook`) ||
          currentUrl.startsWith(`${SUPABASE_URL}/functions/v1/payment-webhook/efi/central`)
        ) {
          needsRegister = false;
        }
      }
    } catch { /* fallback to PUT */ }
  }
  if (needsRegister) {
    const webhookRes = await fetch(`https://pix.api.efipay.com.br/v2/webhook/${encodeURIComponent(opts.pixKey)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
        "x-skip-mtls-checking": "true",
      },
      body: JSON.stringify({ webhookUrl }),
      ...fetchOpts,
    } as any);
    if (!webhookRes.ok) {
      const err = await webhookRes.json().catch(async () => ({ mensagem: await webhookRes.text().catch(() => "") }));
      throw new Error(err.mensagem || err.detail || `Efí webhook: ${webhookRes.status}`);
    }
  }

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
  const e2eId = cleanOptionalText(data?.e2eId);
  const favName = cleanOptionalText(data?.favorecido?.identificacao?.nome);
  const favDoc = cleanOptionalText(data?.favorecido?.identificacao?.cpf || data?.favorecido?.identificacao?.cnpj);
  const favBank = cleanOptionalText(data?.favorecido?.codigoBanco);
  const recipient: RecipientInfo | undefined =
    e2eId || favName || favDoc || favBank
      ? {
          name: favName,
          document: favDoc,
          document_type: favDoc ? (favDoc.replace(/\D/g, "").length === 14 ? "cnpj" : "cpf") : null,
          bank_name: favBank,
          ispb: null,
          end_to_end_id: e2eId,
        }
      : undefined;
  return { payment_id: e2eId || idEnvio, status: data.status || "EM_PROCESSAMENTO", recipient };
}

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

function normalizeMisticPixKey(key: string, mappedType: string): string {
  const trimmed = (key || "").trim();
  if (mappedType === "TELEFONE") {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
      return digits.slice(2);
    }
    return digits || trimmed;
  }
  if (mappedType === "CPF" || mappedType === "CNPJ") {
    return trimmed.replace(/\D/g, "") || trimmed;
  }
  return trimmed;
}

async function checkMisticPayWithdrawalState(opts: {
  clientId: string;
  clientSecret: string;
  transactionId: string;
}): Promise<{ state: string; detail?: string; recipient?: RecipientInfo }> {
  const basicAuth = btoa(`${opts.clientId}:${opts.clientSecret}`);
  let latestState = "QUEUED";
  let latestRecipient: RecipientInfo | undefined;

  for (const waitMs of [1800, 2200]) {
    await new Promise((r) => setTimeout(r, waitMs));
    try {
      const checkRes = await fetch("https://api.misticpay.com/api/transactions/check", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          ci: opts.clientId,
          cs: opts.clientSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transactionId: opts.transactionId }),
      });
      if (!checkRes.ok) continue;
      const checkData = await checkRes.json().catch(() => null);
      const tx = checkData?.transaction ?? checkData?.data ?? checkData ?? {};
      const state = String(tx.transactionState || tx.status || "").toUpperCase();
      latestRecipient = mergeRecipientInfo(extractMisticRecipient(tx), latestRecipient);

      if (!state) continue;
      latestState = state;
      if (["FALHA", "FAILED", "CANCELADO", "CANCELED", "RECUSADO", "ESTORNADO", "ERRO"].includes(state)) {
        const benName = tx?.beneficiary?.name;
        const detail = benName === null
          ? `MisticPay recusou o PIX (${state}): verifique se a chave PIX ou tipo estão corretos ou se a gateway está instável.`
          : `MisticPay retornou falha na transferência (${state}).`;
        return { state, detail, recipient: latestRecipient };
      }
      if (["COMPLETO", "COMPLETED", "PAID", "APROVADO", "CONCLUIDO", "CONCLUIDA"].includes(state)) {
        // Se já concluiu e temos o nome do recebedor, retorna imediatamente; senão tenta mais uma leitura rápida
        if (latestRecipient?.name) {
          return { state, recipient: latestRecipient };
        }
      }
    } catch {
      // ignore transient check failure
    }
  }
  return { state: latestState, recipient: latestRecipient };
}

async function withdrawViaMisticPay(opts: {
  clientId: string;
  clientSecret: string;
  destinationKey: string;
  destinationKeyType: string;
  amountCents: number;
  description?: string;
  webhookUrl?: string;
}): Promise<{ payment_id: string; status: string; recipient?: RecipientInfo }> {
  const basicAuth = btoa(`${opts.clientId}:${opts.clientSecret}`);
  const mappedType = mapMisticPixKeyType(opts.destinationKeyType);
  const normalizedKey = normalizeMisticPixKey(opts.destinationKey, mappedType);

  const payload: Record<string, unknown> = {
    amount: Number((opts.amountCents / 100).toFixed(2)),
    pixKey: normalizedKey,
    pixKeyType: mappedType,
    description: opts.description || "Saque carteira",
  };
  if (opts.webhookUrl) {
    payload.projectWebhook = opts.webhookUrl;
  }

  const res = await fetch("https://api.misticpay.com/api/transactions/withdraw", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      ci: opts.clientId,
      cs: opts.clientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: any = {};
  try { body = JSON.parse(text); } catch { /* keep raw */ }
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `MisticPay ${res.status}: ${text.slice(0, 200)}`);
  }
  const d = body?.data ?? body ?? {};
  const txId = d.transactionId ?? d.id ?? d.jobId;
  const initialStatus = String(d.status || d.transactionState || "QUEUED").toUpperCase();
  const initialRecipient = extractMisticRecipient(d);

  // MisticPay enfileira o saque assincronamente (HTTP 202 QUEUED) e valida a chave DICT ~1.2s depois.
  // Verificamos o status logo após o enfileiramento para não marcar "completed" em caso de FALHA imediata
  // e capturar o objeto beneficiary (nome, CPF/CNPJ, banco) retornado pelo SPI/BACEN.
  if (d.transactionId && (!initialRecipient?.name || ["QUEUED", "PENDING", "PENDENTE", "PROCESSANDO"].includes(initialStatus))) {
    const settled = await checkMisticPayWithdrawalState({
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
      transactionId: String(d.transactionId),
    });
    if (settled.detail) {
      throw new Error(settled.detail);
    }
    return {
      payment_id: String(d.transactionId),
      status: settled.state || initialStatus,
      recipient: mergeRecipientInfo(settled.recipient, initialRecipient),
    };
  }

  return {
    payment_id: String(txId ?? crypto.randomUUID()),
    status: initialStatus,
    recipient: initialRecipient,
  };
}

async function verifySuperAdminOrServiceRole(
  req: Request,
  supabase: any
): Promise<{ authorized: boolean; error?: string; user?: any; isServiceRole?: boolean }> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const apiKeyHeader = req.headers.get("apikey");

  const rawToken = (authHeader ? authHeader.replace(/^Bearer\s+/i, "") : apiKeyHeader)?.trim();
  if (!rawToken) {
    return { authorized: false, error: "Acesso não autorizado: token de autenticação ausente" };
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  // 1. Direct Service Role Key match (backend service-to-service call)
  if (serviceRoleKey && (rawToken === serviceRoleKey || apiKeyHeader === serviceRoleKey)) {
    return { authorized: true, isServiceRole: true };
  }

  // 2. JWT with service_role payload
  if (rawToken.includes(".")) {
    try {
      const parts = rawToken.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.role === "service_role") {
          return { authorized: true, isServiceRole: true };
        }
      }
    } catch {
      // Ignore parse failure, proceed to getUser
    }
  }

  // 3. User JWT verification
  const { data: { user }, error: authError } = await supabase.auth.getUser(rawToken);
  if (authError || !user) {
    return { authorized: false, error: "Acesso não autorizado: sessão de usuário inválida ou expirada" };
  }

  // 4. Check super_admin in user_roles
  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .maybeSingle();

  if (roleError || !roleRow) {
    return { authorized: false, error: "Acesso negado: permissão de super_admin necessária para executar PIX OUT" };
  }

  return { authorized: true, user, isServiceRole: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // CRITICAL SECURITY: Verify caller is super_admin or internal service_role
    const authRes = await verifySuperAdminOrServiceRole(req, supabase);
    if (!authRes.authorized) {
      return new Response(JSON.stringify({ error: authRes.error || "Acesso negado: apenas administradores autorizados ou chamadas internas podem realizar PIX OUT" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: WithdrawBody = await req.json();
    const { tenant_id, amount_cents, pix_key, provider_key, description } = body;

    if (!tenant_id || !amount_cents || amount_cents <= 0 || !pix_key || !provider_key) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Prioriza SEMPRE a Gateway Central da Plataforma (landing_config) para saques da Carteira Split
    let provider: any = null;

    if (provider_key === "misticpay" || provider_key === "mistic_pay") {
      const { data: lc } = await supabase
        .from("landing_config")
        .select("misticpay_active, misticpay_client_id, misticpay_client_secret")
        .limit(1)
        .maybeSingle();
      if ((lc as any)?.misticpay_client_id && (lc as any)?.misticpay_client_secret) {
        provider = {
          provider_key: "misticpay",
          api_key_encrypted: (lc as any).misticpay_client_id,
          secret_key_encrypted: (lc as any).misticpay_client_secret,
          active: true,
          pix_out_enabled: true,
          is_central: true,
        };
      }
    } else if (provider_key === "efi") {
      const { data: lc } = await supabase
        .from("landing_config")
        .select("efi_active, efi_client_id, efi_client_secret, efi_cert_pem, efi_key_pem, efi_pix_key")
        .limit(1)
        .maybeSingle();
      if (lc?.efi_active && lc?.efi_client_id) {
        provider = {
          provider_key: "efi",
          api_key_encrypted: lc.efi_client_id,
          secret_key_encrypted: lc.efi_client_secret,
          efi_cert_pem: lc.efi_cert_pem,
          efi_key_pem: lc.efi_key_pem,
          efi_pix_key: lc.efi_pix_key,
          active: true,
          pix_out_enabled: true,
          is_central: true,
        };
      }
    }

    // 2. Fallback para provider individual da loja apenas se a Gateway Central não estiver configurada
    if (!provider) {
      const { data: tenantProvider } = await supabase
        .from("payment_providers")
        .select("provider_key, api_key_encrypted, secret_key_encrypted, active, pix_out_enabled, efi_cert_pem, efi_key_pem, efi_pix_key")
        .eq("tenant_id", tenant_id)
        .eq("provider_key", provider_key)
        .maybeSingle();
      provider = tenantProvider;
    }

    if (!provider) {
      return new Response(JSON.stringify({ error: "gateway_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!provider.active || !provider.pix_out_enabled) {
      return new Response(JSON.stringify({ error: "gateway_not_pix_out_enabled" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Source of truth for wallet funds is the CENTRAL GATEWAY balance (Efí/MisticPay).
    try {
      const balRes = await supabase.functions.invoke("wallet-gateway-balance", {
        body: { tenant_id: provider.is_central ? "central" : tenant_id, provider_key },
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

    // If existing_tx_id is provided, use it; otherwise insert tx in 'processing' state
    const keyType = body.pix_key_type || detectKeyType(pix_key);
    let txId = body.existing_tx_id;
    if (!txId) {
      const { data: tx, error: txErr } = await supabase
        .from("wallet_transactions")
        .insert({
          tenant_id,
          type: "withdrawal",
          amount_cents,
          description: description || "Saque PIX automático",
          status: "pending",
          pix_key,
          provider: provider_key,
        } as any)
        .select("id")
        .single();
      if (txErr || !tx) throw new Error(txErr?.message || "tx_insert_failed");
      txId = tx.id;
    }

    // ANTI DUPLO-PAGAMENTO: trava atômica da transação antes de chamar a gateway.
    // Só quem conseguir marcar payment_id = PROCESSING-<ts> (de NULL) pode pagar.
    let claimMarker: string | null = null;
    if (body.existing_tx_id) {
      const marker = `PROCESSING-${Date.now()}`;
      const { data: claimed } = await supabase
        .from("wallet_transactions")
        .update({ payment_id: marker })
        .eq("id", txId)
        .eq("status", "pending")
        .is("payment_id", null)
        .select("id");
      if (!claimed || claimed.length === 0) {
        // Permite retomar apenas travas antigas (> 3 min) deixadas por uma queda
        const { data: cur } = await supabase
          .from("wallet_transactions")
          .select("payment_id, status")
          .eq("id", txId)
          .maybeSingle();
        const m = /^PROCESSING-(\d+)$/.exec(String((cur as any)?.payment_id || ""));
        const stale = Boolean(m) && (cur as any)?.status === "pending" && Date.now() - Number(m![1]) > 3 * 60 * 1000;
        if (!stale) {
          return new Response(JSON.stringify({ error: "already_processing", message: "Este saque já está sendo processado ou já foi concluído." }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: reclaimed } = await supabase
          .from("wallet_transactions")
          .update({ payment_id: marker })
          .eq("id", txId)
          .eq("payment_id", (cur as any).payment_id)
          .select("id");
        if (!reclaimed || reclaimed.length === 0) {
          return new Response(JSON.stringify({ error: "already_processing", message: "Este saque já está sendo processado." }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      claimMarker = marker;
    }

    // Dispatch to gateway
    let result: { payment_id: string; status: string; recipient?: RecipientInfo };
    try {
      if (provider_key === "efi") {
        if (!provider.efi_cert_pem || !provider.efi_key_pem || !provider.api_key_encrypted || !provider.secret_key_encrypted || !provider.efi_pix_key) {
          throw new Error("Efí mTLS credentials incomplete");
        }
        result = await withdrawViaEfi({
          tenantId: tenant_id,
          clientId: provider.api_key_encrypted,
          clientSecret: provider.secret_key_encrypted,
          certPem: provider.efi_cert_pem,
          keyPem: provider.efi_key_pem,
          pixKey: provider.efi_pix_key,
          destinationKey: pix_key,
          amountBRL: amount_cents / 100,
          description,
          isCentral: Boolean(provider.is_central),
        });
      } else if (provider_key === "misticpay") {
        if (!provider.api_key_encrypted || !provider.secret_key_encrypted) {
          throw new Error("MisticPay precisa de Client ID (ci) e Client Secret (cs)");
        }
        const webhookSeg = provider.is_central ? "central" : tenant_id;
        result = await withdrawViaMisticPay({
          clientId: provider.api_key_encrypted,
          clientSecret: provider.secret_key_encrypted,
          destinationKey: pix_key,
          destinationKeyType: keyType,
          amountCents: amount_cents,
          description,
          webhookUrl: `${SUPABASE_URL}/functions/v1/payment-webhook/misticpay/${webhookSeg}`,
        });
      } else {
        throw new Error(`Provider ${provider_key} not supported for PIX OUT`);
      }
    } catch (gatewayErr: any) {
      const errMessage = String(gatewayErr?.message || gatewayErr || "Erro desconhecido na gateway");
      // Libera a trava para permitir nova tentativa (o saque continua pendente) e registra o erro no banco
      if (claimMarker && txId) {
        const { data: curRow } = await supabase
          .from("wallet_transactions")
          .select("retry_count")
          .eq("id", txId)
          .maybeSingle();
        await supabase
          .from("wallet_transactions")
          .update({
            payment_id: null,
            last_error: errMessage.slice(0, 500),
            last_attempt_at: new Date().toISOString(),
            retry_count: ((curRow as any)?.retry_count || 0) + 1,
          } as any)
          .eq("id", txId)
          .eq("payment_id", claimMarker);
      }
      if (!body.existing_tx_id && txId) {
        await supabase
          .from("wallet_transactions")
          .update({
            status: "rejected",
            description: `Falhou: ${errMessage}`.slice(0, 250),
            last_error: errMessage.slice(0, 500),
            last_attempt_at: new Date().toISOString(),
          } as any)
          .eq("id", txId);
      }
      return new Response(JSON.stringify({ error: "gateway_error", message: errMessage }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save payment_id and mark transaction completed.
    if (txId) {
      await supabase.rpc("approve_wallet_withdrawal", {
        _tx_id: txId,
        _admin_notes: "Saque PIX processado via gateway",
      });
      await supabase
        .from("wallet_transactions")
        .update({ payment_id: result.payment_id })
        .eq("id", txId);

      if (result.recipient) {
        try {
          const recipientPatch: Record<string, string> = {};
          if (result.recipient.name) recipientPatch.recipient_name = result.recipient.name;
          if (result.recipient.document) recipientPatch.recipient_document = result.recipient.document;
          if (result.recipient.bank_name) recipientPatch.recipient_bank = result.recipient.bank_name;
          if (result.recipient.ispb) recipientPatch.recipient_ispb = result.recipient.ispb;
          if (result.recipient.end_to_end_id) recipientPatch.end_to_end_id = result.recipient.end_to_end_id;
          if (Object.keys(recipientPatch).length > 0) {
            await supabase
              .from("wallet_transactions")
              .update(recipientPatch as any)
              .eq("id", txId);
          }
        } catch (recErr) {
          console.warn("[wallet-pix-withdraw] non-blocking recipient persist error:", recErr);
        }
      }
    } else {
      const { data: w } = await supabase
        .from("wallets").select("total_withdrawn_cents").eq("tenant_id", tenant_id).maybeSingle();
      if (w) {
        await supabase
          .from("wallets")
          .update({ total_withdrawn_cents: ((w as any).total_withdrawn_cents || 0) + amount_cents, updated_at: new Date().toISOString() } as any)
          .eq("tenant_id", tenant_id);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        tx_id: txId,
        payment_id: result.payment_id,
        status: result.status,
        recipient: result.recipient || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[wallet-pix-withdraw] error", e);
    return new Response(JSON.stringify({ error: e.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
