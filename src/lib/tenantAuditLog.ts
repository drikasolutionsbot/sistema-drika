import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "create" | "update" | "delete"
  | "activate" | "deactivate"
  | "switch_server" | "save_permissions"
  | "add_member" | "remove_member"
  | "create_role" | "delete_role"
  | "add_stock" | "deliver_order";

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  actor_discord_id: string | null;
  actor_name: string | null;
  details: Record<string, any>;
  created_at: string;
}

export const logTenantAudit = async (
  tenantId: string,
  action: AuditAction | string,
  entityType: string,
  entityName: string | null,
  entityId?: string | null,
  details?: Record<string, any>
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    // Try to get profile for discord info
    let actorName = user?.email || "Sistema";
    let actorDiscordId: string | null = null;

    if (user) {
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("discord_username, discord_user_id")
        .eq("id", user.id)
        .single();
      if (profile) {
        actorName = profile.discord_username || actorName;
        actorDiscordId = profile.discord_user_id || null;
      }
    }

    await (supabase as any).from("tenant_audit_logs").insert({
      tenant_id: tenantId,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      entity_name: entityName,
      actor_name: actorName,
      actor_discord_id: actorDiscordId,
      details: details || {},
    });
  } catch {
    // Silent fail
  }
};

export const fetchTenantAuditLogs = async (
  tenantId: string,
  limit = 20
): Promise<AuditLogEntry[]> => {
  const { data, error } = await (supabase as any)
    .from("tenant_audit_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
};
