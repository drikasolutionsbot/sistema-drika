import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, tenant_id, provider_key, api_key, secret_key, provider_id, efi_cert_pem, efi_key_pem, efi_pix_key, stripe_webhook_secret } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "list") {
      const { data, error } = await supabase
        .from("payment_providers")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upsert") {
      if (!provider_key) throw new Error("Missing provider_key");

      // Check if exists
      const { data: existing } = await supabase
        .from("payment_providers")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("provider_key", provider_key)
        .maybeSingle();

      if (existing) {
        const updateData: any = {
            api_key_encrypted: api_key,
            secret_key_encrypted: secret_key || null,
            active: true,
            updated_at: new Date().toISOString(),
          };
          if (provider_key === "efi") {
            updateData.efi_cert_pem = efi_cert_pem || null;
            updateData.efi_key_pem = efi_key_pem || null;
            updateData.efi_pix_key = efi_pix_key || null;
          }
          if (provider_key === "stripe") {
            updateData.stripe_webhook_secret = stripe_webhook_secret || null;
          }
          const { error } = await supabase
          .from("payment_providers")
          .update(updateData)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const insertData: any = {
            tenant_id,
            provider_key,
            api_key_encrypted: api_key,
            secret_key_encrypted: secret_key || null,
            active: true,
          };
          if (provider_key === "efi") {
            insertData.efi_cert_pem = efi_cert_pem || null;
            insertData.efi_key_pem = efi_key_pem || null;
            insertData.efi_pix_key = efi_pix_key || null;
          }
          if (provider_key === "stripe") {
            insertData.stripe_webhook_secret = stripe_webhook_secret || null;
          }
          const { error } = await supabase
          .from("payment_providers")
          .insert(insertData);
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle") {
      if (!provider_id) throw new Error("Missing provider_id");
      const { data: current } = await supabase
        .from("payment_providers")
        .select("active")
        .eq("id", provider_id)
        .eq("tenant_id", tenant_id)
        .single();

      if (!current) throw new Error("Provider not found");

      const { error } = await supabase
        .from("payment_providers")
        .update({ active: !current.active })
        .eq("id", provider_id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
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
