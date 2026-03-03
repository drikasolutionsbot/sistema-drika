import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: get bot token and guild_id for a tenant
async function getTenantDiscordInfo(supabase: any, tenant_id: string) {
  const { data, error } = await supabase
    .from("tenants")
    .select("bot_token_encrypted, discord_guild_id")
    .eq("id", tenant_id)
    .single();
  if (error || !data) throw new Error("Tenant not found");
  return { botToken: data.bot_token_encrypted, guildId: data.discord_guild_id };
}

// Helper: add a Discord role to a user
async function addDiscordRole(botToken: string, guildId: string, userId: string, roleId: string) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    { method: "PUT", headers: { Authorization: `Bot ${botToken}` } }
  );
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    console.error(`Failed to add role ${roleId} to user ${userId}: ${text}`);
    return false;
  }
  return true;
}

// Helper: remove a Discord role from a user
async function removeDiscordRole(botToken: string, guildId: string, userId: string, roleId: string) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    { method: "DELETE", headers: { Authorization: `Bot ${botToken}` } }
  );
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    console.error(`Failed to remove role ${roleId} from user ${userId}: ${text}`);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, tenant_id } = body;

    if (!tenant_id) throw new Error("tenant_id required");

    const json = (data: any) =>
      new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ---- PLANS ----
    if (action === "list_plans") {
      const { data, error } = await supabase
        .from("vip_plans")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return json(data);
    }

    if (action === "create_plan") {
      const { name, description, price_cents, duration_days, discord_role_id } = body;
      const { data, error } = await supabase
        .from("vip_plans")
        .insert({ tenant_id, name, description, price_cents: price_cents || 0, duration_days: duration_days || 30, discord_role_id })
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    if (action === "update_plan") {
      const { plan_id, ...fields } = body;
      delete fields.action;
      delete fields.tenant_id;
      const { data, error } = await supabase
        .from("vip_plans")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", plan_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    if (action === "delete_plan") {
      const { plan_id } = body;
      const { error } = await supabase.from("vip_plans").delete().eq("id", plan_id).eq("tenant_id", tenant_id);
      if (error) throw error;
      return json({ success: true });
    }

    // ---- MEMBERS ----
    if (action === "list_members") {
      const { data, error } = await supabase
        .from("vip_members")
        .select("*, vip_plans(name, discord_role_id)")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(data);
    }

    if (action === "add_member") {
      const { plan_id, discord_user_id, discord_username, duration_days } = body;
      const expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + (duration_days || 30));

      const { data, error } = await supabase
        .from("vip_members")
        .insert({ tenant_id, plan_id, discord_user_id, discord_username, expires_at: expires_at.toISOString() })
        .select("*, vip_plans(name, discord_role_id)")
        .single();
      if (error) throw error;

      // Auto-assign Discord role
      const discordRoleId = data.vip_plans?.discord_role_id;
      let roleAssigned = false;
      if (discordRoleId && discord_user_id) {
        try {
          const { botToken, guildId } = await getTenantDiscordInfo(supabase, tenant_id);
          if (botToken && guildId) {
            roleAssigned = await addDiscordRole(botToken, guildId, discord_user_id, discordRoleId);
          }
        } catch (e) {
          console.error("Failed to assign Discord role:", e);
        }
      }

      return json({ ...data, role_assigned: roleAssigned });
    }

    if (action === "remove_member") {
      const { member_id } = body;

      // Get member + plan info before deleting to remove Discord role
      const { data: member } = await supabase
        .from("vip_members")
        .select("discord_user_id, vip_plans(discord_role_id)")
        .eq("id", member_id)
        .eq("tenant_id", tenant_id)
        .single();

      const { error } = await supabase.from("vip_members").delete().eq("id", member_id).eq("tenant_id", tenant_id);
      if (error) throw error;

      // Auto-remove Discord role
      let roleRemoved = false;
      const discordRoleId = member?.vip_plans?.discord_role_id;
      if (discordRoleId && member?.discord_user_id) {
        try {
          const { botToken, guildId } = await getTenantDiscordInfo(supabase, tenant_id);
          if (botToken && guildId) {
            roleRemoved = await removeDiscordRole(botToken, guildId, member.discord_user_id, discordRoleId);
          }
        } catch (e) {
          console.error("Failed to remove Discord role:", e);
        }
      }

      return json({ success: true, role_removed: roleRemoved });
    }

    if (action === "toggle_member") {
      const { member_id, active } = body;

      // Get member + plan to manage Discord role
      const { data: member } = await supabase
        .from("vip_members")
        .select("discord_user_id, vip_plans(discord_role_id)")
        .eq("id", member_id)
        .eq("tenant_id", tenant_id)
        .single();

      const { data, error } = await supabase
        .from("vip_members")
        .update({ active, updated_at: new Date().toISOString() })
        .eq("id", member_id)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      if (error) throw error;

      // Add or remove Discord role based on active status
      let roleUpdated = false;
      const discordRoleId = member?.vip_plans?.discord_role_id;
      if (discordRoleId && member?.discord_user_id) {
        try {
          const { botToken, guildId } = await getTenantDiscordInfo(supabase, tenant_id);
          if (botToken && guildId) {
            if (active) {
              roleUpdated = await addDiscordRole(botToken, guildId, member.discord_user_id, discordRoleId);
            } else {
              roleUpdated = await removeDiscordRole(botToken, guildId, member.discord_user_id, discordRoleId);
            }
          }
        } catch (e) {
          console.error("Failed to update Discord role:", e);
        }
      }

      return json({ ...data, role_updated: roleUpdated });
    }

    // ---- EXPIRE CHECK (can be called by cron or manually) ----
    if (action === "check_expired") {
      const now = new Date().toISOString();
      const { data: expired, error } = await supabase
        .from("vip_members")
        .select("id, discord_user_id, tenant_id, vip_plans(discord_role_id)")
        .eq("tenant_id", tenant_id)
        .eq("active", true)
        .lte("expires_at", now);
      if (error) throw error;

      let deactivated = 0;
      let rolesRemoved = 0;

      for (const member of expired || []) {
        // Deactivate
        await supabase
          .from("vip_members")
          .update({ active: false, updated_at: now })
          .eq("id", member.id);
        deactivated++;

        // Remove Discord role
        const discordRoleId = member.vip_plans?.discord_role_id;
        if (discordRoleId && member.discord_user_id) {
          try {
            const { botToken, guildId } = await getTenantDiscordInfo(supabase, tenant_id);
            if (botToken && guildId) {
              const removed = await removeDiscordRole(botToken, guildId, member.discord_user_id, discordRoleId);
              if (removed) rolesRemoved++;
            }
          } catch (e) {
            console.error("Failed to remove expired role:", e);
          }
        }
      }

      return json({ success: true, deactivated, roles_removed: rolesRemoved });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
