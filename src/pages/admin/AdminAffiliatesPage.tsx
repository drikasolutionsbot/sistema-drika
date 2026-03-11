import { useState, useEffect, useCallback } from "react";
import {
  Users, Settings, TrendingUp, DollarSign, Calendar, Gift, Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AffiliateOverview from "@/components/affiliates/AffiliateOverview";
import AffiliateList from "@/components/affiliates/AffiliateList";
import AffiliatePayouts from "@/components/affiliates/AffiliatePayouts";
import type { Affiliate, AffiliateOrder, AffiliatePayout } from "@/components/affiliates/types";

const AdminAffiliatesPage = () => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [orders, setOrders] = useState<AffiliateOrder[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [config, setConfig] = useState({ referral_bonus_days: 7, referral_bonus_credits_cents: 500 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [globalRes, configRes] = await Promise.all([
        supabase.functions.invoke("manage-affiliates", {
          body: { action: "admin_global", tenant_id: "_admin" },
        }),
        supabase
          .from("landing_config")
          .select("referral_bonus_days, referral_bonus_credits_cents")
          .limit(1)
          .single(),
      ]);

      if (!globalRes.error && globalRes.data) {
        setAffiliates(globalRes.data.affiliates ?? []);
        setOrders(globalRes.data.orders ?? []);
        setPayouts(globalRes.data.payouts ?? []);
      }

      if (configRes.data) setConfig(configRes.data as any);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      const { error } = await supabase
        .from("landing_config")
        .update({
          referral_bonus_days: config.referral_bonus_days,
          referral_bonus_credits_cents: config.referral_bonus_credits_cents,
        })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      toast({ title: "Configuração salva ✅" });
      setConfigOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setConfigSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Programa de Afiliados
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie todos os afiliados de todas as lojas</p>
        </div>
        <Button variant="outline" onClick={() => setConfigOpen(true)} className="gap-2">
          <Settings className="h-4 w-4" /> Configurar Premiação
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/30 backdrop-blur-sm border border-border/50">
          <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:bg-primary/10">
            <TrendingUp className="h-4 w-4" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5 data-[state=active]:bg-primary/10">
            <Users className="h-4 w-4" /> Afiliados
          </TabsTrigger>
          <TabsTrigger value="payouts" className="gap-1.5 data-[state=active]:bg-primary/10">
            <DollarSign className="h-4 w-4" /> Pagamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AffiliateOverview
            affiliates={affiliates}
            orders={orders}
            payouts={payouts}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="list">
          <AffiliateList
            affiliates={affiliates}
            loading={loading}
            tenantId={null}
            onRefresh={fetchData}
            adminMode
          />
        </TabsContent>

        <TabsContent value="payouts">
          <AffiliatePayouts
            affiliates={affiliates}
            tenantId={null}
            payouts={payouts}
            onRefresh={fetchData}
            adminMode
          />
        </TabsContent>
      </Tabs>

      {/* Config modal */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" /> Configurar Premiação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dias bônus por indicação Pro paga</Label>
              <Input
                type="number"
                min={0}
                value={config.referral_bonus_days}
                onChange={(e) => setConfig({ ...config, referral_bonus_days: Number(e.target.value) })}
              />
              <p className="text-[11px] text-muted-foreground">
                Dias adicionados ao plano Pro do afiliado quando o indicado pagar
              </p>
            </div>
            <div className="space-y-2">
              <Label>Créditos por indicação (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={(config.referral_bonus_credits_cents / 100).toFixed(2)}
                onChange={(e) => setConfig({ ...config, referral_bonus_credits_cents: Math.round(Number(e.target.value) * 100) })}
              />
              <p className="text-[11px] text-muted-foreground">
                Créditos internos adicionados ao saldo do afiliado
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
            <Button onClick={saveConfig} disabled={configSaving} className="gradient-pink text-primary-foreground border-none">
              {configSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAffiliatesPage;
