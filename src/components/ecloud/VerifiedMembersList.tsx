import { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users,
  RotateCcw,
  Save,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VerifiedMember {
  id: string;
  discord_user_id: string;
  discord_username: string | null;
  discord_avatar: string | null;
  roles_backup: string[];
  nickname: string | null;
  verified_at: string;
  last_restore_at: string | null;
}

export const VerifiedMembersList = () => {
  const { tenantId } = useTenant();
  const [members, setMembers] = useState<VerifiedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchMembers = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-member", {
        body: { action: "list", tenant_id: tenantId, page, per_page: perPage },
      });
      if (error || data?.error) throw new Error(data?.error);
      setMembers(data.members || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Erro ao carregar membros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [tenantId, page]);

  const handleBackup = async (discordUserId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-member", {
        body: { action: "backup_roles", tenant_id: tenantId, discord_user_id: discordUserId },
      });
      if (error || data?.error) throw new Error(data?.error);
      toast.success(`Backup realizado: ${data.roles.length} cargos salvos`);
      fetchMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no backup");
    }
  };

  const handleRestore = async (discordUserId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-member", {
        body: { action: "restore_roles", tenant_id: tenantId, discord_user_id: discordUserId },
      });
      if (error || data?.error) throw new Error(data?.error);
      toast.success(`Restaurados ${data.restored}/${data.total} cargos`);
      fetchMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na restauração");
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold text-lg">Membros Verificados</h2>
        </div>
        <Badge variant="outline">{total} total</Badge>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          Nenhum membro verificado ainda
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
            >
              {member.discord_avatar ? (
                <img src={member.discord_avatar} alt="" className="h-9 w-9 rounded-full" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {(member.discord_username || "?")[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {member.nickname || member.discord_username || member.discord_user_id}
                </p>
                <p className="text-xs text-muted-foreground">
                  {member.roles_backup?.length || 0} cargos · Verificado{" "}
                  {formatDistanceToNow(new Date(member.verified_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Backup de cargos"
                  onClick={() => handleBackup(member.discord_user_id)}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Restaurar cargos"
                  onClick={() => handleRestore(member.discord_user_id)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
