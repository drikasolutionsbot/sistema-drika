import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface Tenant {
  id: string;
  name: string;
  discord_guild_id: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  plan: string;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  bot_token_encrypted: string | null;
  bot_client_id: string | null;
  bot_prefix: string | null;
  bot_status: string | null;
  bot_name: string | null;
  bot_avatar_url: string | null;
  bot_status_interval: number | null;
  banner_url: string | null;
  ecloud_custom_url: string | null;
  verify_enabled: boolean | null;
  verify_redirect_url: string | null;
  verify_role_id: string | null;
  referral_code: string | null;
  referred_by_tenant_id: string | null;
  referral_credits_cents: number;
  affiliate_active: boolean;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  loading: boolean;
  refetch: () => Promise<Tenant | null>;
  isPlanExpired: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = async (isRefetch = false): Promise<Tenant | null> => {
    if (!isRefetch) setLoading(true);

    // Check token session first - use stored data directly (no RLS needed)
    const tokenSessionStr = sessionStorage.getItem("token_session");
    if (tokenSessionStr) {
      try {
        const tokenSession = JSON.parse(tokenSessionStr);
        if (tokenSession.tenant_id) {
          const { data, error } = await supabase.functions.invoke("get-tenant", {
            body: { tenant_id: tokenSession.tenant_id },
          });

          let result: Tenant;
          if (!error && data && !data.error) {
            result = data as Tenant;
          } else {
            result = {
              id: tokenSession.tenant_id,
              name: tokenSession.tenant_name || "Loja",
              discord_guild_id: null,
              logo_url: null,
              primary_color: "#FF69B4",
              secondary_color: "#FFD700",
              plan: "free",
              plan_started_at: null,
              plan_expires_at: null,
              pix_key: null,
              pix_key_type: null,
              bot_token_encrypted: null,
              bot_client_id: null,
              bot_prefix: null,
              bot_status: null,
              bot_status_interval: null,
              bot_name: null,
              bot_avatar_url: null,
              banner_url: null,
              ecloud_custom_url: null,
              verify_enabled: null,
              verify_redirect_url: null,
              verify_role_id: null,
              referral_code: null,
              referred_by_tenant_id: null,
              referral_credits_cents: 0,
              affiliate_active: false,
            };
          }
          setTenant(result);
          setLoading(false);
          return result;
        }
      } catch {}
    }

    if (!user) { setTenant(null); setLoading(false); return null; }

    // Get user's first tenant via user_roles
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (roleData?.tenant_id) {
      const { data } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", roleData.tenant_id)
        .single();
      const result = (data as Tenant | null);
      setTenant(result);
      setLoading(false);
      return result;
    } else {
      setTenant(null);
      setLoading(false);
      return null;
    }
  };

  useEffect(() => { fetchTenant(); }, [user]);

  useEffect(() => {
    if (!tenant?.id || tenant.discord_guild_id) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchTenant(true);
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [tenant?.id, tenant?.discord_guild_id]);

  const isPlanExpired = (() => {
    if (!tenant) return false;
    if (tenant.plan === "expired") return true;
    if (tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date()) {
      return true;
    }
    return false;
  })();

  return (
    <TenantContext.Provider value={{ tenant, tenantId: tenant?.id ?? null, loading, refetch: () => fetchTenant(true), isPlanExpired }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
};
