import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export async function generateReceipt(order: any, tenant: any) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Drika Invoices logo
  const logoUrl = "/drika-invoices.png";
  
  try {
    // Load image
    const imgData = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.src = logoUrl;
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
    });

    // Add Logo centered
    const imgWidth = 60;
    const imgHeight = (imgWidth * 1) / 3; // roughly estimate aspect ratio, will fix below if needed
    // Actually let's just use 60x20 as a safe bound, or better yet, just a fixed height
    doc.addImage(imgData, "PNG", (pageWidth - 60) / 2, 15, 60, 20);
  } catch (e) {
    console.error("Failed to load logo", e);
    // fallback text
    doc.setFontSize(20);
    doc.text("COMPROVANTE", pageWidth / 2, 25, { align: "center" });
  }

  // Try to load Discord avatar
  let avatarData = null;
  try {
    const { data } = await supabase.functions.invoke("get-discord-user", {
      body: { user_id: order.discord_user_id }
    });
    
    if (data?.avatarUrl) {
      avatarData = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        // Use a proxy or direct URL if CORS allows. Discord CDN usually allows CORS if requested with crossOrigin
        img.src = data.avatarUrl;
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          // Draw as a circle (optional, but standard for Discord)
          if (ctx) {
            ctx.beginPath();
            ctx.arc(img.width/2, img.height/2, img.width/2, 0, Math.PI*2);
            ctx.clip();
            ctx.drawImage(img, 0, 0);
          }
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
      });
    }
  } catch (e) {
    console.error("Failed to load user avatar", e);
  }

  // Try to load Product Image
  let productImgData = null;
  const productImageUrl = order.products?.icon_url || order.products?.banner_url;
  
  if (productImageUrl) {
    try {
      productImgData = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.src = productImageUrl;
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            // Draw as a rounded rectangle or just normally
            ctx.drawImage(img, 0, 0);
          }
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
      });
    } catch (e) {
      console.error("Failed to load product image", e);
    }
  }

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("COMPROVANTE DE PAGAMENTO", pageWidth / 2, 45, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const dateStr = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Gerado em: ${dateStr}`, pageWidth / 2, 52, { align: "center" });

  // Order Details
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 60, pageWidth - 20, 60);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  
  let startY = 70;
  const lineSpacing = 8;
  
  if (avatarData) {
    doc.addImage(avatarData, "PNG", 20, startY - 5, 12, 12);
    doc.setFont("helvetica", "bold");
    doc.text("Cliente:", 35, startY);
    doc.setFont("helvetica", "normal");
    doc.text(`${order.discord_username || "—"} (${order.discord_user_id})`, 35, startY + 5);
    startY += 15;
  } else {
    doc.setFont("helvetica", "bold");
    doc.text("Cliente:", 20, startY);
    doc.setFont("helvetica", "normal");
    doc.text(`${order.discord_username || "—"} (${order.discord_user_id})`, 50, startY);
    startY += 10;
  }

  let currentY = startY;

  const addRow = (label: string, value: string, isBoldValue = false) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 20, currentY);
    doc.setFont("helvetica", isBoldValue ? "bold" : "normal");
    doc.text(value || "—", 65, currentY);
    currentY += lineSpacing;
  };

  addRow("Nº do Pedido", `#${order.order_number}`, true);
  addRow("ID do Pedido", order.id);
  
  // Custom addRow for Product to include the image if available
  doc.setFont("helvetica", "bold");
  doc.text("Produto:", 20, currentY);
  if (productImgData) {
    doc.addImage(productImgData, "PNG", 65, currentY - 4, 6, 6);
    doc.setFont("helvetica", "normal");
    doc.text(order.product_name || "—", 73, currentY);
  } else {
    doc.setFont("helvetica", "normal");
    doc.text(order.product_name || "—", 65, currentY);
  }
  currentY += lineSpacing;

  addRow("Cliente", order.discord_username || order.discord_user_id);
  addRow("Discord ID", order.discord_user_id);
  addRow("Data da Compra", format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }));
  addRow("Provedor", (order.payment_provider || "Manual").toUpperCase());
  
  if (order.payment_id) {
    addRow("ID Transação", order.payment_id);
  }

  const statusMap: Record<string, string> = {
    paid: "PAGO",
    delivered: "ENTREGUE",
    pending_payment: "PENDENTE",
    canceled: "CANCELADO",
    refunded: "REEMBOLSADO",
  };
  addRow("Status", statusMap[order.status] || order.status.toUpperCase(), true);

  // Total
  currentY += 5;
  doc.line(20, currentY - 5, pageWidth - 20, currentY - 5);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL PAGO:", 20, currentY + 5);
  
  doc.setTextColor(34, 197, 94); // Green
  doc.text(formatCurrency(order.total_cents), pageWidth - 20, currentY + 5, { align: "right" });

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Drika Hub - Sistema de Gerenciamento", pageWidth / 2, 280, { align: "center" });

  // Save
  doc.save(`Comprovante_Pedido_${order.order_number}.pdf`);
}
