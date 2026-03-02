import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import StorePage from "./pages/StorePage";
import ChannelsPage from "./pages/ChannelsPage";
import CouponsPage from "./pages/CouponsPage";
import AffiliatesPage from "./pages/AffiliatesPage";
import PaymentsPage from "./pages/PaymentsPage";
import TicketsPage from "./pages/TicketsPage";
import FinancePage from "./pages/FinancePage";
import SettingsPage from "./pages/SettingsPage";
import CustomizationPage from "./pages/CustomizationPage";
import ResourcesPage from "./pages/ResourcesPage";
import RolesPage from "./pages/RolesPage";
import WelcomePage from "./pages/WelcomePage";
import AutomationsPage from "./pages/AutomationsPage";
import ProtectionPage from "./pages/ProtectionPage";
import InviteTrackingPage from "./pages/InviteTrackingPage";
import GiveawaysPage from "./pages/GiveawaysPage";
import VipsPage from "./pages/VipsPage";
import ECloudPage from "./pages/ECloudPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminTenantsPage from "./pages/admin/AdminTenantsPage";
import AdminTokensPage from "./pages/admin/AdminTokensPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    
    {/* Admin routes */}
    <Route element={<ProtectedRoute><AdminProvider><AdminLayout /></AdminProvider></ProtectedRoute>}>
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/admin/tenants" element={<AdminTenantsPage />} />
      <Route path="/admin/tokens" element={<AdminTokensPage />} />
    </Route>

    {/* Dashboard routes */}
    <Route element={<ProtectedRoute><TenantProvider><DashboardLayout /></TenantProvider></ProtectedRoute>}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/store" element={<StorePage />} />
      <Route path="/channels" element={<ChannelsPage />} />
      <Route path="/coupons" element={<CouponsPage />} />
      <Route path="/affiliates" element={<AffiliatesPage />} />
      <Route path="/payments" element={<PaymentsPage />} />
      <Route path="/tickets" element={<TicketsPage />} />
      <Route path="/finance" element={<FinancePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/customization" element={<CustomizationPage />} />
      <Route path="/resources" element={<ResourcesPage />} />
      <Route path="/roles" element={<RolesPage />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/automations" element={<AutomationsPage />} />
      <Route path="/protection" element={<ProtectionPage />} />
      <Route path="/invite-tracking" element={<InviteTrackingPage />} />
      <Route path="/giveaways" element={<GiveawaysPage />} />
      <Route path="/vips" element={<VipsPage />} />
      <Route path="/ecloud" element={<ECloudPage />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;