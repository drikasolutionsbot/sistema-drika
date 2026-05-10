import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tenant_id, amount_cents, action, tx_id } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ---------- CHECK status ----------
    if (action === "check") {
      if (!tx_id) throw new Error("Missing tx_id");
      const { data: tx } = await supabase
        .from("wallet_transactions")
        .select("id, status")
        .eq("id", tx_id)
        .eq("tenant_id", tenant_id)
        .maybeSingle();
      if (!tx) throw new Error("Transação não encontrada");
      return new Response(JSON.stringify({ status: tx.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- CREATE PIX deposit ----------
    if (!amount_cents || amount_cents <= 0) throw new Error("Valor inválido");

    const { data: pix, error: pixErr } = await supabase.functions.invoke("generate-pix", {
      body: {
        tenant_id,
        amount_cents,
        product_name: "Depósito carteira",
        tx_id: `WALLET${Date.now()}`,
      },
    });
    if (pixErr) throw pixErr;
    if (pix?.error) throw new Error(pix.error);
    if (pix.method !== "dynamic") {
      throw new Error("Configure um gateway PIX ativo (com valor) para depositar.");
    }

    const { data: inserted, error: insErr } = await supabase
      .from("wallet_transactions")
      .insert({
        tenant_id,
        type: "deposit",
        amount_cents,
        description: "Depósito via PIX",
        status: "pending",
        provider: pix.provider,
        payment_id: pix.payment_id,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    return new Response(
      JSON.stringify({
        tx_id: inserted.id,
        brcode: pix.brcode,
        qr_code_base64: pix.qr_code_base64,
        amount: pix.amount,
        provider: pix.provider,
        expires_at: pix.expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("wallet-pix-deposit:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
