const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Tenant ──
async function getTenantByGuild(guildId) {
  const { data } = await supabase.from("tenants").select("*").eq("discord_guild_id", guildId).single();
  return data;
}

async function findUniquePendingTenantWithoutOwner() {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: pendingLogs } = await supabase
    .from("tenant_audit_logs")
    .select("tenant_id, created_at")
    .eq("action", "pending_bot_invite")
    .is("actor_discord_id", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(20);

  const pendingTenantIds = [...new Set((pendingLogs || []).map((row) => row.tenant_id).filter(Boolean))];
  if (pendingTenantIds.length !== 1) return null;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, discord_guild_id")
    .eq("id", pendingTenantIds[0])
    .is("discord_guild_id", null)
    .maybeSingle();

  return tenant || null;
}

async function findPendingTenantForOwner(ownerDiscordId) {
  if (!ownerDiscordId) {
    return await findUniquePendingTenantWithoutOwner();
  }

  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: pendingLogs } = await supabase
    .from("tenant_audit_logs")
    .select("tenant_id, created_at")
    .eq("action", "pending_bot_invite")
    .eq("actor_discord_id", ownerDiscordId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(10);

  const pendingTenantIds = [...new Set((pendingLogs || []).map((row) => row.tenant_id).filter(Boolean))];

  if (pendingTenantIds.length > 0) {
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, name, discord_guild_id")
      .in("id", pendingTenantIds)
      .is("discord_guild_id", null);

    for (const log of pendingLogs || []) {
      const match = (tenants || []).find((tenant) => tenant.id === log.tenant_id);
      if (match) return match;
    }
  }

  const { data: directOwnerTenant } = await supabase
    .from("tenants")
    .select("id, name, discord_guild_id")
    .eq("owner_discord_id", ownerDiscordId)
    .is("discord_guild_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (directOwnerTenant) return directOwnerTenant;

  return await findUniquePendingTenantWithoutOwner();
}

async function autoLinkGuildToPendingTenant({ guildId, guildName, ownerDiscordId }) {
  if (!guildId || !ownerDiscordId) return null;

  const tenant = await findPendingTenantForOwner(ownerDiscordId);
  if (!tenant) return null;

  const { data: claimedTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("discord_guild_id", guildId)
    .neq("id", tenant.id)
    .maybeSingle();

  if (claimedTenant) {
    console.warn(`[auto-link] Guild ${guildId} já vinculada a outro tenant`);
    return null;
  }

  const { data: updatedTenant, error } = await supabase
    .from("tenants")
    .update({ discord_guild_id: guildId, updated_at: new Date().toISOString() })
    .eq("id", tenant.id)
    .is("discord_guild_id", null)
    .select("id, name, discord_guild_id")
    .single();

  if (error || !updatedTenant) {
    console.error(`[auto-link] Falha ao vincular guild ${guildId}:`, error?.message || "unknown error");
    return null;
  }

  await supabase.from("tenant_audit_logs").insert({
    tenant_id: tenant.id,
    action: "auto_link_server",
    entity_type: "servidor",
    entity_id: guildId,
    entity_name: guildName,
    actor_discord_id: ownerDiscordId,
    actor_name: "Bot Externo",
    details: { source: "guild_create" },
  });

  return updatedTenant;
}

// ── Products ──
async function fetchProductsFromEdge(tenantId) {
  try {
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/manage-products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ action: "list", tenant_id: tenantId }),
    });

    if (!res.ok) {
      console.error(`[products-fallback] HTTP ${res.status}:`, await res.text());
      return [];
    }

    const data = await res.json();
    if (data?.error) {
      console.error(`[products-fallback] ${data.error}`);
      return [];
    }

    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(`[products-fallback] Error for tenant ${tenantId}:`, e.message);
    return [];
  }
}

async function getProducts(tenantId, onlyActive = true) {
  let q = supabase.from("products").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  if (onlyActive) q = q.eq("active", true);

  const { data, error } = await q;
  if (error) {
    console.error(`[getProducts] Error for tenant ${tenantId}:`, error.message);
  }

  if ((error || !Array.isArray(data) || data.length === 0) && tenantId) {
    const fallback = await fetchProductsFromEdge(tenantId);
    if (fallback.length > 0) {
      return onlyActive ? fallback.filter((p) => p.active) : fallback;
    }
  }

  return data || [];
}

function extractProductIdCandidates(rawProductId) {
  if (!rawProductId) return [];

  const raw = String(rawProductId).trim();
  const candidates = new Set();
  if (raw) candidates.add(raw);

  raw
    .split(/[:|,;\/\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => candidates.add(part));

  const uuidMatches = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi) || [];
  uuidMatches.forEach((id) => candidates.add(id));

  return [...candidates];
}

async function getProductById(productId, tenantId = null) {
  const candidates = extractProductIdCandidates(productId);
  if (!candidates.length) return null;

  for (const candidateId of candidates) {
    let q = supabase.from("products").select("*").eq("id", candidateId);
    if (tenantId) q = q.eq("tenant_id", tenantId);

    const { data, error } = await q.maybeSingle();
    if (error) {
      console.error(`[getProductById] Error for candidate ${candidateId}:`, error.message);
      continue;
    }

    if (data) return data;
  }

  if (tenantId) {
    const fallback = await fetchProductsFromEdge(tenantId);
    const exact = fallback.find((p) => candidates.includes(p.id));
    if (exact) return exact;

    const activeFallback = fallback.filter((p) => p.active);
    if (activeFallback.length === 1) {
      console.warn(`[getProductById] Using single active-product fallback for tenant ${tenantId}`);
      return activeFallback[0];
    }
  }

  return null;
}

async function getProductFields(productId, tenantId) {
  const { data } = await supabase.from("product_fields").select("*").eq("product_id", productId).eq("tenant_id", tenantId).order("sort_order", { ascending: true });
  return data || [];
}

// ── Stock ──
async function getAvailableStock(productId, tenantId, fieldId = null, limit = 1) {
  let q = supabase.from("product_stock_items").select("*").eq("tenant_id", tenantId).eq("delivered", false).limit(limit);
  if (fieldId) q = q.eq("field_id", fieldId);
  else q = q.eq("product_id", productId);
  const { data } = await q;
  // Fallback: if field-specific stock is empty, check product-level stock (field_id IS NULL)
  if (fieldId && (!data || data.length === 0)) {
    const { data: generalData } = await supabase.from("product_stock_items")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .is("field_id", null)
      .eq("delivered", false)
      .limit(limit);
    return generalData || [];
  }
  return data || [];
}

async function countStock(productId, tenantId, fieldId = null) {
  let q = supabase.from("product_stock_items").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("delivered", false);
  if (fieldId) q = q.eq("field_id", fieldId);
  else q = q.eq("product_id", productId);
  const { count } = await q;
  // Fallback: if field-specific stock is 0, check product-level stock (field_id IS NULL)
  if (fieldId && (count || 0) === 0) {
    const { count: generalCount } = await supabase.from("product_stock_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .is("field_id", null)
      .eq("delivered", false);
    return generalCount || 0;
  }
  return count || 0;
}

async function deliverStockItems(itemIds, discordUserId) {
  await supabase.from("product_stock_items").update({
    delivered: true, delivered_at: new Date().toISOString(), delivered_to: discordUserId,
  }).in("id", itemIds);
}

// ── Orders ──
async function createOrder(orderData) {
  const { data, error } = await supabase.from("orders").insert(orderData).select().single();
  if (error) throw error;
  return data;
}

async function getOrder(orderId) {
  const { data } = await supabase.from("orders").select("*").eq("id", orderId).single();
  return data;
}

async function updateOrderStatus(orderId, status, extraFields = {}) {
  const { data } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString(), ...extraFields }).eq("id", orderId).select().single();
  return data;
}

// ── Store Config ──
async function getStoreConfig(tenantId) {
  const { data } = await supabase.from("store_configs").select("*").eq("tenant_id", tenantId).single();
  return data;
}

// ── Categories ──
async function getCategories(tenantId) {
  const { data } = await supabase.from("categories").select("*").eq("tenant_id", tenantId).order("sort_order", { ascending: true });
  return data || [];
}

// ── Coupons ──
async function getCoupon(tenantId, code) {
  const { data } = await supabase.from("coupons").select("*").eq("tenant_id", tenantId).eq("code", code.toUpperCase()).eq("active", true).single();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  if (data.max_uses && data.used_count >= data.max_uses) return null;
  return data;
}

async function incrementCouponUsage(couponId, currentCount) {
  await supabase.from("coupons").update({ used_count: currentCount + 1 }).eq("id", couponId);
}

// ── Protection ──
async function getProtectionSettings(tenantId) {
  const { data } = await supabase.from("protection_settings").select("*").eq("tenant_id", tenantId);
  return data || [];
}

async function getProtectionWhitelist(tenantId) {
  const { data } = await supabase.from("protection_whitelist").select("*").eq("tenant_id", tenantId);
  return data || [];
}

async function logProtection(tenantId, moduleKey, action, targetUserId, targetUsername, details = {}) {
  await supabase.from("protection_logs").insert({ tenant_id: tenantId, module_key: moduleKey, action, target_user_id: targetUserId, target_username: targetUsername, details });
}

// ── Tickets ──
async function createTicket(data) {
  const { data: ticket, error } = await supabase.from("tickets").insert(data).select().single();
  if (error) throw error;
  return ticket;
}

async function getOpenTickets(tenantId, discordUserId) {
  const { data } = await supabase.from("tickets").select("id, discord_channel_id").eq("tenant_id", tenantId).eq("discord_user_id", discordUserId).in("status", ["open", "in_progress"]);
  return data || [];
}

async function closeTicket(ticketId, closedBy) {
  await supabase.from("tickets").update({ status: "closed", closed_by: closedBy, closed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", ticketId);
}

async function getTicketByChannel(channelId) {
  const { data } = await supabase.from("tickets").select("*").eq("discord_channel_id", channelId).in("status", ["open", "in_progress"]).single();
  return data;
}

async function getTicketById(ticketId) {
  const { data } = await supabase.from("tickets").select("*").eq("id", ticketId).single();
  return data;
}

// ── Payment Providers ──
async function getActivePaymentProvider(tenantId) {
  const { data } = await supabase.from("payment_providers").select("*").eq("tenant_id", tenantId).eq("active", true);
  if (!data) return null;
  return data.find((p) => p.api_key_encrypted) || null;
}

// ── Automations ──
async function triggerAutomation(tenantId, triggerType, triggerData) {
  try {
    await fetch(`${process.env.SUPABASE_URL}/functions/v1/execute-automation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ tenant_id: tenantId, trigger_type: triggerType, trigger_data: triggerData }),
    });
  } catch (e) { console.error(`Automation ${triggerType} failed:`, e.message); }
}

// ── Deliver Order (via edge function) ──
async function deliverOrder(orderId, tenantId) {
  try {
    await fetch(`${process.env.SUPABASE_URL}/functions/v1/deliver-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ order_id: orderId, tenant_id: tenantId }),
    });
  } catch (e) { console.error("Deliver order error:", e.message); }
}

// ── Global Bot Config ──
async function getGlobalBotConfig() {
  const { data } = await supabase.from("landing_config").select("global_bot_status, global_bot_banner_url").limit(1).single();
  return data;
}

module.exports = {
  supabase,
  getTenantByGuild,
  autoLinkGuildToPendingTenant,
  getProducts,
  getProductById,
  getProductFields,
  getAvailableStock,
  countStock,
  deliverStockItems,
  createOrder,
  getOrder,
  updateOrderStatus,
  getStoreConfig,
  getCategories,
  getCoupon,
  incrementCouponUsage,
  getProtectionSettings,
  getProtectionWhitelist,
  logProtection,
  createTicket,
  getOpenTickets,
  closeTicket,
  getTicketByChannel,
  getTicketById,
  getActivePaymentProvider,
  triggerAutomation,
  deliverOrder,
  getGlobalBotConfig,
};
