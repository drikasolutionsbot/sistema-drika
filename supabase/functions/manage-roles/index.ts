import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function hexToDecimal(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, tenant_id, ...params } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    // Get guild_id and bot token from tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("discord_guild_id, bot_token_encrypted")
      .eq("id", tenant_id)
      .single();

    if (tenantErr || !tenant) {
      throw new Error("Tenant not found");
    }

    const botToken = tenant.bot_token_encrypted || null;
    const guildId = tenant.discord_guild_id || null;

    // Helper: require bot token for Discord operations
    const requireBot = () => {
      if (!botToken) throw new Error("Bot token não configurado. Configure em Configurações → Bot Externo.");
      if (!guildId) throw new Error("Nenhum servidor Discord conectado.");
      return { botToken, guildId };
    };

    switch (action) {
      case "list": {
        const { data, error } = await supabase
          .from("tenant_roles")
          .select("*")
          .eq("tenant_id", tenant_id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_discord": {
        const bot = requireBot();
        const discordRes = await fetch(
          `https://discord.com/api/v10/guilds/${bot.guildId}/roles`,
          {
            headers: { Authorization: `Bot ${bot.botToken}` },
          }
        );

        if (!discordRes.ok) {
          const text = await discordRes.text();
          throw new Error(`Discord API error [${discordRes.status}]: ${text}`);
        }

        const discordRoles = await discordRes.json();
        const roles = discordRoles
          .filter((r: any) => r.name !== "@everyone")
          .map((r: any) => ({ id: r.id, name: r.name, position: r.position, color: r.color }))
          .sort((a: any, b: any) => b.position - a.position);

        return new Response(JSON.stringify({ roles }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create": {
        const { name, color = "#99AAB5" } = params;
        if (!name) throw new Error("Missing name");

        // Accept both hex string and number for color
        const colorDecimal = typeof color === "number" ? color : hexToDecimal(String(color));

        const discordRes = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/roles`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name,
              color: colorDecimal,
              mentionable: false,
              hoist: false,
            }),
          }
        );

        if (!discordRes.ok) {
          const text = await discordRes.text();
          throw new Error(`Discord API error [${discordRes.status}]: ${text}`);
        }

        const discordRole = await discordRes.json();

        const colorHex = typeof color === "string" ? color : `#${colorDecimal.toString(16).padStart(6, "0")}`;

        const { data, error } = await supabase
          .from("tenant_roles")
          .insert({
            tenant_id,
            discord_role_id: discordRole.id,
            name: discordRole.name,
            color: colorHex,
            synced: true,
          })
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        const { id, ...updates } = params;
        if (!id) throw new Error("Missing id");

        const { data: role, error: roleErr } = await supabase
          .from("tenant_roles")
          .select("*")
          .eq("id", id)
          .eq("tenant_id", tenant_id)
          .single();

        if (roleErr || !role) throw new Error("Role not found");

        if (role.discord_role_id && (updates.name || updates.color)) {
          const discordBody: Record<string, unknown> = {};
          if (updates.name) discordBody.name = updates.name;
          if (updates.color) discordBody.color = hexToDecimal(updates.color);

          const discordRes = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/roles/${role.discord_role_id}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(discordBody),
            }
          );

          if (!discordRes.ok) {
            const text = await discordRes.text();
            console.error(`Discord update failed: ${text}`);
          }
        }

        const allowedKeys = [
          "name", "color",
          "can_view", "can_manage_app", "can_manage_resources",
          "can_change_server", "can_manage_permissions", "can_manage_bot_appearance",
          "can_manage_products", "can_manage_store", "can_manage_stock",
          "can_manage_protection", "can_manage_ecloud",
        ];
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const key of allowedKeys) {
          if (updates[key] !== undefined) updateData[key] = updates[key];
        }

        const { data, error } = await supabase
          .from("tenant_roles")
          .update(updateData)
          .eq("id", id)
          .eq("tenant_id", tenant_id)
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_discord_permissions": {
        const { role_id, permissions } = params;
        if (!role_id) throw new Error("Missing role_id");
        if (permissions === undefined) throw new Error("Missing permissions");

        const discordRes = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/roles/${role_id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ permissions: String(permissions) }),
          }
        );

        if (!discordRes.ok) {
          const text = await discordRes.text();
          throw new Error(`Discord API error [${discordRes.status}]: ${text}`);
        }

        const updatedRole = await discordRes.json();
        return new Response(JSON.stringify(updatedRole), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { id } = params;
        if (!id) throw new Error("Missing id");

        const { data: role } = await supabase
          .from("tenant_roles")
          .select("discord_role_id")
          .eq("id", id)
          .eq("tenant_id", tenant_id)
          .single();

        if (role?.discord_role_id) {
          const discordRes = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/roles/${role.discord_role_id}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bot ${botToken}` },
            }
          );
          if (!discordRes.ok) {
            console.error(`Discord delete failed: ${await discordRes.text()}`);
          }
        }

        const { error } = await supabase
          .from("tenant_roles")
          .delete()
          .eq("id", id)
          .eq("tenant_id", tenant_id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "sync_from_discord": {
        // Fetch all Discord roles
        const syncRes = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/roles`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );
        if (!syncRes.ok) {
          const text = await syncRes.text();
          throw new Error(`Discord API error [${syncRes.status}]: ${text}`);
        }
        const allDiscordRoles = await syncRes.json();
        const syncableRoles = allDiscordRoles.filter((r: any) => r.name !== "@everyone" && !r.managed);

        // Get existing tenant_roles with discord_role_id
        const { data: existingRoles } = await supabase
          .from("tenant_roles")
          .select("discord_role_id")
          .eq("tenant_id", tenant_id);

        const existingIds = new Set((existingRoles || []).map((r: any) => r.discord_role_id));

        const toInsert = syncableRoles
          .filter((r: any) => !existingIds.has(r.id))
          .map((r: any) => ({
            tenant_id,
            discord_role_id: r.id,
            name: r.name,
            color: r.color === 0 ? "#99AAB5" : `#${r.color.toString(16).padStart(6, "0")}`,
            synced: true,
          }));

        let inserted = 0;
        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase
            .from("tenant_roles")
            .insert(toInsert);
          if (insertErr) throw insertErr;
          inserted = toInsert.length;
        }

        return new Response(JSON.stringify({ success: true, synced: inserted, total: syncableRoles.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete directly by Discord role ID (used by RolesTab)
      case "delete_discord": {
        const { role_id } = params;
        if (!role_id) throw new Error("Missing role_id");

        // Delete from Discord
        const discordRes = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/roles/${role_id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bot ${botToken}` },
          }
        );

        if (!discordRes.ok && discordRes.status !== 404) {
          const text = await discordRes.text();
          throw new Error(`Discord API error [${discordRes.status}]: ${text}`);
        }

        // Also remove from tenant_roles if exists
        await supabase
          .from("tenant_roles")
          .delete()
          .eq("discord_role_id", role_id)
          .eq("tenant_id", tenant_id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
