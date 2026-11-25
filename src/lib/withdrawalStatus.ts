/**
 * Helpers centralizados de validação e mapeamento de estados para saques PIX.
 */

const TERMINAL_PAID_STATES = new Set([
  "COMPLETO",
  "COMPLETED",
  "PAID",
  "APROVADO",
  "APROVADA",
  "CONCLUIDO",
  "CONCLUIDA",
]);

const TERMINAL_FAILED_STATES = new Set([
  "FALHA",
  "FALHOU",
  "FAILED",
  "FAIL",
  "CANCELADO",
  "CANCELADA",
  "CANCELED",
  "CANCELLED",
  "RECUSADO",
  "RECUSADA",
  "ESTORNADO",
  "ESTORNADA",
  "REVERTED",
  "REJEITADO",
  "REJEITADA",
  "REJECTED",
  "ERRO",
  "ERROR",
]);

export function normalizeGatewayState(state?: string | null): string {
  return String(state || "").trim().toUpperCase();
}

export function isMisticPayTerminalPaid(state?: string | null): boolean {
  return TERMINAL_PAID_STATES.has(normalizeGatewayState(state));
}

export function isMisticPayTerminalFailed(state?: string | null): boolean {
  return TERMINAL_FAILED_STATES.has(normalizeGatewayState(state));
}

export type MisticAuditClassification =
  | "confirmed_paid"
  | "gateway_failed"
  | "still_processing"
  | "unknown";

export function classifyMisticPayAuditState(
  state?: string | null,
  httpOk = true
): MisticAuditClassification {
  if (!httpOk) return "unknown";
  const s = normalizeGatewayState(state);
  if (!s) return "unknown";
  if (isMisticPayTerminalPaid(s)) return "confirmed_paid";
  if (isMisticPayTerminalFailed(s)) return "gateway_failed";
  if (["QUEUED", "PENDING", "PENDENTE", "PROCESSANDO", "PROCESSING", "EM_PROCESSAMENTO", "CREATED"].includes(s)) {
    return "still_processing";
  }
  return "unknown";
}

/**
 * Detecta quando o usuário colou um payload EMV QR ("PIX Copia e Cola") no campo de chave PIX.
 */
export function isPixCopiaEColaPayload(pixKey?: string | null): boolean {
  return /^000201/i.test((pixKey || "").trim());
}
