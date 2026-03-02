import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, User, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

export interface DiscordMember {
  id: string;
  username: string;
  displayName: string;
  avatar?: string | null;
}

interface MemberSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMember?: (member: DiscordMember) => void;
}

const MemberSearchModal = ({ open, onOpenChange, onSelectMember }: MemberSearchModalProps) => {
  const { tenant } = useTenant();
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<DiscordMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async (query: string) => {
    if (!tenant?.discord_guild_id) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("discord-guild-members", {
        body: { guild_id: tenant.discord_guild_id, query, limit: 20 },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setMembers(data as DiscordMember[]);
    } catch (err) {
      console.error("Error fetching members:", err);
      setError("Erro ao buscar membros do servidor");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [tenant?.discord_guild_id]);

  // Debounced search
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      fetchMembers(search);
    }, search.length > 0 ? 400 : 0);

    return () => clearTimeout(timer);
  }, [search, open, fetchMembers]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearch("");
      setMembers([]);
      setError(null);
    }
  }, [open]);

  const handleSelect = (member: DiscordMember) => {
    onSelectMember?.(member);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 bg-card border-border">
        <DialogHeader className="sr-only">
          <DialogTitle>Buscar membros</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Input
            placeholder="Buscar membro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-8 text-sm"
            autoFocus
          />
          {loading ? (
            <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[280px] overflow-y-auto">
          {error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : loading && members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
            </div>
          ) : members.length === 0 && search.length > 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <User className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum membro encontrado</p>
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                Digite para buscar membros do servidor
              </p>
            </div>
          ) : (
            <div className="py-1">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleSelect(member)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-accent/50 transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    {member.avatar && <AvatarImage src={member.avatar} />}
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold uppercase">
                      {member.displayName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{member.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">@{member.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MemberSearchModal;
