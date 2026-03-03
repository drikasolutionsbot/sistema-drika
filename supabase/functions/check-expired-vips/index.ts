import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function removeDiscordRole(botToken: string, guildId: string, userId: string, roleId: string) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    { method: "DELETE", headers: { Authorization: `Bot ${botToken}` } }
  );
  return res.ok || res.status === 204;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();

    // Find all expired active VIP members across ALL tenants
    const { data: expired, error } = await supabase
      .from("vip_members")
      .select("id, discord_user_id, tenant_id, vip_plans(discord_role_id)")
      .eq("active", true)
      .lte("expires_at", now);

    if (error) throw error;

    let deactivated = 0;
    let rolesRemoved = 0;

    // Cache tenant info to avoid repeated lookups
    const tenantCache: Record<string, { botToken: string; guildId: string }> = {};

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
          if (!tenantCache[member.tenant_id]) {
            const { data: tenant } = await supabase
              .from("tenants")
              .select("bot_token_encrypted, discord_guild_id")
              .eq("id", member.tenant_id)
              .single();
            if (tenant?.bot_token_encrypted && tenant?.discord_guild_id) {
              tenantCache[member.tenant_id] = {
                botToken: tenant.bot_token_encrypted,
                guildId: tenant.discord_guild_id,
              };
            }
          }
          const info = tenantCache[member.tenant_id];
          if (info) {
            const removed = await removeDiscordRole(info.botToken, info.guildId, member.discord_user_id, discordRoleId);
            if (removed) rolesRemoved++;
          }
        } catch (e) {
          console.error(`Failed to remove role for member ${member.id}:`, e);
        }
      }
    }

    console.log(`check-expired-vips: deactivated=${deactivated}, rolesRemoved=${rolesRemoved}`);

    return new Response(
      JSON.stringify({ success: true, deactivated, roles_removed: rolesRemoved }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("check-expired-vips error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
