import { useEffect, useState } from "react";
import { ShieldOff, Loader2, QrCode, Crown, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";
import { useLanguage } from "@/i18n/LanguageContext";

type PlanKey = "pro" | "master";

const PlanExpiredPage = () => {
  const { tenant, refetch } = useTenant();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
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
    })();
  }, []);

  const handleRenew = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-subscription-pix", {
        body: { tenant_id: tenant.id, plan: selectedPlan },
      });
      if (error || data?.error) throw new Error(data?.error || "Error");
      setPixData({ brcode: data.brcode, amount_cents: data.amount_cents });
    } catch (err: any) {
      toast.error(err.message || t.login.error);
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

  const planLabel = tenant?.plan === "master"
    ? pricing.masterName
    : tenant?.plan === "pro"
      ? pricing.proName
      : t.plan.free;

  const formatPrice = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden login-pattern-bg">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10" />
      <div className="relative z-20 w-full max-w-md mx-4 animate-fade-in">
        <div className="rounded-3xl border border-destructive/20 bg-[#1a1a2e]/95 backdrop-blur-xl p-8 shadow-[0_0_60px_rgba(255,40,73,0.15)] text-center">
          <img src={drikaLogo} alt="Drika Solutions" className="h-20 w-auto mx-auto mb-6 drop-shadow-[0_0_20px_hsl(330_100%_71%/0.4)]" />

          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-destructive/20 border-2 border-destructive/40 flex items-center justify-center">
              <ShieldOff className="h-8 w-8 text-destructive" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            {tenant?.plan === "pro" || tenant?.plan === "master" ? t.plan.planExpired : t.plan.trialEnded}
          </h1>
          <p className="text-white/60 text-sm mb-6">
            <span className="text-primary font-semibold">{planLabel}</span> {t.plan.planExpiredDesc}
          </p>

          {pixData ? (
            <div className="space-y-4 mb-6">
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
              <Button onClick={() => refetch()} variant="ghost" className="w-full text-white/60 text-xs">
                {t.plan.alreadyPaid}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {/* Seletor de plano */}
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
                disabled={loading}
                className={`w-full h-11 rounded-full text-white font-medium ${
                  selectedPlan === "master"
                    ? "bg-gradient-to-r from-amber-500 to-amber-400 hover:opacity-90 text-black"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Renovar {selectedPlan === "master" ? pricing.masterName : pricing.proName} via PIX
              </Button>

              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-white/80 text-sm">
                  {t.plan.contactSupport}
                </p>
              </div>
            </div>
          )}

          <a
            href="https://wa.me/5548996915303"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-base tracking-wide cursor-pointer border-none transition-colors"
          >
            {t.plan.whatsappSupport}
          </a>
        </div>
      </div>
    </div>
  );
};

export default PlanExpiredPage;
