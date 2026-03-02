import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TenantPermission {
  id: string;
  tenant_id: string;
  discord_user_id: string;
  discord_username: string | null;
  discord_display_name: string | null;
  discord_avatar_url: string | null;
  can_view: boolean;
  can_manage_app: boolean;
  can_manage_resources: boolean;
  created_at: string;
  updated_at: string;
}

export function usePermissions(tenantId: string | null) {
  const [permissions, setPermissions] = useState<TenantPermission[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-permissions", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (!error && data && !data.error) {
        setPermissions(data as TenantPermission[]);
      }
    } catch (err) {
      console.error("Error fetching permissions:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const addMember = useCallback(async (member: {
    discord_user_id: string;
    discord_username: string;
    discord_display_name: string;
    discord_avatar_url?: string | null;
  }) => {
    if (!tenantId) return null;
    try {
      const { data, error } = await supabase.functions.invoke("manage-permissions", {
        body: {
          action: "upsert",
          tenant_id: tenantId,
          ...member,
        },
      });
      if (!error && data && !data.error) {
        await fetchPermissions();
        return data as TenantPermission;
      }
    } catch (err) {
      console.error("Error adding member:", err);
    }
    return null;
  }, [tenantId, fetchPermissions]);

  const updatePermission = useCallback(async (
    id: string,
    updates: { can_view?: boolean; can_manage_app?: boolean; can_manage_resources?: boolean }
  ) => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-permissions", {
        body: { action: "update", tenant_id: tenantId, id, ...updates },
      });
      if (!error && data && !data.error) {
        setPermissions(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
      }
    } catch (err) {
      console.error("Error updating permission:", err);
    }
  }, [tenantId]);

  const removeMember = useCallback(async (id: string) => {
    if (!tenantId) return;
    try {
      const { error } = await supabase.functions.invoke("manage-permissions", {
        body: { action: "delete", tenant_id: tenantId, id },
      });
      if (!error) {
        setPermissions(prev => prev.filter(p => p.id !== id));
      }
    } catch (err) {
      console.error("Error removing member:", err);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  return { permissions, loading, fetchPermissions, addMember, updatePermission, removeMember };
}
