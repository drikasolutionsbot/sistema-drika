const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Busca o tenant pelo discord_guild_id
 */
async function getTenantByGuild(guildId) {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("discord_guild_id", guildId)
    .single();
  if (error) return null;
  return data;
}

/**
 * Busca produtos ativos de um tenant
 */
async function getProducts(tenantId, onlyActive = true) {
  let query = supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (onlyActive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) return [];
  return data;
}

/**
 * Busca variações (fields) de um produto
 */
async function getProductFields(productId, tenantId) {
  const { data, error } = await supabase
    .from("product_fields")
    .select("*")
    .eq("product_id", productId)
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return data;
}

/**
 * Busca itens de estoque disponíveis
 */
async function getAvailableStock(productId, tenantId, fieldId = null, limit = 1) {
  let query = supabase
    .from("product_stock_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("delivered", false)
    .limit(limit);
  if (fieldId) {
    query = query.eq("field_id", fieldId);
  } else {
    query = query.eq("product_id", productId);
  }
  const { data, error } = await query;
  if (error) return [];
  return data;
}

/**
 * Conta estoque disponível
 */
async function countStock(productId, tenantId, fieldId = null) {
  let query = supabase
    .from("product_stock_items")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("delivered", false);
  if (fieldId) {
    query = query.eq("field_id", fieldId);
  } else {
    query = query.eq("product_id", productId);
  }
  const { count, error } = await query;
  if (error) return 0;
  return count || 0;
}

/**
 * Cria um pedido
 */
async function createOrder(orderData) {
  const { data, error } = await supabase
    .from("orders")
    .insert(orderData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza status do pedido
 */
async function updateOrderStatus(orderId, status, extraFields = {}) {
  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString(), ...extraFields })
    .eq("id", orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Marca itens de estoque como entregues
 */
async function deliverStockItems(itemIds, discordUserId) {
  const { error } = await supabase
    .from("product_stock_items")
    .update({
      delivered: true,
      delivered_at: new Date().toISOString(),
      delivered_to: discordUserId,
    })
    .in("id", itemIds);
  if (error) throw error;
}

/**
 * Busca config da loja
 */
async function getStoreConfig(tenantId) {
  const { data, error } = await supabase
    .from("store_configs")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();
  if (error) return null;
  return data;
}

/**
 * Busca categorias do tenant
 */
async function getCategories(tenantId) {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return data;
}

/**
 * Busca cupom por código
 */
async function getCoupon(tenantId, code) {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("code", code.toUpperCase())
    .eq("active", true)
    .single();
  if (error) return null;
  // Verificar expiração
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  // Verificar uso máximo
  if (data.max_uses && data.used_count >= data.max_uses) return null;
  return data;
}

/**
 * Incrementa uso do cupom
 */
async function incrementCouponUsage(couponId) {
  await supabase.rpc("increment_coupon_usage", { coupon_id: couponId }).catch(() => {
    // Fallback: update direto
    supabase
      .from("coupons")
      .update({ used_count: supabase.raw("used_count + 1") })
      .eq("id", couponId);
  });
}

/**
 * Busca configurações de proteção
 */
async function getProtectionSettings(tenantId) {
  const { data, error } = await supabase
    .from("protection_settings")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error) return [];
  return data;
}

/**
 * Registra log de proteção
 */
async function logProtection(tenantId, moduleKey, action, targetUserId, targetUsername, details = {}) {
  await supabase.from("protection_logs").insert({
    tenant_id: tenantId,
    module_key: moduleKey,
    action,
    target_user_id: targetUserId,
    target_username: targetUsername,
    details,
  });
}

module.exports = {
  supabase,
  getTenantByGuild,
  getProducts,
  getProductFields,
  getAvailableStock,
  countStock,
  createOrder,
  updateOrderStatus,
  deliverStockItems,
  getStoreConfig,
  getCategories,
  getCoupon,
  incrementCouponUsage,
  getProtectionSettings,
  logProtection,
};
