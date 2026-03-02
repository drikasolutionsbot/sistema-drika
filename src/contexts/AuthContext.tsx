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
    return sessionStorage.getItem("discord_provider_token");
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // Capture provider token on sign in
      if (event === "SIGNED_IN" && session?.provider_token) {
        setProviderToken(session.provider_token);
        sessionStorage.setItem("discord_provider_token", session.provider_token);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.provider_token) {
        setProviderToken(session.provider_token);
        sessionStorage.setItem("discord_provider_token", session.provider_token);
      }
      const hasAuthParams = window.location.hash?.includes("access_token") || window.location.hash?.includes("refresh_token");
      if (!hasAuthParams) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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
