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
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  loading: boolean;
  refetch: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = async () => {
    if (!user) { setTenant(null); setLoading(false); return; }
    setLoading(true);

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
      setTenant(data as Tenant | null);
    } else {
      setTenant(null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTenant(); }, [user]);

  return (
    <TenantContext.Provider value={{ tenant, tenantId: tenant?.id ?? null, loading, refetch: fetchTenant }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
};
