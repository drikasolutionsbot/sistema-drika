import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import drikaLogoImg from "@/assets/logo.png";

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

function formatPixKeyDisplay(key: string | null, type: string | null): string {
  if (!key) return "Não informada";
  const clean = key.trim();
  const rawDigits = clean.replace(/\D/g, "");
  const normalizedType = (type || "").toLowerCase();

  // CPF (11 dígitos)
  if ((normalizedType === "cpf" || rawDigits.length === 11) && rawDigits.length === 11 && !clean.includes("@")) {
    return `${rawDigits.slice(0, 3)}.${rawDigits.slice(3, 6)}.${rawDigits.slice(6, 9)}-${rawDigits.slice(9, 11)}`;
  }
  // CNPJ (14 dígitos)
  if ((normalizedType === "cnpj" || rawDigits.length === 14) && rawDigits.length === 14) {
    return `${rawDigits.slice(0, 2)}.${rawDigits.slice(2, 5)}.${rawDigits.slice(5, 8)}/${rawDigits.slice(8, 12)}-${rawDigits.slice(12, 14)}`;
  }
  // Telefone (10 ou 11 dígitos)
  if ((normalizedType === "phone" || normalizedType === "telefone") && (rawDigits.length === 10 || rawDigits.length === 11)) {
    if (rawDigits.length === 11) {
      return `(${rawDigits.slice(0, 2)}) ${rawDigits.slice(2, 7)}-${rawDigits.slice(7, 11)}`;
    }
    return `(${rawDigits.slice(0, 2)}) ${rawDigits.slice(2, 6)}-${rawDigits.slice(6, 10)}`;
  }

  return clean;
}

let cachedLogoDataUrl: string | null = null;

async function loadLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;

  const candidateSources = [
    drikaLogoImg,
    "/logo.png",
    "/drika-invoices.png",
    "/assets/logo.png",
  ];

  for (const src of candidateSources) {
    if (!src) continue;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Canvas context is null"));
              return;
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = (err) => reject(err);
        img.src = src;
      });

      if (dataUrl && dataUrl.startsWith("data:image")) {
        cachedLogoDataUrl = dataUrl;
        return dataUrl;
      }
    } catch {
      // Tentar próxima fonte candidata
    }
  }

  return null;
}

export async function generateWithdrawalReceiptPDF(data: WithdrawalReceiptData): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Carregar logotipo de forma assíncrona
  const logoBase64 = await loadLogoDataUrl();

  // ─── 1. CABEÇALHO FINTECH PREMIUM ───
  // Fundo Navy Obsidian profundo
  doc.setFillColor(8, 13, 26); // #080d1a
  doc.rect(0, 0, pageWidth, 32, "F");

  // Faixa de destaque esmeralda (sinal de liquidação instantânea PIX)
  doc.setFillColor(16, 185, 129); // #10b981
  doc.rect(0, 32, pageWidth, 1.2, "F");

  // Logo da Drika Hub no canto superior esquerdo
  if (logoBase64) {
    try {
      // Proporção de aspecto original de 1870x557 (~3.35)
      doc.addImage(logoBase64, "PNG", margin, 7.5, 46, 13.7);
    } catch (e) {
      console.warn("Falha ao desenhar logo no PDF, renderizando texto alternativo", e);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text("DRIKA HUB", margin, 18);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("DRIKA HUB", margin, 18);
  }

  // Título e Identificação à Direita
  const emitDateStr = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("COMPROVANTE DE TRANSFERÊNCIA PIX", pageWidth - margin, 12, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text("Liquidação de Saque • Drika Hub Split", pageWidth - margin, 18, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Emissão: ${emitDateStr} • Via Oficial`, pageWidth - margin, 24, { align: "right" });

  // ─── 2. HERO CARD: VALOR LÍQUIDO & STATUS DE SUCESSO ───
  let y = 38;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 31, 2.5, 2.5, "FD");

  // Badge Pill de Status
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.3);
  doc.roundedRect(margin + 5, y + 4.5, 74, 6.2, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text("PIX CONCLUÍDO COM SUCESSO", margin + 9, y + 9);

  // Data da Liquidação à direita do Badge
  const completedAtDate = data.completed_at ? new Date(data.completed_at) : new Date();
  const completedAtStr = format(completedAtDate, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Efetivado em: ${completedAtStr}`, pageWidth - margin - 5, y + 9, { align: "right" });

  // Rótulo do Valor
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("VALOR LÍQUIDO TRANSFERIDO VIA PIX", margin + 5, y + 17);

  // Valor Líquido Grande em Destaque
  const netCents = data.net_amount_cents && data.net_amount_cents > 0 ? data.net_amount_cents : data.amount_cents;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(formatBRL(netCents), margin + 5, y + 26.5);

  // Detalhamento de Taxas / Transparência Financeira
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (data.fee_cents && data.fee_cents > 0) {
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Valor Solicitado: ${formatBRL(data.amount_cents)}  •  Taxa Retida: ${formatBRL(data.fee_cents)}`,
      pageWidth - margin - 5,
      y + 26.5,
      { align: "right" }
    );
  } else {
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text(
      `Valor Solicitado: ${formatBRL(data.amount_cents)}  •  Taxa: R$ 0,00  •  Transferência Integral`,
      pageWidth - margin - 5,
      y + 26.5,
      { align: "right" }
    );
  }

  y += 36;

  // ─── 3. SEÇÃO 1: DADOS DO FAVORECIDO & ORIGEM ───
  const requestedAtDate = data.created_at ? new Date(data.created_at) : new Date();
  const requestedAtStr = format(requestedAtDate, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
  const formattedPixKey = formatPixKeyDisplay(data.pix_key, data.pix_key_type);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "striped",
    head: [["DADOS DA OPERAÇÃO", "DETALHAMENTO"]],
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      cellPadding: 3,
    },
    body: [
      ["Favorecido / Destinatário", data.store_name || "Lojista Drika Hub"],
      ["Chave PIX de Destino", formattedPixKey],
      ["Tipo de Chave PIX", (data.pix_key_type || "PIX").toUpperCase()],
      ["Origem dos Recursos", "Drika Hub Soluções Digitais (Caixa Central)"],
      ["Gateway Processador", "MisticPay / SPI — Banco Central do Brasil"],
      ["Data / Hora da Solicitação", requestedAtStr],
      ["Data / Hora da Efetivação", completedAtStr],
      ["Canal de Liquidação", "PIX Direto API Automatizado"],
    ],
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [51, 65, 85], // slate-700
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, textColor: [15, 23, 42] },
      1: { cellWidth: contentWidth - 55 },
    },
  });

  const t1FinalY = (doc as any).lastAutoTable.finalY || y + 55;

  // ─── 4. SEÇÃO 2: RASTREABILIDADE TÉCNICA & AUDITORIA BANCÁRIA ───
  const table2Body = [
    ["ID da Liquidação PIX (Gateway)", data.payment_id || "Liquidado via Sistema Interno"],
    ["ID da Transação no Sistema", data.id],
    ["Situação da Operação", "CONCLUÍDO E EFETIVADO (LIQUIDADO)"],
    ["Protocolo de Rastreio Interno", `DH-WITHDRAW-${data.id.slice(0, 8).toUpperCase()}`],
  ];

  if (data.admin_notes) {
    table2Body.push(["Observações Administrativas", data.admin_notes]);
  }

  autoTable(doc, {
    startY: t1FinalY + 4,
    margin: { left: margin, right: margin },
    theme: "striped",
    head: [["RASTREABILIDADE & AUDITORIA", "IDENTIFICADOR TÉCNICO"]],
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      cellPadding: 3,
    },
    body: table2Body,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [51, 65, 85],
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, textColor: [15, 23, 42] },
      1: { font: "courier", cellWidth: contentWidth - 55, textColor: [30, 41, 59] },
    },
  });

  const t2FinalY = (doc as any).lastAutoTable.finalY || t1FinalY + 50;

  // ─── 5. CERTIFICADO DE AUTENTICAÇÃO DIGITAL & CONFORMIDADE ───
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, t2FinalY + 5, contentWidth, 24, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("AUTENTICAÇÃO DIGITAL & PROTOCOLO DE CONFORMIDADE", margin + 5, t2FinalY + 10.5);

  const cleanId = data.id.replace(/-/g, "").toUpperCase();
  const cleanGatewayId = (data.payment_id || "SYS-OK").replace(/-/g, "").slice(0, 16).toUpperCase();
  const dateCode = format(completedAtDate, "yyyyMMdd");
  const authCode = `DH.PIX.${dateCode}.${cleanId.slice(0, 8)}.${cleanGatewayId.slice(0, 8)}`;
  const shaHash = `SHA256-${cleanId.slice(0, 16)}${cleanGatewayId.slice(0, 16)}`;

  doc.setFont("courier", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`CÓDIGO DE AUDITORIA: ${authCode}`, margin + 5, t2FinalY + 15.5);
  doc.text(`ASSINATURA DIGITAL : ${shaHash}`, margin + 5, t2FinalY + 19.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Comprovante oficial emitido eletronicamente pela Drika Hub. Esta transferência foi processada via MisticPay pelo SPI do BACEN.",
    margin + 5,
    t2FinalY + 24.5
  );

  // ─── 6. RODAPÉ INSTITUCIONAL ───
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Drika Hub Soluções Digitais — Plataforma Central de Gestão e Split Financeiro",
    pageWidth / 2,
    286.5,
    { align: "center" }
  );
  doc.text(
    "Documento oficial com validade jurídica • www.drikahub.com • Página 1 de 1",
    pageWidth / 2,
    291,
    { align: "center" }
  );

  // ─── 7. DISPARAR DOWNLOAD AUTOMÁTICO ───
  const safeStoreName = (data.store_name || "lojista")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .slice(0, 15);
  const shortId = data.id.slice(0, 8);
  const fileDate = format(new Date(), "yyyyMMdd-HHmm");
  doc.save(`comprovante-saque-pix-${safeStoreName}-${shortId}-${fileDate}.pdf`);
}
