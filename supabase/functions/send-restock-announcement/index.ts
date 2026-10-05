import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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

    // 1. Buscar canal configurado em channel_configs
    const { data: channelConfig } = await supabase
      .from("channel_configs")
      .select("discord_channel_id")
      .eq("tenant_id", tenant_id)
      .eq("channel_key", "restock_channel")
      .maybeSingle();

    // 2. Buscar store_configs para embed customizado
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

    // 3. Buscar produto
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

    // 4. Nome da variante (field)
    let fieldName: string | null = null;
    if (field_id) {
      const { data: field } = await supabase.from("product_fields").select("name").eq("id", field_id).maybeSingle();
      fieldName = field?.name || null;
    }

    // 5. Contar estoque total
    let stockQuery = supabase.from("product_stock_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("delivered", false);
    if (field_id) stockQuery = stockQuery.eq("field_id", field_id);
    else stockQuery = stockQuery.eq("product_id", product_id);
    const { count: totalStock } = await stockQuery;

    // 6. Montar cor temática
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

    // 8. Menção ao cargo
    const mentionRoleId = storeConfig?.restock_mention_role_id;
    const content = mentionRoleId
      ? (mentionRoleId === "everyone" ? "@everyone" : `<@&${mentionRoleId}>`)
      : undefined;

    // 9. Gerar data formatada
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

    // 10. Tentar gerar imagem
    let imageBuffer: Uint8Array | null = null;
    try {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
      const imageRes = await fetch("https://iwotvdfxppjwasywrbmw.supabase.co/functions/v1/generate-restock-image", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
        body: JSON.stringify({
          productName: fieldName ? `${product.name} - ${fieldName}` : product.name,
          addedCount: added_count,
          totalStock: totalStock,
          dateTime: `${dateStr} · ${timeStr}`,
          themeColor: rawColor,
        }),
      });
      clearTimeout(timeoutId);
      console.log(`[RESTOCK] generate-restock-image status: ${imageRes.status}`);
      if (imageRes.ok) {
        imageBuffer = new Uint8Array(await imageRes.arrayBuffer());
        console.log(`[RESTOCK] Imagem gerada: ${imageBuffer.length} bytes`);
      } else {
        const errText = await imageRes.text();
        console.error(`[RESTOCK] Edge Function erro ${imageRes.status}:`, errText);
      }
    } catch (e: any) {
      console.error("[RESTOCK] Falha ao gerar imagem:", e.message);
    }

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
      parts.push(enc.encode(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="payload_json"${CRLF}` +
        `Content-Type: application/json${CRLF}${CRLF}` +
        payloadJson + CRLF
      ));
      parts.push(enc.encode(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="files[0]"; filename="restock.png"${CRLF}` +
        `Content-Type: image/png${CRLF}${CRLF}`
      ));
      parts.push(imageBuffer);
      parts.push(enc.encode(`${CRLF}--${boundary}--${CRLF}`));

      const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
      const multipartBody = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) {
        multipartBody.set(part, offset);
        offset += part.length;
      }

      res = await fetch(`https://discord.com/api/v10/channels/${restockChannelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: multipartBody,
      });
    } else {
      // 11b. Fallback: Enviar como embed
      const embedColor = parseInt(rawColor.replace("#", ""), 16) || 0x9333ea;
      const title = storeConfig?.restock_embed_title
        ? storeConfig.restock_embed_title
            .replace("{product}", product.name)
            .replace("{qty}", String(added_count))
            .replace("{total_stock}", String(totalStock ?? "?"))
        : `🔄 RESTOCK! O produto ${product.name} acabou de receber novos itens!`;

      const description = storeConfig?.restock_embed_description
        ? storeConfig.restock_embed_description
            .replace("{product}", product.name)
            .replace("{qty}", String(added_count))
            .replace("{total_stock}", String(totalStock ?? "?"))
        : null;

      const descLines: string[] = [];
      if (description) { descLines.push(description); descLines.push(""); }
      if (fieldName) descLines.push(`➥ 🏷️ • **Campo:** \`${fieldName}\``);
      descLines.push(`➥ 📦 • **Adicionados:** \`${added_count}x\``);
      if (totalStock !== null) descLines.push(`➥ 📈 • **Estoque total:** \`${totalStock}x\``);
      const unixTimestamp = Math.floor(now.getTime() / 1000);
      descLines.push(`🕒 **Data:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`);

      const embed: Record<string, unknown> = {
        title,
        color: embedColor,
        description: descLines.join("\n"),
        timestamp: now.toISOString(),
      };
      if (storeConfig?.restock_embed_footer) embed.footer = { text: storeConfig.restock_embed_footer };
      if (storeConfig?.restock_embed_thumbnail_url) embed.thumbnail = { url: storeConfig.restock_embed_thumbnail_url };
      if (storeConfig?.restock_embed_image_url) embed.image = { url: storeConfig.restock_embed_image_url };

      const body: Record<string, unknown> = { embeds: [embed] };
      if (content) body.content = content;
      if (components.length > 0) body.components = components;

      res = await fetch(`https://discord.com/api/v10/channels/${restockChannelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    }

    if (res.ok) {
      console.log(`[RESTOCK] ✅ Anúncio enviado | Canal: ${restockChannelId} | Produto: ${product.name} | +${added_count} itens`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
