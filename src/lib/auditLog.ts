import { supabase } from "@/integrations/supabase/client";

export const logAudit = async (
  action: string,
  entity_type: string,
  entity_id: string | null,
  entity_name: string | null,
  details?: Record<string, any>
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase as any).from("admin_audit_logs").insert({
      admin_email: user?.email || null,
      admin_user_id: user?.id || null,
      action,
      entity_type,
      entity_id,
      entity_name,
      details: details || {},
    });
  } catch {
    // Silent fail - don't break main flow
  }
};
