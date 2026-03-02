import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import StorePage from "./pages/StorePage";
import ChannelsPage from "./pages/ChannelsPage";
import CouponsPage from "./pages/CouponsPage";
import AffiliatesPage from "./pages/AffiliatesPage";
import PaymentsPage from "./pages/PaymentsPage";
import TicketsPage from "./pages/TicketsPage";
import FinancePage from "./pages/FinancePage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/store" element={<StorePage />} />
            <Route path="/channels" element={<ChannelsPage />} />
            <Route path="/coupons" element={<CouponsPage />} />
            <Route path="/affiliates" element={<AffiliatesPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
