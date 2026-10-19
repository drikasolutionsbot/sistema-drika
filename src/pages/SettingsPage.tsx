import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Upload, Users, Crown, QrCode, Loader2, Copy, CheckCircle2, UserPlus, Sparkles, Zap, Shield, HelpCircle, ChevronDown, User, Bot, Palette, LayoutTemplate, Trash2, Database, HardDrive, Plug, Wallet } from "lucide-react";
import PaymentsPage from "@/pages/PaymentsPage";
import WalletPage from "@/pages/WalletPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useTenant } from "@/contexts/TenantContext";
import PixGeneratorDialog from "@/components/pix/PixGeneratorDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import SettingsPlanTab from "@/components/settings/SettingsPlanTab";
import SettingsProfileTab from "@/components/settings/SettingsProfileTab";
import SettingsDiscordProfileTab from "@/components/settings/SettingsDiscordProfileTab";

import EmbedBuilder from "@/components/customization/EmbedBuilder";

import SettingsBotCustomizationTab from "@/components/settings/SettingsBotCustomizationTab";
import abacatePayIcon from "@/assets/abacatepay-icon.png";
import misticPayIcon from "@/assets/misticpay-icon.png";
import efiIcon from "@/assets/efi-icon.png";
import mercadoPagoIcon from "@/assets/mercadopago-icon.png";
import pushinPayIcon from "@/assets/pushinpay-icon.png";

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const PROVIDER_META: Record<string, { name: string; icon: string }> = {
  abacatepay: { name: "AbacatePay", icon: abacatePayIcon },
  misticpay: { name: "Mistic Pay", icon: misticPayIcon },
  efi: { name: "Efí", icon: efiIcon },
  mercadopago: { name: "Mercado Pago", icon: mercadoPagoIcon },
  pushinpay: { name: "PushinPay", icon: pushinPayIcon },
};

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  profiles: { discord_username: string | null; avatar_url: string | null } | null;
}

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave Aleatória" },
];

const SettingsPage = () => {
  const { tenant, tenantId, refetch: refetchTenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentTab = searchParams.get("tab") || "profile";
  const { user } = useAuth();

  useEffect(() => {
    if (searchParams.get("tab") === "wallet") {
      navigate("/wallet", { replace: true });
    }
  }, [searchParams, navigate]);

  // PIX state with draft persistence
  const [savingPix, setSavingPix] = useState(false);
  const [editingPix, setEditingPix] = useState(false);

  const pixStorageKey = tenantId ? `draft:${tenantId}:pix-config` : null;
  const pixInitialized = useRef(false);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("");

  // Initialize PIX from localStorage or tenant
  useEffect(() => {
    if (!tenant || pixInitialized.current) return;
    pixInitialized.current = true;
    try {
      const saved = pixStorageKey ? localStorage.getItem(pixStorageKey) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        setPixKey(parsed.pixKey || "");
        setPixKeyType(parsed.pixKeyType || "");
      } else {
        setPixKey(tenant.pix_key || "");
        setPixKeyType(tenant.pix_key_type || "");
      }
    } catch {
      setPixKey(tenant.pix_key || "");
      setPixKeyType(tenant.pix_key_type || "");
    }
    setEditingPix(false);
  }, [tenant?.pix_key, tenant?.pix_key_type, pixStorageKey]);

  // Auto-save PIX draft
  useEffect(() => {
    if (!pixStorageKey || !pixInitialized.current) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(pixStorageKey, JSON.stringify({ pixKey, pixKeyType })); } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [pixKey, pixKeyType, pixStorageKey]);

  const clearPixDraft = useCallback(() => {
    if (pixStorageKey) localStorage.removeItem(pixStorageKey);
  }, [pixStorageKey]);

  const { data: userRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await (supabase as any)
        .from("user_roles")
        .select("id, user_id, role, profiles:user_id(discord_username, avatar_url)")
        .eq("tenant_id", tenantId);
      return (data ?? []) as UserRole[];
    },
    enabled: !!tenantId,
  });

  // Payment providers for this tenant (via edge function to bypass RLS for token auth)
  const { data: providers = [], isLoading: providersLoading, refetch: refetchProviders } = useQuery({
    queryKey: ["payment-providers", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.functions.invoke("manage-payment-providers", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });




  const handleSavePix = async () => {
    if (!tenantId) return;
    setSavingPix(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            pix_key: pixKey.trim() || null,
            pix_key_type: pixKeyType || null,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      clearPixDraft();
      toast({ title: "Chave PIX salva com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSavingPix(false);
    }
  };

  const toggleProvider = async (providerId: string, currentActive: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-payment-providers", {
        body: { action: "toggle", tenant_id: tenantId, provider_id: providerId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      refetchProviders();
    } catch (err: any) {
      toast({ title: "Erro ao alternar gateway", description: err.message, variant: "destructive" });
    }
  };

  const copyPixKey = () => {
    if (pixKey) {
      navigator.clipboard.writeText(pixKey);
      toast({ title: "Chave PIX copiada!" });
    }
  };

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
              <TabsTrigger value="pix" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-3 sm:px-4 py-2 text-xs sm:text-sm">
                <QrCode className="h-4 w-4" /> PIX
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

        {/* Wallet Tab */}
        <TabsContent value="wallet">
          <WalletPage />
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <SettingsProfileTab tenant={tenant} tenantId={tenantId} />
        </TabsContent>

        {/* Discord & Token Tab */}
        <TabsContent value="discord">
          <SettingsDiscordProfileTab tenant={tenant} tenantId={tenantId} />
        </TabsContent>

        {/* PIX Tab */}
        <TabsContent value="pix">
          <div className="space-y-6">
            {/* Static PIX Key */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-6 group">
              {/* Decorative Background Glow */}
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-full blur-[60px] pointer-events-none transition-opacity duration-700 opacity-50 group-hover:opacity-100" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center justify-center h-14 w-14 rounded-2xl shadow-inner border bg-pink-500/10 border-pink-500/20 text-pink-500 shrink-0">
                    <QrCode className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-foreground">Chave PIX Estática</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Usada para gerar QR Code e copia e cola manualmente</p>
                  </div>
                </div>

                {/* Como funciona (Accordion moderno) */}
                <details className="group/details rounded-xl border border-border/50 bg-background/50 hover:bg-background/80 transition-colors overflow-hidden mb-6 shadow-sm">
                  <summary className="flex items-center gap-2 px-5 py-3.5 cursor-pointer select-none text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                    Como funciona o PIX Estático?
                    <ChevronDown className="h-4 w-4 ml-auto transition-transform group-open/details:rotate-180" />
                  </summary>
                  <div className="px-5 pb-5 space-y-3.5 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-4 bg-muted/20">
                    <p>
                      Com o <span className="text-foreground font-semibold">PIX Estático</span>, um QR Code é gerado para cada pedido usando sua chave. O cliente escaneia e paga normalmente.
                    </p>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                      <p><span className="text-foreground font-semibold">Entregas automáticas</span> — o estoque será enviado assim que você aprovar o pagamento (se configurado).</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Shield className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                      <p><span className="text-foreground font-semibold">Aprovação manual</span> — a confirmação do pagamento é feita manualmente pela aba <span className="text-foreground font-semibold">Aprovações</span> ou Discord.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <p><span className="text-foreground font-semibold">Quer aprovação automática?</span> — configure um Gateway de Pagamento na seção abaixo para webhooks instantâneos.</p>
                    </div>
                  </div>
                </details>

                {/* Active PIX display */}
                {tenant?.pix_key && tenant?.pix_key_type && !editingPix ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 shadow-sm">
                      <div className="p-2 rounded-full bg-emerald-500/20 shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-400">Chave PIX ativa</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {PIX_KEY_TYPES.find(t => t.value === tenant.pix_key_type)?.label || tenant.pix_key_type}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-background/50 border border-border/50 px-5 py-4 shadow-sm">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Chave cadastrada</p>
                      <div className="flex items-center gap-3">
                        <p className="font-mono text-sm sm:text-base text-foreground font-medium flex-1 truncate bg-muted/50 px-3 py-1.5 rounded-md border border-border/50">{tenant.pix_key}</p>
                        <Button type="button" size="icon" variant="secondary" onClick={copyPixKey} title="Copiar" className="h-9 w-9 shrink-0 shadow-sm hover:shadow">
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button
                        onClick={() => setEditingPix(true)}
                        variant="outline"
                        className="bg-background/50 shadow-sm hover:shadow transition-all"
                      >
                        Editar chave
                      </Button>
                      <Button
                        onClick={async () => {
                          setSavingPix(true);
                          try {
                            const { data: d, error: e } = await supabase.functions.invoke("update-tenant", {
                              body: { tenant_id: tenantId, updates: { pix_key: null, pix_key_type: null } },
                            });
                            if (e) throw e;
                            if (d?.error) throw new Error(d.error);
                            await refetchTenant();
                            toast({ title: "Chave PIX desativada" });
                          } catch (err: any) {
                            toast({ title: "Erro", description: err.message, variant: "destructive" });
                          } finally {
                            setSavingPix(false);
                          }
                        }}
                        disabled={savingPix}
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 shadow-sm"
                      >
                        Desativar
                      </Button>
                      <PixGeneratorDialog
                        trigger={
                          <Button variant="outline" className="bg-background/50 shadow-sm hover:shadow transition-all">
                            <QrCode className="h-4 w-4 mr-2 text-primary" /> Testar QR Code
                          </Button>
                        }
                      />
                    </div>
                  </div>
                ) : (
                  /* Edit / Create form */
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                    <div className="grid gap-5 sm:grid-cols-2 bg-background/30 p-5 rounded-xl border border-border/50 shadow-sm">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Chave</Label>
                        <Select value={pixKeyType} onValueChange={setPixKeyType}>
                          <SelectTrigger className="bg-background/80 border-border/60 focus:ring-primary/20 shadow-sm h-11">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {PIX_KEY_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chave PIX</Label>
                        <Input
                          value={pixKey}
                          onChange={e => setPixKey(e.target.value)}
                          placeholder={
                            pixKeyType === "cpf" ? "000.000.000-00" :
                            pixKeyType === "cnpj" ? "00.000.000/0000-00" :
                            pixKeyType === "email" ? "email@exemplo.com" :
                            pixKeyType === "telefone" ? "+5511999999999" :
                            "Cole sua chave aleatória"
                          }
                          className="bg-background/80 border-border/60 font-mono text-sm focus:ring-primary/20 shadow-sm h-11"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={handleSavePix}
                        disabled={savingPix || !pixKey.trim() || !pixKeyType}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all h-11 px-6"
                      >
                        {savingPix && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Salvar Chave PIX
                      </Button>
                      {editingPix && (
                        <Button
                          onClick={() => {
                            setPixKey(tenant?.pix_key || "");
                            setPixKeyType(tenant?.pix_key_type || "");
                            setEditingPix(false);
                          }}
                          variant="outline"
                          className="h-11 shadow-sm"
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Gateways */}
            <div className="wallet-section">
              <div className="wallet-section-header mb-5">
                <div className="wallet-section-icon">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-foreground font-display font-semibold text-sm">Gateways de Pagamento</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Ative gateways para gerar PIX dinâmico com valor e expiração automáticos</p>
                </div>
              </div>

              {providersLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
              ) : providers.length === 0 ? (
                <div className="rounded-xl bg-muted/50 border border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Nenhum gateway configurado ainda.</p>
                  <p className="text-xs text-muted-foreground/60">
                    Configure seus gateways na página de{" "}
                    <a href="/payments" className="text-primary hover:underline">Pagamentos</a>
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {providers.map(p => (
                    <div key={p.id} className="wallet-tx-row">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted overflow-hidden">
                          {PROVIDER_META[p.provider_key]?.icon ? (
                            <img src={PROVIDER_META[p.provider_key].icon} alt={PROVIDER_META[p.provider_key].name} className="h-7 w-7 object-contain" />
                          ) : (
                            <span className="text-xs font-bold uppercase text-muted-foreground">{p.provider_key.slice(0, 2)}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{PROVIDER_META[p.provider_key]?.name ?? p.provider_key.replace(/_/g, " ")}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {p.api_key_encrypted ? "Credenciais configuradas" : "Sem credenciais"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`wallet-tx-badge ${p.active ? "completed" : "pending"}`}>
                          {p.active ? "Ativo" : "Inativo"}
                        </span>
                        <Switch
                          checked={p.active}
                          onCheckedChange={() => toggleProvider(p.id, p.active)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <a
                href="/payments"
                className="flex items-center justify-center gap-2 mt-4 rounded-xl border border-dashed border-border bg-muted/30 hover:bg-muted/60 transition-colors px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
              >
                <Zap className="h-4 w-4" />
                Configurar outros gateways
              </a>
            </div>
          </div>
        </TabsContent>


        {/* Gateways Tab — Configuração de gateways do CLIENTE (payment_providers do tenant) */}
        <TabsContent value="gateways">
          <PaymentsPage />
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