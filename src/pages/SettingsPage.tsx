import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Crown, User, HardDrive, Plug, Database, Trash2, Wallet } from "lucide-react";
import PaymentsPage from "@/pages/PaymentsPage";
import WalletPage from "@/pages/WalletPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import SettingsPlanTab from "@/components/settings/SettingsPlanTab";
import SettingsProfileTab from "@/components/settings/SettingsProfileTab";
import SettingsDiscordProfileTab from "@/components/settings/SettingsDiscordProfileTab";

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const SettingsPage = () => {
  const { tenant, tenantId, refetch: refetchTenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentTab = searchParams.get("tab") || "profile";
  const { user } = useAuth();

  useEffect(() => {
    if (searchParams.get("tab") === "pix") {
      navigate("/wallet?tab=pix", { replace: true });
    }
  }, [searchParams, navigate]);

  if (!tenant) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with gradient bg */}
      <div className="relative rounded-2xl overflow-hidden p-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/5" />
        <div className="absolute inset-0 border border-primary/10 rounded-2xl" />
        <div className="relative">
          <h1 className="font-display text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Personalize seu painel</p>
        </div>

        <Tabs value={currentTab} onValueChange={(v) => { const sp = new URLSearchParams(searchParams); sp.set("tab", v); sp.delete("section"); setSearchParams(sp, { replace: true }); }} className="relative mt-5">
          <div className="overflow-x-auto -mx-6 px-6 scrollbar-none">
            <TabsList className="bg-muted/60 backdrop-blur-sm border border-border/50 p-1 h-auto gap-1 w-max min-w-full sm:w-auto">
              <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-3 sm:px-4 py-2 text-xs sm:text-sm">
                <User className="h-4 w-4" /> Perfil
              </TabsTrigger>
              <TabsTrigger value="discord" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-3 sm:px-4 py-2 text-xs sm:text-sm">
                <DiscordIcon className="h-4 w-4 text-[#5865F2]" /> Discord & Token
              </TabsTrigger>
              <TabsTrigger value="gateways" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-3 sm:px-4 py-2 text-xs sm:text-sm">
                <Plug className="h-4 w-4" /> Gateways
              </TabsTrigger>
              <TabsTrigger value="wallet" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-3 sm:px-4 py-2 text-xs sm:text-sm">
                <Wallet className="h-4 w-4" /> Carteira
              </TabsTrigger>
              <TabsTrigger value="plan" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-3 sm:px-4 py-2 text-xs sm:text-sm">
                <Crown className="h-4 w-4" /> Plano
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-3 sm:px-4 py-2 text-xs sm:text-sm">
                <HardDrive className="h-4 w-4" /> Avançado
              </TabsTrigger>
            </TabsList>
          </div>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <SettingsProfileTab tenant={tenant} tenantId={tenantId} />
        </TabsContent>

        {/* Discord & Token Tab */}
        <TabsContent value="discord">
          <SettingsDiscordProfileTab tenant={tenant} tenantId={tenantId} />
        </TabsContent>

        {/* Gateways Tab — Configuração de gateways do CLIENTE (payment_providers do tenant) */}
        <TabsContent value="gateways">
          <PaymentsPage />
        </TabsContent>

        {/* Carteira Tab */}
        <TabsContent value="wallet">
          <WalletPage />
        </TabsContent>

        {/* Plan Tab */}
        <TabsContent value="plan">
          <SettingsPlanTab tenant={tenant} tenantId={tenantId} refetchTenant={refetchTenant} />
        </TabsContent>

        {/* Advanced Tab - Cache */}
        <TabsContent value="advanced">
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-6 sm:p-8 group">
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-[80px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
              
              <div className="relative z-10">
                <div className="mb-6">
                  <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Database className="h-5 w-5 text-indigo-400" />
                    Limpeza de Cache
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Resolva conflitos de dados, sessões obsoletas ou bugs visuais limpando o cache do navegador.</p>
                </div>

                <div className="space-y-3">
                  {/* Clear drafts */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-white/5 bg-background/40 hover:bg-background/60 hover:border-white/10 transition-all p-4 shadow-sm hover:shadow">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-inner shrink-0">
                        <Trash2 className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Limpar Rascunhos</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Remove rascunhos salvos localmente (formulários não enviados)</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="shrink-0 bg-background/50 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20 transition-colors"
                      onClick={() => {
                        const keysToRemove: string[] = [];
                        for (let i = 0; i < localStorage.length; i++) {
                          const key = localStorage.key(i);
                          if (key && key.startsWith("draft:")) keysToRemove.push(key);
                        }
                        keysToRemove.forEach(k => localStorage.removeItem(k));
                        toast({ title: `${keysToRemove.length} rascunho(s) removido(s) ✅` });
                      }}
                    >
                      Limpar
                    </Button>
                  </div>

                  {/* Clear tenant cache */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-white/5 bg-background/40 hover:bg-background/60 hover:border-white/10 transition-all p-4 shadow-sm hover:shadow">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-inner shrink-0">
                        <Database className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Limpar Cache do Servidor</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Remove dados em cache do servidor/tenant atual</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="shrink-0 bg-background/50 hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20 transition-colors"
                      onClick={() => {
                        const keysToRemove: string[] = [];
                        for (let i = 0; i < localStorage.length; i++) {
                          const key = localStorage.key(i);
                          if (key && tenantId && key.includes(tenantId)) keysToRemove.push(key);
                        }
                        keysToRemove.forEach(k => localStorage.removeItem(k));
                        toast({ title: `Cache do servidor limpo (${keysToRemove.length} itens) ✅` });
                      }}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>





      </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;