import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_API = "https://discord.com/api/v10";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const tenantId = url.searchParams.get("tenant_id");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // state = tenant_id (passed through OAuth)

  const clientId = "1477916070508757092";
  const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/verify-member`;

  console.log("verify-member init", { tenantId, hasCode: Boolean(code), clientId, redirectUri });

  // ─── Step 1: No code yet → redirect to Discord OAuth2 ────
  if (!code) {
    if (!tenantId) {
      return htmlResponse("❌ Erro", "Tenant não informado.", "#ED4245");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify guilds.join",
      state: tenantId,
      prompt: "consent",
    });

    return Response.redirect(`https://discord.com/api/oauth2/authorize?${params}`, 302);
  }

  // ─── Step 2: Received code → exchange for token ───────────
  const effectiveTenantId = state || tenantId;
  if (!effectiveTenantId) {
    return htmlResponse("❌ Erro", "Tenant não encontrado no estado.", "#ED4245");
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Token exchange error:", errText);
      return htmlResponse("❌ Erro na Verificação", "Não foi possível autenticar com o Discord. Tente novamente.", "#ED4245");
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    // Get user info
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return htmlResponse("❌ Erro", "Não foi possível obter suas informações do Discord.", "#ED4245");
    }

    const user = await userRes.json();
    const discordUserId = user.id;
    const discordUsername = user.username;
    const discordAvatar = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : null;

    // Get tenant config
    const { data: tenantData, error: tenantErr } = await supabase
      .from("tenants")
      .select("verify_enabled, verify_role_id, discord_guild_id, bot_token_encrypted, name, logo_url")
      .eq("id", effectiveTenantId)
      .single();

    if (tenantErr || !tenantData) {
      return htmlResponse("❌ Erro", "Servidor não encontrado.", "#ED4245");
    }

    if (!tenantData.verify_enabled) {
      return htmlResponse("⚠️ Verificação Desativada", "A verificação está desativada neste servidor.", "#FEE75C");
    }

    const guildId = tenantData.discord_guild_id;
    const roleId = tenantData.verify_role_id;
    const botToken = tenantData.bot_token_encrypted || Deno.env.get("DISCORD_BOT_TOKEN")!;

    if (!guildId) {
      return htmlResponse("❌ Erro", "Servidor Discord não configurado.", "#ED4245");
    }

    // Add user to guild (if not already) using OAuth token
    try {
      await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: accessToken,
          roles: roleId ? [roleId] : [],
        }),
      });
    } catch (e) {
      console.error("Add to guild error:", e);
    }

    // If user is already in the guild, add the role directly
    if (roleId) {
      try {
        await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, {
          method: "PUT",
          headers: { Authorization: `Bot ${botToken}` },
        });
      } catch (e) {
        console.error("Add role error:", e);
      }
    }

    // Save to verified_members table
    const tokenExpiresAt = new Date(Date.now() + (expiresIn || 604800) * 1000).toISOString();

    await supabase.from("verified_members").upsert(
      {
        tenant_id: effectiveTenantId,
        discord_user_id: discordUserId,
        discord_username: discordUsername,
        discord_avatar: discordAvatar,
        access_token_encrypted: accessToken,
        refresh_token_encrypted: refreshToken || null,
        token_expires_at: tokenExpiresAt,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,discord_user_id" }
    );

    const serverName = tenantData.name || "o servidor";

    return htmlResponse(
      "✅ Verificado com Sucesso!",
      `Bem-vindo, <strong>${discordUsername}</strong>! Você foi verificado em <strong>${serverName}</strong>.${roleId ? "<br>Seu cargo foi atribuído automaticamente." : ""}<br><br>Pode fechar esta página e voltar ao Discord.`,
      "#57F287",
      tenantData.logo_url
    );
  } catch (err) {
    console.error("Verify member error:", err);
    return htmlResponse("❌ Erro", `Ocorreu um erro durante a verificação: ${err instanceof Error ? err.message : "Erro desconhecido"}`, "#ED4245");
  }
});

function htmlResponse(title: string, message: string, color: string, logoUrl?: string | null): Response {
  const isSuccess = color === "#57F287";
  const isError = color === "#ED4245";
  const isWarning = color === "#FEE75C";

  const logo = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" class="logo" />`
    : "";

  const icon = isSuccess 
    ? `<div class="icon-container success">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
           <polyline points="20 6 9 17 4 12"></polyline>
         </svg>
       </div>`
    : isError
    ? `<div class="icon-container error">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
           <line x1="18" y1="6" x2="6" y2="18"></line>
           <line x1="6" y1="6" x2="18" y2="18"></line>
         </svg>
       </div>`
    : `<div class="icon-container warning">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
           <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
           <line x1="12" y1="9" x2="12" y2="13"></line>
           <line x1="12" y1="17" x2="12.01" y2="17"></line>
         </svg>
       </div>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title.replace(/[✅❌⚠️]/g, '').trim()}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e0e0e0;
      padding: 20px;
      overflow: hidden;
    }
    
    body::before {
      content: '';
      position: fixed;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 30% 30%, rgba(88, 101, 242, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 70% 70%, rgba(87, 242, 135, 0.05) 0%, transparent 50%);
      animation: float 20s ease-in-out infinite;
      pointer-events: none;
    }
    
    @keyframes float {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      50% { transform: translate(20px, -20px) rotate(5deg); }
    }
    
    .card {
      position: relative;
      background: rgba(22, 33, 62, 0.8);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      padding: 48px 40px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 80px rgba(0,0,0,0.5),
                  0 0 0 1px rgba(255,255,255,0.05),
                  inset 0 1px 0 rgba(255,255,255,0.1);
      animation: slideUp 0.6s ease-out;
    }
    
    @keyframes slideUp {
      0% { opacity: 0; transform: translateY(30px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    
    .logo {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      margin-bottom: 20px;
      object-fit: cover;
      border: 3px solid rgba(255,255,255,0.1);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      animation: pulse 2s ease-in-out infinite;
    }
    
    @keyframes pulse {
      0%, 100% { box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 0 0 rgba(88, 101, 242, 0); }
      50% { box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 0 8px rgba(88, 101, 242, 0.1); }
    }
    
    .icon-container {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      animation: scaleIn 0.5s ease-out 0.2s both;
    }
    
    @keyframes scaleIn {
      0% { transform: scale(0); opacity: 0; }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); opacity: 1; }
    }
    
    .icon-container svg {
      width: 32px;
      height: 32px;
    }
    
    .icon-container.success {
      background: linear-gradient(135deg, rgba(87, 242, 135, 0.2), rgba(87, 242, 135, 0.05));
      color: #57F287;
      box-shadow: 0 0 30px rgba(87, 242, 135, 0.2);
    }
    
    .icon-container.error {
      background: linear-gradient(135deg, rgba(237, 66, 69, 0.2), rgba(237, 66, 69, 0.05));
      color: #ED4245;
      box-shadow: 0 0 30px rgba(237, 66, 69, 0.2);
    }
    
    .icon-container.warning {
      background: linear-gradient(135deg, rgba(254, 231, 92, 0.2), rgba(254, 231, 92, 0.05));
      color: #FEE75C;
      box-shadow: 0 0 30px rgba(254, 231, 92, 0.2);
    }
    
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 12px;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    
    .subtitle {
      font-size: 14px;
      line-height: 1.7;
      color: #9ca3af;
      margin-bottom: 8px;
    }
    
    .subtitle strong {
      color: #ffffff;
      font-weight: 600;
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 16px;
      padding: 8px 16px;
      background: rgba(87, 242, 135, 0.1);
      border: 1px solid rgba(87, 242, 135, 0.2);
      border-radius: 100px;
      font-size: 12px;
      font-weight: 500;
      color: #57F287;
    }
    
    .status-badge::before {
      content: '';
      width: 6px;
      height: 6px;
      background: #57F287;
      border-radius: 50%;
      animation: blink 1.5s ease-in-out infinite;
    }
    
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    
    .discord-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-top: 28px;
      padding: 14px 32px;
      background: linear-gradient(135deg, #5865F2, #4752C4);
      color: white;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 20px rgba(88, 101, 242, 0.3);
    }
    
    .discord-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(88, 101, 242, 0.4);
    }
    
    .discord-btn svg {
      width: 18px;
      height: 18px;
    }
    
    .footer {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.05);
      font-size: 11px;
      color: #6b7280;
    }
    
    .footer a {
      color: #5865F2;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    ${logo}
    ${!logoUrl ? icon : ''}
    <h1>${title.replace(/[✅❌⚠️]/g, '').trim()}</h1>
    <p class="subtitle">${message}</p>
    ${isSuccess ? '<div class="status-badge">Cargo atribuído</div>' : ''}
    <a href="https://discord.com/channels/@me" class="discord-btn">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
      Voltar ao Discord
    </a>
    <div class="footer">
      Verificação segura via <a href="https://discord.com" target="_blank">Discord OAuth2</a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
