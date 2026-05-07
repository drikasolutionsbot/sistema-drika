
# Integrar LofyPay como Gateway de Pagamento

A LofyPay será adicionada seguindo o mesmo padrão dos gateways existentes (MercadoPago, PushinPay, AbacatePay, etc.). São **7 pontos de alteração**:

---

## 1. Ícone do LofyPay
- Gerar/adicionar ícone em `src/assets/lofypay-icon.png`

## 2. Área do Cliente — `src/pages/PaymentsPage.tsx`
- Adicionar entrada `lofypay` no array `buildProviders()` com:
  - Nome: "LofyPay"
  - Cor: `bg-cyan-500/10 text-cyan-400`
  - Docs: `https://lofypay.com`
  - Campo único: `api_key` → "API Key" (placeholder `SUA_CHAVE_AQUI`)
  - Instruções: "No painel LofyPay, copie sua API Key."
- Adicionar abreviação "Lofy" na TabsTrigger mobile

## 3. Bot — Geração de PIX — `bot-externo/handlers/checkout.js`
- Criar `generateLofyPayPix(apiKey, amountBRL, externalRef, webhookUrl)`:
  - POST `https://app.lofypay.com/api/v1/gateway/`
  - Body: `{ "api-key": apiKey, amount: amountBRL, method: "pix", external_reference: externalRef, notification_url: webhookUrl, client: { name: "Cliente", document: "00000000000", email: "cliente@email.com" } }`
  - Retorno: `{ brcode: paymentCode, payment_id: idTransaction }`
- Adicionar `else if (providerKey === "lofypay")` no switch de checkout (~linha 850)
- Adicionar label `"Pix – LofyPay"` no mapa de labels (~linha 926)

## 4. Edge Function — Webhook — `supabase/functions/payment-webhook/index.ts`
- Criar `handleLofyPay(body, tenantId, supabase)`:
  - Aceita payload: `{ status: "PAID", idTransaction, amount, external_reference, paid_at }`
  - Extrai `order_id` do `external_reference` (remove prefixo `order_`)
  - Atualiza order para `paid`
- Adicionar `case "lofypay"` no switch (~linha 339)

## 5. Edge Function — Polling — `supabase/functions/check-payment-status/index.ts`
- Adicionar bloco para `provider === "lofypay"`:
  - POST `https://app.lofypay.com/api/v1/webhook/` com `{ idtransaction: paymentId }`
  - Header `Content-Type: application/json`
  - Se resposta contém `status === "PAID"` → `isPaid = true`

## 6. Edge Function — Teste — `supabase/functions/test-payment/index.ts`
- Criar `testLofyPay(apiKey)`:
  - GET `https://app.lofypay.com/api/status`
  - Se HTTP 200 → `{ success: true, message: "Conexão LofyPay validada!" }`
- Adicionar `case "lofypay"` no switch (~linha 139)

## 7. Admin — Não há tab específica necessária
- O admin já usa `landing_config` para PushinPay (assinaturas SaaS), que é um fluxo separado
- A LofyPay é apenas para uso dos clientes/tenants na loja, assim como MercadoPago, AbacatePay, etc.
- Se quiser uma tab admin para LofyPay no futuro (para cobrança de assinaturas Pro), será outra tarefa

---

## Detalhes Técnicos

- A API LofyPay recebe `amount` em **reais** (float), não centavos. O checkout converte: `priceCents / 100`
- `api-key` vai no body (não no header). Padrão diferente dos outros gateways
- Webhook é dinâmico via `notification_url` — não precisa configurar manualmente
- Polling usa endpoint `POST /api/v1/webhook/` com `{ idtransaction }` para consultar status
