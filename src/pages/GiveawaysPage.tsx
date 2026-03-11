import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Gift, Trophy, History, Plus, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import GiveawayCard from "@/components/giveaways/GiveawayCard";
import CreateGiveawayForm from "@/components/giveaways/CreateGiveawayForm";
import WinnersModal from "@/components/giveaways/WinnersModal";
import EditGiveawayModal from "@/components/giveaways/EditGiveawayModal";

interface Giveaway {
  id: string;
  title: string;
  description: string | null;
  prize: string;
  winners_count: number;
  ends_at: string;
  channel_id: string | null;
  require_role_id?: string | null;
  status: string;
  winners: any[];
  entries_count: number;
  created_at: string;
  embed_config?: any;
}

export default function GiveawaysPage() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("active");
  const [confirmAction, setConfirmAction] = useState<{ type: "draw" | "cancel" | "delete"; id: string; title?: string } | null>(null);
  const [winnersModal, setWinnersModal] = useState<{ title: string; winners: any[] } | null>(null);
  const [editGiveaway, setEditGiveaway] = useState<Giveaway | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: giveaways = [], isLoading } = useQuery<Giveaway[]>({
    queryKey: ["giveaways", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["giveaways", tenantId] });
  }, [queryClient, tenantId]);

  const activeGiveaways = giveaways.filter((g) => g.status === "active");
  const historyGiveaways = giveaways.filter((g) => g.status !== "active");

  const handleConfirm = async () => {
    if (!confirmAction || !tenantId) return;
    setActionLoading(true);
    try {
      const actionMap = { draw: "draw", cancel: "cancel", delete: "delete" };
      const { data, error } = await supabase.functions.invoke("manage-giveaways", {
        body: {
          action: actionMap[confirmAction.type],
          tenant_id: tenantId,
          giveaway_id: confirmAction.id,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro");

      if (confirmAction.type === "draw" && data?.winners?.length) {
        setWinnersModal({ title: data.title, winners: data.winners });
        toast({ title: "🎉 Sorteio realizado com sucesso!" });
      } else if (confirmAction.type === "delete") {
        toast({ title: "🗑️ Sorteio excluído" });
      } else if (confirmAction.type === "cancel") {
        toast({ title: "Sorteio cancelado" });
      }
      refetch();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const handleReroll = async (id: string) => {
    if (!tenantId) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "reroll", tenant_id: tenantId, giveaway_id: id, count: 1 },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro");
      toast({ title: "🎲 Re-sorteio realizado!" });
      refetch();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "ended") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Encerrado</Badge>;
    if (status === "canceled") return <Badge variant="destructive">Cancelado</Badge>;
    return <Badge>Ativo</Badge>;
  };

  const getConfirmTitle = () => {
    if (!confirmAction) return "";
    if (confirmAction.type === "draw") return "🎉 Sortear agora?";
    if (confirmAction.type === "cancel") return "Cancelar sorteio?";
    return "Excluir sorteio?";
  };

  const getConfirmDescription = () => {
    if (!confirmAction) return "";
    if (confirmAction.type === "draw") return "Os vencedores serão selecionados aleatoriamente e anunciados no Discord.";
    if (confirmAction.type === "cancel") return "O sorteio será cancelado. Você poderá ver no histórico.";
    return `O sorteio "${confirmAction.title}" será excluído permanentemente. Esta ação não pode ser desfeita.`;
  };

  const getConfirmLabel = () => {
    if (!confirmAction) return "";
    if (confirmAction.type === "draw") return "Sortear";
    if (confirmAction.type === "cancel") return "Cancelar sorteio";
    return "Excluir";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gift className="h-6 w-6 text-primary" /> Sorteios
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie sorteios integrados ao Discord</p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active" className="gap-1.5">
            <Gift className="h-4 w-4" /> Ativos ({activeGiveaways.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" /> Histórico ({historyGiveaways.length})
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-1.5">
            <Plus className="h-4 w-4" /> Criar Sorteio
          </TabsTrigger>
        </TabsList>

        {/* ATIVOS */}
        <TabsContent value="active">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : activeGiveaways.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Gift className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold text-foreground">Nenhum sorteio ativo</h3>
                <p className="text-muted-foreground text-sm mt-1 mb-4">Crie seu primeiro sorteio na aba "Criar Sorteio"</p>
                <Button onClick={() => setTab("create")}><Plus className="h-4 w-4 mr-1" /> Criar Sorteio</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeGiveaways.map((g) => (
                <GiveawayCard
                  key={g.id}
                  giveaway={g}
                  onDraw={(id) => setConfirmAction({ type: "draw", id })}
                  onCancel={(id) => setConfirmAction({ type: "cancel", id })}
                  onEdit={(giveaway) => setEditGiveaway(giveaway)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="history">
          {historyGiveaways.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <History className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold text-foreground">Sem histórico</h3>
                <p className="text-muted-foreground text-sm mt-1">Os sorteios encerrados aparecerão aqui</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Prêmio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Participantes</TableHead>
                    <TableHead>Vencedores</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyGiveaways.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.title}</TableCell>
                      <TableCell>{g.prize}</TableCell>
                      <TableCell>{statusBadge(g.status)}</TableCell>
                      <TableCell>{g.entries_count}</TableCell>
                      <TableCell>
                        {g.winners?.length > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setWinnersModal({ title: g.title, winners: g.winners })}
                          >
                            <Trophy className="h-4 w-4 mr-1 text-primary" /> {g.winners.length}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(g.ends_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {g.status === "ended" && (
                          <Button variant="outline" size="sm" onClick={() => handleReroll(g.id)} disabled={actionLoading}>
                            <RefreshCw className="h-4 w-4 mr-1" /> Re-sortear
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setConfirmAction({ type: "delete", id: g.id, title: g.title })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* CRIAR */}
        <TabsContent value="create">
          <Card>
            <CardContent className="pt-6">
              <CreateGiveawayForm onCreated={() => { refetch(); setTab("active"); }} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getConfirmTitle()}</AlertDialogTitle>
            <AlertDialogDescription>{getConfirmDescription()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={actionLoading}
              className={confirmAction?.type === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {getConfirmLabel()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Winners Modal */}
      {winnersModal && (
        <WinnersModal
          open={!!winnersModal}
          onOpenChange={() => setWinnersModal(null)}
          title={winnersModal.title}
          winners={winnersModal.winners}
        />
      )}

      {/* Edit Modal */}
      {editGiveaway && (
        <EditGiveawayModal
          open={!!editGiveaway}
          onOpenChange={(open) => !open && setEditGiveaway(null)}
          giveaway={editGiveaway}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
