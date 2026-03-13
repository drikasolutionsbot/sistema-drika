import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Users, UserX, UserCheck, Loader2, MoreHorizontal, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VerifiedMember {
  id: string;
  discord_user_id: string;
  discord_username: string | null;
  discord_avatar: string | null;
  verified_at: string;
}

const formatTimeAgo = (date: string) => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min${mins > 1 ? "s" : ""}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} hora${hours > 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} dia${days > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  return `há ${months} ${months > 1 ? "meses" : "mês"}`;
};

const getAvatarUrl = (userId: string, avatar: string | null) => {
  if (!avatar) return null;
  // If already a full URL, use it directly
  if (avatar.startsWith("http")) return avatar;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64`;
};

const VerifiedMembersPage = () => {
  const { tenantId, tenant } = useTenant();
  const navigate = useNavigate();
  const [members, setMembers] = useState<VerifiedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState("username");
  const [deleting, setDeleting] = useState<string | null>(null);

  const serverName = tenant?.name || "Servidor";

  const fetchMembers = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("verified_members" as any)
        .select("id, discord_user_id, discord_username, discord_avatar, verified_at")
        .eq("tenant_id", tenantId)
        .order("verified_at", { ascending: false });
      if (error) throw error;
      setMembers((data as any[]) || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar membros verificados");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleDelete = async (member: VerifiedMember) => {
    if (!tenantId) return;
    setDeleting(member.id);
    try {
      const { error } = await supabase
        .from("verified_members" as any)
        .delete()
        .eq("id", member.id);
      if (error) throw error;
      setMembers(prev => prev.filter(m => m.id !== member.id));
      toast.success(`${member.discord_username || member.discord_user_id} removido`);
    } catch (e: any) {
      toast.error("Erro ao remover: " + e.message);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = members.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (searchType === "username") return (m.discord_username || "").toLowerCase().includes(q);
    return m.discord_user_id.includes(q);
  });

  const totalMembers = members.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/customization")} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Membros Verificados</h1>
              <p className="text-sm text-muted-foreground">Visualize e gerencie dados de membros verificados.</p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMembers} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-sidebar border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Membros Verificados</p>
              <p className="text-2xl font-bold mt-1">{totalMembers.toLocaleString("pt-BR")}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-sidebar border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Não Autorizados</p>
              <p className="text-2xl font-bold mt-1">0</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <UserX className="h-5 w-5 text-destructive" />
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-sidebar border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total de Membros</p>
              <p className="text-2xl font-bold mt-1">{totalMembers.toLocaleString("pt-BR")}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4 bg-sidebar border-border/50">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Pesquisar</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar membros..."
                className="pl-9 bg-background"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Tipo de Pesquisa</p>
            <Select value={searchType} onValueChange={setSearchType}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="username">Nome de Usuário</SelectItem>
                <SelectItem value="id">ID do Discord</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Servidor</p>
            <Select defaultValue="all">
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Members List */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-bold">Lista de Membros</h2>
          <p className="text-xs text-muted-foreground">Todos os membros que correspondem aos seus critérios de pesquisa.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 bg-sidebar border-border/50 text-center">
            <UserCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "Nenhum membro encontrado." : "Nenhum membro verificado ainda."}
            </p>
          </Card>
        ) : (
          <Card className="bg-sidebar border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-muted-foreground">Nome de Usuário</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Servidor</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Verificado</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground w-[60px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((member) => (
                  <TableRow key={member.id} className="border-border/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {getAvatarUrl(member.discord_user_id, member.discord_avatar) ? (
                            <img
                              src={getAvatarUrl(member.discord_user_id, member.discord_avatar)!}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-muted-foreground">
                              {(member.discord_username || "?").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-sm">@{member.discord_username || member.discord_user_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-primary underline cursor-default">{serverName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{formatTimeAgo(member.verified_at)}</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDelete(member)}
                            disabled={deleting === member.id}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover verificação
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VerifiedMembersPage;
