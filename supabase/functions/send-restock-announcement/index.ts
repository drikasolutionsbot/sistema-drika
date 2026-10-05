import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache WASM e fontes entre invocações (warm starts)
let wasmInitialized = false;
let fontRegular: Uint8Array | null = null;
let fontBold: Uint8Array | null = null;
let fontBlack: Uint8Array | null = null;

async function ensureInitialized() {
  if (!wasmInitialized) {
    const wasmRes = await fetch("https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm");
    await initWasm(await wasmRes.arrayBuffer());
    wasmInitialized = true;
  }
  if (!fontRegular || !fontBold || !fontBlack) {
    const [r, b, bl] = await Promise.all([
      fetch("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf").then((res) => res.arrayBuffer()),
      fetch("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf").then((res) => res.arrayBuffer()),
      fetch("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-900-normal.ttf").then((res) => res.arrayBuffer()),
    ]);
    fontRegular = new Uint8Array(r);
    fontBold = new Uint8Array(b);
    fontBlack = new Uint8Array(bl);
  }
}

function escapeXml(unsafe: string): string {
  return String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateRestockSvg(productName: string, addedCount: string, totalStock: string, dateTime: string, theme: string): string {
  const e = escapeXml;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a0f" />
      <stop offset="100%" stop-color="#1a1a24" />
    </linearGradient>
    <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${e(theme)}" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.8" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="800" height="400" fill="url(#bgGradient)" rx="24" />
  <circle cx="650" cy="200" r="250" fill="url(#accentGradient)" />
  <circle cx="100" cy="-50" r="300" fill="url(#accentGradient)" />

  <!-- Top Badge: RESTOCK -->
  <rect x="60" y="50" width="160" height="48" rx="24" fill="#ffffff" />
  <path d="M95 62 L85 75 L92 75 L89 86 L100 73 L93 73 Z" fill="#000000" />
  <text x="110" y="80" fill="#000000" font-size="18" font-family="Inter, sans-serif" font-weight="900" letter-spacing="1.5">RESTOCK</text>

  <text x="240" y="79" fill="#8b8e9b" font-size="16" font-family="Inter, sans-serif" font-weight="400">novos itens acabaram de chegar</text>

  <!-- Product Name -->
  <text x="60" y="160" fill="#ffffff" font-size="42" font-family="Inter, sans-serif" font-weight="900" letter-spacing="-0.5">${e(productName)}</text>
  <line x1="60" y1="190" x2="450" y2="190" stroke="#2a2d3d" stroke-width="2" />

  <!-- Adicionados Box -->
  <rect x="60" y="230" width="180" height="90" rx="16" fill="#13141d" stroke="#2a2d3d" stroke-width="1.5" />
  <rect x="80" y="250" width="30" height="30" rx="6" fill="#1c1f2e" />
  <path d="M87 265 L95 261 L103 265 M87 265 L87 271 L95 275 L95 261 M95 275 L103 271 L103 265" stroke="#75798e" stroke-width="2" fill="none" stroke-linejoin="round" />
  <text x="125" y="265" fill="#75798e" font-size="14" font-family="Inter, sans-serif" font-weight="600">Adicionados</text>
  <text x="125" y="295" fill="#ffffff" font-size="28" font-family="Inter, sans-serif" font-weight="900">${e(addedCount)}x</text>

  <!-- Data Box -->
  <rect x="260" y="230" width="220" height="90" rx="16" fill="#13141d" stroke="#2a2d3d" stroke-width="1.5" />
  <rect x="280" y="250" width="30" height="30" rx="6" fill="#1c1f2e" />
  <circle cx="295" cy="265" r="7" stroke="#75798e" stroke-width="2" fill="none" />
  <path d="M295 260 L295 265 L299 265" stroke="#75798e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  <text x="325" y="265" fill="#75798e" font-size="14" font-family="Inter, sans-serif" font-weight="600">Data</text>
  <text x="325" y="295" fill="#ffffff" font-size="22" font-family="Inter, sans-serif" font-weight="900">${e(dateTime)}</text>

  <!-- Total Stock Circle -->
  <circle cx="650" cy="160" r="90" fill="#13141d" stroke="#2a2d3d" stroke-width="2" />
  <circle cx="650" cy="160" r="105" fill="none" stroke="${e(theme)}" stroke-width="1" stroke-dasharray="8 8" opacity="0.5" />
  <text x="650" y="170" fill="#ffffff" font-size="64" font-family="Inter, sans-serif" font-weight="900" text-anchor="middle">${e(totalStock)}</text>
  <text x="650" y="205" fill="#8b8e9b" font-size="16" font-family="Inter, sans-serif" font-weight="600" text-anchor="middle" letter-spacing="1">em estoque</text>

  <!-- Pill button -->
  <rect x="550" y="280" width="200" height="40" rx="20" fill="#13141d" stroke="#2a2d3d" stroke-width="1.5" />
  <path d="M575 292 L568 300 L572 300 L570 308 L578 298 L574 298 Z" fill="${e(theme)}" />
  <text x="590" y="306" fill="#ffffff" font-size="16" font-family="Inter, sans-serif" font-weight="700">+${e(addedCount)} unidades</text>
</svg>`;
}

async function generateRestockImage(productName: string, addedCount: string, totalStock: string, dateTime: string, theme: string): Promise<Uint8Array | null> {
  try {
    await ensureInitialized();
    const svg = generateRestockSvg(productName, addedCount, totalStock, dateTime, theme);
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 800 },
      font: {
        fontBuffers: [fontRegular!, fontBold!, fontBlack!],
        defaultFontFamily: "Inter",
      },
    });
    const pngData = resvg.render();
    return pngData.asPng();
  } catch (e: any) {
    console.error("[RESTOCK] Erro ao gerar SVG/PNG:", e.message);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;

    const { tenant_id, product_id, field_id, added_count } = await req.json();

    if (!tenant_id || !product_id) {
      return new Response(JSON.stringify({ error: "tenant_id e product_id obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Canal configurado
    const { data: channelConfig } = await supabase
      .from("channel_configs")
      .select("discord_channel_id")
      .eq("tenant_id", tenant_id)
      .eq("channel_key", "restock_channel")
      .maybeSingle();

    // 2. Store configs
    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("restock_channel_id, restock_embed_color, restock_embed_title, restock_embed_description, restock_embed_footer, restock_embed_image_url, restock_embed_thumbnail_url, restock_mention_role_id, store_url, embed_color")
      .eq("tenant_id", tenant_id)
      .single();

    const restockChannelId = channelConfig?.discord_channel_id || storeConfig?.restock_channel_id;
    if (!restockChannelId) {
      console.log(`[RESTOCK] Nenhum canal configurado para tenant ${tenant_id}`);
      return new Response(JSON.stringify({ skipped: true, reason: "no_channel" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Produto
    const { data: product } = await supabase
      .from("products")
      .select("id, name")
      .eq("id", product_id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!product) {
      console.log(`[RESTOCK] Produto não encontrado: ${product_id}`);
      return new Response(JSON.stringify({ skipped: true, reason: "no_product" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Campo (variante)
    let fieldName: string | null = null;
    if (field_id) {
      const { data: field } = await supabase.from("product_fields").select("name").eq("id", field_id).maybeSingle();
      fieldName = field?.name || null;
    }

    // 5. Estoque total
    let stockQuery = supabase.from("product_stock_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("delivered", false);
    if (field_id) stockQuery = stockQuery.eq("field_id", field_id);
    else stockQuery = stockQuery.eq("product_id", product_id);
    const { count: totalStock } = await stockQuery;

    // 6. Configurações de aparência
    const rawColor = storeConfig?.restock_embed_color || storeConfig?.embed_color || "#9333ea";

    // 7. Botão Comprar Agora
    const components: unknown[] = [];
    const storeUrl = storeConfig?.store_url;
    if (storeUrl) {
      const productUrl = storeUrl.includes("?") ? `${storeUrl}&product=${product_id}` : `${storeUrl}?product=${product_id}`;
      components.push({
        type: 1,
        components: [{ type: 2, style: 5, label: "Comprar Agora", url: productUrl, emoji: { name: "🛒" } }],
      });
    }

    // 8. Menção
    const mentionRoleId = storeConfig?.restock_mention_role_id;
    const content = mentionRoleId
      ? (mentionRoleId === "everyone" ? "@everyone" : `<@&${mentionRoleId}>`)
      : undefined;

    // 9. Data formatada
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

    // 10. Gerar imagem (embutido nesta função)
    const displayName = fieldName ? `${product.name} - ${fieldName}` : product.name;
    const imageBuffer = await generateRestockImage(
      displayName,
      String(added_count),
      totalStock !== null ? String(totalStock) : "?",
      `${dateStr} · ${timeStr}`,
      rawColor
    );
    console.log(imageBuffer ? `[RESTOCK] Imagem gerada: ${imageBuffer.length} bytes` : "[RESTOCK] Fallback para embed");

    let res: Response;

    if (imageBuffer) {
      // 11a. Enviar como imagem via multipart
      const boundary = `----FormBoundary${Date.now()}`;
      const payloadObj: Record<string, unknown> = {};
      if (content) payloadObj.content = content;
      if (components.length > 0) payloadObj.components = components;
      const payloadJson = JSON.stringify(payloadObj);

      const CRLF = "\r\n";
      const enc = new TextEncoder();
      const parts: Uint8Array[] = [];
      parts.push(enc.encode(`--${boundary}${CRLF}Content-Disposition: form-data; name="payload_json"${CRLF}Content-Type: application/json${CRLF}${CRLF}${payloadJson}${CRLF}`));
      parts.push(enc.encode(`--${boundary}${CRLF}Content-Disposition: form-data; name="files[0]"; filename="restock.png"${CRLF}Content-Type: image/png${CRLF}${CRLF}`));
      parts.push(imageBuffer);
      parts.push(enc.encode(`${CRLF}--${boundary}--${CRLF}`));

      const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
      const multipartBody = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) { multipartBody.set(part, offset); offset += part.length; }

      res = await fetch(`https://discord.com/api/v10/channels/${restockChannelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body: multipartBody,
      });
    } else {
      // 11b. Fallback: embed
      const embedColor = parseInt(rawColor.replace("#", ""), 16) || 0x9333ea;
      const title = storeConfig?.restock_embed_title
        ? storeConfig.restock_embed_title.replace("{product}", product.name).replace("{qty}", String(added_count)).replace("{total_stock}", String(totalStock ?? "?"))
        : `🔄 RESTOCK! O produto ${product.name} acabou de receber novos itens!`;
      const description = storeConfig?.restock_embed_description
        ? storeConfig.restock_embed_description.replace("{product}", product.name).replace("{qty}", String(added_count)).replace("{total_stock}", String(totalStock ?? "?"))
        : null;

      const descLines: string[] = [];
      if (description) { descLines.push(description); descLines.push(""); }
      if (fieldName) descLines.push(`➥ 🏷️ • **Campo:** \`${fieldName}\``);
      descLines.push(`➥ 📦 • **Adicionados:** \`${added_count}x\``);
      if (totalStock !== null) descLines.push(`➥ 📈 • **Estoque total:** \`${totalStock}x\``);
      const unixTimestamp = Math.floor(now.getTime() / 1000);
      descLines.push(`🕒 **Data:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`);

      const embed: Record<string, unknown> = { title, color: embedColor, description: descLines.join("\n"), timestamp: now.toISOString() };
      if (storeConfig?.restock_embed_footer) embed.footer = { text: storeConfig.restock_embed_footer };
      if (storeConfig?.restock_embed_thumbnail_url) embed.thumbnail = { url: storeConfig.restock_embed_thumbnail_url };
      if (storeConfig?.restock_embed_image_url) embed.image = { url: storeConfig.restock_embed_image_url };

      const body: Record<string, unknown> = { embeds: [embed] };
      if (content) body.content = content;
      if (components.length > 0) body.components = components;

      res = await fetch(`https://discord.com/api/v10/channels/${restockChannelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (res.ok) {
      console.log(`[RESTOCK] ✅ Anúncio enviado | Canal: ${restockChannelId} | Produto: ${product.name} | +${added_count} itens`);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const errText = await res.text();
      console.error(`[RESTOCK] ❌ Discord ${res.status}:`, errText);
      return new Response(JSON.stringify({ error: `Discord error ${res.status}`, details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("[RESTOCK] Erro:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
