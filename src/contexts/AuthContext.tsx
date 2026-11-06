import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  providerToken: string | null;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerToken, setProviderToken] = useState<string | null>(() => {
    return localStorage.getItem("discord_provider_token") || sessionStorage.getItem("discord_provider_token");
  });

  useEffect(() => {
    let initialResolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.provider_token) {
        setProviderToken(currentSession.provider_token);
        localStorage.setItem("discord_provider_token", currentSession.provider_token);
        sessionStorage.setItem("discord_provider_token", currentSession.provider_token);
      }
      if (initialResolved || event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: restoredSession }, error }) => {
      initialResolved = true;
      if (error) {
        // Se o refresh_token do Supabase expirou/falhou mas o cliente tem token_session,
        // limpamos apenas a sessão Auth quebrada para não enviar JWT expirado nas Edge Functions
        const hasTokenSession = !!localStorage.getItem("token_session");
        if (hasTokenSession) {
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {}
        }
        setSession(null);
      } else {
        setSession(restoredSession);
        if (restoredSession?.provider_token) {
          setProviderToken(restoredSession.provider_token);
          localStorage.setItem("discord_provider_token", restoredSession.provider_token);
          sessionStorage.setItem("discord_provider_token", restoredSession.provider_token);
        }
      }
      const hasAuthParams = window.location.hash?.includes("access_token") || window.location.hash?.includes("refresh_token");
      if (!hasAuthParams) {
        setLoading(false);
      }
    });

    // Quando o cliente volta para a aba/janela após tempo inativo, renova a sessão proativamente
    const handleVisibilityOrFocus = async () => {
      if (document.visibilityState === "visible") {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error && localStorage.getItem("token_session")) {
            await supabase.auth.signOut({ scope: "local" }).catch(() => {});
            setSession(null);
          } else if (data?.session) {
            setSession(data.session);
          }
        } catch {}
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, []);

  const signInWithDiscord = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/onboarding`,
        skipBrowserRedirect: true,
        scopes: "identify guilds",
      },
    });

    if (error) throw error;
    if (!data?.url) return;

    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      window.open(data.url, "_blank");
    } else {
      window.location.assign(data.url);
    }
  };

  const signOut = async () => {
    localStorage.removeItem("discord_provider_token");
    sessionStorage.removeItem("discord_provider_token");
    setProviderToken(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, providerToken, signInWithDiscord, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
