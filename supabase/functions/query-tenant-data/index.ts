import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTenantAccess } from "../_shared/tenant-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowed tables that can be queried through this function
const ALLOWED_TABLES = [
  "orders",
  "products",
  "product_fields",
  "product_stock_items",
  "categories",
  "coupons",
  "affiliates",
  "giveaways",
  "giveaway_entries",
  "verified_members",
  "protection_logs",
  "automation_logs",
  "webhook_logs",
  "tenant_audit_logs",
  "wallets",
  "wallet_transactions",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { tenant_id, table, select, order_by, ascending, limit: queryLimit, filters } = body;

    if (!tenant_id || !table) {
      return new Response(JSON.stringify({ error: "tenant_id and table are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: `Table '${table}' is not allowed` }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { response: authErr } = await requireTenantAccess(req, admin, tenant_id, body, corsHeaders);
    if (authErr) return authErr;

    // Build query
    let query: any = admin
      .from(table)
      .select(select || "*")
      .eq("tenant_id", tenant_id);

    // Apply additional filters
    if (filters && Array.isArray(filters)) {
      for (const f of filters) {
        if (f.column && f.operator && f.value !== undefined) {
          switch (f.operator) {
            case "eq": query = query.eq(f.column, f.value); break;
            case "neq": query = query.neq(f.column, f.value); break;
            case "gt": query = query.gt(f.column, f.value); break;
            case "gte": query = query.gte(f.column, f.value); break;
            case "lt": query = query.lt(f.column, f.value); break;
            case "lte": query = query.lte(f.column, f.value); break;
            case "in": query = query.in(f.column, f.value); break;
          }
        }
      }
    }

    // Order
    if (order_by) {
      query = query.order(order_by, { ascending: ascending ?? false });
    }

    // Limit
    if (queryLimit) {
      query = query.limit(queryLimit);
    }

    const { data, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
