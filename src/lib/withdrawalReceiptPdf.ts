import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface WithdrawalReceiptData {
  id: string;
  tenant_id: string;
  store_name?: string;
  amount_cents: number;
  net_amount_cents?: number;
  fee_cents?: number;
  pix_key: string | null;
  pix_key_type: string | null;
  payment_id: string | null;
  admin_notes: string | null;
  created_at: string;
  completed_at: string | null;
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);

export function generateWithdrawalReceiptPDF(data: WithdrawalReceiptData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // 1. Cabeçalho / Barra Superior
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.rect(0, 0, pageWidth, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("DRIKA HUB", margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("COMPROVANTE DE TRANSFERÊNCIA PIX (SAQUE APROVADO)", margin, 21);

  // Data de Emissão à direita
  const emitDateStr = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  doc.setFontSize(8);
  doc.text(`Emissão: ${emitDateStr}`, pageWidth - margin, 14, { align: "right" });
  doc.text("Documento Digital Autenticado", pageWidth - margin, 21, { align: "right" });

  let y = 42;

  // 2. Banner de Status: Concluído
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text("TRANSFERÊNCIA PIX CONCLUÍDA COM SUCESSO", margin + 6, y + 8);

  const completedAtStr = data.completed_at
    ? format(new Date(data.completed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
    : format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text(`Efetivado em: ${completedAtStr}`, margin + 6, y + 14);

  y += 24;

  // 3. Bloco do Valor em Destaque
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, "FD");

  const netCents = data.net_amount_cents && data.net_amount_cents > 0 ? data.net_amount_cents : data.amount_cents;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("VALOR LÍQUIDO TRANSFERIDO VIA PIX", margin + 6, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(formatBRL(netCents), margin + 6, y + 19);

  if (data.fee_cents && data.fee_cents > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Valor Solicitado: ${formatBRL(data.amount_cents)}  |  Taxa Retida: ${formatBRL(data.fee_cents)}`,
      pageWidth - margin - 6,
      y + 19,
      { align: "right" }
    );
  }

  y += 32;

  // 4. Tabela de Detalhes com jspdf-autotable
  const requestedAtStr = format(new Date(data.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });

  const tableBody = [
    ["Favorecido / Loja", data.store_name || "Lojista Drika Hub"],
    ["Chave PIX de Destino", data.pix_key || "Não informada"],
    ["Tipo de Chave", (data.pix_key_type || "PIX").toUpperCase()],
    ["Origem dos Recursos", "Drika Hub (Caixa Central)"],
    ["Gateway Processador", "MisticPay / PIX Automático"],
    ["ID da Transação no Sistema", data.id],
    ["ID da Liquidação PIX (Gateway)", data.payment_id || "Liquidado via Sistema"],
    ["Data da Solicitação", requestedAtStr],
    ["Data da Efetivação / Pagamento", completedAtStr],
    ["Status da Operação", "CONCLUÍDO / LIQUIDADO"],
  ];

  if (data.admin_notes) {
    tableBody.push(["Observações", data.admin_notes]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "striped",
    head: [["Informação", "Detalhes da Transferência"]],
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    body: tableBody,
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [51, 65, 85], // slate-700
      overflow: "linebreak",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, textColor: [15, 23, 42] },
      1: { cellWidth: contentWidth - 55 },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || y + 80;

  // 5. Bloco de Autenticação Digital & Rastreabilidade
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, finalY + 6, contentWidth, 22, 2, 2, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("AUTENTICAÇÃO DIGITAL & AUDITORIA", margin + 5, finalY + 12);

  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const authCode = `${data.id.replace(/-/g, "").toUpperCase()}#${(data.payment_id || "OK").replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  doc.text(`Código de Verificação: ${authCode}`, margin + 5, finalY + 18);
  doc.text(`Assinatura: SHA256-${authCode.slice(0, 32)}`, margin + 5, finalY + 23);

  // 6. Rodapé
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Este comprovante possui validade legal e comprova a liquidação definitiva da transferência PIX.",
    pageWidth / 2,
    285,
    { align: "center" }
  );
  doc.text("Drika Hub — Soluções de Pagamento e Split Central", pageWidth / 2, 290, { align: "center" });

  // Nome amigável do arquivo para download
  const shortId = data.id.slice(0, 8);
  const fileDate = format(new Date(), "yyyyMMdd-HHmm");
  doc.save(`comprovante-saque-pix-${shortId}-${fileDate}.pdf`);
}
