import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTenantAccess } from "../_shared/tenant-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

function sanitizeStoragePath(rawPath: string): string {
  return String(rawPath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

function isValidTenantPath(path: string, tenantId: string): boolean {
  if (!path || path.includes("..") || path.includes("//")) return false;
  return path.startsWith(`${tenantId}/`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const contentTypeHeader = (req.headers.get("content-type") || "").toLowerCase();

    // JSON actions (e.g. remove)
    if (contentTypeHeader.includes("application/json")) {
      const body = await req.json();
      const { action, tenant_id, old_path } = body;
      if (!tenant_id) {
        return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { response: authErr } = await requireTenantAccess(req, supabase, tenant_id, body, corsHeaders);
      if (authErr) return authErr;

      if (action === "remove" && old_path) {
        const cleanOld = sanitizeStoragePath(old_path);
        if (isValidTenantPath(cleanOld, tenant_id)) {
          await supabase.storage.from("tenant-assets").remove([cleanOld]);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Multipart upload
    const formData = await req.formData();
    const file = formData.get("file");
    const tenantId = String(formData.get("tenant_id") || "").trim();
    const rawPath = String(formData.get("path") || "");
    const rawOldPath = String(formData.get("old_path") || "");
    const authToken = String(formData.get("_auth_token") || "").trim();
    const overrideContentType = String(formData.get("content_type") || "").trim();

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { response: authErr } = await requireTenantAccess(
      req,
      supabase,
      tenantId,
      authToken ? { _auth_token: authToken } : null,
      corsHeaders
    );
    if (authErr) return authErr;

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Arquivo não informado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size === 0) {
      return new Response(JSON.stringify({ error: "Arquivo vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "Arquivo excede o limite de 15MB" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPath = sanitizeStoragePath(rawPath);
    if (!isValidTenantPath(cleanPath, tenantId)) {
      return new Response(JSON.stringify({ error: "Caminho de upload inválido para esta loja" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const uploadContentType = overrideContentType || file.type || "application/octet-stream";

    const { error: uploadError } = await supabase.storage
      .from("tenant-assets")
      .upload(cleanPath, fileBytes, {
        upsert: true,
        contentType: uploadContentType,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort cleanup of replaced file in the same tenant folder
    if (rawOldPath) {
      const cleanOld = sanitizeStoragePath(rawOldPath);
      if (isValidTenantPath(cleanOld, tenantId) && cleanOld !== cleanPath) {
        await supabase.storage.from("tenant-assets").remove([cleanOld]).catch(() => undefined);
      }
    }

    const { data: pub } = supabase.storage.from("tenant-assets").getPublicUrl(cleanPath);

    return new Response(
      JSON.stringify({
        success: true,
        path: cleanPath,
        publicUrl: pub.publicUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno no upload" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
