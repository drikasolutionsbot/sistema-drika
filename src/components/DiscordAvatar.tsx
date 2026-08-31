import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "lucide-react";

export function DiscordAvatar({ userId, className = "h-4 w-4" }: { userId: string, className?: string }) {
  const { data: avatarUrl, isLoading } = useQuery({
    queryKey: ["discord-avatar", userId],
    queryFn: async () => {
      if (!userId) return null;
      try {
        const { data, error } = await supabase.functions.invoke("get-discord-user", {
          body: { user_id: userId }
        });
        if (error) throw error;
        return data?.avatarUrl || null;
      } catch (e) {
        console.error("Failed to fetch avatar:", e);
        return null;
      }
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 60 * 24, // cache for 24 hours
  });

  if (isLoading || !avatarUrl) {
    return <User className={className} />;
  }

  return (
    <img 
      src={avatarUrl} 
      alt="Discord Avatar" 
      className={`${className} rounded-full object-cover bg-muted`} 
      onError={(e) => {
        // Fallback if image fails to load
        (e.target as HTMLImageElement).style.display = "none";
        (e.target as HTMLImageElement).parentElement?.classList.add("fallback-avatar");
      }}
    />
  );
}
