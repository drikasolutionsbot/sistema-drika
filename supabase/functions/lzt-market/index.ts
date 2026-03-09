import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LZT_BASE = "https://prod-api.lzt.market";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("LZT_MARKET_API_TOKEN");
    if (!token) throw new Error("LZT_MARKET_API_TOKEN not configured");

    const { action, category, page, pmin, pmax, item_id } = await req.json();

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    // List categories
    if (action === "categories") {
      const res = await fetch(`${LZT_BASE}/category`, { headers });
      if (!res.ok) throw new Error(`LZT API error: ${res.status}`);
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search / list accounts by category
    if (action === "search") {
      const params = new URLSearchParams();
      if (page) params.set("page", String(page));
      if (pmin) params.set("pmin", String(pmin));
      if (pmax) params.set("pmax", String(pmax));

      const categoryPath = category ? `/${category}` : "";
      const url = `${LZT_BASE}${categoryPath}?${params.toString()}`;

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`LZT API error: ${res.status}`);
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get single account details
    if (action === "get") {
      if (!item_id) throw new Error("Missing item_id");
      const res = await fetch(`${LZT_BASE}/${item_id}`, { headers });
      if (!res.ok) throw new Error(`LZT API error: ${res.status}`);
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
