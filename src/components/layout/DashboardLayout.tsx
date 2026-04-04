import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useTenant } from "@/contexts/TenantContext";
import PlanExpiredPage from "@/pages/PlanExpiredPage";
import ProUpgradeModal from "@/components/ProUpgradeModal";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const DashboardLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isPlanExpired } = useTenant();
  const isMobile = useIsMobile();
  const location = useLocation();

  // Global cleanup of stuck Radix UI overlays on every route change
  useEffect(() => {
    setMobileOpen(false);
    document.body.style.pointerEvents = "";
    document.body.style.overflow = "";
    document.body.removeAttribute("data-scroll-locked");
  }, [location.pathname]);

  // Safety net: periodically check for stuck body locks (every 2s)
  useEffect(() => {
    const interval = setInterval(() => {
      // If no Radix dialog is actually open but body is locked, unlock it
      const hasOpenDialog = document.querySelector("[role='dialog'][data-state='open']");
      if (!hasOpenDialog) {
        if (document.body.style.pointerEvents === "none") {
          document.body.style.pointerEvents = "";
        }
        if (document.body.hasAttribute("data-scroll-locked")) {
          document.body.style.overflow = "";
          document.body.removeAttribute("data-scroll-locked");
        }
      }
    }, 2000);
    return () => {
      clearInterval(interval);
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";
      document.body.removeAttribute("data-scroll-locked");
    };
  }, []);

  if (isPlanExpired) {
    return <PlanExpiredPage />;
  }

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
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </>
  );
};
