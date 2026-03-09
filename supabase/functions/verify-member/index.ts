import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_API = "https://discord.com/api/v10";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const tenantId = url.searchParams.get("tenant_id");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

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
      .select("verify_enabled, verify_role_id, discord_guild_id, bot_token_encrypted, name, logo_url, verify_logs_channel_id")
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

    // ─── Send verification log to Discord channel ───────────
    const logsChannelId = tenantData.verify_logs_channel_id;
    if (logsChannelId && botToken) {
      try {
        // Calculate account age in days
        const snowflake = BigInt(discordUserId);
        const createdTimestamp = Number((snowflake >> 22n) + 1420070400000n);
        const accountAgeDays = Math.floor((Date.now() - createdTimestamp) / 86400000);

        // Try to get user's IP from request headers
        const ip = req.headers.get("cf-connecting-ip") 
          || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          || req.headers.get("x-real-ip") 
          || "N/A";

        const logEmbed = {
          title: "✅ | Membro verificado",
          color: 0x57F287,
          fields: [
            {
              name: "👤 Usuário",
              value: `<@${discordUserId}> (${discordUsername})`,
              inline: false,
            },
            {
              name: "📅 Conta no Discord",
              value: `${accountAgeDays} dias no Discord.`,
              inline: true,
            },
            {
              name: "🔗 IP",
              value: ip,
              inline: true,
            },
          ],
          thumbnail: discordAvatar ? { url: discordAvatar } : undefined,
          timestamp: new Date().toISOString(),
        };

        const logPayload: any = {
          embeds: [logEmbed],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: "Ver localização",
                  url: ip !== "N/A" ? `https://ipinfo.io/${ip}` : "https://ipinfo.io",
                  emoji: { name: "🌐" },
                },
              ],
            },
          ],
        };

        await fetch(`${DISCORD_API}/channels/${logsChannelId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(logPayload),
        });
      } catch (logErr) {
        console.error("Failed to send verification log:", logErr);
      }
    }

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
  const DEFAULT_VERIFY_REDIRECT = "https://drikabotteste.lovable.app/verify/result";

  const status = color === "#57F287" ? "success" : color === "#FEE75C" ? "warning" : "error";

  const cleanTitle = title.replace(/[✅❌⚠️]/g, "").trim();
  const cleanMessage = toPlainText(message);

  const target = new URL(DEFAULT_VERIFY_REDIRECT);
  target.searchParams.set("status", status);
  if (cleanTitle) target.searchParams.set("title", cleanTitle);
  if (cleanMessage) target.searchParams.set("message", cleanMessage);
  if (logoUrl) target.searchParams.set("logo", logoUrl);

  return new Response(null, {
    status: 302,
    headers: {
      location: target.toString(),
      "cache-control": "no-store",
    },
  });
}

function toPlainText(input: string): string {
  return input
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/strong>/gi, "")
    .replace(/<strong>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
