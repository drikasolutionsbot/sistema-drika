import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bgBase64 } from "./bg.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper: update products.stock column AND trigger Discord embed sync
async function syncStockAndEmbed(supabase: any, productId: string, tenantId: string) {
  // Count real stock from product_stock_items
  const { count } = await supabase
    .from("product_stock_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("tenant_id", tenantId)
    .eq("delivered", false);

  const realStock = count ?? 0;

  // Update the products.stock column
  await supabase
    .from("products")
    .update({ stock: realStock, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("tenant_id", tenantId);

  // Trigger Discord embed sync (fire-and-forget)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-webhook-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        action: "sync",
        tenant_id: tenantId,
        product_id: productId,
      }),
    });
  } catch (e) {
    console.error("Failed to sync product embed:", e);
  }
}


// ── Restock image generation (inline WASM) ──
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
let _wasmReady = false;
let _fontR: Uint8Array | null = null;
let _fontB: Uint8Array | null = null;
let _fontBl: Uint8Array | null = null;

async function ensureImageReady() {
  if (!_wasmReady) {
    const w = await fetch("https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm");
    await initWasm(await w.arrayBuffer());
    _wasmReady = true;
  }
  if (!_fontR || !_fontB || !_fontBl) {
    const [r, b, bl] = await Promise.all([
      fetch("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf").then(x => x.arrayBuffer()),
      fetch("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf").then(x => x.arrayBuffer()),
      fetch("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-900-normal.ttf").then(x => x.arrayBuffer()),
    ]);
    _fontR = new Uint8Array(r); _fontB = new Uint8Array(b); _fontBl = new Uint8Array(bl);
  }
}

function _esc(s: string) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

async function buildRestockPng(productName: string, addedCount: string, totalStock: string, dateTime: string, theme: string): Promise<Uint8Array | null> {
  try {
    await ensureImageReady();
    const e = _esc;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
  <defs>
    <clipPath id="bg-clip"><rect width="800" height="400" rx="24"/></clipPath>
  </defs>
  <g clip-path="url(#bg-clip)">
    <image href="${bgBase64}" width="800" height="400" preserveAspectRatio="xMidYMid slice" />
  </g>
  <rect x="60" y="50" width="160" height="48" rx="24" fill="#fff"/>
  <path d="M95 62 L85 75 L92 75 L89 86 L100 73 L93 73 Z" fill="#000"/>
  <text x="110" y="80" fill="#000" font-size="18" font-family="Inter,sans-serif" font-weight="900" letter-spacing="1.5">RESTOCK</text>
  <text x="240" y="79" fill="#8b8e9b" font-size="16" font-family="Inter,sans-serif">novos itens acabaram de chegar</text>
  <text x="60" y="160" fill="#fff" font-size="42" font-family="Inter,sans-serif" font-weight="900" letter-spacing="-0.5">${e(productName)}</text>
  <line x1="60" y1="190" x2="450" y2="190" stroke="#2a2d3d" stroke-width="2"/>
  <rect x="60" y="230" width="180" height="90" rx="16" fill="#13141d" stroke="#2a2d3d" stroke-width="1.5"/>
  <rect x="80" y="250" width="30" height="30" rx="6" fill="#1c1f2e"/>
  <path d="M87 265 L95 261 L103 265 M87 265 L87 271 L95 275 L95 261 M95 275 L103 271 L103 265" stroke="#75798e" stroke-width="2" fill="none" stroke-linejoin="round"/>
  <text x="125" y="265" fill="#75798e" font-size="14" font-family="Inter,sans-serif" font-weight="600">Adicionados</text>
  <text x="125" y="295" fill="#fff" font-size="28" font-family="Inter,sans-serif" font-weight="900">${e(addedCount)}x</text>
  <rect x="260" y="230" width="220" height="90" rx="16" fill="#13141d" stroke="#2a2d3d" stroke-width="1.5"/>
  <rect x="280" y="250" width="30" height="30" rx="6" fill="#1c1f2e"/>
  <circle cx="295" cy="265" r="7" stroke="#75798e" stroke-width="2" fill="none"/>
  <path d="M295 260 L295 265 L299 265" stroke="#75798e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="325" y="265" fill="#75798e" font-size="14" font-family="Inter,sans-serif" font-weight="600">Data</text>
  <text x="325" y="295" fill="#fff" font-size="22" font-family="Inter,sans-serif" font-weight="900">${e(dateTime)}</text>
  <circle cx="650" cy="160" r="90" fill="#13141d" stroke="#2a2d3d" stroke-width="2"/>
  <circle cx="650" cy="160" r="105" fill="none" stroke="${e(theme)}" stroke-width="1" stroke-dasharray="8 8" opacity="0.5"/>
  <text x="650" y="170" fill="#fff" font-size="64" font-family="Inter,sans-serif" font-weight="900" text-anchor="middle">${e(totalStock)}</text>
  <text x="650" y="205" fill="#8b8e9b" font-size="16" font-family="Inter,sans-serif" font-weight="600" text-anchor="middle" letter-spacing="1">em estoque</text>
  <rect x="550" y="280" width="200" height="40" rx="20" fill="#13141d" stroke="#2a2d3d" stroke-width="1.5"/>
  <path d="M575 292 L568 300 L572 300 L570 308 L578 298 L574 298 Z" fill="${e(theme)}"/>
  <text x="590" y="306" fill="#fff" font-size="16" font-family="Inter,sans-serif" font-weight="700">+${e(addedCount)} unidades</text>
</svg>`;
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 800 }, font: { fontBuffers: [_fontR!, _fontB!, _fontBl!], defaultFontFamily: "Inter" } });
    return resvg.render().asPng();
  } catch (e: any) {
    console.error("[RESTOCK] buildRestockPng error:", e.message);
    return null;
  }
}

// Helper: send restock announcement with image to Discord
async function sendRestockAnnouncement(
  supabase: any,
  tenantId: string,
  productId: string,
  fieldId: string | null,
  addedCount: number
) {
  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
    if (!botToken) { console.error("[RESTOCK] DISCORD_BOT_TOKEN não configurado"); return; }

    const { data: channelConfig } = await supabase
      .from("channel_configs")
      .select("discord_channel_id")
      .eq("tenant_id", tenantId)
      .eq("channel_key", "restock_channel")
      .maybeSingle();

    const { data: storeConfig } = await supabase
      .from("store_configs")
      .select("restock_channel_id, restock_embed_color, restock_embed_title, restock_embed_description, restock_embed_footer, restock_embed_image_url, restock_embed_thumbnail_url, restock_mention_role_id, store_url, embed_color")
      .eq("tenant_id", tenantId)
      .single();

    const restockChannelId = channelConfig?.discord_channel_id || storeConfig?.restock_channel_id;
    if (!restockChannelId) { console.log(`[RESTOCK] Nenhum canal configurado para tenant ${tenantId}`); return; }

    const { data: product } = await supabase
      .from("products").select("id, name").eq("id", productId).eq("tenant_id", tenantId).maybeSingle();
    if (!product) { console.log(`[RESTOCK] Produto não encontrado: ${productId}`); return; }

    let fieldName: string | null = null;
    if (fieldId) {
      const { data: field } = await supabase.from("product_fields").select("name").eq("id", fieldId).maybeSingle();
      fieldName = field?.name || null;
    }

    let stockQuery = supabase.from("product_stock_items")
      .select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("delivered", false);
    if (fieldId) stockQuery = stockQuery.eq("field_id", fieldId);
    else stockQuery = stockQuery.eq("product_id", productId);
    const { count: totalStock } = await stockQuery;

    const rawColor = storeConfig?.restock_embed_color || storeConfig?.embed_color || "#9333ea";

    const components: unknown[] = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2, // Secondary/Gray button
            label: "Comprar Agora",
            custom_id: `buy_product:${productId}`,
            emoji: { name: "🛒" }
          }
        ]
      }
    ];

    const mentionRoleId = storeConfig?.restock_mention_role_id;
    const content = mentionRoleId ? (mentionRoleId === "everyone" ? "@everyone" : `<@&${mentionRoleId}>`) : undefined;

    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const displayName = fieldName ? `${product.name} - ${fieldName}` : product.name;

    const imageBuffer = await buildRestockPng(
      displayName,
      String(addedCount),
      totalStock !== null ? String(totalStock) : "?",
      `${dateStr} · ${timeStr}`,
      rawColor
    );

    let res: Response;
    if (imageBuffer) {
      const boundary = `----FB${Date.now()}`;
      const payloadObj: Record<string, unknown> = { allowed_mentions: { parse: ["everyone", "roles", "users"] } };
      if (content) payloadObj.content = content;
      if (components.length > 0) payloadObj.components = components;
      const enc = new TextEncoder();
      const parts: Uint8Array[] = [
        enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(payloadObj)}\r\n`),
        enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="files[0]"; filename="restock.png"\r\nContent-Type: image/png\r\n\r\n`),
        imageBuffer,
        enc.encode(`\r\n--${boundary}--\r\n`),
      ];
      const total = parts.reduce((s, p) => s + p.length, 0);
      const body = new Uint8Array(total);
      let off = 0; for (const p of parts) { body.set(p, off); off += p.length; }
      res = await fetch(`https://discord.com/api/v10/channels/${restockChannelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body,
      });
    } else {
      // Fallback embed
      const embedColor = parseInt(rawColor.replace("#", ""), 16) || 0x9333ea;
      const title = storeConfig?.restock_embed_title
        ? storeConfig.restock_embed_title.replace("{product}", product.name).replace("{qty}", String(addedCount)).replace("{total_stock}", String(totalStock ?? "?"))
        : `🔄 RESTOCK! O produto ${product.name} acabou de receber novos itens!`;
      const description = storeConfig?.restock_embed_description
        ? storeConfig.restock_embed_description.replace("{product}", product.name).replace("{qty}", String(addedCount)).replace("{total_stock}", String(totalStock ?? "?"))
        : null;
      const descLines: string[] = [];
      if (description) { descLines.push(description); descLines.push(""); }
      if (fieldName) descLines.push(`➥ 🏷️ • **Campo:** \`${fieldName}\``);
      descLines.push(`➥ 📦 • **Adicionados:** \`${addedCount}x\``);
      if (totalStock !== null) descLines.push(`➥ 📈 • **Estoque total:** \`${totalStock}x\``);
      descLines.push(`🕒 **Data:** <t:${Math.floor(now.getTime()/1000)}:F> (<t:${Math.floor(now.getTime()/1000)}:R>)`);
      const embed: Record<string, unknown> = { title, color: embedColor, description: descLines.join("\n"), timestamp: now.toISOString() };
      if (storeConfig?.restock_embed_footer) embed.footer = { text: storeConfig.restock_embed_footer };
      if (storeConfig?.restock_embed_thumbnail_url) embed.thumbnail = { url: storeConfig.restock_embed_thumbnail_url };
      if (storeConfig?.restock_embed_image_url) embed.image = { url: storeConfig.restock_embed_image_url };
      const body: Record<string, unknown> = { embeds: [embed], allowed_mentions: { parse: ["everyone", "roles", "users"] } };
      if (content) body.content = content;
      if (components.length > 0) body.components = components;
      res = await fetch(`https://discord.com/api/v10/channels/${restockChannelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (res.ok) {
      console.log(`[RESTOCK] ✅ Anúncio enviado | Canal: ${restockChannelId} | Produto: ${product.name} | +${addedCount} | Imagem: ${!!imageBuffer}`);
    } else {
      console.error(`[RESTOCK] ❌ Discord ${res.status}:`, await res.text());
    }
  } catch (err) {
    console.error("[RESTOCK] Erro:", (err as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, tenant_id, product_id, field_id, field, items, stock_item_id } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // COUNT fields grouped by product_id (for all products of tenant)
    if (action === "count_by_product") {
      const { data, error } = await supabase
        .from("product_fields")
        .select("product_id")
        .eq("tenant_id", tenant_id);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.product_id] = (counts[row.product_id] || 0) + 1;
      }
      return new Response(JSON.stringify(counts), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LIST fields for a product
    if (action === "list") {
      const { data, error } = await supabase
        .from("product_fields")
        .select("*")
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id)
        .order("sort_order", { ascending: true });
      if (error) throw error;

      return new Response(JSON.stringify({ fields: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE a new field
    if (action === "create") {
      const { data, error } = await supabase
        .from("product_fields")
        .insert({
          product_id,
          tenant_id,
          name: field?.name || "Novo",
          description: field?.description || "",
          price_cents: field?.price_cents || 0,
          sort_order: field?.sort_order || 0,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE a field
    if (action === "update") {
      const { error } = await supabase
        .from("product_fields")
        .update(field)
        .eq("id", field_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE a field
    if (action === "delete") {
      const { error } = await supabase
        .from("product_fields")
        .delete()
        .eq("id", field_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ADD STOCK items (now supports product-level stock)
    if (action === "add_stock") {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ error: "items obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!product_id) {
        return new Response(JSON.stringify({ error: "product_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const resolvedFieldId = field_id || null;
      const rows = items.map((content: string) => ({
        product_id,
        tenant_id,
        content,
        field_id: resolvedFieldId,
      }));
      const { data, error } = await supabase
        .from("product_stock_items")
        .insert(rows)
        .select();
      if (error) throw error;
      // Sync stock count and Discord embeds
      await syncStockAndEmbed(supabase, product_id, tenant_id);
      // Trigger restock announcement to Discord channel directly (no external function needed)
      sendRestockAnnouncement(supabase, tenant_id, product_id, resolvedFieldId, data?.length || items.length)
        .catch((e: Error) => console.error("[RESTOCK] Erro no anúncio:", e.message));
      return new Response(JSON.stringify({ count: data?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET STOCK COUNT + items (filters by field_id when provided)
    if (action === "get_stock") {
      if (!product_id) {
        return new Response(JSON.stringify({ error: "product_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let query = supabase
        .from("product_stock_items")
        .select("id, content, created_at")
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id)
        .eq("delivered", false)
        .order("created_at", { ascending: false })
        .limit(500);
      // Filter by field_id when viewing a specific variation
      if (field_id) {
        query = query.eq("field_id", field_id);
      } else {
        // General stock tab: show items with no field (unassigned) OR all items
        query = query.is("field_id", null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ stock: data?.length || 0, items: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE a single stock item
    if (action === "delete_stock_item") {
      if (!stock_item_id) {
        return new Response(JSON.stringify({ error: "stock_item_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Get product_id from the stock item before deleting
      const { data: stockItem } = await supabase
        .from("product_stock_items")
        .select("product_id")
        .eq("id", stock_item_id)
        .eq("tenant_id", tenant_id)
        .single();
      const deletedProductId = stockItem?.product_id;

      const { error } = await supabase
        .from("product_stock_items")
        .delete()
        .eq("id", stock_item_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
      // Sync stock count and Discord embeds
      if (deletedProductId) {
        await syncStockAndEmbed(supabase, deletedProductId, tenant_id);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CLEAR STOCK (by field_id when provided, otherwise all unassigned items for product)
    if (action === "clear_stock") {
      if (!product_id) {
        return new Response(JSON.stringify({ error: "product_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let deleteQuery = supabase
        .from("product_stock_items")
        .delete()
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id)
        .eq("delivered", false);
      if (field_id) {
        deleteQuery = deleteQuery.eq("field_id", field_id);
      } else {
        deleteQuery = deleteQuery.is("field_id", null);
      }
      const { error } = await deleteQuery;
      if (error) throw error;
      // Sync stock count and Discord embeds
      await syncStockAndEmbed(supabase, product_id, tenant_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
