import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users, Search, Settings, TrendingUp, DollarSign, Calendar, Gift, Link2, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

interface Referral {
  id: string;
  name: string;
  plan: string;
  referral_code: string | null;
  referral_credits_cents: number;
  created_at: string;
  referred_by_tenant_id: string | null;
}

const AdminAffiliatesPage = () => {
  const [tenants, setTenants] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [config, setConfig] = useState({ referral_bonus_days: 7, referral_bonus_credits_cents: 500 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantsRes, configRes] = await Promise.all([
        supabase
          .from("tenants")
          .select("id, name, plan, referral_code, referral_credits_cents, created_at, referred_by_tenant_id")
          .order("created_at", { ascending: false }),
        supabase
          .from("landing_config")
          .select("referral_bonus_days, referral_bonus_credits_cents")
          .limit(1)
          .single(),
      ]);
      if (tenantsRes.data) setTenants(tenantsRes.data as Referral[]);
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
        .neq("id", "00000000-0000-0000-0000-000000000000"); // update all rows
      if (error) throw error;
      toast({ title: "Configuração salva ✅" });
      setConfigOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setConfigSaving(false);
  };

  // Build referral tree
  const tenantMap = useMemo(() => {
    const m: Record<string, Referral> = {};
    tenants.forEach(t => { m[t.id] = t; });
    return m;
  }, [tenants]);

  const getReferrerName = (id: string | null) => {
    if (!id) return null;
    return tenantMap[id]?.name ?? "Desconhecido";
  };

  const tenantsWithReferrals = useMemo(() => {
    const counts: Record<string, number> = {};
    tenants.forEach(t => {
      if (t.referred_by_tenant_id) {
        counts[t.referred_by_tenant_id] = (counts[t.referred_by_tenant_id] || 0) + 1;
      }
    });
    return counts;
  }, [tenants]);

  const totalReferrals = tenants.filter(t => t.referred_by_tenant_id).length;
  const totalCreditsDistributed = tenants.reduce((s, t) => s + t.referral_credits_cents, 0);

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.referral_code && t.referral_code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Programa de Afiliados
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie o programa de indicação global</p>
        </div>
        <Button variant="outline" onClick={() => setConfigOpen(true)} className="gap-2">
          <Settings className="h-4 w-4" /> Configurar Premiação
        </Button>
      </div>

      {/* Global stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 space-y-1 border-border/50 bg-card/60">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Clientes</span>
          </div>
          <p className="text-2xl font-bold">{tenants.length}</p>
        </Card>
        <Card className="p-4 space-y-1 border-border/50 bg-card/60">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Indicações</span>
          </div>
          <p className="text-2xl font-bold">{totalReferrals}</p>
        </Card>
        <Card className="p-4 space-y-1 border-border/50 bg-card/60">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-muted-foreground">Dias Bônus/Indicação</span>
          </div>
          <p className="text-2xl font-bold">+{config.referral_bonus_days}d</p>
        </Card>
        <Card className="p-4 space-y-1 border-border/50 bg-card/60">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Créditos Distribuídos</span>
          </div>
          <p className="text-2xl font-bold text-primary">{formatBRL(totalCreditsDistributed)}</p>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tenants list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const referralCount = tenantsWithReferrals[t.id] ?? 0;
            const referrerName = getReferrerName(t.referred_by_tenant_id);
            return (
              <div key={t.id} className="flex items-center gap-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{t.name}</p>
                    <Badge variant={t.plan === "pro" ? "default" : "secondary"} className="text-[10px]">
                      {t.plan}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {t.referral_code && (
                      <span className="font-mono">REF: {t.referral_code}</span>
                    )}
                    {referrerName && (
                      <span>Indicado por: <strong>{referrerName}</strong></span>
                    )}
                    <span>{new Date(t.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="text-center shrink-0">
                  <p className="text-sm font-bold">{referralCount}</p>
                  <p className="text-[10px] text-muted-foreground">indicações</p>
                </div>
                <div className="text-center shrink-0">
                  <p className="text-sm font-bold text-primary">{formatBRL(t.referral_credits_cents)}</p>
                  <p className="text-[10px] text-muted-foreground">créditos</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
