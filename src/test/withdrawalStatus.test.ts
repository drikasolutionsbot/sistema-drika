import { describe, expect, it } from "vitest";
import {
  classifyMisticPayAuditState,
  isMisticPayTerminalFailed,
  isMisticPayTerminalPaid,
  isPixCopiaEColaPayload,
  normalizeGatewayState,
} from "@/lib/withdrawalStatus";

describe("withdrawalStatus helpers", () => {
  it("normalizes gateway states cleanly", () => {
    expect(normalizeGatewayState(" completo ")).toBe("COMPLETO");
    expect(normalizeGatewayState(null)).toBe("");
    expect(normalizeGatewayState(undefined)).toBe("");
  });

  it("identifies terminal paid states and rejects QUEUED/PENDING as paid", () => {
    expect(isMisticPayTerminalPaid("COMPLETO")).toBe(true);
    expect(isMisticPayTerminalPaid("concluida")).toBe(true);
    expect(isMisticPayTerminalPaid("PAID")).toBe(true);

    expect(isMisticPayTerminalPaid("QUEUED")).toBe(false);
    expect(isMisticPayTerminalPaid("PENDING")).toBe(false);
    expect(isMisticPayTerminalPaid("PROCESSANDO")).toBe(false);
    expect(isMisticPayTerminalPaid("FALHA")).toBe(false);
  });

  it("identifies terminal failed states accurately", () => {
    expect(isMisticPayTerminalFailed("FALHA")).toBe(true);
    expect(isMisticPayTerminalFailed("FALHOU")).toBe(true);
    expect(isMisticPayTerminalFailed("FAILED")).toBe(true);
    expect(isMisticPayTerminalFailed("CANCELADO")).toBe(true);
    expect(isMisticPayTerminalFailed("ESTORNADO")).toBe(true);
    expect(isMisticPayTerminalFailed("ERRO")).toBe(true);

    expect(isMisticPayTerminalFailed("QUEUED")).toBe(false);
    expect(isMisticPayTerminalFailed("COMPLETO")).toBe(false);
  });

  it("classifies MisticPay audit results across paid, failed, queued and HTTP errors", () => {
    expect(classifyMisticPayAuditState("COMPLETO", true)).toBe("confirmed_paid");
    expect(classifyMisticPayAuditState("FALHA", true)).toBe("gateway_failed");
    expect(classifyMisticPayAuditState("QUEUED", true)).toBe("still_processing");
    expect(classifyMisticPayAuditState("PENDING", true)).toBe("still_processing");
    expect(classifyMisticPayAuditState("PROCESSANDO", true)).toBe("still_processing");
    expect(classifyMisticPayAuditState("COMPLETO", false)).toBe("unknown");
    expect(classifyMisticPayAuditState(null, true)).toBe("unknown");
  });

  it("detects PIX Copia e Cola EMV QR payloads starting with 000201", () => {
    const sampleQr =
      "00020126580014BR.GOV.BCB.PIX013676f281ac-5de9-4edf-87e6-b498bd82f23a5204000053039865802BR";
    expect(isPixCopiaEColaPayload(sampleQr)).toBe(true);
    expect(isPixCopiaEColaPayload(`  ${sampleQr}  `)).toBe(true);

    expect(isPixCopiaEColaPayload("76f281ac-5de9-4edf-87e6-b498bd82f23a")).toBe(false);
    expect(isPixCopiaEColaPayload("02367031703")).toBe(false);
    expect(isPixCopiaEColaPayload("cliente@exemplo.com")).toBe(false);
    expect(isPixCopiaEColaPayload("")).toBe(false);
  });
});
