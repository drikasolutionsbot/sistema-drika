import { useState, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, History, PlusCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import GiveawayCard from "@/components/giveaways/GiveawayCard";
import CreateGiveawayForm from "@/components/giveaways/CreateGiveawayForm";
import EditGiveawayModal from "@/components/giveaways/EditGiveawayModal";
import WinnersModal from "@/components/giveaways/WinnersModal";

export default function GiveawaysPage() {
  const { tenantId } = useTenant();
  const [editGiveaway, setEditGiveaway] = useState<any>(null);
  const [winnersModal, setWinnersModal] = useState<{ open: boolean; title: string; winners: any[] }>({ open: false, title: "", winners: [] });

  const { data: giveaways = [], isLoading, refetch } = useQuery({
    queryKey: ["giveaways", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error) throw error;
      return Array.isArray(data) ? data : (data?.giveaways || []);
    },
    enabled: !!tenantId,
  });

  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!tenantId) return;
    supabase.functions.invoke("discord-channels", { body: { tenant_id: tenantId } })
      .then(({ data }) => { if (data?.channels) setChannels(data.channels); })
      .catch(console.error);
  }, [tenantId]);

  const activeGiveaways = giveaways.filter((g: any) => g.status === "active");
  const historyGiveaways = giveaways.filter((g: any) => g.status !== "active");

  const handleDraw = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "draw", tenant_id: tenantId, giveaway_id: id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const winners = data?.winners || [];
      const giveaway = giveaways.find((g: any) => g.id === id);
      setWinnersModal({ open: true, title: giveaway?.title || "Sorteio", winners });
      toast({ title: "🎉 Sorteio realizado!", description: `${winners.length} ganhador(es) sorteado(s)` });
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao sortear", description: err.message, variant: "destructive" });
    }
  }, [tenantId, giveaways, refetch]);

  const handleCancel = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "cancel", tenant_id: tenantId, giveaway_id: id },
      });
      if (error) throw error;
      toast({ title: "Sorteio cancelado" });
      refetch();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  }, [tenantId, refetch]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este sorteio? Isso não pode ser desfeito.")) return;
    try {
      const { error } = await supabase.functions.invoke("manage-giveaways", {
        body: { action: "delete", tenant_id: tenantId, giveaway_id: id },
      });
      if (error) throw error;
      toast({ title: "Sorteio excluído" });
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  }, [tenantId, refetch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sorteios</h1>
        <p className="text-sm text-muted-foreground">Gerencie sorteios no seu servidor Discord</p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="bg-muted/50 border border-border w-max min-w-full sm:w-auto">
            <TabsTrigger value="active" className="gap-2 text-xs sm:text-sm"><Gift className="h-4 w-4" />Ativos</TabsTrigger>
            <TabsTrigger value="history" className="gap-2 text-xs sm:text-sm"><History className="h-4 w-4" />Histórico</TabsTrigger>
            <TabsTrigger value="create" className="gap-2 text-xs sm:text-sm"><PlusCircle className="h-4 w-4" />Criar</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="active" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : activeGiveaways.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum sorteio ativo</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeGiveaways.map((g: any) => {
                const cName = channels.find(c => c.id === g.channel_id)?.name;
                return (
                  <GiveawayCard key={g.id} giveaway={g} onDraw={handleDraw} onCancel={handleCancel} onDelete={handleDelete} onEdit={setEditGiveaway} channelName={cName ? `#${cName}` : undefined} />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {historyGiveaways.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum sorteio no histórico</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {historyGiveaways.map((g: any) => {
                const cName = channels.find(c => c.id === g.channel_id)?.name;
                return (
                  <GiveawayCard key={g.id} giveaway={g} onDraw={handleDraw} onCancel={handleCancel} onDelete={handleDelete} onEdit={setEditGiveaway} channelName={cName ? `#${cName}` : undefined} />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="create" className="mt-4">
          <CreateGiveawayForm onCreated={refetch} />
        </TabsContent>
      </Tabs>

      {editGiveaway && (
        <EditGiveawayModal
          open={!!editGiveaway}
          onOpenChange={(open) => { if (!open) setEditGiveaway(null); }}
          giveaway={editGiveaway}
          onSaved={refetch}
        />
      )}

      <WinnersModal
        open={winnersModal.open}
        onOpenChange={(open) => setWinnersModal((prev) => ({ ...prev, open }))}
        title={winnersModal.title}
        winners={winnersModal.winners}
      />
    </div>
  );
}
