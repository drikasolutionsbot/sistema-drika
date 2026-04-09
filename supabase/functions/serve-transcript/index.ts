import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");
    const ticketId = url.searchParams.get("ticket_id");

    if (!tenantId || !ticketId) {
      return new Response("<h1>Transcript não encontrado</h1>", {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const filePath = `transcripts/${tenantId}/${ticketId}.html`;

    const { data, error } = await supabase.storage
      .from("tenant-assets")
      .download(filePath);

    if (error || !data) {
      return new Response(
        `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Transcript</title>
        <style>body{background:#313338;color:#dbdee1;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
        .box{text-align:center;padding:40px;background:#2b2d31;border-radius:12px}h1{font-size:1.2rem}p{color:#949ba4;margin-top:8px}</style></head>
        <body><div class="box"><h1>📜 Transcript não encontrado</h1><p>Este transcript pode ter expirado ou sido removido.</p></div></body></html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const html = await data.text();

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return new Response(`<h1>Erro interno</h1><p>${err.message}</p>`, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
