import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useTenant } from "@/contexts/TenantContext";
import PlanExpiredPage from "@/pages/PlanExpiredPage";
import ProUpgradeModal from "@/components/ProUpgradeModal";
import FreePlanLock from "@/components/FreePlanLock";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { isPaidPlan } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Rotas liberadas no plano Free.
 * Tudo o que NÃO estiver aqui mostra o overlay de upgrade.
 */
const FREE_ALLOWED_ROUTES = new Set<string>([
  "/dashboard",
  "/settings",
  "/finance",
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
  "/affiliates": "Afiliados",
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
  const { tenant, isPlanExpired } = useTenant();
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

  if (isPlanExpired) {
    return <PlanExpiredPage />;
  }

  // Bloqueio Free: rotas não-permitidas viram tela de upgrade
  const path = location.pathname;
  const isFree = !!tenant && !isPaidPlan(tenant.plan);
  
  let isLockedRoute = !FREE_ALLOWED_ROUTES.has(path);
  
  if (isFree && allowCustomization) {
    if (path === "/customization" || path === "/bot-customization") {
      isLockedRoute = false;
    }
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
