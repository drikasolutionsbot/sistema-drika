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

    // 6. Montar embed
    const rawColor = storeConfig?.restock_embed_color || storeConfig?.embed_color || "#57F287";
    const embedColor = parseInt(rawColor.replace("#", ""), 16) || 0x57F287;

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
    if (description) {
      descLines.push(description);
      descLines.push("");
    }

    if (fieldName) descLines.push(`➥ 🏷️ • **Campo:** \`${fieldName}\``);
    descLines.push(`➥ 📦 • **Adicionados:** \`${added_count}x\``);
    if (totalStock !== null) descLines.push(`➥ 📈 • **Estoque total:** \`${totalStock}x\``);

    const now = new Date();
    const unixTimestamp = Math.floor(now.getTime() / 1000);
    descLines.push(`🕒 **Data:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`);

    const finalDescription = descLines.join("\n");

    const embed: Record<string, unknown> = {
      title,
      color: embedColor,
      description: finalDescription,
      timestamp: now.toISOString(),
    };
    if (storeConfig?.restock_embed_footer) embed.footer = { text: storeConfig.restock_embed_footer };
    if (storeConfig?.restock_embed_thumbnail_url) embed.thumbnail = { url: storeConfig.restock_embed_thumbnail_url };
    if (storeConfig?.restock_embed_image_url) embed.image = { url: storeConfig.restock_embed_image_url };

    // 7. Botão Comprar Agora
    const components: unknown[] = [];
    const storeUrl = storeConfig?.store_url;
    if (storeUrl) {
      components.push({
        type: 1,
        components: [{ type: 2, style: 5, label: "Comprar Agora", url: storeUrl, emoji: { name: "🛒" } }],
      });
    }

    // 8. Menção ao cargo
    const mentionRoleId = storeConfig?.restock_mention_role_id;
    const content = mentionRoleId
      ? (mentionRoleId === "everyone" ? "@everyone" : `<@&${mentionRoleId}>`)
      : undefined;

    // 9. Enviar para o Discord via REST
    const body: Record<string, unknown> = { embeds: [embed] };
    if (content) body.content = content;
    if (components.length > 0) body.components = components;

    const res = await fetch(`https://discord.com/api/v10/channels/${restockChannelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

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
