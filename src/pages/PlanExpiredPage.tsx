import { useEffect, useState } from "react";
import { Lock, Loader2, QrCode, Crown, Sparkles, Check, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";
import { useLanguage } from "@/i18n/LanguageContext";

type PlanKey = "pro" | "master";

const PlanExpiredPage = () => {
  const { tenant, refetch } = useTenant();
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("pro");
  const [pixData, setPixData] = useState<{ brcode: string; amount_cents: number } | null>(null);
  const [pricing, setPricing] = useState<{ pro: number; master: number; proName: string; masterName: string }>({
    pro: 2690,
    master: 3090,
    proName: "Pro",
    masterName: "Master",
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("landing_config")
          .select("pro_price_cents, master_price_cents, pro_plan_name, master_plan_name")
          .maybeSingle();
        if (data) {
          setPricing({
            pro: data.pro_price_cents ?? 2690,
            master: data.master_price_cents ?? 3090,
            proName: data.pro_plan_name || "Pro",
            masterName: data.master_plan_name || "Master",
          });
        }
      } catch {
        // silencioso — mantém valores default. Nunca derruba o overlay.
      }
    })();
  }, []);

  const handleRenew = async () => {
    if (!tenant) {
      toast.error("Sessão indisponível. Atualize a página.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-subscription-pix", {
        body: { tenant_id: tenant.id, plan: selectedPlan },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Erro ao gerar PIX");
      setPixData({ brcode: data.brcode, amount_cents: data.amount_cents });
    } catch (err: any) {
      toast.error(err.message || "Não foi possível gerar o PIX");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (pixData?.brcode) {
      navigator.clipboard.writeText(pixData.brcode);
      toast.success(t.common.copied);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast.success("Status atualizado");
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("token_session");
    try { await signOut(); } catch {}
    window.location.href = "/login";
  };

  const planLabel = tenant?.plan === "master"
    ? pricing.masterName
    : tenant?.plan === "pro"
      ? pricing.proName
      : t.plan.free;

  const formatPrice = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-y-auto login-pattern-bg">
      {/* Backdrop blur — efeito "cadeado sobre o painel" */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-md mx-4 my-8 animate-fade-in">
        <div className="rounded-3xl border border-destructive/30 bg-[#1a1a2e]/95 backdrop-blur-xl p-6 sm:p-8 shadow-[0_0_80px_rgba(255,40,73,0.25)] text-center">
          <img src={drikaLogo} alt="Drika Solutions" className="h-16 sm:h-20 w-auto mx-auto mb-5 drop-shadow-[0_0_20px_hsl(330_100%_71%/0.4)]" />

          {/* Cadeado animado */}
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-destructive/30 blur-xl animate-pulse" />
              <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-destructive/40 to-destructive/10 border-2 border-destructive/50 flex items-center justify-center">
                <Lock className="h-10 w-10 text-destructive" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
            🔒 Painel bloqueado
          </h1>
          <p className="text-white/70 text-sm mb-1">
            {tenant?.plan === "pro" || tenant?.plan === "master" ? t.plan.planExpired : t.plan.trialEnded}
          </p>
          <p className="text-white/50 text-xs mb-5">
            Plano atual: <span className="text-primary font-semibold">{planLabel}</span> — Para liberar o painel, escolha um plano abaixo.
          </p>

          {pixData ? (
            <div className="space-y-4 mb-4">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-white/80 text-xs mb-2">{t.plan.copyPixDesc}</p>
                <div className="bg-black/30 rounded-lg p-3 break-all text-xs text-white/90 font-mono max-h-24 overflow-y-auto">
                  {pixData.brcode}
                </div>
                <p className="text-primary text-sm font-semibold mt-2">
                  {formatPrice(pixData.amount_cents)}
                </p>
              </div>
              <Button onClick={handleCopyPix} className="w-full rounded-full" variant="outline">
                <QrCode className="h-4 w-4 mr-2" />
                {t.plan.copyPix}
              </Button>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="ghost"
                className="w-full text-white/70 text-xs hover:text-white"
              >
                {refreshing ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <RefreshCw className="h-3 w-3 mr-2" />}
                {t.plan.alreadyPaid}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Escolha seu plano</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlan("pro")}
                  className={`relative rounded-xl border p-3 text-left transition-all ${
                    selectedPlan === "pro"
                      ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  {selectedPlan === "pro" && (
                    <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                  <Sparkles className="h-4 w-4 text-primary mb-1" />
                  <p className="text-white font-semibold text-sm">{pricing.proName}</p>
                  <p className="text-white/60 text-[11px] mt-0.5">{formatPrice(pricing.pro)}/mês</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan("master")}
                  className={`relative rounded-xl border p-3 text-left transition-all ${
                    selectedPlan === "master"
                      ? "border-amber-400 bg-amber-400/10 ring-2 ring-amber-400/40"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  {selectedPlan === "master" && (
                    <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-amber-400 flex items-center justify-center">
                      <Check className="h-3 w-3 text-black" />
                    </span>
                  )}
                  <Crown className="h-4 w-4 text-amber-400 mb-1" />
                  <p className="text-white font-semibold text-sm">{pricing.masterName}</p>
                  <p className="text-white/60 text-[11px] mt-0.5">{formatPrice(pricing.master)}/mês</p>
                </button>
              </div>

              <Button
                onClick={handleRenew}
                disabled={loading || !tenant}
                className={`w-full h-11 rounded-full text-white font-medium ${
                  selectedPlan === "master"
                    ? "bg-gradient-to-r from-amber-500 to-amber-400 hover:opacity-90 text-black"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Renovar {selectedPlan === "master" ? pricing.masterName : pricing.proName} via PIX
              </Button>

              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="ghost"
                className="w-full text-white/60 text-xs hover:text-white"
              >
                {refreshing ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <RefreshCw className="h-3 w-3 mr-2" />}
                Já paguei — atualizar status
              </Button>
            </div>
          )}

          <a
            href="https://wa.me/5548996915303"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm tracking-wide cursor-pointer border-none transition-colors mb-2"
          >
            {t.plan.whatsappSupport}
          </a>

          <button
            onClick={handleLogout}
            className="w-full text-white/40 hover:text-white/70 text-xs flex items-center justify-center gap-1.5 py-2 transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanExpiredPage;
