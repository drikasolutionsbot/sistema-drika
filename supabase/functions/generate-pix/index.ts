import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── EMV TLV helpers ───────────────────────────────────────────────
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

// CRC16-CCITT (poly 0x1021)
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

interface PixParams {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number; // in BRL (e.g. 29.90)
  txId?: string;
  description?: string;
}

function generateBRCode(params: PixParams): string {
  const { pixKey, merchantName, merchantCity, amount, txId, description } = params;

  // ID 00 – Payload Format Indicator
  let payload = tlv("00", "01");

  // ID 01 – Point of Initiation Method (12 = dynamic if amount, 11 = static)
  payload += tlv("01", amount ? "12" : "11");

  // ID 26 – Merchant Account Information (PIX)
  let mai = tlv("00", "br.gov.bcb.pix"); // GUI
  mai += tlv("01", pixKey);
  if (description) {
    mai += tlv("02", description.substring(0, 72));
  }
  payload += tlv("26", mai);

  // ID 52 – Merchant Category Code
  payload += tlv("52", "0000");

  // ID 53 – Transaction Currency (986 = BRL)
  payload += tlv("53", "986");

  // ID 54 – Transaction Amount (optional)
  if (amount && amount > 0) {
    payload += tlv("54", amount.toFixed(2));
  }

  // ID 58 – Country Code
  payload += tlv("58", "BR");

  // ID 59 – Merchant Name
  payload += tlv("59", merchantName.substring(0, 25));

  // ID 60 – Merchant City
  payload += tlv("60", merchantCity.substring(0, 15));

  // ID 62 – Additional Data Field
  const refLabel = txId || "***";
  payload += tlv("62", tlv("05", refLabel.substring(0, 25)));

  // ID 63 – CRC16 (append placeholder, compute, replace)
  payload += "6304";
  const checksum = crc16(payload);
  payload += checksum;

  return payload;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, amount_cents, product_name, tx_id } = await req.json();

    if (!tenant_id) throw new Error("Missing tenant_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch tenant PIX config
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name, pix_key, pix_key_type")
      .eq("id", tenant_id)
      .single();

    if (tenantError) throw tenantError;
    if (!tenant.pix_key) throw new Error("Chave PIX não configurada. Vá em Configurações > PIX.");

    const amount = amount_cents ? amount_cents / 100 : undefined;

    const brCode = generateBRCode({
      pixKey: tenant.pix_key,
      merchantName: tenant.name || "Loja",
      merchantCity: "Brasil",
      amount,
      txId: tx_id || undefined,
      description: product_name ? `Pgto ${product_name}`.substring(0, 72) : undefined,
    });

    return new Response(
      JSON.stringify({
        success: true,
        brcode: brCode,
        pix_key: tenant.pix_key,
        pix_key_type: tenant.pix_key_type,
        amount: amount ? amount.toFixed(2) : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("generate-pix error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
