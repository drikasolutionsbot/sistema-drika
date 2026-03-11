import { useState, useEffect } from "react";
import { Link2, Copy, Check, Users, Gift, Calendar, TrendingUp, DollarSign, Award, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";

interface ReferralStats {
  total_referrals: number;
  total_paid_referrals: number;
  total_bonus_days_earned: number;
  total_credits_earned: number;
  referrals: {
    id: string;
    name: string;
    plan: string;
    created_at: string;
  }[];
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const AffiliatesPage = () => {
  const { tenant, tenantId, refetch } = useTenant();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [config, setConfig] = useState<{ referral_bonus_days: number; referral_bonus_credits_cents: number } | null>(null);

  const isActive = tenant?.affiliate_active ?? false;

  useEffect(() => {
    if (!tenantId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: lcData } = await supabase
          .from("landing_config")
          .select("referral_bonus_days, referral_bonus_credits_cents")
          .limit(1)
          .single();
        if (lcData) setConfig(lcData as any);

        if (isActive) {
          const { data, error } = await supabase.functions.invoke("manage-affiliates", {
            body: { action: "referral_stats", tenant_id: tenantId },
          });
          if (error) throw error;
          setStats(data as ReferralStats);
        }
      } catch (e: any) {
        console.error("Error loading referral stats:", e);
      }
      setLoading(false);
    };

    fetchData();
  }, [tenantId, isActive]);

  const handleToggleAffiliate = async () => {
    if (!tenantId) return;
    setToggling(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-affiliates", {
        body: { action: "toggle_affiliate", tenant_id: tenantId },
      });
      if (error) throw error;
      toast({
        title: data.affiliate_active ? "Modo Afiliado ativado! 🎉" : "Modo Afiliado desativado",
        description: data.affiliate_active
          ? "Seu link de indicação foi gerado. Compartilhe e ganhe recompensas!"
          : "Você não receberá mais indicações.",
      });
      refetch();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setToggling(false);
  };

  const referralLink = tenant?.referral_code
    ? `${window.location.origin}?ref=${tenant.referral_code}`
    : null;

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Link copiado! 📋", description: referralLink });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Programa de Indicação
          </h1>
          <p className="text-muted-foreground text-sm">
            Indique novos clientes e ganhe dias extras + créditos no seu plano
          </p>
        </div>
      </div>

      {/* Activation Card */}
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <div className={`absolute top-0 left-0 right-0 h-1 ${isActive ? "bg-gradient-to-r from-primary to-violet-500" : "bg-muted"}`} />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isActive ? "gradient-pink" : "bg-muted"}`}>
                <Power className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Modo Afiliado</h2>
                <p className="text-xs text-muted-foreground">
                  {isActive
                    ? "Ativo — seu link de indicação está disponível"
                    : "Ative para gerar seu link de indicação e ganhar recompensas"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                {isActive ? "Ativo" : "Inativo"}
              </span>
              <Switch
                checked={isActive}
                onCheckedChange={handleToggleAffiliate}
                disabled={toggling}
              />
            </div>
          </div>

          {/* Rewards info */}
          {config && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  +{config.referral_bonus_days} dias por indicação Pro
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  +{formatBRL(config.referral_bonus_credits_cents)} em créditos
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Only show content when affiliate mode is active */}
      {!isActive ? (
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Gift className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Ative o Modo Afiliado</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mt-1">
                Ao ativar, você receberá um link exclusivo de indicação. Quando alguém se cadastrar pelo seu link
                e assinar o plano Pro, você ganha dias extras e créditos!
              </p>
            </div>
            <Button
              onClick={handleToggleAffiliate}
              disabled={toggling}
              className="gradient-pink text-primary-foreground border-none hover:opacity-90 mt-2"
            >
              <Power className="h-4 w-4 mr-2" />
              {toggling ? "Ativando..." : "Ativar Agora"}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Referral Link */}
          <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Seu Link de Indicação</h3>
                  <p className="text-xs text-muted-foreground">Compartilhe com amigos e ganhe recompensas</p>
                </div>
              </div>

              {referralLink ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 rounded-xl bg-muted/20 border border-border/50 px-4 py-3">
                    <Link2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm font-mono text-muted-foreground truncate flex-1">
                      {referralLink}
                    </span>
                  </div>
                  <Button
                    onClick={copyLink}
                    className="gradient-pink text-primary-foreground border-none hover:opacity-90 h-12 px-6"
                  >
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
              ) : (
                <Skeleton className="h-12 rounded-xl" />
              )}
            </div>
          </Card>

          {/* Stats */}
          {loading ? (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="p-4 space-y-2 border-border/50 bg-card/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Indicações</span>
                  </div>
                  <p className="text-2xl font-bold font-display">{stats?.total_referrals ?? 0}</p>
                </Card>
                <Card className="p-4 space-y-2 border-border/50 bg-card/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs text-muted-foreground">Convertidas (Pro)</span>
                  </div>
                  <p className="text-2xl font-bold font-display">{stats?.total_paid_referrals ?? 0}</p>
                </Card>
                <Card className="p-4 space-y-2 border-border/50 bg-card/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-400" />
                    <span className="text-xs text-muted-foreground">Dias Ganhos</span>
                  </div>
                  <p className="text-2xl font-bold font-display">{stats?.total_bonus_days_earned ?? 0}</p>
                </Card>
                <Card className="p-4 space-y-2 border-border/50 bg-card/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Créditos Acumulados</span>
                  </div>
                  <p className="text-2xl font-bold font-display text-primary">
                    {formatBRL(tenant?.referral_credits_cents ?? 0)}
                  </p>
                </Card>
              </div>

              {/* Referrals list */}
              <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
                <div className="p-4 border-b border-border/50">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" /> Suas Indicações
                  </h3>
                </div>
                <div className="p-4">
                  {!stats?.referrals?.length ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                        <Gift className="h-7 w-7 text-primary" />
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Nenhuma indicação ainda. Compartilhe seu link!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stats.referrals.map((ref) => (
                        <div
                          key={ref.id}
                          className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/10 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{ref.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(ref.created_at).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={ref.plan === "pro" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {ref.plan === "pro" ? "Pro ✅" : ref.plan === "free" ? "Trial" : ref.plan}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AffiliatesPage;
