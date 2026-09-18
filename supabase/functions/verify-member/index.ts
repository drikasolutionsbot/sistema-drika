import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_API = "https://discord.com/api/v10";

function getClientIdFromBotToken(botToken: string | null): string | null {
  if (!botToken) return null;
  try {
    const firstSegment = botToken.split(".")[0]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padded = firstSegment + "=".repeat((4 - (firstSegment.length % 4 || 4)) % 4);
    const decoded = atob(padded);
    return /^\d{17,20}$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let tenantId = url.searchParams.get("tenant_id");
  const slug = url.searchParams.get("slug");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Resolve slug to tenant_id
  if (!tenantId && slug && !code) {
    // Try by verify_slug first
    const { data: slugTenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("verify_slug", slug)
      .single();
    if (slugTenant) {
      tenantId = slugTenant.id;
    } else {
      // Fallback: try as tenant_id directly (UUID)
      const { data: idTenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("id", slug)
        .single();
      if (idTenant) {
        tenantId = idTenant.id;
      } else {
        return htmlResponse("❌ Erro", "Link de verificação inválido.", "#ED4245");
      }
    }
  }

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;
  const clientId = Deno.env.get("DISCORD_CLIENT_ID") || getClientIdFromBotToken(botToken);
  const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/verify-member`;

  if (!clientId) {
    return htmlResponse("❌ Erro", "Client ID do bot externo não configurado.", "#ED4245");
  }

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
      console.error("Token exchange failed:", tokenRes.status, errText);
      return htmlResponse("❌ Erro", "Falha ao trocar o código OAuth2.", "#ED4245");
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = tokenData.expires_in;

    if (!accessToken) {
      return htmlResponse("❌ Erro", "Token de acesso não recebido.", "#ED4245");
    }

    // Fetch Discord user info
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error("User fetch failed:", userRes.status, errText);
      return htmlResponse("❌ Erro", "Falha ao obter informações do usuário.", "#ED4245");
    }

    const userData = await userRes.json();
    const discordUserId = userData.id;
    const discordUsername = userData.username;
    const discordAvatar = userData.avatar
      ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
      : null;

    // Fetch tenant data
    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("discord_guild_id, verify_role_id, verify_logs_channel_id, name, logo_url")
      .eq("id", effectiveTenantId)
      .single();

    if (tenantError || !tenantData) {
      return htmlResponse("❌ Erro", "Tenant não encontrado.", "#ED4245");
    }

    const guildId = tenantData.discord_guild_id;
    let roleId = tenantData.verify_role_id;
    if (roleId) {
      roleId = roleId.replace(/\D/g, ""); // Remove anything that is not a number
    }
    if (!botToken) {
      return htmlResponse("❌ Erro", "Bot externo não configurado (DISCORD_BOT_TOKEN).", "#ED4245");
    }

    if (!guildId) {
      return htmlResponse("❌ Erro", "Servidor Discord não configurado.", "#ED4245");
    }

    // Add user to guild (if not already) using OAuth token
    console.log("Adding user to guild:", { guildId, discordUserId, roleId });
    try {
      const addRes = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}`, {
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
      const addResText = await addRes.text();
      console.log("Add to guild response:", addRes.status, addResText);
    } catch (e) {
      console.error("Add to guild error:", e);
    }

    let roleApplied = false;
    let roleError = null;

    // If user is already in the guild, add the role directly
    if (roleId) {
      console.log("Adding role directly:", { guildId, discordUserId, roleId });
      try {
        const roleRes = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, {
          method: "PUT",
          headers: { Authorization: `Bot ${botToken}` },
        });
        
        if (roleRes.ok || roleRes.status === 204) {
          roleApplied = true;
          console.log("Add role success:", roleRes.status);
        } else {
          const roleResText = await roleRes.text();
          console.error("Add role failed:", roleRes.status, roleResText);
          roleError = `Erro ${roleRes.status}`;
          try {
            const errJson = JSON.parse(roleResText);
            if (errJson.code === 50013) {
              roleError = "O cargo do bot precisa estar acima do cargo de verificação nas configurações do servidor.";
            } else if (errJson.code === 10011) {
              roleError = "Cargo não encontrado no servidor. Ele pode ter sido excluído.";
            } else if (errJson.message) {
              roleError = errJson.message;
            }
          } catch (_) {}
        }
      } catch (e) {
        console.error("Add role error:", e);
        roleError = "Erro interno ao atribuir";
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
    console.log("verify-member log channel:", logsChannelId, "botToken present:", Boolean(botToken));
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

        const logFields = [
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
        ];

        if (roleId) {
          logFields.push({
            name: "📋 Cargo",
            value: roleApplied ? `✅ Cargo <@&${roleId}> atribuído.` : `❌ Falha ao atribuir: ${roleError}`,
            inline: false,
          });
        }

        const logEmbed = {
          title: "✅ | Membro verificado",
          color: 0x57F287,
          fields: logFields,
          thumbnail: tenantData.logo_url ? { url: tenantData.logo_url } : (discordAvatar ? { url: discordAvatar } : undefined),
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

        console.log("Sending verification log to channel:", logsChannelId);
        const logRes = await fetch(`${DISCORD_API}/channels/${logsChannelId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(logPayload),
        });
        const logResText = await logRes.text();
        console.log("Verification log response:", logRes.status, logResText);
      } catch (logErr) {
        console.error("Failed to send verification log:", logErr);
      }
    } else {
      console.warn("Skipping verification log: logsChannelId=", logsChannelId, "botToken=", Boolean(botToken));
    }

    const serverName = tenantData.name || "o servidor";

    let successMessage = `Bem-vindo, <strong>${discordUsername}</strong>! Você foi verificado em <strong>${serverName}</strong>.`;
    if (roleId) {
      if (roleApplied) {
        successMessage += "<br>Seu cargo foi atribuído automaticamente.";
      } else {
        successMessage += "<br><br><em>Aviso: Ocorreu uma falha ao atribuir seu cargo. Um administrador já foi notificado.</em>";
      }
    }
    successMessage += "<br><br>Pode fechar esta página e voltar ao Discord.";

    return htmlResponse(
      "✅ Verificado com Sucesso!",
      successMessage,
      "#57F287",
      tenantData.logo_url
    );
  } catch (err) {
    console.error("Verify member error:", err);
    return htmlResponse("❌ Erro", `Ocorreu um erro durante a verificação: ${err instanceof Error ? err.message : "Erro desconhecido"}`, "#ED4245");
  }
});

function htmlResponse(title: string, message: string, color: string, logoUrl?: string | null): Response {
  const DEFAULT_VERIFY_REDIRECT = "https://www.drikahub.com/verify/result";

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
