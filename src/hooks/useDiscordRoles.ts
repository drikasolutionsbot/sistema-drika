import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

export interface DiscordRole {
  id: string;
  name: string;
  color: string | number;
  position?: number;
  discord_role_id?: string;
}

/**
 * Fetches Discord roles using the hybrid strategy:
 * 1. Real Discord roles via `list_discord`
 * 2. Panel roles from `tenant_roles` table
 * 3. Merges both, deduplicating by Discord role ID
 */
export function useDiscordRoles(enabled = true) {
  const { tenantId } = useTenant();
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId || !enabled) return;
    setLoading(true);

    Promise.all([
      supabase.functions.invoke("manage-roles", {
        body: { action: "list_discord", tenant_id: tenantId },
      }),
      supabase.functions.invoke("manage-roles", {
        body: { action: "list", tenant_id: tenantId },
      }),
    ])
      .then(([discordRes, panelRes]) => {
        const discordRoles: DiscordRole[] = Array.isArray(discordRes.data?.roles)
          ? discordRes.data.roles.map((r: any) => ({
              id: r.id,
              name: r.name,
              color: typeof r.color === "number" ? `#${r.color.toString(16).padStart(6, "0")}` : r.color || "#99AAB5",
              position: r.position ?? 0,
            }))
          : [];

        const panelRoles: DiscordRole[] = Array.isArray(panelRes.data) ? panelRes.data : [];

        // Merge: Discord roles first, then panel-only roles not already in Discord
        const discordIds = new Set(discordRoles.map((r) => r.id));
        const panelOnly = panelRoles
          .filter((r) => r.discord_role_id && !discordIds.has(r.discord_role_id))
          .map((r) => ({
            id: r.discord_role_id!,
            name: r.name,
            color: r.color || "#99AAB5",
            position: 0,
          }));

        setRoles([...discordRoles, ...panelOnly]);
      })
      .catch((err) => {
        console.error("Failed to fetch Discord roles:", err);
      })
      .finally(() => setLoading(false));
  }, [tenantId, enabled]);

  return { roles, loading };
}
