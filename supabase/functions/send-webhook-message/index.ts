import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCORD_API = "https://discord.com/api/v10";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, channel_id, content, embeds, product_id, components } = await req.json();

    if (!tenant_id) throw new Error("Missing tenant_id");
    if (!channel_id) throw new Error("Missing channel_id");
    if (!content && (!embeds || embeds.length === 0)) {
      throw new Error("Missing content or embeds");
    }

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) throw new Error("DISCORD_BOT_TOKEN not configured");

    // Build payload
    const payload: Record<string, any> = {};
    if (content) payload.content = content;
    if (embeds) payload.embeds = embeds;

    // If product_id is provided, add buy/variations buttons
    if (product_id) {
      // Fetch product fields and auto_delivery status
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const { data: product } = await supabase
        .from("products")
        .select("auto_delivery, button_style")
        .eq("id", product_id)
        .eq("tenant_id", tenant_id)
        .single();

      const { count: realStockCount, error: stockError } = await supabase
        .from("product_stock_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id)
        .eq("delivered", false);

      if (stockError) {
        console.error("Failed to fetch real stock count:", stockError.message);
      }

      // Always add/update stock field "Restam" using real stock pool
      if (embeds && embeds.length > 0) {
        embeds[0].fields = embeds[0].fields || [];
        const stockField = {
          name: "Restam",
          value: `${realStockCount ?? 0}`,
          inline: true,
        };

        const existingStockFieldIndex = embeds[0].fields.findIndex(
          (field: any) => typeof field?.name === "string" && field.name.toLowerCase() === "restam"
        );

        if (existingStockFieldIndex >= 0) {
          embeds[0].fields[existingStockFieldIndex] = stockField;
        } else {
          embeds[0].fields.push(stockField);
        }
      }

      // Prepend auto delivery badge to embed description if applicable
      if (product?.auto_delivery && embeds && embeds.length > 0) {
        const currentDesc = embeds[0].description || "";
        if (!currentDesc.includes("Entrega Automática")) {
          embeds[0].description = `⚡ **Entrega Automática!**\n\n${currentDesc}`;
        }
      }

      const { data: fields } = await supabase
        .from("product_fields")
        .select("id")
        .eq("product_id", product_id)
        .eq("tenant_id", tenant_id);

      const hasVariations = fields && fields.length > 0;

      // Map button_style to Discord button style number
      const styleMap: Record<string, number> = {
        primary: 1,
        secondary: 2,
        success: 3,
        danger: 4,
        link: 2,
        glass: 2,
      };
      const discordBuyStyle = styleMap[product?.button_style || "success"] || 3;

      const buttons: any[] = [
        {
          type: 2, // Button
          style: discordBuyStyle,
          label: "Comprar",
          custom_id: `buy_product:${product_id}`,
        },
      ];

      payload.components = [
        {
          type: 1, // Action Row
          components: buttons,
        },
      ];
    } else if (components) {
      payload.components = components;
    }

    // Send message via Bot API (supports components/interactions)
    const sendRes = await fetch(`${DISCORD_API}/channels/${channel_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("Bot message failed:", sendRes.status, errText);
      throw new Error(`Discord API error: ${sendRes.status} - ${errText}`);
    }

    const message = await sendRes.json();

    return new Response(JSON.stringify({ success: true, message_id: message.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-webhook-message error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
