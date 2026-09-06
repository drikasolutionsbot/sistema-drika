export function formatCdnUrl(url?: string | null): string {
  if (!url) return "";
  return url
    .replace("krudxivcuygykoswjbbx.supabase.co", "cdn-drika.studyhakify.workers.dev")
    .replace("iwotvdfxppjwasywrbmw.supabase.co", "cdn-drika.studyhakify.workers.dev");
}
