import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useTenant } from "@/contexts/TenantContext";
import PlanExpiredPage from "@/pages/PlanExpiredPage";
import ProUpgradeModal from "@/components/ProUpgradeModal";
import WalletAnnouncementModal from "@/components/WalletAnnouncementModal";
import FreePlanLock from "@/components/FreePlanLock";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { isPaidPlan } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Rotas liberadas no plano Free.
 * Tudo o que NÃO estiver aqui mostra o overlay de upgrade.
 */
const FREE_ALLOWED_ROUTES = new Set<string>([
  "/dashboard",
  "/settings",
  "/finance",
  "/wallet",
  "/support",
  "/tutorials",
  "/onboarding",
  "/approvals",
]);

const FREE_LOCK_LABELS: Record<string, string> = {
  "/store": "Loja",
  "/marketplace": "Marketplace",
  "/channels": "Canais",
  "/coupons": "Cupons",
  "/payments": "Pagamentos",
  "/tickets": "Tickets",
  "/customization": "Personalização",
  "/bot-customization": "Personalização do Bot",
  "/resources": "Recursos do Bot",
  "/roles": "Cargos",
  "/welcome": "Boas-vindas",
  "/automations": "Automações",
  "/protection": "Proteção",
  "/verification": "Verificação",
  "/verified-members": "Membros Verificados",
  "/ecloud": "eCloud",
  "/giveaways": "Sorteios",
  "/embeds": "Embeds",
  "/dm-templates": "Templates de DM",
  "/ai-assistant": "Assistente IA",
};

export const DashboardLayout = () => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { tenant, isSystemFree, planAccess } = useTenant();
  const isMobile = useIsMobile();
  const [allowCustomization, setAllowCustomization] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from("landing_config")
        .select("allow_customization_on_trial")
        .limit(1)
        .single();
      if (data) {
        setAllowCustomization(data.allow_customization_on_trial || false);
      }
      setLoadingConfig(false);
    };
    fetchConfig();
  }, []);

  // No novo modelo de negócio:
  // - Venceu: ganha 2 dias de tolerância com gateways ativas e taxas 0%
  // - Passou de 2 dias sem renovar: gateways somem e a loja opera no modo Free (Split + Taxas + Carteira)
  // O painel nunca é travado com tela preta de PlanExpiredPage; o cliente opera normalmente em modo Free.
  const path = location.pathname;
  const isFree = !isSystemFree && (planAccess.isFree || planAccess.isGraceExpired);
  
  let isLockedRoute = !FREE_ALLOWED_ROUTES.has(path);
  
  if (isSystemFree) {
    isLockedRoute = false;
  } else if (isFree && allowCustomization) {
    isLockedRoute = false;
  }

  const showFreeLock = isFree && isLockedRoute;
  const lockLabel = FREE_LOCK_LABELS[path];

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  return (
    <>
      <ProUpgradeModal />
      <WalletAnnouncementModal />
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        </div>

        {/* Mobile sidebar drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-60 border-r-0 [&>button]:hidden">
            <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar onToggleSidebar={toggleSidebar} />

          {/* Banner de Tolerância de 2 Dias (48 horas) */}
          {planAccess.isInGracePeriod && (
            <div className="mx-4 mt-3 md:mx-6 p-3.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-black/40 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-400 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    Plano Expirado — Período de Tolerância ({planAccess.graceHoursRemaining}h restantes)
                  </p>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    Suas gateways próprias continuam ativas por 2 dias. Renove agora para continuar recebendo direto na sua conta com 0% de taxas!
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold shrink-0 text-xs px-3.5 py-1.5 h-8 shadow-md"
                onClick={() => {
                  sessionStorage.setItem("open_upgrade_modal", "true");
                  window.dispatchEvent(new Event("storage"));
                }}
              >
                Renovar Plano
              </Button>
            </div>
          )}

          {/* Banner de Plano Expirado há mais de 2 dias (Modo Free / Split Ativo) */}
          {planAccess.isGraceExpired && (
            <div className="mx-4 mt-3 md:mx-6 p-3.5 rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-[#07152b] to-black/40 text-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-500/20 border border-sky-500/30 shrink-0">
                  <Info className="h-5 w-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Sua loja está operando no Modo Free (Split & Carteira)
                  </p>
                  <p className="text-xs text-sky-200/80 leading-relaxed">
                    O período de tolerância de 2 dias terminou. Suas vendas agora entram pela Gateway Central com taxas e liquidação na sua Carteira. Assine um plano pago para reativar suas gateways e ter taxa zero!
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-sky-500 hover:bg-sky-600 text-black font-bold shrink-0 text-xs px-3.5 py-1.5 h-8 shadow-md"
                onClick={() => {
                  sessionStorage.setItem("open_upgrade_modal", "true");
                  window.dispatchEvent(new Event("storage"));
                }}
              >
                Fazer Upgrade
              </Button>
            </div>
          )}
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <ErrorBoundary key={location.pathname}>
              {isFree && loadingConfig ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : showFreeLock ? (
                <FreePlanLock feature={lockLabel} />
              ) : (
                <Outlet />
              )}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </>
  );
};
