import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email Ã© obrigatÃ³rio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const resetRedirectUrl = "https://www.drikahub.com/reset-password";
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY nÃ£o configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // NÃ£o revelar se o email existe ou nÃ£o - sempre responde sucesso
    const cleanEmail = email.trim().toLowerCase();

    // Gera link de recuperaÃ§Ã£o via Supabase Admin API sempre com domÃ­nio oficial
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: cleanEmail,
      options: {
        redirectTo: resetRedirectUrl,
      },
    });

    // Se o usuÃ¡rio nÃ£o existe, retorna sucesso silenciosamente (seguranÃ§a)
    if (linkErr || !linkData?.properties?.action_link) {
      // console.log("[send-password-reset] Email nÃ£o encontrado ou erro:", linkErr?.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hashedToken = linkData.properties.hashed_token;
    if (!hashedToken) {
      return new Response(JSON.stringify({ error: "Token de recuperaÃ§Ã£o nÃ£o gerado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionLink = `${resetRedirectUrl}?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;

    // Monta email HTML branded DRIKA HUB
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>RecuperaÃ§Ã£o de senha â€” DRIKA HUB</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#141414;border:1px solid #2a2a2a;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:40px 40px 24px 40px;text-align:center;background:linear-gradient(135deg,#1a0a14 0%,#0a0a0a 100%);">
              <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:2px;color:#FF2d72;">DRIKA HUB</h1>
              <p style="margin:8px 0 0 0;font-size:13px;color:#888;letter-spacing:1px;text-transform:uppercase;">RecuperaÃ§Ã£o de senha</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 16px 40px;">
              <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#fff;">OlÃ¡! ðŸ‘‹</h2>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#cfcfcf;">
                Recebemos uma solicitaÃ§Ã£o para redefinir a senha da sua conta no <strong style="color:#fff;">DRIKA HUB</strong>.
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#cfcfcf;">
                Clique no botÃ£o abaixo para criar uma nova senha. Este link expira em <strong>1 hora</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 40px 32px 40px;">
              <a href="${actionLink}" target="_blank" style="display:inline-block;background:#FF2d72;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 36px;border-radius:999px;letter-spacing:0.5px;">
                Redefinir minha senha
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#888;line-height:1.6;">
                Se o botÃ£o nÃ£o funcionar, copie e cole o link no seu navegador:
              </p>
              <p style="margin:0;font-size:12px;color:#FF2d72;word-break:break-all;background:#0a0a0a;padding:12px;border-radius:8px;border:1px solid #2a2a2a;">
                ${actionLink}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #2a2a2a;background:#0f0f0f;">
              <p style="margin:0 0 8px 0;font-size:12px;color:#666;line-height:1.6;">
                âš ï¸ Se vocÃª <strong style="color:#aaa;">nÃ£o solicitou</strong> esta alteraÃ§Ã£o, ignore este email â€” sua senha continua segura.
              </p>
              <p style="margin:12px 0 0 0;font-size:11px;color:#555;text-align:center;">
                Â© ${new Date().getFullYear()} DRIKA HUB Â· Todos os direitos reservados
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Envia via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DRIKA HUB <noreply@drikahub.com>",
        to: [cleanEmail],
        subject: "ðŸ” RecuperaÃ§Ã£o de senha â€” DRIKA HUB",
        html,
      }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      console.error("[send-password-reset] Resend error:", resendData);
      // Tentativa fallback com domÃ­nio Resend padrÃ£o se o domÃ­nio personalizado falhar
      if (resendData?.message?.includes("domain") || resendData?.statusCode === 403) {
        const fallback = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "DRIKA HUB <onboarding@resend.dev>",
            to: [cleanEmail],
            subject: "ðŸ” RecuperaÃ§Ã£o de senha â€” DRIKA HUB",
            html,
          }),
        });
        if (!fallback.ok) {
          const fbErr = await fallback.json();
          return new Response(JSON.stringify({ error: "Falha no envio", details: fbErr }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: resendData?.message || "Falha no envio" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-password-reset] error:", err.message);
    return new Response(JSON.stringify({ error: (err as Error).message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
