import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Helper: fetch with rate limit retry
  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
    for (let i = 0; i <= maxRetries; i++) {
      const res = await fetch(url, options);
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const retryAfter = (body?.retry_after || 1) * 1000;
        if (i < maxRetries) {
          await new Promise((r) => setTimeout(r, retryAfter + 100));
          continue;
        }
      }
      return res;
    }
    throw new Error("Max retries exceeded");
  };

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!botToken) throw new Error("Bot token not configured");

    let tenantIdFromBody: string | null = null;
    let accessToken: string | null = null;
    let action: string | null = null;
    let invitePermissions = "536870920";

    try {
      const body = await req.json();
      tenantIdFromBody = body?.tenant_id || null;
      accessToken = body?.token || null;
      action = body?.action || null;
      if (typeof body?.permissions === "string" && /^\d+$/.test(body.permissions)) {
        invitePermissions = body.permissions;
      }
    } catch {
      // body opcional
    }

    if (action === "invite_url") {
      const botUserRes = await fetchWithRetry("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bot ${botToken}` },
      });

      if (!botUserRes.ok) {
        const text = await botUserRes.text();
        throw new Error(`Discord API error [${botUserRes.status}]: ${text}`);
      }

      const botUser = await botUserRes.json();
      const clientId = botUser?.id;
      if (!clientId) {
        throw new Error("Não foi possível identificar o bot configurado");
      }

      const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${invitePermissions}&scope=bot%20applications.commands`;

      return new Response(JSON.stringify({ invite_url: inviteUrl, client_id: clientId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    let resolvedTenantId: string | null = null;
    let resolvedDiscordUserId: string | null = null;

    const resolveDiscordUserIdFromAuthHeader = async (authHeader: string | null) => {
      if (!authHeader) return null;
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser();

      if (userError || !user) {
        return null;
      }

      const fromMetadata =
        user.user_metadata?.provider_id ||
        user.user_metadata?.sub ||
        user.app_metadata?.provider_id ||
        null;

      if (fromMetadata) return String(fromMetadata);

      const { data: profile } = await admin
        .from("profiles")
        .select("discord_user_id")
        .eq("id", user.id)
        .maybeSingle();

      return profile?.discord_user_id || null;
    };

    const getOwnedGuilds = async (
      candidates: Array<{ id: string; name: string; icon: string | null }>,
      discordUserId: string
    ) => {
      const checks = await Promise.all(
        candidates.map(async (guild) => {
          try {
            const guildRes = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guild.id}`, {
              headers: { Authorization: `Bot ${botToken}` },
            });
            if (!guildRes.ok) return null;
            const guildData = await guildRes.json();
            return guildData?.owner_id === discordUserId ? guild : null;
          } catch {
            return null;
          }
        })
      );

      return checks.filter(Boolean) as Array<{ id: string; name: string; icon: string | null }>;
    };

    // 1) Token de acesso (sessão por token) tem prioridade e resolve tenant no backend
    if (accessToken) {
      const { data: tokenRecord, error: tokenError } = await admin
        .from("access_tokens")
        .select("tenant_id, expires_at, created_by")
        .eq("token", accessToken)
        .eq("revoked", false)
        .single();

      if (tokenError || !tokenRecord) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Token expirado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (tenantIdFromBody && tokenRecord.tenant_id !== tenantIdFromBody) {
        return new Response(JSON.stringify({ error: "Token não pertence ao tenant informado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      resolvedTenantId = tokenRecord.tenant_id;

      if (tokenRecord.created_by) {
        const { data: profile } = await admin
          .from("profiles")
          .select("discord_user_id")
          .eq("id", tokenRecord.created_by)
          .maybeSingle();

        resolvedDiscordUserId = profile?.discord_user_id || null;

        if (!resolvedDiscordUserId) {
          const { data: authUserData } = await admin.auth.admin.getUserById(tokenRecord.created_by);
          resolvedDiscordUserId =
            authUserData?.user?.user_metadata?.provider_id ||
            authUserData?.user?.user_metadata?.sub ||
            authUserData?.user?.app_metadata?.provider_id ||
            null;
        }
      }
    }

    // 2) Usuário autenticado via Supabase Auth + tenant_id informado
    if (!resolvedTenantId && tenantIdFromBody) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser();

      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: membership } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantIdFromBody)
        .limit(1)
        .maybeSingle();

      if (!membership) {
        return new Response(JSON.stringify({ error: "Acesso negado para este tenant" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      resolvedTenantId = tenantIdFromBody;
      resolvedDiscordUserId = await resolveDiscordUserIdFromAuthHeader(authHeader);
    }

    // 3) Onboarding sem tenant informado: tenta usar usuário autenticado para identificar ownership
    if (!resolvedTenantId && !resolvedDiscordUserId) {
      const authHeader = req.headers.get("Authorization");
      resolvedDiscordUserId = await resolveDiscordUserIdFromAuthHeader(authHeader);
    }

    // Busca guilds atuais do bot no Discord
    const discordResponse = await fetchWithRetry("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (!discordResponse.ok) {
      const text = await discordResponse.text();
      throw new Error(`Discord API error [${discordResponse.status}]: ${text}`);
    }

    const guilds = await discordResponse.json();
    const mapped = guilds.map((g: any) => ({
      id: g.id,
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
    }));

    // Busca servidores já vinculados a qualquer tenant
    const { data: claimedRows } = await admin
      .from("tenants")
      .select("id, discord_guild_id")
      .not("discord_guild_id", "is", null);

    if (resolvedTenantId) {
      const { data: currentTenant, error: currentTenantError } = await admin
        .from("tenants")
        .select("id, discord_guild_id, owner_discord_id")
        .eq("id", resolvedTenantId)
        .single();

      if (currentTenantError || !currentTenant) {
        return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (currentTenant.discord_guild_id) {
        const result = mapped.filter((g: any) => g.id === currentTenant.discord_guild_id);
        return new Response(JSON.stringify({ guilds: result, auto_linked: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const claimedByOthers = new Set(
        (claimedRows || [])
          .filter((r: any) => r.id !== resolvedTenantId)
          .map((r: any) => r.discord_guild_id)
          .filter(Boolean)
      );
      const available = mapped.filter((g: any) => !claimedByOthers.has(g.id));

      // For token-based sessions (bot externo), skip ownership check
      // The client owns the bot, so adding it to a server is proof of access
      const ownerDiscordId = currentTenant.owner_discord_id || resolvedDiscordUserId;
      let finalGuilds = available;

      if (ownerDiscordId) {
        // If we know the owner, filter by ownership for extra security
        finalGuilds = await getOwnedGuilds(available, ownerDiscordId);
      }
      // If no ownerDiscordId (token session without discord link), show all available guilds

      // Auto-link if only one guild available
      let autoLinked = false;
      if (finalGuilds.length === 1) {
        const guildToLink = finalGuilds[0];
        const { error: linkError } = await admin
          .from("tenants")
          .update({ discord_guild_id: guildToLink.id, updated_at: new Date().toISOString() })
          .eq("id", resolvedTenantId)
          .is("discord_guild_id", null);
        if (!linkError) autoLinked = true;
      }

      return new Response(JSON.stringify({ guilds: finalGuilds, auto_linked: autoLinked }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Onboarding: sem tenant, retorna somente servidores não reclamados cujo owner é o usuário
    if (!resolvedDiscordUserId) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claimedIds = new Set((claimedRows || []).map((row: any) => row.discord_guild_id).filter(Boolean));
    const unclaimed = mapped.filter((g: any) => !claimedIds.has(g.id));
    const ownedUnclaimed = await getOwnedGuilds(unclaimed, resolvedDiscordUserId);

    return new Response(JSON.stringify(ownedUnclaimed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
