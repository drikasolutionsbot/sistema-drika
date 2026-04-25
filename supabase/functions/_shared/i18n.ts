// Shared i18n strings for Discord-facing texts (embeds, buttons, DMs).
// Language is taken from tenants.language (pt-BR | en | de).

export type Lang = "pt-BR" | "en" | "de";

export const I18N: Record<Lang, Record<string, string>> = {
  "pt-BR": {
    buy: "Comprar",
    buy_emoji: "🛒 Comprar",
    cancel: "Cancelar",
    payment: "Pagamento",
    edit_quantity: "Editar Quantidade",
    coupon: "Cupom",
    price_label: "Valor à vista",
    stock_label: "Restam",
    sold_label: "Vendidos",
    delivery_auto: "⚡ Entrega Automática!",
    delivery_manual: "🛠️ Entrega Manual",
    out_of_stock: "Esgotado",
    quantity: "Quantidade",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Desconto",
    open_ticket: "Abrir Ticket",
    close_ticket: "Fechar Ticket",
    confirm: "Confirmar",
    back: "Voltar",
    pay_with_pix: "Pagar com PIX",
    copy_code: "Copiar Código",
    payment_approved_title: "🟢 Pagamento aprovado",
    payment_approved_desc: "Olá **{customer}**! Seu pagamento do pedido **#{order_number}** foi aprovado.\n\n**Produto:** {product}\n**Total:** {total}\n\nEm instantes você receberá a entrega.",
    order_delivered_title: "📦 Pedido entregue",
    order_delivered_desc: "Olá **{customer}**! Seu pedido **#{order_number}** foi entregue com sucesso.\n\n**Produto:** {product}\n**Quantidade:** {quantity}\n**Total:** {total}\n\n```{delivery_content}```",
    order_rejected_title: "❌ Pedido rejeitado",
    order_rejected_desc: "Olá **{customer}**, infelizmente seu pedido **#{order_number}** foi rejeitado pela equipe.\n\nSe acreditar que houve um engano, abra um ticket de suporte.",
    order_canceled_title: "🚫 Pedido cancelado",
    order_canceled_desc: "Olá **{customer}**, seu pedido **#{order_number}** foi cancelado.\n\nSe tiver dúvidas, abra um ticket de suporte.",
    order_expired_title: "⏰ Pedido expirado",
    order_expired_desc: "Olá **{customer}**, o pagamento do pedido **#{order_number}** não foi confirmado a tempo e o pedido expirou.\n\nVocê pode realizar uma nova compra a qualquer momento.",
    ticket_opened_title: "🎫 Ticket aberto",
    ticket_opened_desc: "Olá **{customer}**! Seu ticket foi aberto com sucesso.\n\nA equipe da **{store_name}** responderá em breve. Aguarde no canal do ticket.",
    ticket_closed_title: "🔒 Ticket encerrado",
    ticket_closed_desc: "Olá **{customer}**, seu ticket foi encerrado.\n\nObrigado pelo contato! Se precisar de algo mais, abra um novo ticket.",
    thanks_for_purchase: "Obrigado pela compra!",
    support: "Suporte",
  },
  en: {
    buy: "Buy",
    buy_emoji: "🛒 Buy",
    cancel: "Cancel",
    payment: "Payment",
    edit_quantity: "Edit Quantity",
    coupon: "Coupon",
    price_label: "Price",
    stock_label: "In stock",
    sold_label: "Sold",
    delivery_auto: "⚡ Instant Delivery!",
    delivery_manual: "🛠️ Manual Delivery",
    out_of_stock: "Out of stock",
    quantity: "Quantity",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    open_ticket: "Open Ticket",
    close_ticket: "Close Ticket",
    confirm: "Confirm",
    back: "Back",
    pay_with_pix: "Pay with PIX",
    copy_code: "Copy Code",
    payment_approved_title: "🟢 Payment approved",
    payment_approved_desc: "Hi **{customer}**! Your payment for order **#{order_number}** has been approved.\n\n**Product:** {product}\n**Total:** {total}\n\nYour delivery will arrive shortly.",
    order_delivered_title: "📦 Order delivered",
    order_delivered_desc: "Hi **{customer}**! Your order **#{order_number}** has been successfully delivered.\n\n**Product:** {product}\n**Quantity:** {quantity}\n**Total:** {total}\n\n```{delivery_content}```",
    order_rejected_title: "❌ Order rejected",
    order_rejected_desc: "Hi **{customer}**, unfortunately your order **#{order_number}** was rejected by the team.\n\nIf you believe this is a mistake, please open a support ticket.",
    order_canceled_title: "🚫 Order canceled",
    order_canceled_desc: "Hi **{customer}**, your order **#{order_number}** has been canceled.\n\nIf you have any questions, please open a support ticket.",
    order_expired_title: "⏰ Order expired",
    order_expired_desc: "Hi **{customer}**, the payment for order **#{order_number}** was not confirmed in time and the order has expired.\n\nYou can place a new order at any time.",
    ticket_opened_title: "🎫 Ticket opened",
    ticket_opened_desc: "Hi **{customer}**! Your ticket has been opened successfully.\n\nThe **{store_name}** team will respond shortly. Please wait in the ticket channel.",
    ticket_closed_title: "🔒 Ticket closed",
    ticket_closed_desc: "Hi **{customer}**, your ticket has been closed.\n\nThank you for reaching out! If you need anything else, feel free to open a new ticket.",
    thanks_for_purchase: "Thanks for your purchase!",
    support: "Support",
  },
  de: {
    buy: "Kaufen",
    buy_emoji: "🛒 Kaufen",
    cancel: "Abbrechen",
    payment: "Zahlung",
    edit_quantity: "Menge ändern",
    coupon: "Gutschein",
    price_label: "Preis",
    stock_label: "Verfügbar",
    sold_label: "Verkauft",
    delivery_auto: "⚡ Sofortige Lieferung!",
    delivery_manual: "🛠️ Manuelle Lieferung",
    out_of_stock: "Ausverkauft",
    quantity: "Menge",
    total: "Gesamt",
    subtotal: "Zwischensumme",
    discount: "Rabatt",
    open_ticket: "Ticket öffnen",
    close_ticket: "Ticket schließen",
    confirm: "Bestätigen",
    back: "Zurück",
    pay_with_pix: "Mit PIX bezahlen",
    copy_code: "Code kopieren",
    payment_approved_title: "🟢 Zahlung bestätigt",
    payment_approved_desc: "Hallo **{customer}**! Deine Zahlung für die Bestellung **#{order_number}** wurde bestätigt.\n\n**Produkt:** {product}\n**Gesamt:** {total}\n\nDeine Lieferung erfolgt in Kürze.",
    order_delivered_title: "📦 Bestellung geliefert",
    order_delivered_desc: "Hallo **{customer}**! Deine Bestellung **#{order_number}** wurde erfolgreich geliefert.\n\n**Produkt:** {product}\n**Menge:** {quantity}\n**Gesamt:** {total}\n\n```{delivery_content}```",
    order_rejected_title: "❌ Bestellung abgelehnt",
    order_rejected_desc: "Hallo **{customer}**, leider wurde deine Bestellung **#{order_number}** vom Team abgelehnt.\n\nWenn du glaubst, dass es ein Fehler ist, öffne bitte ein Support-Ticket.",
    order_canceled_title: "🚫 Bestellung storniert",
    order_canceled_desc: "Hallo **{customer}**, deine Bestellung **#{order_number}** wurde storniert.\n\nBei Fragen öffne bitte ein Support-Ticket.",
    order_expired_title: "⏰ Bestellung abgelaufen",
    order_expired_desc: "Hallo **{customer}**, die Zahlung für die Bestellung **#{order_number}** wurde nicht rechtzeitig bestätigt und die Bestellung ist abgelaufen.\n\nDu kannst jederzeit eine neue Bestellung aufgeben.",
    ticket_opened_title: "🎫 Ticket geöffnet",
    ticket_opened_desc: "Hallo **{customer}**! Dein Ticket wurde erfolgreich geöffnet.\n\nDas **{store_name}** Team wird in Kürze antworten. Bitte warte im Ticket-Kanal.",
    ticket_closed_title: "🔒 Ticket geschlossen",
    ticket_closed_desc: "Hallo **{customer}**, dein Ticket wurde geschlossen.\n\nDanke für deine Nachricht! Falls du noch etwas brauchst, öffne gerne ein neues Ticket.",
    thanks_for_purchase: "Danke für deinen Einkauf!",
    support: "Support",
  },
};

export function normLang(v: string | null | undefined): Lang {
  if (v === "en" || v === "de" || v === "pt-BR") return v;
  return "pt-BR";
}

export function tr(lang: string | null | undefined, key: string): string {
  const L = normLang(lang);
  return I18N[L][key] ?? I18N["pt-BR"][key] ?? key;
}

/** Helper: fetch tenant.language with fallback. Pass an already-built supabase client. */
export async function getTenantLang(supabase: any, tenantId: string): Promise<Lang> {
  try {
    const { data } = await supabase
      .from("tenants")
      .select("language")
      .eq("id", tenantId)
      .maybeSingle();
    return normLang((data as any)?.language);
  } catch {
    return "pt-BR";
  }
}
