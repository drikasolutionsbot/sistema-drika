import { describe, it, expect } from "vitest";
import {
  formatRecipientDocument,
  resolveWithdrawalRecipientDisplay,
} from "@/lib/withdrawalReceiptPdf";

describe("formatRecipientDocument", () => {
  it("mascara CPF numérico no padrão bancário LGPD/BACEN", () => {
    expect(formatRecipientDocument("12345678900")).toBe("***.456.789-**");
  });

  it("formata CNPJ corretamente sem mascarar", () => {
    expect(formatRecipientDocument("12345678000195")).toBe("12.345.678/0001-95");
  });

  it("preserva string já mascarada pela gateway", () => {
    expect(formatRecipientDocument("***456789**")).toBe("***456789**");
  });

  it("retorna null quando ausente ou vazio", () => {
    expect(formatRecipientDocument(null)).toBeNull();
    expect(formatRecipientDocument("   ")).toBeNull();
  });
});

describe("resolveWithdrawalRecipientDisplay", () => {
  it("prioriza o nome bancário real retornado pela MisticPay e mantém a loja como referência", () => {
    const res = resolveWithdrawalRecipientDisplay({
      recipient_name: "MATHEUS RIAN SOUZA",
      recipient_document: "12345678900",
      recipient_bank: "NU PAGAMENTOS - IP",
      recipient_ispb: "18236120",
      store_name: "matheusriansouza33",
    });

    expect(res).toEqual({
      favorecidoName: "MATHEUS RIAN SOUZA",
      hasVerifiedRecipient: true,
      storeSubName: "matheusriansouza33",
      formattedDocument: "***.456.789-**",
      bankLabel: "NU PAGAMENTOS - IP (ISPB 18236120)",
    });
  });

  it("faz fallback para o nome da loja quando ainda não há destinatário bancário salvo", () => {
    const res = resolveWithdrawalRecipientDisplay({
      recipient_name: null,
      store_name: "matheusriansouza33",
    });

    expect(res).toEqual({
      favorecidoName: "matheusriansouza33",
      hasVerifiedRecipient: false,
      storeSubName: null,
      formattedDocument: null,
      bankLabel: null,
    });
  });

  it("não repete storeSubName quando o nome do destinatário coincide com o nome da loja", () => {
    const res = resolveWithdrawalRecipientDisplay({
      recipient_name: "Empresa Recebedora LTDA",
      store_name: "empresa recebedora ltda",
      recipient_bank: "CAIXA ECONOMICA FEDERAL (ISPB 00360305)",
      recipient_ispb: "00360305",
    });

    expect(res.storeSubName).toBeNull();
    expect(res.bankLabel).toBe("CAIXA ECONOMICA FEDERAL (ISPB 00360305)");
  });
});
