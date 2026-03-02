import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PermissionKey } from "./usePermissions";

export interface TenantRole {
  id: string;
  tenant_id: string;
  discord_role_id: string | null;
  name: string;
  color: string;
  synced: boolean;
  can_view: boolean;
  can_manage_app: boolean;
  can_manage_resources: boolean;
  can_change_server: boolean;
  can_manage_permissions: boolean;
  can_manage_bot_appearance: boolean;
  can_manage_products: boolean;
  can_manage_store: boolean;
  can_manage_stock: boolean;
  can_manage_protection: boolean;
  can_manage_ecloud: boolean;
  created_at: string;
  updated_at: string;
}

export function useRoles(tenantId: string | null) {
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRoles = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (!error && data && !data.error) {
        setRoles(data as TenantRole[]);
      }
    } catch (err) {
      console.error("Error fetching roles:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const createRole = useCallback(async (name: string, color: string) => {
    if (!tenantId) return null;
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: { action: "create", tenant_id: tenantId, name, color },
      });
      if (!error && data && !data.error) {
        await fetchRoles();
        return data as TenantRole;
      }
      if (data?.error) throw new Error(data.error);
    } catch (err) {
      console.error("Error creating role:", err);
      throw err;
    }
    return null;
  }, [tenantId, fetchRoles]);

  const updateRole = useCallback(async (
    id: string,
    updates: Partial<Record<PermissionKey, boolean>> & { name?: string; color?: string }
  ) => {
    if (!tenantId) return null;
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: { action: "update", tenant_id: tenantId, id, ...updates },
      });
      if (!error && data && !data.error) {
        setRoles(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
        return data as TenantRole;
      }
    } catch (err) {
      console.error("Error updating role:", err);
    }
    return null;
  }, [tenantId]);

  const deleteRole = useCallback(async (id: string) => {
    if (!tenantId) return;
    try {
      const { error } = await supabase.functions.invoke("manage-roles", {
        body: { action: "delete", tenant_id: tenantId, id },
      });
      if (!error) {
        setRoles(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error("Error deleting role:", err);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return { roles, loading, fetchRoles, createRole, updateRole, deleteRole };
}
