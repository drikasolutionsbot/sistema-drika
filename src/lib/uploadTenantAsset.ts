import { supabase } from "@/integrations/supabase/client";
import { getTokenSession } from "@/lib/tokenSession";

interface UploadTenantAssetOptions {
  tenantId: string;
  path: string;
  file: File | Blob;
  contentType?: string;
  oldUrl?: string | null;
  useCdn?: boolean;
}

export function extractTenantAssetPath(url?: string | null): string | null {
  if (!url || !url.includes("/tenant-assets/")) return null;
  const part = url.split("/tenant-assets/")[1]?.split("?")[0];
  return part || null;
}

/** Uploads a store asset via the authenticated upload-tenant-asset Edge Function (immune to expired client JWT clocks). */
export async function uploadTenantAsset({
  tenantId,
  path,
  file,
  contentType,
  oldUrl,
  useCdn = true,
}: UploadTenantAssetOptions): Promise<string> {
  const formData = new FormData();
  const uploadFile =
    file instanceof File
      ? file
      : new File([file], path.split("/").pop() || "upload.webp", {
          type: contentType || file.type || "application/octet-stream",
        });

  formData.append("file", uploadFile);
  formData.append("tenant_id", tenantId);
  formData.append("path", path);

  const oldPath = extractTenantAssetPath(oldUrl);
  if (oldPath) formData.append("old_path", oldPath);
  if (contentType) formData.append("content_type", contentType);

  const tokenSession = getTokenSession();
  if (tokenSession?.token) {
    formData.append("_auth_token", tokenSession.token);
  }

  const { data, error } = await supabase.functions.invoke("upload-tenant-asset", {
    body: formData,
  });

  if (error) {
    let msg = error.message || "Falha ao enviar arquivo";
    try {
      const ctx: any = (error as any).context;
      if (ctx?.json) {
        const errBody = await ctx.json();
        if (errBody?.error) msg = errBody.error;
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  if (data?.error || !data?.publicUrl) {
    throw new Error(data?.error || "Não foi possível gerar a URL pública do arquivo");
  }

  const cdnUrl = import.meta.env.VITE_CDN_URL;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (useCdn && cdnUrl && supabaseUrl) {
    return String(data.publicUrl).replace(supabaseUrl, cdnUrl);
  }
  return String(data.publicUrl);
}
