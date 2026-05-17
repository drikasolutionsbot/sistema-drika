import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function applyVars(tpl: string, vars: Record<string, string>): string {
  return (tpl || "").replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
function hexToInt(hex?: string): number {
  if (!hex) return 0xFF1493;
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return Number.isFinite(n) ? n : 0xFF1493;
}

async function postListingToDiscord(supabase: any, listing_id: string, listing: any, category_global: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: cfg } = await supabase
      .from("landing_config")
      .select("global_marketplace_category_channels, global_marketplace_embed_template")
      .maybeSingle();
    const channels = (cfg?.global_marketplace_category_channels || {}) as Record<string, string>;
    const channelId = channels[category_global];
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

    if (!channelId) return { ok: false, error: `Sem canal configurado para "${category_global}"` };
    if (!botToken) return { ok: false, error: "DISCORD_BOT_TOKEN ausente" };

    const tpl = (cfg?.global_marketplace_embed_template || {}) as any;
    const p: any = listing.products || {};
    const seller = listing.tenants?.name || "Vendedor";
    const priceBRL = ((p.price_cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const vars = {
      product_name: p.name || "Produto",
      product_description: p.description || "",
      price: priceBRL,
      seller,
      category: category_global,
    };

    const fields: any[] = [];
    if (tpl.show_price !== false) fields.push({ name: "Preço", value: priceBRL, inline: true });
    if (tpl.show_seller !== false) fields.push({ name: "Vendedor", value: seller, inline: true });
    if (tpl.show_category !== false) fields.push({ name: "Categoria", value: category_global, inline: true });

    const embed: any = {
      title: applyVars(tpl.title || "{product_name}", vars),
      description: applyVars(tpl.description || "{product_description}", vars),
      color: hexToInt(tpl.color),
      fields,
      footer: { text: applyVars(tpl.footer || "Marketplace Global • DRIKA HUB", vars) },
      timestamp: new Date().toISOString(),
    };
    if (tpl.show_thumbnail !== false && p.icon_url) embed.thumbnail = { url: p.icon_url };
    if (tpl.show_banner !== false && p.banner_url) embed.image = { url: p.banner_url };

    const btn: any = {
      type: 2,
      style: [1, 2, 3, 4].includes(tpl.button_style) ? tpl.button_style : 1,
      label: tpl.button_label || "Comprar",
      custom_id: `gml_buy:${listing_id}`,
    };
    if (tpl.button_emoji) btn.emoji = { name: tpl.button_emoji };
    const components = [{ type: 1, components: [btn] }];

    const resp = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed], components, allowed_mentions: { parse: [] } }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error(`[postListing] ${resp.status} ${txt}`);
      return { ok: false, error: `Discord ${resp.status}: ${txt.slice(0, 200)}` };
    }
    const msg = await resp.json();
    await supabase
      .from("global_marketplace_listings")
      .update({ discord_channel_id: channelId, discord_message_id: msg.id })
      .eq("id", listing_id);
    return { ok: true };
  } catch (e: any) {
    console.error("[postListing] erro:", e);
    return { ok: false, error: e.message || String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    // ── Submit produto pra aprovação ──
    if (action === "submit") {
      const { tenant_id, product_id } = body;
      if (!tenant_id || !product_id) throw new Error("Missing tenant_id or product_id");

      // Valida plano pago
      const { data: tenant } = await supabase
        .from("tenants").select("plan").eq("id", tenant_id).single();
      if (!tenant || !["pro", "master"].includes(tenant.plan)) {
        return json({ error: "Apenas planos Pro/Master podem enviar produtos ao Marketplace Global" }, 403);
      }

      // Valida produto pertence ao tenant
      const { data: product } = await supabase
        .from("products").select("id, name, active, price_cents")
        .eq("id", product_id).eq("tenant_id", tenant_id).single();
      if (!product) throw new Error("Produto não encontrado");
      if (!product.active) throw new Error("Produto precisa estar ativo");
      if (!product.price_cents || product.price_cents < 100) throw new Error("Preço mínimo R$ 1,00");

      // Já existe listagem ativa (pending/approved)?
      const { data: existing } = await supabase
        .from("global_marketplace_listings")
        .select("id, global_status")
        .eq("product_id", product_id)
        .in("global_status", ["pending", "approved"])
        .maybeSingle();

      if (existing) {
        return json({ error: `Produto já está ${existing.global_status === "pending" ? "em análise" : "aprovado"}` }, 400);
      }

      const { data, error } = await supabase
        .from("global_marketplace_listings")
        .insert({ tenant_id, product_id, global_status: "pending" })
        .select().single();
      if (error) throw error;
      return json(data);
    }

    // ── Listar listagens próprias do tenant ──
    if (action === "list_own") {
      const { tenant_id } = body;
      if (!tenant_id) throw new Error("Missing tenant_id");
      const { data, error } = await supabase
        .from("global_marketplace_listings")
        .select("*, products(name, icon_url, banner_url, price_cents, description)")
        .eq("tenant_id", tenant_id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return json(data);
    }

    // ── Admin: listar todas / por status ──
    if (action === "list_all") {
      const { status } = body;
      let query = supabase
        .from("global_marketplace_listings")
        .select("*, products(name, icon_url, banner_url, price_cents, description, type), tenants:tenant_id(name, plan, email, whatsapp, owner_discord_username, owner_discord_id, pix_key, pix_key_type)")
        .order("submitted_at", { ascending: false });
      if (status) query = query.eq("global_status", status);
      const { data, error } = await query;
      if (error) throw error;
      return json(data);
    }

    // ── Admin: aprovar ──
    if (action === "approve") {
      const { listing_id, category_global, reviewer_id } = body;
      if (!listing_id || !category_global) throw new Error("Missing listing_id or category_global");
      const { data, error } = await supabase
        .from("global_marketplace_listings")
        .update({
          global_status: "approved",
          category_global,
          reviewed_by: reviewer_id || null,
          reviewed_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq("id", listing_id)
        .select("*, products(name, icon_url, banner_url, price_cents, description, type), tenants:tenant_id(name, email, whatsapp, owner_discord_username, owner_discord_id, pix_key, pix_key_type)")
        .single();
      if (error) throw error;

      // Postar embed no canal Discord da categoria
      await postListingToDiscord(supabase, listing_id, data, category_global);

      return json(data);
    }

    // ── Admin: reenviar para o Discord ──
    if (action === "repost") {
      const { listing_id } = body;
      if (!listing_id) throw new Error("Missing listing_id");
      const { data: listing, error } = await supabase
        .from("global_marketplace_listings")
        .select("*, products(name, icon_url, banner_url, price_cents, description, type), tenants:tenant_id(name, email, whatsapp, owner_discord_username, owner_discord_id, pix_key, pix_key_type)")
        .eq("id", listing_id)
        .single();
      if (error) throw error;
      if (listing.global_status !== "approved") return json({ error: "Apenas aprovados podem ser reenviados" }, 400);
      if (!listing.category_global) return json({ error: "Listing sem categoria" }, 400);

      // Apaga mensagem antiga se existir
      const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
      if (botToken && listing.discord_channel_id && listing.discord_message_id) {
        await fetch(`https://discord.com/api/v10/channels/${listing.discord_channel_id}/messages/${listing.discord_message_id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bot ${botToken}` },
        }).catch((e) => console.warn("[repost] falha ao apagar antiga:", e));
      }

      const posted = await postListingToDiscord(supabase, listing_id, listing, listing.category_global);
      if (!posted.ok) return json({ error: posted.error || "Falha ao postar no Discord" }, 400);
      return json({ success: true });
    }

    // ── Admin: rejeitar ──
    if (action === "reject") {
      const { listing_id, reason, reviewer_id } = body;
      if (!listing_id) throw new Error("Missing listing_id");
      const { data, error } = await supabase
        .from("global_marketplace_listings")
        .update({
          global_status: "rejected",
          rejection_reason: reason || "Sem motivo informado",
          reviewed_by: reviewer_id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", listing_id)
        .select().single();
      if (error) throw error;
      return json(data);
    }

    // ── Admin: remover do marketplace ──
    if (action === "remove") {
      const { listing_id } = body;
      if (!listing_id) throw new Error("Missing listing_id");
      const { error } = await supabase
        .from("global_marketplace_listings")
        .update({ global_status: "removed" })
        .eq("id", listing_id);
      if (error) throw error;
      return json({ success: true });
    }

    // ── Tenant: cancelar própria submissão ──
    if (action === "cancel") {
      const { listing_id, tenant_id } = body;
      if (!listing_id || !tenant_id) throw new Error("Missing listing_id or tenant_id");
      const { error } = await supabase
        .from("global_marketplace_listings")
        .delete()
        .eq("id", listing_id)
        .eq("tenant_id", tenant_id)
        .eq("global_status", "pending");
      if (error) throw error;
      return json({ success: true });
    }

    // ── Config: get/update (super admin only) ──
    if (action === "get_config") {
      const { data, error } = await supabase
        .from("landing_config")
        .select("global_marketplace_commission_percent, global_marketplace_guild_id, global_marketplace_approver_discord_ids, global_marketplace_category_channels, global_marketplace_payment_provider")
        .order("created_at", { ascending: true })
        .limit(1).single();
      if (error) throw error;
      return json(data);
    }

    if (action === "update_config") {
      const { config } = body;
      if (!config) throw new Error("Missing config");
      const allowed: Record<string, unknown> = {};
      const fields = [
        "global_marketplace_commission_percent",
        "global_marketplace_guild_id",
        "global_marketplace_approver_discord_ids",
        "global_marketplace_category_channels",
        "global_marketplace_payment_provider",
      ];
      for (const f of fields) if (config[f] !== undefined) allowed[f] = config[f];
      allowed.updated_at = new Date().toISOString();

      const { data: row } = await supabase
        .from("landing_config").select("id").order("created_at", { ascending: true }).limit(1).single();
      if (!row) throw new Error("landing_config não inicializado");

      const { data, error } = await supabase
        .from("landing_config").update(allowed).eq("id", row.id).select().single();
      if (error) throw error;
      return json(data);
    }

    throw new Error("Invalid action");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 400);
  }
});
