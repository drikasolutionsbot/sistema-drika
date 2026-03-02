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
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!botToken) throw new Error("Bot token not configured");

    const { action, tenant_id, ...params } = await req.json();
    if (!tenant_id) throw new Error("Missing tenant_id");

    // Get guild_id from tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("discord_guild_id")
      .eq("id", tenant_id)
      .single();

    if (tenantErr || !tenant?.discord_guild_id) {
      throw new Error("Tenant not found or no Discord server connected");
    }

    const guildId = tenant.discord_guild_id;

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

      case "create": {
        const { name, color = "#99AAB5" } = params;
        if (!name) throw new Error("Missing name");

        // Create role in Discord
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
              color: hexToDecimal(color),
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

        // Save to DB
        const { data, error } = await supabase
          .from("tenant_roles")
          .insert({
            tenant_id,
            discord_role_id: discordRole.id,
            name: discordRole.name,
            color,
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

        // Get current role from DB
        const { data: role, error: roleErr } = await supabase
          .from("tenant_roles")
          .select("*")
          .eq("id", id)
          .eq("tenant_id", tenant_id)
          .single();

        if (roleErr || !role) throw new Error("Role not found");

        // If name or color changed, update in Discord too
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

        // Update permissions in DB
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

      case "delete": {
        const { id } = params;
        if (!id) throw new Error("Missing id");

        // Get role to find discord_role_id
        const { data: role } = await supabase
          .from("tenant_roles")
          .select("discord_role_id")
          .eq("id", id)
          .eq("tenant_id", tenant_id)
          .single();

        // Delete from Discord
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

        // Delete from DB
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
