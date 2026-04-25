import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCORD_API = "https://discord.com/api/v10";

// ─── Default templates (used as fallback when tenant has none) ─────
type DefaultTemplate = {
  title: string;
  description: string;
  color: number;
  footer?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  buttons?: Array<{ label: string; url: string; emoji?: string; style?: number }>;
};

const DEFAULT_TEMPLATES: Record<string, DefaultTemplate> = {
  order_delivered: {
    title: "📦 Pedido entregue",
    description: "Olá **{customer}**! Seu pedido **#{order_number}** foi entregue com sucesso.\n\n**Produto:** {product}\n**Quantidade:** {quantity}\n**Total:** {total}\n\n```{delivery_content}```",
    color: 0x57f287,
    footer: "{store_name} • Obrigado pela compra!",
  },
  payment_approved: {
    title: "🟢 Pagamento aprovado",
    description: "Olá **{customer}**! Seu pagamento do pedido **#{order_number}** foi aprovado.\n\n**Produto:** {product}\n**Total:** {total}\n\nEm instantes você receberá a entrega.",
    color: 0x57f287,
    footer: "{store_name}",
  },
  order_rejected: {
    title: "❌ Pedido rejeitado",
    description: "Olá **{customer}**, infelizmente seu pedido **#{order_number}** foi rejeitado pela equipe.\n\nSe acreditar que houve um engano, abra um ticket de suporte.",
    color: 0xed4245,
    footer: "{store_name}",
  },
  order_canceled: {
    title: "🚫 Pedido cancelado",
    description: "Olá **{customer}**, seu pedido **#{order_number}** foi cancelado.\n\nSe tiver dúvidas, abra um ticket de suporte.",
    color: 0xed4245,
    footer: "{store_name}",
  },
  order_expired: {
    title: "⏰ Pedido expirado",
    description: "Olá **{customer}**, o pagamento do pedido **#{order_number}** não foi confirmado a tempo e o pedido expirou.\n\nVocê pode realizar uma nova compra a qualquer momento.",
    color: 0xfee75c,
    footer: "{store_name}",
  },
  ticket_opened: {
    title: "🎫 Ticket aberto",
    description: "Olá **{customer}**! Seu ticket foi aberto com sucesso.\n\nA equipe da **{store_name}** responderá em breve. Aguarde no canal do ticket.",
    color: 0x5865f2,
    footer: "{store_name} • Suporte",
  },
  ticket_closed: {
    title: "🔒 Ticket encerrado",
    description: "Olá **{customer}**, seu ticket foi encerrado.\n\nObrigado pelo contato! Se precisar de algo mais, abra um novo ticket.",
    color: 0x99aab5,
    footer: "{store_name}",
  },
};

// ─── Placeholder substitution ───────────────────────────────────────
function applyVars(text: string, vars: Record<string, any>): string {
  if (!text) return text;
  return text.replace(/\{(\w+)\}/g, (_m, key) => {
    const v = vars[key];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}

function applyVarsDeep(obj: any, vars: Record<string, any>): any {
  if (typeof obj === "string") return applyVars(obj, vars);
  if (Array.isArray(obj)) return obj.map((x) => applyVarsDeep(x, vars));
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const k of Object.keys(obj)) out[k] = applyVarsDeep(obj[k], vars);
    return out;
  }
  return obj;
}

function hexToInt(hex: string | undefined): number | undefined {
  if (!hex) return undefined;
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return Number.isFinite(n) ? n : undefined;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, template_key, recipient_id, vars = {} } = await req.json();
    if (!tenant_id || !template_key || !recipient_id) {
      throw new Error("Missing tenant_id, template_key, or recipient_id");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;

    // 1. Load tenant for branding + bot token
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, logo_url, bot_name, bot_avatar_url")
      .eq("id", tenant_id)
      .maybeSingle();

    const storeBrand = {
      name: (tenant as any)?.bot_name || (tenant as any)?.name || "Loja",
      icon_url: (tenant as any)?.bot_avatar_url || (tenant as any)?.logo_url || undefined,
    };

    // 2. Load custom template (or fallback to default)
    const { data: tpl } = await supabase
      .from("dm_templates")
      .select("enabled, embed_data")
      .eq("tenant_id", tenant_id)
      .eq("template_key", template_key)
      .maybeSingle();

    const useCustom = tpl && (tpl as any).enabled !== false && (tpl as any).embed_data && Object.keys((tpl as any).embed_data).length > 0;
    const fallback = DEFAULT_TEMPLATES[template_key];
    if (!useCustom && !fallback) {
      throw new Error(`No template found for key ${template_key}`);
    }

    const fullVars = {
      store_name: storeBrand.name,
      date: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      ...vars,
    };

    // 3. Build embed
    let embed: any;
    let buttons: any[] = [];

    if (useCustom) {
      const data = (tpl as any).embed_data || {};
      embed = {
        title: applyVars(data.title || "", fullVars) || undefined,
        description: applyVars(data.description || "", fullVars) || undefined,
        color: hexToInt(data.color) ?? 0x2b2d31,
        author: { name: storeBrand.name, icon_url: storeBrand.icon_url },
        ...(data.thumbnail ? { thumbnail: { url: applyVars(data.thumbnail, fullVars) } } : {}),
        ...(data.image ? { image: { url: applyVars(data.image, fullVars) } } : {}),
        ...(data.footer
          ? { footer: { text: applyVars(data.footer, fullVars), icon_url: storeBrand.icon_url } }
          : { footer: { text: storeBrand.name, icon_url: storeBrand.icon_url } }),
        ...(Array.isArray(data.fields) && data.fields.length > 0
          ? {
              fields: data.fields.slice(0, 25).map((f: any) => ({
                name: applyVars(f.name || "​", fullVars),
                value: applyVars(f.value || "​", fullVars),
                inline: !!f.inline,
              })),
            }
          : {}),
      };
      if (Array.isArray(data.buttons) && data.buttons.length > 0) {
        buttons = data.buttons.slice(0, 5).map((b: any) => ({
          type: 2,
          style: 5, // Link
          label: applyVars(b.label || "Abrir", fullVars).slice(0, 80),
          url: applyVars(b.url || "https://discord.com", fullVars),
          ...(b.emoji ? { emoji: typeof b.emoji === "string" ? { name: b.emoji } : b.emoji } : {}),
        }));
      }
    } else {
      // Fallback default
      embed = {
        title: applyVars(fallback.title, fullVars),
        description: applyVars(fallback.description, fullVars),
        color: fallback.color,
        author: { name: storeBrand.name, icon_url: storeBrand.icon_url },
        footer: {
          text: applyVars(fallback.footer || storeBrand.name, fullVars),
          icon_url: storeBrand.icon_url,
        },
        ...(fallback.fields && fallback.fields.length > 0
          ? { fields: fallback.fields.map((f) => ({ ...f, name: applyVars(f.name, fullVars), value: applyVars(f.value, fullVars) })) }
          : {}),
      };
      if (fallback.buttons && fallback.buttons.length > 0) {
        buttons = fallback.buttons.slice(0, 5).map((b) => ({
          type: 2,
          style: b.style ?? 5,
          label: applyVars(b.label, fullVars).slice(0, 80),
          url: applyVars(b.url, fullVars),
          ...(b.emoji ? { emoji: { name: b.emoji } } : {}),
        }));
      }
    }

    // 4. Open DM channel
    const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id }),
    });
    if (!dmRes.ok) {
      const errText = await dmRes.text();
      throw new Error(`Failed to open DM: ${dmRes.status} ${errText.slice(0, 200)}`);
    }
    const dmCh = await dmRes.json();

    // 5. Send message
    const components = buttons.length > 0 ? [{ type: 1, components: buttons }] : [];
    const msgRes = await fetch(`${DISCORD_API}/channels/${dmCh.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed], components }),
    });

    if (!msgRes.ok) {
      const errText = await msgRes.text();
      throw new Error(`Failed to send DM: ${msgRes.status} ${errText.slice(0, 200)}`);
    }

    const msgJson = await msgRes.json();
    return new Response(
      JSON.stringify({ success: true, dm_channel_id: dmCh.id, message_id: msgJson.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-dm-template error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
