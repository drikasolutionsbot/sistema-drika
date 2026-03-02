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

export type PermissionKey = 
  | "can_view" | "can_manage_app" | "can_manage_resources"
  | "can_change_server" | "can_manage_permissions" | "can_manage_bot_appearance"
  | "can_manage_products" | "can_manage_store" | "can_manage_stock"
  | "can_manage_protection" | "can_manage_ecloud";

export const PERMISSION_LABELS: { key: PermissionKey; label: string; description: string }[] = [
  { key: "can_view", label: "Ver", description: "Permite ver as informações da aplicação." },
  { key: "can_manage_app", label: "Gerenciar Aplicação", description: "Permite iniciar, parar e reiniciar a aplicação." },
  { key: "can_manage_resources", label: "Gerenciar Recursos", description: "Permite gerenciar os recursos da aplicação." },
  { key: "can_change_server", label: "Mudar Servidor", description: "Permite mudar o servidor da aplicação." },
  { key: "can_manage_permissions", label: "Gerenciar Permissões", description: "Permite adicionar e remover permissões da aplicação." },
  { key: "can_manage_bot_appearance", label: "Aparência do Bot", description: "Permite mudar a aparência do bot, como nome, avatar, cores, etc." },
  { key: "can_manage_products", label: "Gerenciar Produtos", description: "Permite gerenciar os produtos do servidor." },
  { key: "can_manage_store", label: "Gerenciar Geral da Loja", description: "Permite gerenciar as configurações gerais da loja." },
  { key: "can_manage_stock", label: "Gerenciar Estoque", description: "Permite gerenciar o estoque de produtos do servidor." },
  { key: "can_manage_protection", label: "Gerenciar Proteção", description: "Permite mudar as configurações de proteção do servidor." },
  { key: "can_manage_ecloud", label: "Gerenciar eCloud", description: "Permite gerenciar as configurações do OAuth2 e puxar os membros." },
];

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
        body: { action: "upsert", tenant_id: tenantId, ...member },
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

  const savePermissions = useCallback(async (
    id: string,
    updates: Partial<Record<PermissionKey, boolean>>
  ) => {
    if (!tenantId) return null;
    try {
      const { data, error } = await supabase.functions.invoke("manage-permissions", {
        body: { action: "update", tenant_id: tenantId, id, ...updates },
      });
      if (!error && data && !data.error) {
        setPermissions(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
        return data as TenantPermission;
      }
    } catch (err) {
      console.error("Error updating permission:", err);
    }
    return null;
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

  return { permissions, loading, fetchPermissions, addMember, savePermissions, removeMember };
}
