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
import SignupPage from "./pages/SignupPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage";
import AdminClientsPage from "./pages/admin/AdminClientsPage";
import AdminSupportPage from "./pages/admin/AdminSupportPage";
import AdminLandingConfigPage from "./pages/admin/AdminLandingConfigPage";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import AdminAuditLogsPage from "./pages/admin/AdminAuditLogsPage";
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
import ECloudPage from "./pages/ECloudPage";
import SupportPage from "./pages/SupportPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import TermsPage from "./pages/TermsPage";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const tokenSession = sessionStorage.getItem("token_session");
  if (loading) return <div className="flex h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!user && !tokenSession) {
    const isAdminRoute = window.location.pathname.startsWith("/admin");
    return <Navigate to={isAdminRoute ? "/admin/login" : "/login"} replace />;
  }
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
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/termos" element={<TermsPage />} />
    <Route path="/admin/login" element={<AdminLoginPage />} />
    <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
    <Route path="/" element={<LandingPage />} />

    {/* Admin routes - completely separate */}
    <Route element={<ProtectedRoute><AdminProvider><AdminLayout /></AdminProvider></ProtectedRoute>}>
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/admin/pagamentos" element={<AdminPaymentsPage />} />
      <Route path="/admin/clientes" element={<AdminClientsPage />} />
      <Route path="/admin/suporte" element={<AdminSupportPage />} />
      <Route path="/admin/landing" element={<AdminLandingConfigPage />} />
      <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
      <Route path="/admin/logs" element={<AdminAuditLogsPage />} />
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
      <Route path="/approvals" element={<ApprovalsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/customization" element={<CustomizationPage />} />
      <Route path="/resources" element={<ResourcesPage />} />
      <Route path="/roles" element={<RolesPage />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/automations" element={<AutomationsPage />} />
      <Route path="/protection" element={<ProtectionPage />} />
      <Route path="/ecloud" element={<ECloudPage />} />
      <Route path="/support" element={<SupportPage />} />
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