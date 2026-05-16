// DrikaHub
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
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SignupPage from "./pages/SignupPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage";
import AdminClientsPage from "./pages/admin/AdminClientsPage";
import AdminSupportPage from "./pages/admin/AdminSupportPage";
import AdminLandingConfigPage from "./pages/admin/AdminLandingConfigPage";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import AdminAuditLogsPage from "./pages/admin/AdminAuditLogsPage";
import AdminPermissionsPage from "./pages/admin/AdminPermissionsPage";
import AdminMarketplacePage from "./pages/admin/AdminMarketplacePage";
import AdminTutorialsPage from "./pages/admin/AdminTutorialsPage";
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
import BotCustomizationPage from "./pages/BotCustomizationPage";
import ResourcesPage from "./pages/ResourcesPage";
import RolesPage from "./pages/RolesPage";
import WelcomePage from "./pages/WelcomePage";
import AutomationsPage from "./pages/AutomationsPage";
import ProtectionPage from "./pages/ProtectionPage";
import ECloudPage from "./pages/ECloudPage";
import SupportPage from "./pages/SupportPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import VerificationPage from "./pages/VerificationPage";
import TermsPage from "./pages/TermsPage";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import PreviewPage from "./pages/PreviewPage";
import AIAssistantPage from "./pages/AIAssistantPage";
import TutorialsPage from "./pages/TutorialsPage";
import MarketplacePage from "./pages/MarketplacePage";
import VerifyResultPage from "./pages/VerifyResultPage";
import VerifyRedirectPage from "./pages/VerifyRedirectPage";
import GiveawaysPage from "./pages/GiveawaysPage";
import EmbedsPage from "./pages/EmbedsPage";
import AdminAffiliatesPage from "./pages/admin/AdminAffiliatesPage";
import AdminBotConfigPage from "./pages/admin/AdminBotConfigPage";
import AdminGlobalMarketplacePage from "./pages/admin/AdminGlobalMarketplacePage";
import VerifiedMembersPage from "./pages/VerifiedMembersPage";
import TranscriptPage from "./pages/TranscriptPage";
import DmTemplatesPage from "./pages/DmTemplatesPage";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const tokenSession = localStorage.getItem("token_session");
  if (loading) return <div className="flex h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!user && !tokenSession) {
    const isAdminRoute = window.location.pathname.startsWith("/admin");
    return <Navigate to={isAdminRoute ? "/admin/login" : "/login"} replace />;
  }
  return <>{children}</>;
};
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const tokenSession = localStorage.getItem("token_session");
  if (loading) return null;
  // If user has a token session, redirect to dashboard
  if (tokenSession) return <Navigate to="/dashboard" replace />;
  // If user is logged in via Supabase Auth BUT on the client login page, allow access
  // (admin might want to test token login)
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/termos" element={<TermsPage />} />
    <Route path="/verify/result" element={<VerifyResultPage />} />
    <Route path="/verify/:slug" element={<VerifyRedirectPage />} />
    <Route path="/admin/login" element={<AdminLoginPage />} />
    <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
    <Route path="/" element={<LandingPage />} />
    <Route path="/preview" element={<PreviewPage />} />
    <Route path="/transcript/:channelId" element={<TranscriptPage />} />
    <Route path="/transcript" element={<TranscriptPage />} />

    {/* Admin routes - completely separate */}
    <Route element={<ProtectedRoute><AdminProvider><AdminLayout /></AdminProvider></ProtectedRoute>}>
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/admin/pagamentos" element={<AdminPaymentsPage />} />
      <Route path="/admin/clientes" element={<AdminClientsPage />} />
      <Route path="/admin/suporte" element={<AdminSupportPage />} />
      <Route path="/admin/landing" element={<AdminLandingConfigPage />} />
      <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
      <Route path="/admin/logs" element={<AdminAuditLogsPage />} />
      <Route path="/admin/permissoes" element={<AdminPermissionsPage />} />
      <Route path="/admin/tutoriais" element={<AdminTutorialsPage />} />
      <Route path="/admin/marketplace" element={<AdminMarketplacePage />} />
      <Route path="/admin/afiliados" element={<AdminAffiliatesPage />} />
      <Route path="/admin/bot-config" element={<AdminBotConfigPage />} />
      <Route path="/admin/marketplace-global" element={<AdminGlobalMarketplacePage />} />
    </Route>

    {/* Dashboard routes */}
    <Route element={<ProtectedRoute><TenantProvider><DashboardLayout /></TenantProvider></ProtectedRoute>}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/ai-assistant" element={<AIAssistantPage />} />
      <Route path="/store" element={<StorePage />} />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/channels" element={<ChannelsPage />} />
      <Route path="/coupons" element={<CouponsPage />} />
      <Route path="/affiliates" element={<AffiliatesPage />} />
      <Route path="/payments" element={<PaymentsPage />} />
      <Route path="/tickets" element={<TicketsPage />} />
      <Route path="/finance" element={<FinancePage />} />
      <Route path="/approvals" element={<ApprovalsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/customization" element={<CustomizationPage />} />
      <Route path="/bot-customization" element={<BotCustomizationPage />} />
      <Route path="/resources" element={<ResourcesPage />} />
      <Route path="/roles" element={<RolesPage />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/automations" element={<AutomationsPage />} />
      <Route path="/protection" element={<ProtectionPage />} />
      <Route path="/verification" element={<VerificationPage />} />
      <Route path="/verified-members" element={<VerifiedMembersPage />} />
      <Route path="/ecloud" element={<ECloudPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/tutorials" element={<TutorialsPage />} />
      <Route path="/giveaways" element={<GiveawaysPage />} />
      <Route path="/embeds" element={<EmbedsPage />} />
      <Route path="/dm-templates" element={<DmTemplatesPage />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/i18n/LanguageContext";

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <LanguageProvider>
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
    </LanguageProvider>
  </ThemeProvider>
);

export default App;