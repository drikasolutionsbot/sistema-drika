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

  // ─── Bot Invite OAuth2 Callback Flow (state = "bot_invite:<tenantId>:<sig>") ───
  if (state && state.startsWith("bot_invite:")) {
    const oauthError = url.searchParams.get("error");
    if (oauthError) {
      return htmlResponse(
        "⚠️ Conexão Cancelada",
        "A adição do bot ao servidor foi cancelada no Discord. Você pode fechar esta aba.",
        "#FEE75C"
      );
    }

    const parts = state.split(":");
    const inviteTenantId = parts[1] || "";
    const providedSig = parts[2] || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!inviteTenantId || !providedSig) {
      return htmlResponse("❌ Erro", "Parâmetros de convite inválidos.", "#ED4245");
    }

    const encoder = new TextEncoder();
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(serviceRoleKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuf = await crypto.subtle.sign(
      "HMAC",
      hmacKey,
      encoder.encode(`bot_invite:${inviteTenantId}`)
    );
    const expectedSig = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 24);

    if (providedSig !== expectedSig) {
      return htmlResponse("❌ Erro", "Assinatura de segurança do convite inválida.", "#ED4245");
    }

    const selectedGuildId = url.searchParams.get("guild_id") || "";
    if (!/^\d{17,20}$/.test(selectedGuildId)) {
      return htmlResponse("❌ Erro", "O Discord não informou o servidor selecionado.", "#ED4245");
    }

    const botTokenForInvite = Deno.env.get("DISCORD_BOT_TOKEN") || null;
    if (!botTokenForInvite) {
      return htmlResponse("❌ Erro", "Bot externo não configurado.", "#ED4245");
    }

    const guildRes = await fetch(`${DISCORD_API}/guilds/${selectedGuildId}`, {
      headers: { Authorization: `Bot ${botTokenForInvite}` },
    });

    if (!guildRes.ok) {
      return htmlResponse(
        "❌ Bot não encontrado no servidor",
        "Não foi possível confirmar a presença do bot no servidor selecionado. Tente novamente.",
        "#ED4245"
      );
    }

    const guildData = await guildRes.json();
    const guildName = guildData?.name || selectedGuildId;
    const guildIcon = guildData?.icon
      ? `https://cdn.discordapp.com/icons/${selectedGuildId}/${guildData.icon}.png`
      : null;

    // Check if another tenant already claimed this guild
    const { data: existingClaim } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("discord_guild_id", selectedGuildId)
      .neq("id", inviteTenantId)
      .maybeSingle();

    if (existingClaim) {
      return htmlResponse(
        "❌ Servidor já vinculado",
        `O servidor <strong>${guildName}</strong> já está vinculado a outra loja (${existingClaim.name}). Desconecte-o lá primeiro.`,
        "#ED4245",
        guildIcon
      );
    }

    const { error: linkErr } = await supabase
      .from("tenants")
      .update({
        discord_guild_id: selectedGuildId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteTenantId);

    if (linkErr) {
      return htmlResponse("❌ Erro", "Não foi possível vincular o servidor ao painel.", "#ED4245");
    }

    await supabase
      .from("tenant_audit_logs")
      .insert({
        tenant_id: inviteTenantId,
        action: "auto_link_server",
        entity_type: "servidor",
        entity_id: selectedGuildId,
        entity_name: guildName,
        actor_discord_id: guildData?.owner_id || null,
        actor_name: "Discord OAuth",
        details: { source: "discord_oauth_callback", guild_id: selectedGuildId },
      })
      .then(() => undefined, () => undefined);

    return htmlResponse(
      "✅ Servidor Conectado!",
      `O servidor <strong>${guildName}</strong> foi conectado ao seu painel com sucesso! Pode fechar esta aba e voltar ao Drika Hub.`,
      "#57F287",
      guildIcon,
      { bot_connected: "1", guild_id: selectedGuildId, guild_name: guildName }
    );
  }

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
        return htmlResponse("âŒ Erro", "Link de verificaÃ§Ã£o invÃ¡lido.", "#ED4245");
      }
    }
  }

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || null;
  const clientId = Deno.env.get("DISCORD_CLIENT_ID") || getClientIdFromBotToken(botToken);
  const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET")!;
  const redirectUri = `${supabaseUrl}/functions/v1/verify-member`;

  if (!clientId) {
    return htmlResponse("âŒ Erro", "Client ID do bot externo nÃ£o configurado.", "#ED4245");
  }

  // console.log("verify-member init", { tenantId, hasCode: Boolean(code), clientId, redirectUri });

  // â”€â”€â”€ Step 1: No code yet â†’ redirect to Discord OAuth2 â”€â”€â”€â”€
  if (!code) {
    if (!tenantId) {
      return htmlResponse("âŒ Erro", "Tenant nÃ£o informado.", "#ED4245");
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

  // â”€â”€â”€ Step 2: Received code â†’ exchange for token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const effectiveTenantId = state || tenantId;
  if (!effectiveTenantId) {
    return htmlResponse("âŒ Erro", "Tenant nÃ£o encontrado no estado.", "#ED4245");
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
      return htmlResponse("âŒ Erro", "Falha ao trocar o cÃ³digo OAuth2.", "#ED4245");
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = tokenData.expires_in;

    if (!accessToken) {
      return htmlResponse("âŒ Erro", "Token de acesso nÃ£o recebido.", "#ED4245");
    }

    // Fetch Discord user info
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error("User fetch failed:", userRes.status, errText);
      return htmlResponse("âŒ Erro", "Falha ao obter informaÃ§Ãµes do usuÃ¡rio.", "#ED4245");
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
      return htmlResponse("âŒ Erro", "Tenant nÃ£o encontrado.", "#ED4245");
    }

    const guildId = tenantData.discord_guild_id;
    let roleId = tenantData.verify_role_id;
    if (roleId) {
      roleId = roleId.replace(/\D/g, ""); // Remove anything that is not a number
    }
    if (!botToken) {
      return htmlResponse("âŒ Erro", "Bot externo nÃ£o configurado (DISCORD_BOT_TOKEN).", "#ED4245");
    }

    if (!guildId) {
      return htmlResponse("âŒ Erro", "Servidor Discord nÃ£o configurado.", "#ED4245");
    }

    // Add user to guild (if not already) using OAuth token
    // console.log("Adding user to guild:", { guildId, discordUserId, roleId });
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
      // console.log("Add to guild response:", addRes.status, addResText);
    } catch (e) {
      console.error("Add to guild error:", e);
    }

    let roleApplied = false;
    let roleError = null;

    // If user is already in the guild, add the role directly
    if (roleId) {
      // console.log("Adding role directly:", { guildId, discordUserId, roleId });
      try {
        const roleRes = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, {
          method: "PUT",
          headers: { Authorization: `Bot ${botToken}` },
        });
        
        if (roleRes.ok || roleRes.status === 204) {
          roleApplied = true;
          // console.log("Add role success:", roleRes.status);
        } else {
          const roleResText = await roleRes.text();
          console.error("Add role failed:", roleRes.status, roleResText);
          roleError = `Erro ${roleRes.status}`;
          try {
            const errJson = JSON.parse(roleResText);
            if (errJson.code === 50013) {
              roleError = "O cargo do bot precisa estar acima do cargo de verificaÃ§Ã£o nas configuraÃ§Ãµes do servidor.";
            } else if (errJson.code === 10011) {
              roleError = "Cargo nÃ£o encontrado no servidor. Ele pode ter sido excluÃ­do.";
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

    // â”€â”€â”€ Send verification log to Discord channel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const logsChannelId = tenantData.verify_logs_channel_id;
    // console.log("verify-member log channel:", logsChannelId, "botToken present:", Boolean(botToken));
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
            name: "ðŸ‘¤ UsuÃ¡rio",
            value: `<@${discordUserId}> (${discordUsername})`,
            inline: false,
          },
          {
            name: "ðŸ“… Conta no Discord",
            value: `${accountAgeDays} dias no Discord.`,
            inline: true,
          },
          {
            name: "ðŸ”— IP",
            value: ip,
            inline: true,
          },
        ];

        if (roleId) {
          logFields.push({
            name: "ðŸ“‹ Cargo",
            value: roleApplied ? `âœ… Cargo <@&${roleId}> atribuÃ­do.` : `âŒ Falha ao atribuir: ${roleError}`,
            inline: false,
          });
        }

        const logEmbed = {
          title: "âœ… | Membro verificado",
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
                  label: "Ver localizaÃ§Ã£o",
                  url: ip !== "N/A" ? `https://ipinfo.io/${ip}` : "https://ipinfo.io",
                  emoji: { name: "ðŸŒ" },
                },
              ],
            },
          ],
        };

        // console.log("Sending verification log to channel:", logsChannelId);
        const logRes = await fetch(`${DISCORD_API}/channels/${logsChannelId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(logPayload),
        });
        const logResText = await logRes.text();
        // console.log("Verification log response:", logRes.status, logResText);
      } catch (logErr) {
        console.error("Failed to send verification log:", logErr);
      }
    } else {
      console.warn("Skipping verification log: logsChannelId=", logsChannelId, "botToken=", Boolean(botToken));
    }

    const serverName = tenantData.name || "o servidor";

    let successMessage = `Bem-vindo, <strong>${discordUsername}</strong>! VocÃª foi verificado em <strong>${serverName}</strong>.`;
    if (roleId) {
      if (roleApplied) {
        successMessage += "<br>Seu cargo foi atribuÃ­do automaticamente.";
      } else {
        successMessage += "<br><br><em>Aviso: Ocorreu uma falha ao atribuir seu cargo. Um administrador jÃ¡ foi notificado.</em>";
      }
    }
    successMessage += "<br><br>Pode fechar esta pÃ¡gina e voltar ao Discord.";

    return htmlResponse(
      "âœ… Verificado com Sucesso!",
      successMessage,
      "#57F287",
      tenantData.logo_url
    );
  } catch (err) {
    console.error("Verify member error:", err);
    return htmlResponse("âŒ Erro", `Ocorreu um erro durante a verificaÃ§Ã£o: ${err instanceof Error ? err.message : "Erro desconhecido"}`, "#ED4245");
  }
});

function htmlResponse(
  title: string,
  message: string,
  color: string,
  logoUrl?: string | null,
  extraParams?: Record<string, string>
): Response {
  const DEFAULT_VERIFY_REDIRECT = "https://www.drikahub.com/verify/result";

  const status = color === "#57F287" ? "success" : color === "#FEE75C" ? "warning" : "error";

  const cleanTitle = title.replace(/[âœ…âŒâš ï¸]/g, "").trim();
  const cleanMessage = toPlainText(message);

  const target = new URL(DEFAULT_VERIFY_REDIRECT);
  target.searchParams.set("status", status);
  if (cleanTitle) target.searchParams.set("title", cleanTitle);
  if (cleanMessage) target.searchParams.set("message", cleanMessage);
  if (logoUrl) target.searchParams.set("logo", logoUrl);
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) target.searchParams.set(k, v);
    }
  }

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
