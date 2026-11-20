import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { evaluatePlanAccess, type PlanAccessStatus } from "@/lib/plans";
import { getTokenSession, saveTokenSession, clearTokenSession } from "@/lib/tokenSession";

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
  use_split_wallet?: boolean | null;
  access_token?: string | null;
  token?: string | null;
  owner_discord_username?: string | null;
  owner_discord_id?: string | null;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  loading: boolean;
  refetch: () => Promise<Tenant | null>;
  isPlanExpired: boolean;
  isSystemFree: boolean;
  globalBotBanner: string | null;
  planAccess: PlanAccessStatus;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSystemFree, setIsSystemFree] = useState(false);
  const [globalBotBanner, setGlobalBotBanner] = useState<string | null>(null);

  const fetchTenant = async (isRefetch = false): Promise<Tenant | null> => {
    if (!isRefetch) setLoading(true);

    // Check token session first (localStorage + 365-day cookie fallback)
    const tokenSession = getTokenSession();
    if (tokenSession?.tenant_id) {
      try {
        const { data, error } = await supabase.functions.invoke("get-tenant", {
          body: { tenant_id: tokenSession.tenant_id },
        });

        if (!error && data && !data.error) {
          const activeToken = data.access_token || tokenSession.token || null;
          const result: Tenant = {
            ...data,
            token: activeToken,
            access_token: activeToken,
          } as Tenant;
          // Mantém o token_session sempre sincronizado no localStorage e no cookie de 365 dias
          if (activeToken) {
            saveTokenSession({
              tenant_id: data.id || tokenSession.tenant_id,
              tenant_name: data.name || tokenSession.tenant_name || "Loja",
              token: activeToken,
            });
          }
          setTenant(result);
          setLoading(false);
          return result;
        } else {
          // Token foi rotacionado, revogado ou não autorizado: limpa a sessão de token inválida
          clearTokenSession();
          if (!user) {
            setTenant(null);
            setLoading(false);
            if (window.location.pathname !== "/login" && window.location.pathname !== "/") {
              window.location.href = "/login";
            }
            return null;
          }
          // Se o usuário estiver logado via Discord (user), continua abaixo para carregar/sincronizar o novo token
        }
      } catch {}
    }

    if (!user) { setTenant(null); setLoading(false); return null; }

    // Get user's first tenant via user_roles
    let resolvedTenantId: string | null = null;
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    resolvedTenantId = roleData?.tenant_id || null;

    // Fallback: se o usuário está autenticado via Discord mas não tinha token_session salvo,
    // recupera/vincula a loja automaticamente via login-with-discord
    if (!resolvedTenantId && user.app_metadata?.provider === "discord") {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const { data: discordLoginData } = await supabase.functions.invoke("login-with-discord", {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        if (discordLoginData?.tenant_id) {
          resolvedTenantId = discordLoginData.tenant_id;
          if (discordLoginData.token) {
            saveTokenSession({
              tenant_id: discordLoginData.tenant_id,
              tenant_name: discordLoginData.tenant_name || "Loja",
              token: discordLoginData.token,
            });
          }
        }
      } catch {}
    }

    if (resolvedTenantId) {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("get-tenant", {
        body: { tenant_id: resolvedTenantId },
      });

      let result: Tenant | null = null;
      if (!fnErr && fnData && !fnData.error) {
        result = {
          ...fnData,
          token: fnData.access_token || null,
          access_token: fnData.access_token || null,
        } as Tenant;
        // Persiste token_session automaticamente no localStorage + cookie 365 dias
        if (fnData.access_token) {
          saveTokenSession({
            tenant_id: fnData.id,
            tenant_name: fnData.name || "Loja",
            token: fnData.access_token,
          });
        }
      } else {
        const { data } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", resolvedTenantId)
          .single();
        result = (data as Tenant | null);
      }
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
    const fetchConfig = async () => {
      const { data } = await supabase
        .from("landing_config")
        .select("is_free_system, global_bot_banner_url")
        .limit(1)
        .single();
      if (data) {
        setIsSystemFree(data.is_free_system || false);
        setGlobalBotBanner(data.global_bot_banner_url || null);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!tenant?.id || tenant.discord_guild_id) return;

    const channel = supabase
      .channel(`tenant_${tenant.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tenants", filter: `id=eq.${tenant.id}` },
        () => {
          void fetchTenant(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, tenant?.discord_guild_id]);

  const planAccess = evaluatePlanAccess(tenant, isSystemFree);
  // Mantém retrocompatibilidade de isPlanExpired (somente quando a tolerância de 2 dias também já expirou)
  const isPlanExpired = planAccess.isExpired && planAccess.isGraceExpired;

  // Se o período de tolerância de 2 dias já expirou, a loja opera efetivamente no plano "free"
  const effectiveTenant = useMemo(() => {
    if (!tenant) return null;
    if (planAccess.isGraceExpired && tenant.plan !== "free") {
      return { ...tenant, plan: "free" };
    }
    return tenant;
  }, [tenant, planAccess.isGraceExpired]);

  // Sincroniza com o banco de dados caso ainda estivesse salvo como pro/master
  useEffect(() => {
    if (tenant?.id && planAccess.isGraceExpired && tenant.plan !== "free") {
      supabase
        .from("tenants")
        .update({ plan: "free", updated_at: new Date().toISOString() })
        .eq("id", tenant.id);
    }
  }, [tenant?.id, tenant?.plan, planAccess.isGraceExpired]);

  return (
    <TenantContext.Provider value={{ tenant: effectiveTenant, tenantId: effectiveTenant?.id ?? null, loading, refetch: () => fetchTenant(true), isPlanExpired, isSystemFree, globalBotBanner, planAccess }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
};
