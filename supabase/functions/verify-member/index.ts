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

  try {
    const url = new URL(req.url);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Step 1: Start OAuth flow — redirect user to Discord
    if (req.method === "GET") {
      const tenantId = url.searchParams.get("tenant_id");
      if (!tenantId) {
        return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get tenant to check if verification is enabled
      const { data: tenant, error: tenantErr } = await supabase
        .from("tenants")
        .select("id, name, verify_enabled, bot_client_id, verify_redirect_url, verify_role_id")
        .eq("id", tenantId)
        .single();

      if (tenantErr || !tenant) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!tenant.verify_enabled) {
        return new Response(JSON.stringify({ error: "Verification not enabled for this server" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!tenant.bot_client_id) {
        return new Response(JSON.stringify({ error: "Bot client ID not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const redirectUri = `${supabaseUrl}/functions/v1/verify-member/callback`;
      const state = btoa(JSON.stringify({ tenant_id: tenantId }));
      const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${tenant.bot_client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify+guilds.join&state=${state}`;

      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: discordAuthUrl },
      });
    }

    // Step 2: Handle POST from callback page or direct callback
    if (req.method === "POST") {
      const body = await req.json();

      // Action: list verified members for a tenant
      if (body.action === "list") {
        const { tenant_id, page = 1, per_page = 50 } = body;
        if (!tenant_id) throw new Error("Missing tenant_id");

        const from = (page - 1) * per_page;
        const to = from + per_page - 1;

        const { data, error, count } = await supabase
          .from("verified_members")
          .select("id, discord_user_id, discord_username, discord_avatar, roles_backup, nickname, verified_at, last_restore_at", { count: "exact" })
          .eq("tenant_id", tenant_id)
          .order("verified_at", { ascending: false })
          .range(from, to);

        if (error) throw error;

        return new Response(JSON.stringify({ members: data, total: count, page, per_page }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Action: process OAuth callback code
      if (body.action === "callback") {
        const { code, tenant_id } = body;
        if (!code || !tenant_id) throw new Error("Missing code or tenant_id");

        // Get tenant info
        const { data: tenant } = await supabase
          .from("tenants")
          .select("bot_client_id, bot_token_encrypted, discord_guild_id, verify_role_id")
          .eq("id", tenant_id)
          .single();

        if (!tenant?.bot_client_id) throw new Error("Tenant not configured");

        const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
        const redirectUri = `${supabaseUrl}/functions/v1/verify-member/callback`;

        // Exchange code for tokens
        const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: tenant.bot_client_id,
            client_secret: botToken, // Using bot token as client secret
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }),
        });

        const tokenData = await tokenRes.json();
        if (tokenData.error) throw new Error(`Discord OAuth error: ${tokenData.error}`);

        // Get user info
        const userRes = await fetch("https://discord.com/api/v10/users/@me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userRes.json();

        // Get member roles from guild
        let rolesBackup: string[] = [];
        let nickname: string | null = null;
        if (tenant.discord_guild_id) {
          try {
            const memberRes = await fetch(
              `https://discord.com/api/v10/guilds/${tenant.discord_guild_id}/members/${userData.id}`,
              { headers: { Authorization: `Bot ${botToken}` } }
            );
            if (memberRes.ok) {
              const memberData = await memberRes.json();
              rolesBackup = memberData.roles || [];
              nickname = memberData.nick || null;
            }
          } catch {}
        }

        // Upsert verified member
        const { data: member, error: upsertErr } = await supabase
          .from("verified_members")
          .upsert(
            {
              tenant_id,
              discord_user_id: userData.id,
              discord_username: userData.username,
              discord_avatar: userData.avatar
                ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
                : null,
              access_token_encrypted: tokenData.access_token,
              refresh_token_encrypted: tokenData.refresh_token || null,
              token_expires_at: tokenData.expires_in
                ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
                : null,
              roles_backup: rolesBackup,
              nickname,
              verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,discord_user_id" }
          )
          .select()
          .single();

        if (upsertErr) throw upsertErr;

        // Add verify role if configured
        if (tenant.verify_role_id && tenant.discord_guild_id) {
          try {
            await fetch(
              `https://discord.com/api/v10/guilds/${tenant.discord_guild_id}/members/${userData.id}/roles/${tenant.verify_role_id}`,
              {
                method: "PUT",
                headers: { Authorization: `Bot ${botToken}` },
              }
            );
          } catch {}
        }

        return new Response(
          JSON.stringify({
            success: true,
            username: userData.username,
            avatar: member.discord_avatar,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Action: backup roles for a member
      if (body.action === "backup_roles") {
        const { tenant_id, discord_user_id } = body;
        if (!tenant_id || !discord_user_id) throw new Error("Missing params");

        const { data: tenant } = await supabase
          .from("tenants")
          .select("discord_guild_id")
          .eq("id", tenant_id)
          .single();

        if (!tenant?.discord_guild_id) throw new Error("No guild configured");

        const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
        const memberRes = await fetch(
          `https://discord.com/api/v10/guilds/${tenant.discord_guild_id}/members/${discord_user_id}`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );

        if (!memberRes.ok) throw new Error("Member not found in guild");
        const memberData = await memberRes.json();

        const { error } = await supabase
          .from("verified_members")
          .update({
            roles_backup: memberData.roles || [],
            nickname: memberData.nick || null,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenant_id)
          .eq("discord_user_id", discord_user_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, roles: memberData.roles }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Action: restore roles for a member
      if (body.action === "restore_roles") {
        const { tenant_id, discord_user_id } = body;
        if (!tenant_id || !discord_user_id) throw new Error("Missing params");

        const { data: tenant } = await supabase
          .from("tenants")
          .select("discord_guild_id")
          .eq("id", tenant_id)
          .single();

        if (!tenant?.discord_guild_id) throw new Error("No guild configured");

        const { data: member } = await supabase
          .from("verified_members")
          .select("roles_backup")
          .eq("tenant_id", tenant_id)
          .eq("discord_user_id", discord_user_id)
          .single();

        if (!member?.roles_backup) throw new Error("No backup found");

        const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
        const roles = member.roles_backup as string[];
        let restored = 0;

        for (const roleId of roles) {
          try {
            const res = await fetch(
              `https://discord.com/api/v10/guilds/${tenant.discord_guild_id}/members/${discord_user_id}/roles/${roleId}`,
              {
                method: "PUT",
                headers: { Authorization: `Bot ${botToken}` },
              }
            );
            if (res.ok) restored++;
          } catch {}
        }

        await supabase
          .from("verified_members")
          .update({ last_restore_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("tenant_id", tenant_id)
          .eq("discord_user_id", discord_user_id);

        return new Response(JSON.stringify({ success: true, restored, total: roles.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Action: count stats
      if (body.action === "stats") {
        const { tenant_id } = body;
        if (!tenant_id) throw new Error("Missing tenant_id");

        const { count } = await supabase
          .from("verified_members")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant_id);

        return new Response(JSON.stringify({ verified_count: count || 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error("Invalid action");
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
