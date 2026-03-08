import { useState, useEffect } from "react";
import { Link2, Trophy, Users, Hash, Clock, ExternalLink, RefreshCw, Crown, Medal, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InviteDetail {
  code: string;
  uses: number;
  max_uses: number | null;
  channel: string | null;
  created_at: string;
  expires_at: string | null;
  temporary: boolean;
}

interface Inviter {
  id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  total_uses: number;
  invites: InviteDetail[];
}

const rankIcons = [
  <Crown key="1" className="h-5 w-5 text-yellow-500" />,
  <Medal key="2" className="h-5 w-5 text-gray-400" />,
  <Award key="3" className="h-5 w-5 text-amber-600" />,
];

const InviteTrackingPage = () => {
  const { tenantId } = useTenant();
  const [inviters, setInviters] = useState<Inviter[]>([]);
  const [totalInvites, setTotalInvites] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const fetchInvites = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-guild-invites", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInviters(data.inviters || []);
      setTotalInvites(data.total_invites || 0);
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar convites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, [tenantId]);

  const topThree = inviters.slice(0, 3);
  const rest = inviters.slice(3);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold">Rastreamento de Convites</h1>
            <p className="text-muted-foreground text-sm">
              Acompanhe quem está convidando membros para o servidor
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            <Users className="mr-1 h-3.5 w-3.5" />
            {totalInvites} convites ativos
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchInvites} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : inviters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Link2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">Nenhum convite encontrado</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm">
            O servidor ainda não possui convites ativos ou o bot não tem permissão para visualizá-los.
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {topThree.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {topThree.map((inv, idx) => (
                <div
                  key={inv.id}
                  className={`relative rounded-xl border bg-card p-5 transition-all hover:shadow-md ${
                    idx === 0
                      ? "border-yellow-500/40 shadow-[0_0_15px_-5px_hsl(var(--primary)/0.3)]"
                      : "border-border"
                  }`}
                >
                  <div className="absolute top-3 right-3">{rankIcons[idx]}</div>
                  <div className="flex items-center gap-3 mb-3">
                    {inv.avatar ? (
                      <img
                        src={inv.avatar}
                        alt={inv.display_name}
                        className="h-11 w-11 rounded-full ring-2 ring-border"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground font-bold text-lg">
                        {inv.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{inv.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">@{inv.username}</p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-display font-bold">{inv.total_uses}</p>
                      <p className="text-xs text-muted-foreground">convites usados</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {inv.invites.length} link{inv.invites.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Full Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="text-center">Convites Usados</TableHead>
                  <TableHead className="text-center">Links Ativos</TableHead>
                  <TableHead className="text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviters.map((inv, idx) => (
                  <>
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedUser(expandedUser === inv.id ? null : inv.id)}
                    >
                      <TableCell className="font-mono text-muted-foreground text-sm">
                        {idx < 3 ? rankIcons[idx] : idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {inv.avatar ? (
                            <img src={inv.avatar} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                              {inv.display_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{inv.display_name}</p>
                            <p className="text-xs text-muted-foreground">@{inv.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-display font-bold text-lg">{inv.total_uses}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{inv.invites.length}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedUser === inv.id && (
                      <TableRow key={`${inv.id}-details`}>
                        <TableCell colSpan={5} className="bg-muted/20 p-0">
                          <div className="p-4 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Links de Convite
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {inv.invites.map((link) => (
                                <div
                                  key={link.code}
                                  className="rounded-lg border bg-card p-3 text-sm space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <code className="text-xs font-mono text-primary">
                                      discord.gg/{link.code}
                                    </code>
                                    {link.temporary && (
                                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                        Temporário
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {link.uses}{link.max_uses ? `/${link.max_uses}` : ""} usos
                                    </span>
                                    {link.channel && (
                                      <span className="flex items-center gap-1">
                                        <Hash className="h-3 w-3" />
                                        {link.channel}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    Criado em {format(new Date(link.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default InviteTrackingPage;
